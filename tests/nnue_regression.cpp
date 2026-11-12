#include <array>
#include <cmath>
#include <cstdint>
#include <filesystem>
#include <fstream>
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

}  // namespace

int main() {
    using namespace prunex;

    const auto directory = std::filesystem::temp_directory_path();
    const auto validPath = directory / "prunex-qat-regression.nnue";
    const auto invalidPath = directory / "prunex-qat-regression-invalid.nnue";
    const auto truncatedPath = directory / "prunex-qat-regression-truncated.nnue";

    if (!writeNetworkFile(validPath, true)) return 1;
    if (!writeNetworkFile(invalidPath, false)) return 2;
    if (!writeNetworkFile(truncatedPath, true)) return 3;

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
    if (network.evaluate(position) != 400) return 9;

    if (network.load(invalidPath.string())) return 10;
    if (!network.loaded() || network.evaluate(position) != 400) return 11;
    if (network.load(truncatedPath.string())) return 12;
    if (!network.loaded() || network.evaluate(position) != 400) return 13;

    network.clear();
    if (network.loaded()) return 14;

    std::error_code error;
    std::filesystem::remove(validPath, error);
    std::filesystem::remove(invalidPath, error);
    std::filesystem::remove(truncatedPath, error);
    return 0;
}
