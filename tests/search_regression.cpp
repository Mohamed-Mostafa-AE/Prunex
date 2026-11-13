#include <random>
#include <algorithm>
#define main prunex_console_entry
#include "../src/main.cpp"
#undef main

static_assert(prunex::TT_WAYS==4);

static std::vector<std::string> referenceLegalMoveStrings(prunex::Position position) {
    using namespace prunex;
    std::vector<std::string> result;
    for(const Move& move:pseudoMoves(position)) {
        const int side=position.side;
        const Undo undo=makeMove(position,move);
        const bool safe=!inCheck(position,side);
        undoMove(position,move,undo);
        if(safe) result.push_back(moveUci(move));
    }
    std::sort(result.begin(),result.end());
    return result;
}

static bool sliderTableIndicesAgree() {
    using namespace prunex;
    const auto& tables=slidingAttackTables();
    auto verify=[](const SliderAttackTable& table,const auto& directions) {
        for(int square=0;square<64;++square) {
            const std::uint64_t mask=table.masks[square];
            const unsigned bits=static_cast<unsigned>(std::popcount(mask));
            const std::size_t subsetCount=std::size_t{1}<<bits;
            for(std::size_t subset=0;subset<subsetCount;++subset) {
                const auto occupancy=expandOccupancyIndex(
                    static_cast<std::uint32_t>(subset),mask);
                if(compressOccupancy(occupancy,mask)!=subset) return false;
                if(table.lookup(square,occupancy)!=
                   traceSlidingAttacks(square,occupancy,directions)) return false;
            }
        }
        return true;
    };
    return verify(tables.bishops,BISHOP_DIRECTIONS)&&
           verify(tables.rooks,ROOK_DIRECTIONS);
}

static bool legalMoveSetsAgree(prunex::Position position) {
    using namespace prunex;
    std::vector<std::string> actual;
    for(const Move& move:legalMoves(position)) actual.push_back(moveUci(move));
    std::sort(actual.begin(),actual.end());
    return actual==referenceLegalMoveStrings(position)&&bitboardsConsistent(position);
}

static bool attackedMailboxReference(const prunex::Position& p,int target,int by) {
 using namespace prunex;
 constexpr int nd[8]={-33,-31,-18,-14,14,18,31,33};
 constexpr int kd[8]={-17,-16,-15,-1,1,15,16,17};
 int pawn=makePiece(1,by), sources[2]={target+(by==WHITE?-15:15),target+(by==WHITE?-17:17)};
 for(int s:sources) if(onBoard(s)&&p.board[s]==pawn) return true;
 int knight=makePiece(2,by), king=makePiece(6,by);
 for(int d:nd) { int s=target+d; if(onBoard(s)&&p.board[s]==knight) return true; }
 for(int d:kd) { int s=target+d; if(onBoard(s)&&p.board[s]==king) return true; }
 constexpr int bd[4]={-17,-15,15,17}, rd[4]={-16,-1,1,16};
 auto ray=[&](const auto& dirs,bool diag) {
  for(int d:dirs) for(int s=target+d;onBoard(s);s+=d) {
   int pc=p.board[s]; if(pc==EMPTY) continue;
   if(colorOf(pc)==by) { int t=typeOf(pc); if(t==5||(diag?t==3:t==4)) return true; }
   break;
  }
  return false;
 };
 return ray(bd,true)||ray(rd,false);
}
static bool attackMapsAgree(const prunex::Position& p) {
 using namespace prunex;
 for(int rank=0;rank<8;++rank) for(int file=0;file<8;++file)
  for(int color=WHITE;color<=BLACK;++color) {
   int s=rank*16+file;
   if(attacked(p,s,color)!=attackedMailboxReference(p,s,color)) return false;
  }
 return true;
}

