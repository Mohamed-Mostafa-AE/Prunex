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

class NnueNetwork {
public:
    static constexpr std::uint32_t FEATURE_COUNT = 40960;
    static constexpr std::uint32_t FILE_VERSION = 1;
    static constexpr std::uint32_t MAX_HIDDEN = 256;
    static constexpr std::uint32_t MAX_DENSE = 128;
    static constexpr std::int64_t ACTIVATION_SCALE = 127;
    static constexpr std::int64_t WEIGHT_SCALE = 127;
    static constexpr std::int64_t DENSE_SCALE =
        ACTIVATION_SCALE * WEIGHT_SCALE;

    bool loaded() const noexcept {
        return loaded_;
    }

    void clear() noexcept {
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
        *this = std::move(replacement);
        return true;
    }

    int evaluate(const Position& position) const noexcept {
        if (!loaded_) return 0;

        const auto whiteKingBits = position.piecesBB[WHITE][6];
        const auto blackKingBits = position.piecesBB[BLACK][6];
        if (whiteKingBits == 0 || blackKingBits == 0) return 0;

        const int whiteKing = static_cast<int>(std::countr_zero(whiteKingBits));
        const int blackKing = static_cast<int>(std::countr_zero(blackKingBits)) ^ 56;

        std::array<std::int32_t, MAX_HIDDEN> whiteAccumulator{};
        std::array<std::int32_t, MAX_HIDDEN> blackAccumulator{};
        for (std::uint32_t index = 0; index < hidden_; ++index) {
            whiteAccumulator[index] = featureBias_[index];
            blackAccumulator[index] = featureBias_[index];
        }

        for (int color = WHITE; color <= BLACK; ++color) {
            for (int type = 1; type <= 5; ++type) {
                std::uint64_t pieces = position.piecesBB[color][type];
                while (pieces != 0) {
                    const int square = static_cast<int>(std::countr_zero(pieces));
                    pieces &= pieces - 1;

                    const int whitePieceColor = color == WHITE ? 0 : 1;
                    addFeature(
                        whiteAccumulator,
                        halfKpIndex(whiteKing, square, type - 1, whitePieceColor)
                    );

                    const int blackPieceColor = color == BLACK ? 0 : 1;
                    addFeature(
                        blackAccumulator,
                        halfKpIndex(blackKing, square ^ 56, type - 1, blackPieceColor)
                    );
                }
            }
        }

        std::array<std::int32_t, MAX_HIDDEN * 2> input{};
        const auto& firstPerspective =
            position.side == WHITE ? whiteAccumulator : blackAccumulator;
        const auto& secondPerspective =
            position.side == WHITE ? blackAccumulator : whiteAccumulator;
        for (std::uint32_t index = 0; index < hidden_; ++index) {
            input[index] = clipActivation(firstPerspective[index]);
            input[hidden_ + index] = clipActivation(secondPerspective[index]);
        }

        std::array<std::int32_t, MAX_DENSE> firstLayer{};
        for (std::uint32_t row = 0; row < dense1_; ++row) {
            std::int64_t value = dense1Bias_[row];
            const std::size_t offset = static_cast<std::size_t>(row) * inputWidth();
            for (std::uint32_t column = 0; column < hidden_ * 2; ++column) {
                value += static_cast<std::int64_t>(dense1Weights_[offset + column])
                    * input[column];
            }
            firstLayer[row] = clipDense(value);
        }

        std::array<std::int32_t, MAX_DENSE> secondLayer{};
        for (std::uint32_t row = 0; row < dense2_; ++row) {
            std::int64_t value = dense2Bias_[row];
            const std::size_t offset = static_cast<std::size_t>(row) * dense1_;
            for (std::uint32_t column = 0; column < dense1_; ++column) {
                value += static_cast<std::int64_t>(dense2Weights_[offset + column])
                    * firstLayer[column];
            }
            secondLayer[row] = clipDense(value);
        }

        std::int64_t output = outputBias_;
        for (std::uint32_t index = 0; index < dense2_; ++index) {
            output += static_cast<std::int64_t>(outputWeights_[index])
                * secondLayer[index];
        }

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

    void addFeature(std::array<std::int32_t, MAX_HIDDEN>& accumulator,
                    int featureIndex) const noexcept {
        const std::size_t offset =
            static_cast<std::size_t>(featureIndex) * hidden_;
        for (std::uint32_t index = 0; index < hidden_; ++index) {
            accumulator[index] += featureWeights_[offset + index];
        }
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
