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

bool writeNetworkFile(const std::filesystem::path& path, bool complete) {
    std::ofstream output(path, std::ios::binary);
    if (!output) return false;

    std::array<char, 8> magic{
        'P', 'R', 'U', 'N', 'E', 'X', 'N', '1'
    };
    if (!complete) magic[0] = 'X';
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

    const std::array<std::size_t, 7> counts{
        static_cast<std::size_t>(features) * hidden,
        hidden,
        static_cast<std::size_t>(dense1) * hidden * 2,
        dense1,
        static_cast<std::size_t>(dense2) * dense1,
        dense2,
        dense2
    };
    const float zero = 0.0F;
    for (std::size_t count : counts) {
        for (std::size_t index = 0; index < count; ++index) {
            output.write(reinterpret_cast<const char*>(&zero), sizeof(zero));
        }
    }

    output.write(reinterpret_cast<const char*>(&zero), sizeof(zero));
    output.close();
    return static_cast<bool>(output);
}

}  // namespace

int main() {
    using namespace prunex;

    const auto directory = std::filesystem::temp_directory_path();
    const auto validPath = directory / "prunex-nnue-regression.nnue";
    const auto invalidPath = directory / "prunex-nnue-regression-invalid.nnue";
    const auto truncatedPath = directory / "prunex-nnue-regression-truncated.nnue";

    if (!writeNetworkFile(validPath, true)) { std::cerr << "NNUE regression check 1 failed\\n"; return 1; }
    if (!writeNetworkFile(invalidPath, false)) { std::cerr << "NNUE regression check 2 failed\\n"; return 2; }
    if (!writeNetworkFile(truncatedPath, true)) { std::cerr << "NNUE regression check 3 failed\\n"; return 3; }

    {
        std::ofstream output(truncatedPath, std::ios::binary | std::ios::trunc);
        if (!output) { std::cerr << "NNUE regression check 4 failed\\n"; return 4; }
        output.write("PRUNEX", 6);
    }

    NnueNetwork network;
    if (network.loaded()) { std::cerr << "NNUE regression check 5 failed\\n"; return 5; }
    if (!network.load(validPath.string())) { std::cerr << "NNUE regression check 6 failed\\n"; return 6; }
    if (!network.loaded()) { std::cerr << "NNUE regression check 7 failed\\n"; return 7; }

    Position position;
    if (!loadFen(position, START_FEN)) { std::cerr << "NNUE regression check 8 failed\\n"; return 8; }
    if (network.evaluate(position) != 0) { std::cerr << "NNUE regression check 9 failed\\n"; return 9; }

    if (network.load(invalidPath.string())) { std::cerr << "NNUE regression check 10 failed\\n"; return 10; }
    if (!network.loaded() || network.evaluate(position) != 0) { std::cerr << "NNUE regression check 11 failed\\n"; return 11; }
    if (network.load(truncatedPath.string())) { std::cerr << "NNUE regression check 12 failed\\n"; return 12; }
    if (!network.loaded()) { std::cerr << "NNUE regression check 13 failed\\n"; return 13; }

    network.clear();
    if (network.loaded()) { std::cerr << "NNUE regression check 14 failed\\n"; return 14; }

    std::error_code error;
    std::filesystem::remove(validPath, error);
    std::filesystem::remove(invalidPath, error);
    std::filesystem::remove(truncatedPath, error);

    return 0;
}
