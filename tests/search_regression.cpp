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

    auto hashRoundTrips=[](const Position& original) {
        if(original.key!=computePositionKey(original)||!bitboardsConsistent(original)) return false;
        Position base=original;
        const auto moves=legalMoves(base);
        if(base.board!=original.board||base.side!=original.side||
           base.castling!=original.castling||base.ep!=original.ep||
           base.halfmove!=original.halfmove||base.fullmove!=original.fullmove||
           base.key!=original.key||!bitboardsConsistent(base)) return false;
        for(const Move& move:moves) {
            Position child=original;
            const std::uint64_t originalKey=child.key;
            Undo undo=makeMove(child,move);
            if(child.key!=computePositionKey(child)||!bitboardsConsistent(child)) return false;
            undoMove(child,move,undo);
            if(child.key!=originalKey||child.key!=computePositionKey(child)||
               !bitboardsConsistent(child)) return false;
        }
        return true;
    };

    if(!loadFen(position,START_FEN)) return 8;
    std::uint64_t startKey=positionKey(position);
    if(!hashRoundTrips(position)) return 9;
    auto startMoves=legalMoves(position);
    for(const Move& move:startMoves) {
        Undo undo=makeMove(position,move);
        if(positionKey(position)!=computePositionKey(position)) return 64;
        undoMove(position,move,undo);
        if(positionKey(position)!=startKey||position.key!=computePositionKey(position)) return 65;
    }

    if(!loadFen(position,"r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1")) return 66;
    if(!hashRoundTrips(position)) return 67;

    if(!loadFen(position,"7k/8/8/3pP3/8/8/8/K7 w - d6 0 1")) return 68;
    if(!hashRoundTrips(position)) return 69;

    if(!loadFen(position,"7k/P7/8/8/8/8/8/7K w - - 0 1")) return 70;
    if(!hashRoundTrips(position)) return 71;

    if(!loadFen(position,START_FEN)) return 72;
    if(!bitboardsConsistent(position)) return 87;
    const std::uint64_t beforeNull=position.key;
    makeNullMove(position);
    if(position.key!=computePositionKey(position)) return 73;
    if(position.side!=BLACK||position.ep!=-1||position.key==beforeNull||
       !bitboardsConsistent(position)) return 74;

    clearTranspositionTable();
    ttGeneration=7;
    const std::uint64_t clusterBaseKey=0x12345ULL;
    bool tableHit=false;
    TTEntry& deepEntry=probeTranspositionTable(clusterBaseKey,tableHit);
    if(tableHit) return 75;
    deepEntry.key=clusterBaseKey;
    deepEntry.depth=14;
    deepEntry.bound=TT_EXACT;
    deepEntry.generation=ttGeneration;

    const std::uint64_t shallowKey=clusterBaseKey+TT_BUCKETS;
    TTEntry& shallowEntry=probeTranspositionTable(shallowKey,tableHit);
    if(tableHit||&deepEntry==&shallowEntry) return 76;
    shallowEntry.key=shallowKey;
    shallowEntry.depth=3;
    shallowEntry.bound=TT_LOWER;
    shallowEntry.generation=ttGeneration;

    const std::uint64_t thirdKey=clusterBaseKey+2*TT_BUCKETS;
    TTEntry& replacement=probeTranspositionTable(thirdKey,tableHit);
    if(tableHit||replacement.key!=shallowKey) return 77;
    replacement.key=thirdKey;
    replacement.depth=5;
    replacement.bound=TT_UPPER;
    replacement.generation=ttGeneration;

    TTEntry& retainedDeep=probeTranspositionTable(clusterBaseKey,tableHit);
    if(!tableHit||retainedDeep.depth!=14) return 78;
    clearTranspositionTable();

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
    rebuildBitboards(reflected);
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

    // Passed-pawn detection must use one rank coordinate system for both colors.
    if(!loadFen(position,"7k/8/4p3/8/3P4/8/8/K7 w - - 0 1")) return 51;
    if(isPassedPawn(position,parseSquare("d4"),WHITE)) return 52;
    if(!loadFen(position,"7k/8/8/8/3P4/4p3/8/K7 w - - 0 1")) return 53;
    if(!isPassedPawn(position,parseSquare("d4"),WHITE)) return 54;
    if(!loadFen(position,"7k/8/8/8/3p4/4P3/8/K7 b - - 0 1")) return 55;
    if(isPassedPawn(position,parseSquare("d4"),BLACK)) return 56;
    if(!loadFen(position,"7k/8/8/4P3/3p4/8/8/K7 b - - 0 1")) return 57;
    if(!isPassedPawn(position,parseSquare("d4"),BLACK)) return 58;

    // A developed knight with several safe destinations should score above
    // the same material with the knight undeveloped and restricted.
    if(!loadFen(position,"7k/8/8/8/8/5N2/8/K7 w - - 0 1")) return 59;
    const int mobileKnight=evaluate(position);
    if(!loadFen(position,"7k/8/8/8/8/8/8/KN6 w - - 0 1")) return 60;
    const int restrictedKnight=evaluate(position);
    if(mobileKnight<=restrictedKnight) return 61;

    // If search is interrupted before depth one completes, use an
    // evaluation-ranked legal fallback instead of the first generated move.
    if(!loadFen(position,"7k/8/8/3q4/8/8/8/K2R4 w - - 0 1")) return 62;
    searchAborted.store(true,std::memory_order_relaxed);
    Move fallback=findBestMove(position,6);
    searchAborted.store(false,std::memory_order_relaxed);
    if(moveUci(fallback)!="d1d5") return 63;

    if(!loadFen(position,"rnbqkb1r/pppppppp/5n2/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 1 2")) return 79;
    Move counterCandidate;
    if(!parseUciMove(position,"g1f3",counterCandidate)) return 80;
    searchPathMoves.fill(Move{});
    searchPathPieceTypes.fill(0);
    counterMoves={};
    searchPathMoves[0]={parseSquare("g8"),parseSquare("f6"),EMPTY,false,false};
    searchPathPieceTypes[0]=2;
    counterMoves[2][parseSquare("f6")]=counterCandidate;
    if(moveOrderingScore(position,counterCandidate,Move{},1)!=780000) return 81;
    counterMoves={};
    if(moveOrderingScore(position,counterCandidate,Move{},1)==780000) return 82;
    searchPathMoves.fill(Move{});
    searchPathPieceTypes.fill(0);

    if(!loadFen(position,START_FEN)) return 83;
    auto ordered=legalMoves(position);
    if(!parseUciMove(position,"e2e4",counterCandidate)) return 84;
    orderMoves(position,ordered,counterCandidate,0);
    if(ordered.empty()||!sameMove(ordered.front(),counterCandidate)) return 85;
    for(std::size_t index=1;index<ordered.size();++index) {
        if(moveOrderingScore(position,ordered[index-1],counterCandidate,0)<
           moveOrderingScore(position,ordered[index],counterCandidate,0)) return 86;
    }

    return 0;
}
