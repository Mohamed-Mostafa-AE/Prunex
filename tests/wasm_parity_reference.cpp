#define PRUNEX_NO_MAIN
#include "../src/main.cpp"

#include <array>
#include <iostream>
#include <string_view>

int main() {
    using namespace prunex;
    struct Case { std::string_view name; std::string_view fen; };
    constexpr std::array<Case, 5> cases{{
        {"starting-position", "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"},
        {"kiwipete", "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1"},
        {"rook-endgame", "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1"},
        {"mate-in-one", "7k/8/5KQ1/8/8/8/8/8 w - - 0 1"},
        {"closed-center", "r1bq1rk1/pp1n1ppp/2pbpn2/3p4/3P4/2NBPN2/PPQ1BPPP/R1R3K1 w - - 0 1"}
    }};
    for (const Case& item : cases) {
        Position position;
        if (!loadFen(position, item.fen)) return 2;
        resetSearchState();
        const int score = evaluate(position);
        Move best;
        const bool previous = suppressEngineOutput;
        suppressEngineOutput = true;
        best = findBestMove(position, 3);
        suppressEngineOutput = previous;
        if (best.from < 0 || best.to < 0) return 3;
        std::cout << item.name << '\t' << score << '\t' << moveUci(best) << '\t' << nodes << '\n';
    }
    return 0;
}
