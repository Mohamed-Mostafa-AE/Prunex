#pragma once

#include <algorithm>
#include <array>
#include <bit>
#include <cstdint>
#include <cmath>
#include <fstream>
#include <string>
#include <utility>
#include <vector>

namespace prunex {

namespace nnue_detail {

inline std::int64_t dotProductScalar(
    const std::int8_t* weights,
    const std::uint8_t* activations,
    std::size_t count
) noexcept {
    std::int64_t sum = 0;
    for (std::size_t index = 0; index < count; ++index) {
        sum += static_cast<std::int64_t>(weights[index]) * activations[index];
    }
    return sum;
}

#if defined(PRUNEX_RUNTIME_BMI2_DISPATCH)
__attribute__((target("avx2")))
inline std::int64_t dotProductAvx2(
    const std::int8_t* weights,
    const std::uint8_t* activations,
    std::size_t count
) noexcept {
    const __m256i pairOnes = _mm256_set1_epi16(1);
    __m256i accumulated = _mm256_setzero_si256();
    std::size_t index = 0;

    for (; index + 32 <= count; index += 32) {
        const auto activationBlock = _mm256_loadu_si256(
            reinterpret_cast<const __m256i*>(activations + index)
        );
        const auto weightBlock = _mm256_loadu_si256(
            reinterpret_cast<const __m256i*>(weights + index)
        );
        const __m256i products16 = _mm256_maddubs_epi16(
            activationBlock, weightBlock
        );
        const __m256i products32 = _mm256_madd_epi16(
            products16, pairOnes
        );
        accumulated = _mm256_add_epi32(accumulated, products32);
    }

    alignas(32) std::array<std::int32_t, 8> lanes{};
    _mm256_store_si256(reinterpret_cast<__m256i*>(lanes.data()), accumulated);

    std::int64_t sum = 0;
    for (const std::int32_t lane : lanes) sum += lane;
    for (; index < count; ++index) {
        sum += static_cast<std::int64_t>(weights[index]) * activations[index];
    }
    return sum;
}

inline bool avx2Available() noexcept {
    static const bool supported = [] {
        __builtin_cpu_init();
        return __builtin_cpu_supports("avx2");
    }();
    return supported;
}
#else
inline bool avx2Available() noexcept {
    return false;
}
#endif

inline std::int64_t dotProduct(
    const std::int8_t* weights,
    const std::uint8_t* activations,
    std::size_t count
) noexcept {
#if defined(PRUNEX_RUNTIME_BMI2_DISPATCH)
    if (avx2Available()) return dotProductAvx2(weights, activations, count);
#endif
    return dotProductScalar(weights, activations, count);
}

inline void addScaledInt8RowScalar(
    std::int32_t* accumulator,
    const std::int8_t* weights,
    std::size_t count,
    int direction
) noexcept {
    for (std::size_t index = 0; index < count; ++index) {
        accumulator[index] += direction * static_cast<std::int32_t>(weights[index]);
    }
}

#if defined(PRUNEX_RUNTIME_BMI2_DISPATCH)
__attribute__((target("avx2")))
inline void addScaledInt8RowAvx2(
    std::int32_t* accumulator,
    const std::int8_t* weights,
    std::size_t count,
    int direction
) noexcept {
    std::size_t index = 0;
    for (; index + 8 <= count; index += 8) {
        const __m128i weightBytes = _mm_loadl_epi64(
            reinterpret_cast<const __m128i*>(weights + index)
        );
        const __m256i weightValues = _mm256_cvtepi8_epi32(weightBytes);
        const __m256i currentValues = _mm256_loadu_si256(
            reinterpret_cast<const __m256i*>(accumulator + index)
        );
        const __m256i updatedValues = direction > 0
            ? _mm256_add_epi32(currentValues, weightValues)
            : _mm256_sub_epi32(currentValues, weightValues);
        _mm256_storeu_si256(
            reinterpret_cast<__m256i*>(accumulator + index), updatedValues
        );
    }

    for (; index < count; ++index) {
        accumulator[index] += direction
            * static_cast<std::int32_t>(weights[index]);
    }
}
#endif

inline void addScaledInt8Row(
    std::int32_t* accumulator,
    const std::int8_t* weights,
    std::size_t count,
    int direction
) noexcept {
#if defined(PRUNEX_RUNTIME_BMI2_DISPATCH)
    if (avx2Available()) {
        addScaledInt8RowAvx2(accumulator, weights, count, direction);
        return;
    }
#endif
    addScaledInt8RowScalar(accumulator, weights, count, direction);
}

}  // namespace nnue_detail

class NnueNetwork {
public:
    static constexpr std::uint32_t FEATURE_COUNT = 40960;
    static constexpr std::uint32_t FILE_VERSION = 1;
    static constexpr std::uint32_t MAX_HIDDEN = NNUE_MAX_HIDDEN;
    static constexpr std::uint32_t MAX_DENSE = 128;
    static constexpr std::int64_t ACTIVATION_SCALE = 127;
    static constexpr std::int64_t WEIGHT_SCALE = 127;
    static constexpr std::int64_t DENSE_SCALE =
        ACTIVATION_SCALE * WEIGHT_SCALE;

