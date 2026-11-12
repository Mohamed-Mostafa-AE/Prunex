#pragma once

#include <algorithm>
#include <array>
#include <bit>
#include <cmath>
#include <cstdint>
#include <fstream>
#include <limits>
#include <string>
#include <vector>

namespace prunex {

class NnueNetwork {
public:
    static constexpr std::uint32_t FEATURE_COUNT = 40960;
    static constexpr std::uint32_t FILE_VERSION = 1;
    static constexpr std::uint32_t MAX_HIDDEN = 256;
    static constexpr std::uint32_t MAX_DENSE = 128;

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
        outputBias_ = 0.0F;
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
            'P', 'R', 'U', 'N', 'E', 'X', 'N', '1'
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
        if (!readFloats(input, replacement.featureWeights_,
                        static_cast<std::size_t>(FEATURE_COUNT) * hidden)
            || !readFloats(input, replacement.featureBias_, hidden)
            || !readFloats(input, replacement.dense1Weights_,
                           static_cast<std::size_t>(dense1) * inputWidth)
            || !readFloats(input, replacement.dense1Bias_, dense1)
            || !readFloats(input, replacement.dense2Weights_,
                           static_cast<std::size_t>(dense2) * dense1)
            || !readFloats(input, replacement.dense2Bias_, dense2)
            || !readFloats(input, replacement.outputWeights_, dense2)) {
            return false;
        }

        input.read(reinterpret_cast<char*>(&replacement.outputBias_),
                   sizeof(replacement.outputBias_));
        if (!input || input.peek() != std::char_traits<char>::eof()
            || !std::isfinite(replacement.outputBias_)
            || !allFinite(replacement.featureWeights_)
            || !allFinite(replacement.featureBias_)
            || !allFinite(replacement.dense1Weights_)
            || !allFinite(replacement.dense1Bias_)
            || !allFinite(replacement.dense2Weights_)
            || !allFinite(replacement.dense2Bias_)
            || !allFinite(replacement.outputWeights_)) {
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

        std::array<float, MAX_HIDDEN> whiteAccumulator{};
        std::array<float, MAX_HIDDEN> blackAccumulator{};
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
                    const int whiteFeature = halfKpIndex(
                        whiteKing, square, type - 1, whitePieceColor
                    );
                    addFeature(whiteAccumulator, whiteFeature);

                    const int blackPieceColor = color == BLACK ? 0 : 1;
                    const int blackFeature = halfKpIndex(
                        blackKing, square ^ 56, type - 1, blackPieceColor
                    );
                    addFeature(blackAccumulator, blackFeature);
                }
            }
        }

        std::array<float, MAX_HIDDEN * 2> input{};
        const auto& firstPerspective =
            position.side == WHITE ? whiteAccumulator : blackAccumulator;
        const auto& secondPerspective =
            position.side == WHITE ? blackAccumulator : whiteAccumulator;
        for (std::uint32_t index = 0; index < hidden_; ++index) {
            input[index] = clip(firstPerspective[index]);
            input[hidden_ + index] = clip(secondPerspective[index]);
        }

        std::array<float, MAX_DENSE> firstLayer{};
        for (std::uint32_t row = 0; row < dense1_; ++row) {
            float value = dense1Bias_[row];
            const std::size_t offset = static_cast<std::size_t>(row) * hidden_ * 2;
            for (std::uint32_t column = 0; column < hidden_ * 2; ++column) {
                value += dense1Weights_[offset + column] * input[column];
            }
            firstLayer[row] = clip(value);
        }

        std::array<float, MAX_DENSE> secondLayer{};
        for (std::uint32_t row = 0; row < dense2_; ++row) {
            float value = dense2Bias_[row];
            const std::size_t offset = static_cast<std::size_t>(row) * dense1_;
            for (std::uint32_t column = 0; column < dense1_; ++column) {
                value += dense2Weights_[offset + column] * firstLayer[column];
            }
            secondLayer[row] = clip(value);
        }

        float score = outputBias_;
        for (std::uint32_t index = 0; index < dense2_; ++index) {
            score += outputWeights_[index] * secondLayer[index];
        }

        const float bounded = std::clamp(score * scoreScale_, -20000.0F, 20000.0F);
        return static_cast<int>(std::lround(bounded));
    }

private:
    static int halfKpIndex(int kingSquare, int pieceSquare,
                           int pieceType, int relativeColor) noexcept {
        return pieceSquare
            + (pieceType * 2 + relativeColor + kingSquare * 10) * 64;
    }

    static float clip(float value) noexcept {
        return std::clamp(value, 0.0F, 1.0F);
    }

    void addFeature(std::array<float, MAX_HIDDEN>& accumulator,
                    int featureIndex) const noexcept {
        const std::size_t offset =
            static_cast<std::size_t>(featureIndex) * hidden_;
        for (std::uint32_t index = 0; index < hidden_; ++index) {
            accumulator[index] += featureWeights_[offset + index];
        }
    }

    static bool readFloats(std::ifstream& input, std::vector<float>& values,
                           std::size_t count) {
        values.resize(count);
        const auto bytes = static_cast<std::streamsize>(count * sizeof(float));
        input.read(reinterpret_cast<char*>(values.data()), bytes);
        return static_cast<bool>(input);
    }

    static bool allFinite(const std::vector<float>& values) noexcept {
        return std::all_of(values.begin(), values.end(),
                           [](float value) { return std::isfinite(value); });
    }

    bool loaded_ = false;
    std::uint32_t hidden_ = 0;
    std::uint32_t dense1_ = 0;
    std::uint32_t dense2_ = 0;
    float scoreScale_ = 400.0F;
    std::vector<float> featureWeights_;
    std::vector<float> featureBias_;
    std::vector<float> dense1Weights_;
    std::vector<float> dense1Bias_;
    std::vector<float> dense2Weights_;
    std::vector<float> dense2Bias_;
    std::vector<float> outputWeights_;
    float outputBias_ = 0.0F;
};

NnueNetwork nnueNetwork;

}  // namespace prunex
