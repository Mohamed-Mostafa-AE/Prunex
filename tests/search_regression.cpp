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

    if(!loadFen(position,"r3k2r/pp2bppp/2n1pn2/2pp4/3P4/2P1PN2/PP1NBPPP/R2Q1RK1 w kq - 2 10")) return 15;
    Position reflected=position;
    reflected.board.fill(EMPTY);
    for(int square=0;square<128;++square) {
        if(!onBoard(square)||position.board[square]==EMPTY) continue;
        int target=square^112;
        int piece=position.board[square];
        reflected.board[target]=makePiece(typeOf(piece),1-colorOf(piece));
    }
    reflected.side=1-position.side;
    reflected.castling=0;
    reflected.ep=-1;
    if(evaluate(position)!=evaluate(reflected)) return 16;

    if(!loadFen(position,"4k3/8/2p5/3p4/3P4/2P5/8/4K3 w - - 0 1")) return 17;
    int whiteView=evaluate(position);
    position.side=BLACK;
    int blackView=evaluate(position);
    if(whiteView!=-blackView) return 18;

    if(!loadFen(position,START_FEN)) return 19;
    searchAborted.store(false,std::memory_order_relaxed);
    std::atomic<bool> started{false};
    std::atomic<bool> completed{false};
    Move interruptedBest{};
    std::thread interruptedSearch([&] {
        started.store(true,std::memory_order_release);
        interruptedBest=findBestMove(position,12);
        completed.store(true,std::memory_order_release);
    });
    while(!started.load(std::memory_order_acquire)) std::this_thread::yield();
    std::this_thread::sleep_for(std::chrono::milliseconds(3));
    searchAborted.store(true,std::memory_order_relaxed);
    interruptedSearch.join();
    if(!completed.load(std::memory_order_acquire)) return 20;
    if(interruptedBest.from<0||interruptedBest.to<0) return 21;
    bool returnedLegalMove=false;
    for(const Move& move:legalMoves(position)) returnedLegalMove|=sameMove(move,interruptedBest);
    if(!returnedLegalMove) return 22;

    return 0;
}