    bool loaded() const noexcept {
        return loaded_;
    }

    std::uint64_t generation() const noexcept {
        return generation_;
    }

    bool canUpdate(const Position& position) const noexcept {
        return loaded_ && position.nnue.valid
            && position.nnue.generation == generation_;
    }

    void clear() noexcept {
        ++generation_;
        loaded_ = false;
        hidden_ = 0;
        dense1_ = 0;
        dense2_ = 0;
        scoreScale_ = 400.0F;
        featureWeights_.clear();
        featureBias_.clear();
        dense1Weights_.clear();
        dense1Bias_.clear();
        dense2Weights_.clear();
        dense2Bias_.clear();
        outputWeights_.clear();
        outputBias_ = 0;
    }

    bool load(const std::string& path) {
        std::ifstream input(path, std::ios::binary);
        if (!input) return false;

        std::array<char, 8> magic{};
        std::uint32_t version = 0;
        std::uint32_t featureCount = 0;
        std::uint32_t hidden = 0;
        std::uint32_t dense1 = 0;
        std::uint32_t dense2 = 0;
        float scoreScale = 0.0F;

        input.read(magic.data(), static_cast<std::streamsize>(magic.size()));
        input.read(reinterpret_cast<char*>(&version), sizeof(version));
        input.read(reinterpret_cast<char*>(&featureCount), sizeof(featureCount));
        input.read(reinterpret_cast<char*>(&hidden), sizeof(hidden));
        input.read(reinterpret_cast<char*>(&dense1), sizeof(dense1));
        input.read(reinterpret_cast<char*>(&dense2), sizeof(dense2));
        input.read(reinterpret_cast<char*>(&scoreScale), sizeof(scoreScale));

        constexpr std::array<char, 8> expectedMagic{
            'P', 'R', 'U', 'N', 'E', 'X', 'Q', '1'
        };
        if (!input || magic != expectedMagic || version != FILE_VERSION
            || featureCount != FEATURE_COUNT
            || hidden < 8 || hidden > MAX_HIDDEN
            || dense1 < 4 || dense1 > MAX_DENSE
            || dense2 < 4 || dense2 > MAX_DENSE
            || !std::isfinite(scoreScale) || scoreScale < 50.0F
            || scoreScale > 2000.0F) {
            return false;
        }

        NnueNetwork replacement;
        replacement.hidden_ = hidden;
        replacement.dense1_ = dense1;
        replacement.dense2_ = dense2;
        replacement.scoreScale_ = scoreScale;

        const std::size_t inputWidth = static_cast<std::size_t>(hidden) * 2;
        if (!readValues(input, replacement.featureWeights_,
                        static_cast<std::size_t>(FEATURE_COUNT) * hidden)
            || !readValues(input, replacement.featureBias_, hidden)
            || !readValues(input, replacement.dense1Weights_,
                           static_cast<std::size_t>(dense1) * inputWidth)
            || !readValues(input, replacement.dense1Bias_, dense1)
            || !readValues(input, replacement.dense2Weights_,
                           static_cast<std::size_t>(dense2) * dense1)
            || !readValues(input, replacement.dense2Bias_, dense2)
            || !readValues(input, replacement.outputWeights_, dense2)) {
            return false;
        }

        input.read(reinterpret_cast<char*>(&replacement.outputBias_),
                   sizeof(replacement.outputBias_));
        if (!input || input.peek() != std::char_traits<char>::eof()) {
            return false;
        }

        replacement.loaded_ = true;
        replacement.generation_ = generation_ + 1;
        *this = std::move(replacement);
        return true;
    }

