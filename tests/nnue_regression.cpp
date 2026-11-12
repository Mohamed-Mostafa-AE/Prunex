#include <array>
#include <cmath>
#include <cstdint>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <string>

#define main prunex_console_entry
#include "../src/main.cpp"
#undef main

namespace {

template<typename Value>
bool writeZeros(std::ofstream& output, std::size_t count) {
    const Value zero{};
    for (std::size_t index = 0; index < count; ++index) {
        output.write(reinterpret_cast<const char*>(&zero), sizeof(zero));
        if (!output) return false;
    }
    return true;
}

bool writeNetworkFile(const std::filesystem::path& path, bool validMagic) {
    std::ofstream output(path, std::ios::binary);
    if (!output) return false;

    std::array<char, 8> magic{'P', 'R', 'U', 'N', 'E', 'X', 'Q', '1'};
    if (!validMagic) magic[0] = 'X';
    constexpr std::uint32_t version = 1;
    constexpr std::uint32_t features = 40960;
    constexpr std::uint32_t hidden = 8;
    constexpr std::uint32_t dense1 = 4;
    constexpr std::uint32_t dense2 = 4;
    constexpr float scale = 400.0F;

    output.write(magic.data(), static_cast<std::streamsize>(magic.size()));
    output.write(reinterpret_cast<const char*>(&version), sizeof(version));
    output.write(reinterpret_cast<const char*>(&features), sizeof(features));
    output.write(reinterpret_cast<const char*>(&hidden), sizeof(hidden));
    output.write(reinterpret_cast<const char*>(&dense1), sizeof(dense1));
    output.write(reinterpret_cast<const char*>(&dense2), sizeof(dense2));
    output.write(reinterpret_cast<const char*>(&scale), sizeof(scale));

    if (!writeZeros<std::int8_t>(output, static_cast<std::size_t>(features) * hidden)
        || !writeZeros<std::int16_t>(output, hidden)
        || !writeZeros<std::int8_t>(output, static_cast<std::size_t>(dense1) * hidden * 2)
        || !writeZeros<std::int32_t>(output, dense1)
        || !writeZeros<std::int8_t>(output, static_cast<std::size_t>(dense2) * dense1)
        || !writeZeros<std::int32_t>(output, dense2)
        || !writeZeros<std::int8_t>(output, dense2)) {
        return false;
    }

    const std::int32_t outputBias = validMagic ? 16129 : 0;
    output.write(reinterpret_cast<const char*>(&outputBias), sizeof(outputBias));
    output.close();
    return static_cast<bool>(output);
}


template<typename Value, std::size_t Size>
bool writeArray(std::ofstream& output, const std::array<Value, Size>& values) {
    output.write(
        reinterpret_cast<const char*>(values.data()),
        static_cast<std::streamsize>(values.size() * sizeof(Value))
    );
    return static_cast<bool>(output);
}

bool writeOverflowNetworkFile(const std::filesystem::path& path) {
    std::ofstream output(path, std::ios::binary);
    if (!output) return false;

    constexpr std::uint32_t version = 1;
    constexpr std::uint32_t features = 40960;
    constexpr std::uint32_t hidden = 8;
    constexpr std::uint32_t dense1 = 4;
    constexpr std::uint32_t dense2 = 4;
    constexpr float scale = 400.0F;
    constexpr std::size_t dense1InputWidth = hidden * 2;

    const std::array<char, 8> magic{'P', 'R', 'U', 'N', 'E', 'X', 'Q', '1'};
    output.write(magic.data(), static_cast<std::streamsize>(magic.size()));
    output.write(reinterpret_cast<const char*>(&version), sizeof(version));
    output.write(reinterpret_cast<const char*>(&features), sizeof(features));
    output.write(reinterpret_cast<const char*>(&hidden), sizeof(hidden));
    output.write(reinterpret_cast<const char*>(&dense1), sizeof(dense1));
    output.write(reinterpret_cast<const char*>(&dense2), sizeof(dense2));
    output.write(reinterpret_cast<const char*>(&scale), sizeof(scale));

    // Every active feature contributes 127 to the first accumulator. With
    // the largest legal bias this exceeds int16_t before the activation clamp.
    std::array<std::int8_t, hidden> featureRow{};
    featureRow[0] = 127;
    for (std::uint32_t feature = 0; feature < features; ++feature) {
        if (!writeArray(output, featureRow)) return false;
    }

    std::array<std::int16_t, hidden> featureBias{};
    featureBias[0] = 32767;
    if (!writeArray(output, featureBias)) return false;

    std::array<std::int8_t, dense1 * dense1InputWidth> dense1Weights{};
    dense1Weights[0] = 127;
    if (!writeArray(output, dense1Weights)) return false;
    if (!writeZeros<std::int32_t>(output, dense1)) return false;

    std::array<std::int8_t, dense2 * dense1> dense2Weights{};
    dense2Weights[0] = 127;
    if (!writeArray(output, dense2Weights)) return false;
    if (!writeZeros<std::int32_t>(output, dense2)) return false;

    std::array<std::int8_t, dense2> outputWeights{};
    outputWeights[0] = 127;
    if (!writeArray(output, outputWeights)) return false;

    constexpr std::int32_t outputBias = 0;
    output.write(reinterpret_cast<const char*>(&outputBias), sizeof(outputBias));
    output.close();
    return static_cast<bool>(output);
}


bool writeIncrementalNetworkFile(const std::filesystem::path& path) {
    std::ofstream output(path, std::ios::binary);
    if (!output) return false;

    constexpr std::uint32_t version = 1;
    constexpr std::uint32_t features = 40960;
    constexpr std::uint32_t hidden = 8;
    constexpr std::uint32_t dense1 = 4;
    constexpr std::uint32_t dense2 = 4;
    constexpr float scale = 400.0F;
    const std::array<char, 8> magic{'P', 'R', 'U', 'N', 'E', 'X', 'Q', '1'};

    output.write(magic.data(), static_cast<std::streamsize>(magic.size()));
    output.write(reinterpret_cast<const char*>(&version), sizeof(version));
    output.write(reinterpret_cast<const char*>(&features), sizeof(features));
    output.write(reinterpret_cast<const char*>(&hidden), sizeof(hidden));
    output.write(reinterpret_cast<const char*>(&dense1), sizeof(dense1));
    output.write(reinterpret_cast<const char*>(&dense2), sizeof(dense2));
    output.write(reinterpret_cast<const char*>(&scale), sizeof(scale));

    std::array<std::int8_t, hidden> featureRow{};
    for (std::uint32_t feature = 0; feature < features; ++feature) {
        featureRow[0] = static_cast<std::int8_t>(
            static_cast<int>(feature % 5) - 2
        );
        if (!writeArray(output, featureRow)) return false;
    }

    std::array<std::int16_t, hidden> featureBias{};
    featureBias[0] = 64;
    if (!writeArray(output, featureBias)) return false;

    if (!writeZeros<std::int8_t>(output, dense1 * hidden * 2)
        || !writeZeros<std::int32_t>(output, dense1)
        || !writeZeros<std::int8_t>(output, dense2 * dense1)
        || !writeZeros<std::int32_t>(output, dense2)
        || !writeZeros<std::int8_t>(output, dense2)) {
        return false;
    }

    constexpr std::int32_t outputBias = 0;
    output.write(reinterpret_cast<const char*>(&outputBias), sizeof(outputBias));
    output.close();
    return static_cast<bool>(output);
}

bool accumulatorMatchesRebuild(
    prunex::NnueNetwork& network,
    std::string_view fen,
    const std::string& uci
) {
    prunex::Position position;
    if (!prunex::loadFen(position, fen)) return false;
    (void)network.evaluate(position);
    if (!network.canUpdate(position)) return false;

    prunex::Move move;
    if (!prunex::parseUciMove(position, uci, move)) return false;
    const prunex::Undo undo = prunex::makeMove(position, move);
    if (!network.canUpdate(position)) return false;

    prunex::Position rebuilt = position;
    rebuilt.nnue.valid = false;
    (void)network.evaluate(rebuilt);
    const bool childMatches = position.nnue.values == rebuilt.nnue.values;

    prunex::undoMove(position, move, undo);
    if (!network.canUpdate(position)) return false;

    prunex::Position rebuiltParent = position;
    rebuiltParent.nnue.valid = false;
    (void)network.evaluate(rebuiltParent);
    return childMatches && position.nnue.values == rebuiltParent.nnue.values;
}

bool dotProductsMatchScalar() {
    constexpr std::array<std::size_t, 21> sizes{
        0, 1, 7, 31, 32, 33, 63, 64, 65, 127, 128,
        129, 255, 256, 257, 511, 512, 513, 1023, 1024, 1025
    };
    std::array<std::int8_t, 1025> weights{};
    std::array<std::uint8_t, 1025> activations{};

    for (const std::size_t size : sizes) {
        for (std::size_t index = 0; index < size; ++index) {
            const int weight = static_cast<int>((index * 73 + size * 19) % 255) - 127;
            weights[index] = static_cast<std::int8_t>(weight);
            activations[index] = static_cast<std::uint8_t>(
                (index * 29 + size * 11) % 128
            );
        }

        const auto expected = prunex::nnue_detail::dotProductScalar(
            weights.data(), activations.data(), size
        );
        const auto actual = prunex::nnue_detail::dotProduct(
            weights.data(), activations.data(), size
        );
        if (actual != expected) {
            std::cerr << "NNUE SIMD dot-product mismatch at width " << size
                      << ": expected " << expected << ", got " << actual << '\n';
            return false;
        }
    }
    return true;
}

}  // namespace

