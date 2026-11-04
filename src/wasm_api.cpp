#include <cstring>
#include <limits>
#include <string>

#define PRUNEX_NO_MAIN
#include "main.cpp"

namespace {
constexpr int API_ERROR = std::numeric_limits<int>::min();

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

// Returns a centipawn evaluation from the side-to-move perspective.
// API_ERROR indicates an invalid argument or FEN.
extern "C" int prunex_wasm_evaluate_fen(const char* fen) {
    if (!fen) return API_ERROR;
    prunex::Position position;
    if (!prunex::loadFen(position, fen)) return API_ERROR;
    return prunex::evaluate(position);
}

// Returns the static score and writes the selected move in UCI format.
// Calls are synchronous; invoke them from a dedicated Web Worker in browsers.
extern "C" int prunex_wasm_search_fen(
    const char* fen, int depth, char* best_move, int best_move_capacity
) {
    if (!fen || !best_move || best_move_capacity < 6 || depth < 1 || depth > 12) return API_ERROR;
    prunex::Position position;
    if (!prunex::loadFen(position, fen)) return API_ERROR;

    prunex::resetSearchState();
    prunex::Move best;
    {
        OutputSilencer silence;
        best = prunex::findBestMove(position, depth);
    }
    if (best.from < 0 || best.to < 0) return API_ERROR;

    const std::string uci = prunex::moveUci(best);
    if (static_cast<int>(uci.size()) + 1 > best_move_capacity) return API_ERROR;
    std::memcpy(best_move, uci.c_str(), uci.size() + 1);
    return prunex::evaluate(position);
}

extern "C" double prunex_wasm_nodes() {
    return static_cast<double>(prunex::nodes);
}