    void rebuildAccumulator(Position& position) const noexcept {
        if (!loaded_) {
            position.nnue.valid = false;
            return;
        }

        refreshPerspective(position, WHITE);
        refreshPerspective(position, BLACK);
        position.nnue.generation = generation_;
        position.nnue.valid = true;
    }

    void refreshPerspective(Position& position, int perspective) const noexcept {
        auto& accumulator = position.nnue.values[perspective];
        const std::uint64_t kingBits = position.piecesBB[perspective][6];
        if (kingBits == 0) {
            accumulator.fill(0);
            return;
        }

        for (std::uint32_t index = 0; index < hidden_; ++index) {
            accumulator[index] = featureBias_[index];
        }

        const int rawKingSquare = static_cast<int>(std::countr_zero(kingBits));
        const int kingSquare = perspective == WHITE
            ? rawKingSquare : rawKingSquare ^ 56;
        for (int color = WHITE; color <= BLACK; ++color) {
            for (int type = 1; type <= 5; ++type) {
                std::uint64_t pieces = position.piecesBB[color][type];
                while (pieces != 0) {
                    const int square = static_cast<int>(std::countr_zero(pieces));
                    pieces &= pieces - 1;
                    const int orientedPiece = perspective == WHITE
                        ? square : square ^ 56;
                    const int relativeColor = color == perspective ? 0 : 1;
                    const int feature = halfKpIndex(
                        kingSquare, orientedPiece, type - 1, relativeColor
                    );
                    updateFeature(accumulator, feature, 1);
                }
            }
        }
    }

    void addPieceFeature(Position& position, int piece, int square88) const noexcept {
        updatePieceFeature(position, piece, square88, 1);
    }

    void removePieceFeature(Position& position, int piece, int square88) const noexcept {
        updatePieceFeature(position, piece, square88, -1);
    }

    int evaluate(Position& position) const noexcept {
        if (!loaded_) return 0;
        if (!canUpdate(position)) rebuildAccumulator(position);

        if (position.piecesBB[WHITE][6] == 0
            || position.piecesBB[BLACK][6] == 0) {
            return 0;
        }

        std::array<std::uint8_t, MAX_HIDDEN * 2> input{};
        const auto& firstPerspective = position.nnue.values[position.side];
        const auto& secondPerspective = position.nnue.values[1 - position.side];
        for (std::uint32_t index = 0; index < hidden_; ++index) {
            input[index] = static_cast<std::uint8_t>(
                clipActivation(firstPerspective[index])
            );
            input[hidden_ + index] = static_cast<std::uint8_t>(
                clipActivation(secondPerspective[index])
            );
        }

        std::array<std::uint8_t, MAX_DENSE> firstLayer{};
        for (std::uint32_t row = 0; row < dense1_; ++row) {
            const std::size_t offset = static_cast<std::size_t>(row) * inputWidth();
            const std::int64_t value = dense1Bias_[row]
                + nnue_detail::dotProduct(
                    dense1Weights_.data() + offset, input.data(), inputWidth()
                );
            firstLayer[row] = static_cast<std::uint8_t>(clipDense(value));
        }

        std::array<std::uint8_t, MAX_DENSE> secondLayer{};
        for (std::uint32_t row = 0; row < dense2_; ++row) {
            const std::size_t offset = static_cast<std::size_t>(row) * dense1_;
            const std::int64_t value = dense2Bias_[row]
                + nnue_detail::dotProduct(
                    dense2Weights_.data() + offset, firstLayer.data(), dense1_
                );
            secondLayer[row] = static_cast<std::uint8_t>(clipDense(value));
        }

        const std::int64_t output = outputBias_
            + nnue_detail::dotProduct(
                outputWeights_.data(), secondLayer.data(), dense2_
            );

        const double score = static_cast<double>(output) * scoreScale_
            / static_cast<double>(DENSE_SCALE);
        return static_cast<int>(std::clamp(
            std::llround(score), -20000LL, 20000LL
        ));
    }

private:
    static int halfKpIndex(int kingSquare, int pieceSquare,
                           int pieceType, int relativeColor) noexcept {
        return pieceSquare
            + (pieceType * 2 + relativeColor + kingSquare * 10) * 64;
    }