static int referenceLeastValuableAttacker(
    const prunex::Position& position,int target,int color
) {
    using namespace prunex;
    if(!onBoard(target)) return -1;
    const int target64=square64From88(target);
    const std::uint64_t occupied=position.occupancy[WHITE]
        |position.occupancy[BLACK];
    for(int type=1;type<=6;++type) {
        std::uint64_t attackers=0;
        if(type==1)
            attackers=PAWN_ATTACKS[1-color][target64]&position.piecesBB[color][1];
        else if(type==2)
            attackers=KNIGHT_ATTACKS[target64]&position.piecesBB[color][2];
        else if(type==3)
            attackers=bishopAttacks(target64,occupied)&position.piecesBB[color][3];
        else if(type==4)
            attackers=rookAttacks(target64,occupied)&position.piecesBB[color][4];
        else if(type==5) {
            attackers=(bishopAttacks(target64,occupied)
                |rookAttacks(target64,occupied))&position.piecesBB[color][5];
        } else {
            attackers=KING_ATTACKS[target64]&position.piecesBB[color][6];
        }
        if(attackers)
            return square88From64(static_cast<int>(std::countr_zero(attackers)));
    }
    return -1;
}

static int referenceStaticExchangeEvaluation(
    const prunex::Position& original,const prunex::Move& move
) {
    using namespace prunex;
    if(!isCapture(original,move)) return 0;
    Position position=original;
    const int target=move.to;
    const int capturedSquare=move.enPassant
        ?target+(original.side==WHITE?-16:16):target;
    const int captured=position.board[capturedSquare];
    const int moving=position.board[move.from];
    if(captured==EMPTY||moving==EMPTY) return 0;

    std::array<int,32> gains{};
    int occupant=move.promotion?move.promotion:moving;
    gains[0]=MG_VALUE[typeOf(captured)];
    if(move.promotion)
        gains[0]+=MG_VALUE[typeOf(move.promotion)]-MG_VALUE[1];

    removePositionPiece(position,move.from);
    removePositionPiece(position,capturedSquare);
    removePositionPiece(position,target);
    putPositionPiece(position,target,occupant);
    int side=1-original.side;
    int depth=0;
    while(depth<30) {
        const int attackerSquare=referenceLeastValuableAttacker(position,target,side);
        if(attackerSquare<0) break;
        int attacker=position.board[attackerSquare];
        if(typeOf(attacker)==6) {
            Position kingCapture=position;
            removePositionPiece(kingCapture,attackerSquare);
            removePositionPiece(kingCapture,target);
            putPositionPiece(kingCapture,target,attacker);
            if(attacked(kingCapture,target,1-side)) break;
        }
        ++depth;
        int promotionGain=0;
        if(typeOf(attacker)==1&&rankOf(target)==(side==WHITE?7:0)) {
            promotionGain=MG_VALUE[5]-MG_VALUE[1];
            attacker=makePiece(5,side);
        }
        gains[depth]=MG_VALUE[typeOf(occupant)]+promotionGain-gains[depth-1];
        removePositionPiece(position,attackerSquare);
        removePositionPiece(position,target);
        putPositionPiece(position,target,attacker);
        occupant=attacker;
        side=1-side;
    }
    while(depth>0) {
        gains[depth-1]=-std::max(-gains[depth-1],gains[depth]);
        --depth;
    }
    return gains[0];
}

static bool exchangeEvaluationsAgree(const prunex::Position& position) {
    using namespace prunex;
    Position workingPosition=position;
    for(const Move& move:legalMoves(workingPosition)) {
        if(!isCapture(position,move)) continue;
        const int actual=staticExchangeEvaluation(position,move);
        const int expected=referenceStaticExchangeEvaluation(position,move);
        if(actual!=expected) {
            std::cerr<<"SEE mismatch for "<<moveUci(move)
                <<": actual "<<actual<<", reference "<<expected<<'\n';
            return false;
        }
    }
    return true;
}