int main() {
    using namespace prunex;

    if (!dotProductsMatchScalar()) return 35;

    const auto directory = std::filesystem::temp_directory_path();
    const auto validPath = directory / "prunex-qat-regression.nnue";
    const auto invalidPath = directory / "prunex-qat-regression-invalid.nnue";
    const auto truncatedPath = directory / "prunex-qat-regression-truncated.nnue";
    const auto overflowPath = directory / "prunex-qat-regression-overflow.nnue";
    const auto incrementalPath = directory / "prunex-qat-regression-incremental.nnue";

    if (!writeNetworkFile(validPath, true)) return 1;
    if (!writeNetworkFile(invalidPath, false)) return 2;
    if (!writeNetworkFile(truncatedPath, true)) return 3;
    if (!writeOverflowNetworkFile(overflowPath)) return 15;
    if (!writeIncrementalNetworkFile(incrementalPath)) return 18;

    {
        std::ofstream output(truncatedPath, std::ios::binary | std::ios::trunc);
        if (!output) return 4;
        output.write("PRUNEXQ", 7);
    }

    NnueNetwork network;
    if (network.loaded()) return 5;
    if (!network.load(validPath.string())) return 6;
    if (!network.loaded()) return 7;

    Position position;
    if (!loadFen(position, START_FEN)) return 8;

    NnueNetwork overflowNetwork;
    if (!overflowNetwork.load(overflowPath.string())) {
        std::cerr << "NNUE overflow fixture could not be loaded\n";
        return 16;
    }

    Position overflowPosition;
    if (!loadFen(overflowPosition, START_FEN)) return 27;
    const int overflowScore = overflowNetwork.evaluate(overflowPosition);
    if (overflowScore != 400) {
        std::cerr << "NNUE accumulator overflow regression: expected 400, got "
                  << overflowScore << '\n';
        return 17;
    }


    if (!nnueNetwork.load(incrementalPath.string())) return 19;

    const std::string castleFen =
        "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1";
    const std::string epFen =
        "4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1";
    const std::string promotionFen =
        "4k3/P7/8/8/8/8/8/4K3 w - - 0 1";
    const std::string captureFen =
        "4k3/8/8/8/3q4/2P5/8/4K3 w - - 0 1";
    const std::string kingMoveFen =
        "4k2r/8/8/8/8/8/8/R3K3 w - - 0 1";
    const std::string blackMoveFen =
        "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";
    const std::string blackKingMoveFen =
        "4k3/8/8/8/8/8/4P3/4K3 b - - 0 1";

    if (!accumulatorMatchesRebuild(nnueNetwork, START_FEN, "e2e4")) return 20;
    if (!accumulatorMatchesRebuild(nnueNetwork, captureFen, "c3d4")) return 21;
    if (!accumulatorMatchesRebuild(nnueNetwork, kingMoveFen, "e1d1")) return 22;
    if (!accumulatorMatchesRebuild(nnueNetwork, castleFen, "e1g1")) return 23;
    if (!accumulatorMatchesRebuild(nnueNetwork, epFen, "e5d6")) return 24;
    if (!accumulatorMatchesRebuild(nnueNetwork, promotionFen, "a7a8q")) return 25;
    if (!accumulatorMatchesRebuild(nnueNetwork, blackMoveFen, "e7e5")) return 26;
    if (!accumulatorMatchesRebuild(nnueNetwork, blackKingMoveFen, "e8d8")) return 28;

    Position retainedPosition;
    if (!loadFen(retainedPosition, START_FEN)) return 29;
    (void)nnueNetwork.evaluate(retainedPosition);
    if (!nnueNetwork.canUpdate(retainedPosition)) return 30;

    const std::uint64_t previousGeneration = nnueNetwork.generation();
    if (!nnueNetwork.load(validPath.string())) return 31;
    if (nnueNetwork.generation() == previousGeneration
        || nnueNetwork.canUpdate(retainedPosition)) {
        return 32;
    }

    (void)nnueNetwork.evaluate(retainedPosition);
    if (!nnueNetwork.canUpdate(retainedPosition)) return 33;

    Position rebuiltAfterReload = retainedPosition;
    rebuiltAfterReload.nnue.valid = false;
    (void)nnueNetwork.evaluate(rebuiltAfterReload);
    if (retainedPosition.nnue.values != rebuiltAfterReload.nnue.values) return 34;

    if (network.evaluate(position) != 400) return 9;

    if (network.load(invalidPath.string())) return 10;
    if (!network.loaded() || network.evaluate(position) != 400) return 11;
    if (network.load(truncatedPath.string())) return 12;
    if (!network.loaded() || network.evaluate(position) != 400) return 13;

    nnueNetwork.clear();
    network.clear();
    if (network.loaded()) return 14;

    std::error_code error;
    std::filesystem::remove(validPath, error);
    std::filesystem::remove(invalidPath, error);
    std::filesystem::remove(truncatedPath, error);
    std::filesystem::remove(overflowPath, error);
    std::filesystem::remove(incrementalPath, error);
    return 0;
}