    static std::int32_t clipActivation(std::int32_t value) noexcept {
        return std::clamp<std::int32_t>(value, 0, 127);
    }

    static std::int32_t clipDense(std::int64_t value) noexcept {
        if (value <= 0) return 0;
        if (value >= DENSE_SCALE) return 127;
        return static_cast<std::int32_t>(
            (value + ACTIVATION_SCALE / 2) / ACTIVATION_SCALE
        );
    }

    std::size_t inputWidth() const noexcept {
        return static_cast<std::size_t>(hidden_) * 2;
    }

    static int square64FromMailbox(int square88) noexcept {
        return (square88 >> 4) * 8 + (square88 & 7);
    }

    void updateFeature(
        std::array<std::int32_t, NNUE_MAX_HIDDEN>& accumulator,
        int featureIndex,
        int direction
    ) const noexcept {
        const std::size_t offset =
            static_cast<std::size_t>(featureIndex) * hidden_;
        nnue_detail::addScaledInt8Row(
            accumulator.data(), featureWeights_.data() + offset, hidden_, direction
        );
    }

    void updatePieceFeature(
        Position& position,
        int piece,
        int square88,
        int direction
    ) const noexcept {
        if (!canUpdate(position) || piece == EMPTY) return;
        const int pieceType = (piece - 1) % 6 + 1;
        if (pieceType == 6) return;

        const std::uint64_t whiteKingBits = position.piecesBB[WHITE][6];
        const std::uint64_t blackKingBits = position.piecesBB[BLACK][6];
        if (whiteKingBits == 0 || blackKingBits == 0) return;

        const int square = square64FromMailbox(square88);
        const int color = piece <= WK ? WHITE : BLACK;
        const int whiteKing = static_cast<int>(std::countr_zero(whiteKingBits));
        const int blackKing = static_cast<int>(std::countr_zero(blackKingBits)) ^ 56;

        updateFeature(
            position.nnue.values[WHITE],
            halfKpIndex(whiteKing, square, pieceType - 1,
                        color == WHITE ? 0 : 1),
            direction
        );
        updateFeature(
            position.nnue.values[BLACK],
            halfKpIndex(blackKing, square ^ 56, pieceType - 1,
                        color == BLACK ? 0 : 1),
            direction
        );
    }

    template<typename Value>
    static bool readValues(std::ifstream& input, std::vector<Value>& values,
                           std::size_t count) {
        values.resize(count);
        const auto bytes = static_cast<std::streamsize>(count * sizeof(Value));
        input.read(reinterpret_cast<char*>(values.data()), bytes);
        return static_cast<bool>(input);
    }

    bool loaded_ = false;
    std::uint64_t generation_ = 1;
    std::uint32_t hidden_ = 0;
    std::uint32_t dense1_ = 0;
    std::uint32_t dense2_ = 0;
    float scoreScale_ = 400.0F;
    std::vector<std::int8_t> featureWeights_;
    std::vector<std::int16_t> featureBias_;
    std::vector<std::int8_t> dense1Weights_;
    std::vector<std::int32_t> dense1Bias_;
    std::vector<std::int8_t> dense2Weights_;
    std::vector<std::int32_t> dense2Bias_;
    std::vector<std::int8_t> outputWeights_;
    std::int32_t outputBias_ = 0;
};

NnueNetwork nnueNetwork;

}  // namespace prunex