static bool enPassantHashingMatchesLegalMoves() {
    using namespace prunex;
    Position noAdjacentPawn;
    Position unusedTarget;
    if(!loadFen(noAdjacentPawn,"4k3/8/8/3p4/8/8/8/4K3 w - - 0 1")
       ||!loadFen(unusedTarget,"4k3/8/8/3p4/8/8/8/4K3 w - d6 0 1")
       ||noAdjacentPawn.key!=unusedTarget.key) return false;

    Position legalCapture;
    Position noLegalCapture;
    if(!loadFen(legalCapture,"4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1")
       ||!loadFen(noLegalCapture,"4k3/8/8/3pP3/8/8/8/4K3 w - - 0 1")
       ||legalCapture.key==noLegalCapture.key) return false;

    Position pinnedPawn;
    Position pinnedWithoutTarget;
    if(!loadFen(pinnedPawn,"k3r3/8/8/3pP3/8/8/8/4K3 w - d6 0 1")
       ||!loadFen(pinnedWithoutTarget,"k3r3/8/8/3pP3/8/8/8/4K3 w - - 0 1")
       ||pinnedPawn.key!=pinnedWithoutTarget.key) return false;

    Position doublePush;
    if(!loadFen(doublePush,"4k3/8/8/8/3p4/8/4P3/4K3 w - - 0 1"))
        return false;
    const std::uint64_t parentKey=doublePush.key;
    Move move;
    if(!parseUciMove(doublePush,"e2e4",move)) return false;
    const Undo undo=makeMove(doublePush,move);
    if(doublePush.key!=computePositionKey(doublePush)) return false;
    Position withoutTarget=doublePush;
    withoutTarget.ep=-1;
    if(doublePush.key==computePositionKey(withoutTarget)) return false;
    undoMove(doublePush,move,undo);
    if(doublePush.key!=parentKey||doublePush.key!=computePositionKey(doublePush))
        return false;

    // Null moves clear the raw target but must only remove its hash component
    // when an en-passant capture was actually legal.
    makeNullMove(pinnedPawn);
    if(pinnedPawn.key!=computePositionKey(pinnedPawn)) return false;
    makeNullMove(legalCapture);
    if(legalCapture.key!=computePositionKey(legalCapture)) return false;

    return true;
}

static bool samePositionState(
    const prunex::Position& left,
    const prunex::Position& right
) {
    return left.board==right.board
        &&left.piecesBB==right.piecesBB
        &&left.occupancy==right.occupancy
        &&left.side==right.side
        &&left.castling==right.castling
        &&left.ep==right.ep
        &&left.halfmove==right.halfmove
        &&left.fullmove==right.fullmove
        &&left.key==right.key
        &&left.nnue.values==right.nnue.values
        &&left.nnue.generation==right.nnue.generation
        &&left.nnue.valid==right.nnue.valid;
}

static bool positionCommandsAreTransactional() {
    using namespace prunex;

    Position position;
    if(!loadFen(position,START_FEN)) return false;
    if(!setPosition(position,"position startpos moves e2e4 e7e5")) return false;
    const Position accepted=position;

    if(setPosition(position,"position startpos moves e2e4 e7e5 e1e8")) return false;
    if(!samePositionState(position,accepted)) return false;

    if(setPosition(position,"position startpos unexpected")) return false;
    if(!samePositionState(position,accepted)) return false;

    if(setPosition(position,"position fen 4k3/8/8/8/8/8/8/4K3 w - -")) return false;
    if(!samePositionState(position,accepted)) return false;

    if(!setPosition(position,"position fen 4k3/8/8/8/8/8/8/4K3 w - - 0 1")) return false;
    return position.key==computePositionKey(position)
        &&position.side==WHITE
        &&position.fullmove==1;
}

