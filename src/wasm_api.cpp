#include <cstring>
#include <string>

#define PRUNEX_NO_MAIN
#include "main.cpp"

namespace {
class OutputSilencer {
public:
    OutputSilencer() : previous_(prunex::suppressEngineOutput) {
        prunex::suppressEngineOutput = true;
    }
    ~OutputSilencer() { prunex::suppressEngineOutput = previous_; }
private:
    bool previous_;
};
}

extern "C" int prunex_wasm_api_version() { return 800; }

// Scores are centipawns from the side-to-move perspective.
// Calls are synchronous; use a dedicated Web Worker to keep UI rendering responsive.
extern "C" int prunex_wasm_evaluate_fen(const char* fen, int* score_cp) {
    if (!fen || !score_cp) return 1;
    prunex::Position position;
    if (!prunex::loadFen(position, fen)) return 2;
    *score_cp = prunex::evaluate(position);
    return 0;
}

// Computes a fixed-depth best move. The caller owns every buffer.
extern "C" int prunex_wasm_search_fen(
    const char* fen, int depth, char* best_move, int best_move_capacity,
    int* score_cp, double* nodes_out
) {
    if (!fen || !best_move || best_move_capacity < 6 || !score_cp || !nodes_out) return 1;
    if (depth < 1 || depth > 12) return 2;
    prunex::Position position;
    if (!prunex::loadFen(position, fen)) return 3;
    prunex::resetSearchState();
    prunex::Move best;
    {
        OutputSilencer silence;
        best = prunex::findBestMove(position, depth);
    }
    if (best.from < 0 || best.to < 0) return 4;
    const std::string uci = prunex::moveUci(best);
    if (static_cast<int>(uci.size()) + 1 > best_move_capacity) return 5;
    std::memcpy(best_move, uci.c_str(), uci.size() + 1);
    *score_cp = prunex::evaluate(position);
    *nodes_out = static_cast<double>(prunex::nodes);
    return 0;
}
