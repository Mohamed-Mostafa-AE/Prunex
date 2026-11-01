#define main prunex_console_entry
#include "../src/main.cpp"
#undef main

int main() {
    using namespace prunex;
    Position position;

    if(!loadFen(position,"7k/6Q1/5K2/8/8/8/8/8 b - - 0 1")) return 1;
    nodes=0;
    int mate=quiescence(position,-INF,INF,0,7);
    if(mate!=-MATE+7) return 2;

    if(!loadFen(position,"7k/5Q2/5K2/8/8/8/8/8 b - - 0 1")) return 3;
    nodes=0;
    int stalemate=quiescence(position,-INF,INF,0,7);
    if(stalemate!=0) return 4;

    if(!loadFen(position,"4k3/8/8/8/8/8/8/K3R3 b - - 0 1")) return 5;
    if(!inCheck(position,BLACK)) return 6;
    nodes=0;
    quiescence(position,-INF,INF,0,0);
    if(nodes<=1) return 7;

    if(!loadFen(position,START_FEN)) return 8;
    std::uint64_t startKey=positionKey(position);
    auto startMoves=legalMoves(position);
    for(const Move& move:startMoves) {
        Undo undo=makeMove(position,move);
        undoMove(position,move,undo);
        if(positionKey(position)!=startKey) return 9;
    }

    if(!loadFen(position,"7k/8/5KQ1/8/8/8/8/8 w - - 0 1")) return 10;
    Move matingMove=findBestMove(position,3);
    if(moveUci(matingMove)!="g6g7") return 11;

    if(!loadFen(position,START_FEN)) return 12;
    Move first=findBestMove(position,5);
    std::uint64_t firstNodes=nodes;
    if(first.from<0||first.to<0) return 13;
    Move second=findBestMove(position,5);
    std::uint64_t secondNodes=nodes;
    if(!sameMove(first,second)||secondNodes>=firstNodes) return 14;

    return 0;
}
