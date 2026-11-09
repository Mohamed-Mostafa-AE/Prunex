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

    if(!loadFen(position,"r6k/8/8/8/3PP3/8/8/4K3 w - - 0 1")) return 19;
    int connectedPawns=evaluate(position);
    if(!loadFen(position,"r6k/8/8/8/3P3P/8/8/4K3 w - - 0 1")) return 20;
    int separatedPawns=evaluate(position);
    if(connectedPawns<=separatedPawns) return 21;

    if(!loadFen(position,"r6k/8/8/8/8/8/3PPP2/4K3 w - - 0 1")) return 22;
    int shelteredKing=evaluate(position);
    if(!loadFen(position,"r6k/8/8/8/8/8/PPP5/4K3 w - - 0 1")) return 23;
    int exposedKing=evaluate(position);
    if(shelteredKing<=exposedKing) return 24;

    if(!loadFen(position,START_FEN)) return 25;
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
    if(!completed.load(std::memory_order_acquire)) return 26;
    if(interruptedBest.from<0||interruptedBest.to<0) return 27;
    bool returnedLegalMove=false;
    for(const Move& move:legalMoves(position)) returnedLegalMove|=sameMove(move,interruptedBest);
    if(!returnedLegalMove) return 28;

    searchAborted.store(false,std::memory_order_relaxed);

    if(!loadFen(position,"7k/8/8/8/3R4/8/8/K7 w - - 100 1")) { std::cerr<<"search regression failure 29\n"; return 29; }
    if(negamax(position,3,-INF,INF,0,true)!=0) { std::cerr<<"search regression failure 30\n"; return 30; }

    if(!loadFen(position,"7k/6Q1/5K2/8/8/8/8/8 b - - 100 1")) { std::cerr<<"search regression failure 31\n"; return 31; }
    if(negamax(position,3,-INF,INF,0,true)!=-MATE) { std::cerr<<"search regression failure 32\n"; return 32; }

    if(!loadFen(position,"7k/8/8/8/8/8/8/1B2K3 w - - 0 1")) { std::cerr<<"search regression failure 33\n"; return 33; }
    if(!isInsufficientMaterial(position)) { std::cerr<<"search regression failure 34\n"; return 34; }

    if(!loadFen(position,"7k/5n2/8/8/8/8/8/1N2K3 w - - 0 1")) { std::cerr<<"search regression failure 35\n"; return 35; }
    if(isInsufficientMaterial(position)) { std::cerr<<"search regression failure 36\n"; return 36; }

    searchPathKeys.fill(0);
    const std::uint64_t repeatedKey=positionKey(position);
    searchPathKeys[0]=repeatedKey;
    if(!repeatedPosition(repeatedKey,2,4)) { std::cerr<<"search regression failure 37\n"; return 37; }

    if(!loadFen(position,"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 4 3")) { std::cerr<<"search regression failure 38\n"; return 38; }
    searchPathKeys.fill(0);
    searchPathKeys[0]=positionKey(position);
    if(negamax(position,2,-INF,INF,2,true)!=0) { std::cerr<<"search regression failure 39\n"; return 39; }

    if(!loadFen(position,"7k/8/8/8/8/8/8/1B2K3 w - - 0 1")) { std::cerr<<"search regression failure 40\n"; return 40; }
    if(negamax(position,2,-INF,INF,0,true)!=0) { std::cerr<<"search regression failure 41\n"; return 41; }

    if(!loadFen(position,"7k/8/8/3q4/8/8/8/K2R4 w - - 0 1")) { std::cerr<<"search regression failure 42\n"; return 42; }
    Move exchangeMove;
    if(!parseUciMove(position,"d1d5",exchangeMove)) { std::cerr<<"search regression failure 43\n"; return 43; }
    if(staticExchangeEvaluation(position,exchangeMove)!=MG_VALUE[5]) { std::cerr<<"search regression failure 44: "<<staticExchangeEvaluation(position,exchangeMove)<<"\n"; return 44; }

    if(!loadFen(position,"7k/3q4/8/3p4/8/8/8/K2R4 w - - 0 1")) { std::cerr<<"search regression failure 45\n"; return 45; }
    if(!parseUciMove(position,"d1d5",exchangeMove)) { std::cerr<<"search regression failure 46\n"; return 46; }
    if(staticExchangeEvaluation(position,exchangeMove)!=(MG_VALUE[1]-MG_VALUE[4])) { std::cerr<<"search regression failure 47: "<<staticExchangeEvaluation(position,exchangeMove)<<"\n"; return 47; }

    if(!loadFen(position,"7k/8/8/3pP3/8/8/8/K7 w - d6 0 1")) { std::cerr<<"search regression failure 48\n"; return 48; }
    if(!parseUciMove(position,"e5d6",exchangeMove)) { std::cerr<<"search regression failure 49\n"; return 49; }
    if(staticExchangeEvaluation(position,exchangeMove)!=100) { std::cerr<<"search regression failure 50: "<<staticExchangeEvaluation(position,exchangeMove)<<"\n"; return 50; }

    return 0;
}