static bool moveCountersSaturateAndUndo() {
    using namespace prunex;
    constexpr int maximum=std::numeric_limits<int>::max();

    Position halfmovePosition;
    if(!loadFen(halfmovePosition,
                "4k3/8/8/8/8/8/8/R3K3 w - - 2147483647 1")) return false;
    const Position originalHalfmove=halfmovePosition;
    Move move;
    if(!parseUciMove(halfmovePosition,"a1a2",move)) return false;
    const Undo halfmoveUndo=makeMove(halfmovePosition,move);
    if(halfmovePosition.halfmove!=maximum||halfmovePosition.fullmove!=1) return false;
    undoMove(halfmovePosition,move,halfmoveUndo);
    if(!samePositionState(halfmovePosition,originalHalfmove)) return false;

    Position fullmovePosition;
    if(!loadFen(fullmovePosition,
                "r3k3/8/8/8/8/8/8/4K3 b - - 0 2147483647")) return false;
    const Position originalFullmove=fullmovePosition;
    if(!parseUciMove(fullmovePosition,"a8a7",move)) return false;
    const Undo fullmoveUndo=makeMove(fullmovePosition,move);
    if(fullmovePosition.fullmove!=maximum||fullmovePosition.halfmove!=1) return false;
    undoMove(fullmovePosition,move,fullmoveUndo);
    return samePositionState(fullmovePosition,originalFullmove);
}

static bool evaluationMapsMatchAttackReference(prunex::Position position) {
    using namespace prunex;
    EvaluationMaps maps;
    buildEvaluationMaps(position,maps);

    std::array<std::uint64_t,2> expectedPawnAttacks{};
    for(int color=WHITE;color<=BLACK;++color) {
        std::uint64_t pawns=position.piecesBB[color][1];
        while(pawns) {
            const int square=static_cast<int>(std::countr_zero(pawns));
            pawns&=pawns-1;
            expectedPawnAttacks[color]|=PAWN_ATTACKS[color][square];
        }
        if(maps.pawnAttacks[color]!=expectedPawnAttacks[color]) {
            std::cerr<<"pawn attack map mismatch, color "<<color<<"\\n";
            return false;
        }
    }

    for(int color=WHITE;color<=BLACK;++color) {
        int expectedMiddle=0;
        int expectedEnding=0;
        constexpr std::array<int,7> middleWeight{0,0,4,3,2,1,0};
        constexpr std::array<int,7> endingWeight{0,0,3,3,2,1,0};
        constexpr std::array<int,7> cap{0,0,8,13,14,27,0};
        const std::uint64_t occupied=position.occupancy[WHITE]
            |position.occupancy[BLACK];

        const int enemyKing=kingSquare(position,1-color);
        const std::uint64_t kingZone=enemyKing>=0
            ?KING_ATTACKS[square64From88(enemyKing)]:0;
        std::uint64_t zoneSquares=kingZone;
        while(zoneSquares) {
            const int square64=static_cast<int>(std::countr_zero(zoneSquares));
            zoneSquares&=zoneSquares-1;
            const int square88=square88From64(square64);
            const int actual=maps.attacks[color][square64];
            const int reference=static_cast<int>(
                std::popcount(attackersTo(position,square88,color))
            );
            if(actual!=reference) {
                std::cerr<<"king-zone attack count mismatch, color "<<color
                    <<" square "<<square64<<" actual "<<actual
                    <<" reference "<<reference<<"\\n";
                return false;
            }
        }

        for(int type=2;type<=5;++type) {
            std::uint64_t pieces=position.piecesBB[color][type];
            while(pieces) {
                const int square=static_cast<int>(std::countr_zero(pieces));
                pieces&=pieces-1;
                std::uint64_t targets=0;
                if(type==2) targets=KNIGHT_ATTACKS[square];
                else if(type==3) targets=bishopAttacks(square,occupied);
                else if(type==4) targets=rookAttacks(square,occupied);
                else targets=bishopAttacks(square,occupied)
                    |rookAttacks(square,occupied);
                targets&=~position.occupancy[color];
                targets&=~expectedPawnAttacks[1-color];
                const int bounded=std::min(
                    static_cast<int>(std::popcount(targets)),cap[type]
                );
                expectedMiddle+=bounded*middleWeight[type];
                expectedEnding+=bounded*endingWeight[type];
            }
        }
        if(maps.mobilityMiddle[color]!=expectedMiddle
            ||maps.mobilityEnding[color]!=expectedEnding) {
            std::cerr<<"mobility mismatch, color "<<color<<" actual "
                <<maps.mobilityMiddle[color]<<"/"<<maps.mobilityEnding[color]
                <<" reference "<<expectedMiddle<<"/"<<expectedEnding<<"\\n";
            return false;
        }

        int attackedSquares=0;
        int attackUnits=0;
        for(int rankStep=-1;rankStep<=1;++rankStep) {
            for(int fileStep=-1;fileStep<=1;++fileStep) {
                if(rankStep==0&&fileStep==0) continue;
                const int target=enemyKing+rankStep*16+fileStep;
                if(!onBoard(target)) continue;
                const int count=static_cast<int>(
                    std::popcount(attackersTo(position,target,color))
                );
                if(count==0) continue;
                ++attackedSquares;
                attackUnits+=std::min(2,count);
            }
        }
        int expectedPressure=0;
        if(attackedSquares>=2&&attackUnits>=3)
            expectedPressure=std::min(36,attackedSquares*2+attackUnits*2);
        if(maps.kingPressureMiddle[color]!=expectedPressure
            ||maps.kingPressureEnding[color]!=expectedPressure/3) {
            std::cerr<<"king pressure mismatch, color "<<color<<" actual "
                <<maps.kingPressureMiddle[color]<<"/"<<maps.kingPressureEnding[color]
                <<" reference "<<expectedPressure<<"/"<<expectedPressure/3<<"\\n";
            return false;
        }
    }
    return true;
}

