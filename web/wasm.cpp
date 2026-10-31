#define main prunex_command_line_main
#include "main.cpp"
#undef main

#include <cstring>

extern "C" {
const char* prunex_best_move(const char* fen, int move_time_ms, int depth) {
    static char result[8]{};
    result[0] = '\0';
    if (fen == nullptr) {
        std::strcpy(result, "0000");
        return result;
    }

    prunex::Position position;
    if (!prunex::loadFen(position, fen)) {
        std::strcpy(result, "0000");
        return result;
    }

    int safe_depth = std::clamp(depth, 1, 12);
    std::int64_t safe_time = std::clamp<std::int64_t>(move_time_ms, 10, 30000);
    prunex::Move best = prunex::findBestMove(position, safe_depth, safe_time);
    std::string move = best.from >= 0 ? prunex::moveUci(best) : "0000";
    std::size_t length = std::min(move.size(), sizeof(result) - 1);
    std::memcpy(result, move.data(), length);
    result[length] = '\0';
    return result;
}
}