int main() {
    using namespace prunex;
    Position position;

    if(!positionCommandsAreTransactional()) return 126;
    if(!moveCountersSaturateAndUndo()) return 127;
    if(!enPassantHashingMatchesLegalMoves()) return 125;

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

    if(!loadFen(position,START_FEN)) return 120;
    const Position beforeInvalidFen=position;
    if(loadFen(position,"P7/8/4k3/8/8/8/8/4K3 w - - 0 1")) return 121;
    if(position.board!=beforeInvalidFen.board||position.side!=beforeInvalidFen.side
       ||position.castling!=beforeInvalidFen.castling||position.ep!=beforeInvalidFen.ep
       ||position.key!=beforeInvalidFen.key) return 122;
    if(loadFen(position,"4k3/8/8/8/8/8/8/4K3 w K - 0 1")) return 123;
    if(position.board!=beforeInvalidFen.board||position.key!=beforeInvalidFen.key) return 124;

    if(!loadFen(position,START_FEN)||!attackMapsAgree(position)) return 88;
    if(!loadFen(position,"r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1")||
       !attackMapsAgree(position)) return 89;
    if(!loadFen(position,"r1bq1rk1/pp2bppp/2n1pn2/2pp4/3P4/2P1PN2/PP1NBPPP/R2Q1RK1 w - - 0 1")||
       !attackMapsAgree(position)) return 90;
    if(!loadFen(position,"7k/8/8/3pP3/8/8/8/K7 w - d6 0 1")||
       !attackMapsAgree(position)) return 91;

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

    const std::uint64_t shallowKey=clusterBaseKey+ttBucketCount;
    TTEntry& shallowEntry=probeTranspositionTable(shallowKey,tableHit);
    if(tableHit||&deepEntry==&shallowEntry) return 76;
    shallowEntry.key=shallowKey;
    shallowEntry.depth=3;
    shallowEntry.bound=TT_LOWER;
    shallowEntry.generation=ttGeneration;

    const std::uint64_t thirdKey=clusterBaseKey+2*ttBucketCount;
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

    // The staged picker must always take a legal transposition move first,
    // then a profitable capture before an ordinary quiet move.
    if(!loadFen(position,"7k/8/8/3q4/8/8/8/K2R4 w - - 0 1")) return 98;
    auto tacticalMoves=legalMoves(position,0);
    Move hashCandidate;
    if(!parseUciMove(position,"a1b1",hashCandidate)) return 99;
    MovePicker tacticalPicker(position,tacticalMoves,hashCandidate,0);
    if(!sameMove(tacticalPicker.next(),hashCandidate)) return 100;
    if(moveUci(tacticalPicker.next())!="d1d5") return 101;

    // A countermove is staged ahead of ordinary quiet moves.
    if(!loadFen(position,"rnbqkb1r/pppppppp/5n2/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 1 2")) return 102;
    if(!parseUciMove(position,"g1f3",counterCandidate)) return 103;
    searchPathMoves.fill(Move{});
    searchPathPieceTypes.fill(0);
    counterMoves={};
    searchPathMoves[0]={parseSquare("g8"),parseSquare("f6"),EMPTY,false,false};
    searchPathPieceTypes[0]=2;
    counterMoves[2][parseSquare("f6")]=counterCandidate;
    auto counterMovesLegal=legalMoves(position,1);
    MovePicker counterPicker(position,counterMovesLegal,Move{},1);
    if(!sameMove(counterPicker.next(),counterCandidate)) return 104;
    searchPathMoves.fill(Move{});
    searchPathPieceTypes.fill(0);
    counterMoves={};

    const int originalHashSize=configuredHashMB;
    const std::size_t originalBucketCount=ttBucketCount;
    if(!resizeTranspositionTable(1)) return 93;
    if(ttBucketCount==0||ttBucketCount>originalBucketCount) return 94;
    bool resizedTableHit=false;
    TTEntry& resizedEntry=probeTranspositionTable(0xABCDEF1234567890ULL,resizedTableHit);
    if(resizedTableHit||resizedEntry.bound!=TT_NONE) return 95;
    resizedEntry.key=0xABCDEF1234567890ULL;
    resizedEntry.bound=TT_EXACT;
    resizedEntry.depth=4;
    if(!resizeTranspositionTable(originalHashSize)) return 96;
    if(ttBucketCount!=originalBucketCount) return 97;


    // Compare the optimized pin/check-mask move filter against the former
    // make/undo legality oracle on tactical and special-move positions.
    const std::array<const char*,8> legalityFens{{
        "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1",
        "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1",
        "r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1",
        "rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8",
        "r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10",
        "k3r3/8/8/3pP3/8/8/8/4K3 w - d6 0 1",
        "4k3/8/8/8/1b6/8/4r3/4K3 w - - 0 1"
    }};
    for(const char* fen:legalityFens) {
        if(!loadFen(position,fen)||!legalMoveSetsAgree(position)) return 92;
        if(!exchangeEvaluationsAgree(position)) return 150;

        const auto allLegal=legalMoves(position,0);
        const std::vector<Move> allMoves(allLegal.begin(),allLegal.end());
        const auto tactical=legalMoves(position,0,true);
        std::vector<Move> expectedTactical;
        for(const Move& move:allMoves) {
            if(isCapture(position,move)||move.promotion) expectedTactical.push_back(move);
        }
        if(tactical.size()!=expectedTactical.size()) return 111;
        for(const Move& move:tactical) {
            if(std::none_of(expectedTactical.begin(),expectedTactical.end(),
                [&](const Move& expected){return sameMove(move,expected);})) return 112;
        }
        if(hasAnyLegalMove(position,0)!=!allMoves.empty()) return 113;
    }

    // Quiescence must still recognise terminal positions after switching to
    // capture-only move generation.
    if(!loadFen(position,"7k/5Q2/6K1/8/8/8/8/8 b - - 0 1")) return 114;
    resetSearchState();
    if(quiescence(position,-INF,INF,0,0)!=0) return 115;
    if(!loadFen(position,"7k/6Q1/5K2/8/8/8/8/8 b - - 0 1")) return 116;
    resetSearchState();
    if(quiescence(position,-INF,INF,0,0)!=-MATE) return 117;

    // Deterministic random legal play checks the optimized generator against
    // the slow oracle after every position transition.
    if(!loadFen(position,START_FEN)) return 93;
    std::mt19937 randomMoves(0x5052554EU);
    for(int ply=0;ply<160;++ply) {
        if(!legalMoveSetsAgree(position)) return 94;
        if(!exchangeEvaluationsAgree(position)) return 151;
        const auto allLegal=legalMoves(position,0);
        const std::vector<Move> allMoves(allLegal.begin(),allLegal.end());
        const auto tactical=legalMoves(position,0,true);
        std::size_t expectedTactical=0;
        for(const Move& move:allMoves)
            if(isCapture(position,move)||move.promotion) ++expectedTactical;
        if(tactical.size()!=expectedTactical) return 118;
        if(hasAnyLegalMove(position,0)!=!allMoves.empty()) return 119;
        auto moves=legalMoves(position);
        if(moves.empty()) break;
        const Move selected=moves[
            static_cast<std::size_t>(randomMoves())%moves.size()
        ];
        makeMove(position,selected);
    }


    // A timed search must not stop at the old depth-12 ceiling when there
    // is still time available. Bare kings keep each iteration inexpensive.
    if(!loadFen(position,"7k/8/8/8/8/8/8/K7 w - - 0 1")) return 95;
    searchAborted.store(false,std::memory_order_relaxed);
    const Move timedBest=findBestMove(position,MAX_PLY-1,50,0);
    if(timedBest.from<0||timedBest.to<0||completedSearchDepth<=12) return 96;
    if(searchTimeLimited||searchNodeLimit!=0) return 97;

    if(!sliderTableIndicesAgree()) return 98;

    const std::array<std::string_view,6> evaluationPositions{{
        START_FEN,
        "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1",
        "r1bq1rk1/pp2bppp/2n1pn2/2pp4/3P4/2P1PN2/PP1NBPPP/R2Q1RK1 w - - 0 1",
        "7k/8/8/3pP3/8/8/8/K7 w - d6 0 1",
        "4k3/8/8/8/1b6/8/4r3/4K3 w - - 0 1",
        "7k/8/8/8/8/8/8/K7 w - - 0 1"
    }};
    for(std::size_t index=0;index<evaluationPositions.size();++index) {
        const std::string_view fen=evaluationPositions[index];
        if(!loadFen(position,fen)) {
            std::cerr<<"invalid evaluation test FEN "<<index<<"\\n";
            return 129;
        }
        if(!evaluationMapsMatchAttackReference(position)) {
            std::cerr<<"evaluation map fixture failed: "<<index<<"\\n";
            return 129;
        }
    }

    if(!shouldPruneLateQuietMove(false,false,false,true,3,12,0)) return 133;
    if(shouldPruneLateQuietMove(false,false,false,true,3,11,0)) return 134;
    if(shouldPruneLateQuietMove(true,false,false,true,3,20,0)) return 135;
    if(shouldPruneLateQuietMove(false,true,false,true,3,20,0)) return 136;
    if(shouldPruneLateQuietMove(false,false,true,true,3,20,0)) return 137;
    if(shouldPruneLateQuietMove(false,false,false,false,3,20,0)) return 138;

    if(!shouldPruneFutilityQuiet(false,false,false,true,2,2,0,-100,200)) return 139;
    if(shouldPruneFutilityQuiet(false,false,false,true,2,2,5000,-100,200)) return 140;
    if(shouldPruneFutilityQuiet(false,false,false,true,2,1,0,-100,200)) return 141;
    if(shouldPruneFutilityQuiet(false,false,false,true,2,2,0,-100,150)) return 142;
    if(shouldPruneFutilityQuiet(true,false,false,true,2,2,0,-100,200)) return 143;

    if(!shouldPruneLosingCapture(false,false,false,true,false,3,2,-241)) return 144;
    if(shouldPruneLosingCapture(false,false,true,true,false,3,2,-400)) return 145;
    if(shouldPruneLosingCapture(true,false,false,true,false,3,2,-400)) return 146;
    if(shouldPruneLosingCapture(false,true,false,true,false,3,2,-400)) return 147;
    if(shouldPruneLosingCapture(false,false,false,true,true,3,2,-400)) return 148;
    if(shouldPruneLosingCapture(false,false,false,true,false,6,2,-1000)) return 149;

    return 0;
}
