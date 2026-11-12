#include <algorithm>
#include <bit>
#include <atomic>
#include <array>
#include <cctype>
#include <chrono>
#include <charconv>
#include <cmath>
#include <cstdint>
#include <cstdlib>
#include <iostream>
#include <limits>
#include <mutex>
#include <sstream>
#include <stdexcept>
#include <string>
#include <string_view>
#include <thread>
#include <vector>

#if (defined(__GNUC__) || defined(__clang__)) && (defined(__x86_64__) || defined(__i386__))
#include <immintrin.h>
#define PRUNEX_RUNTIME_BMI2_DISPATCH 1
#endif

namespace prunex {
constexpr int INF = 32000;
constexpr int MATE = 30000;
constexpr std::string_view START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

enum Piece : int { EMPTY=0, WP=1, WN, WB, WR, WQ, WK, BP=7, BN, BB, BR, BQ, BK };
enum Color : int { WHITE=0, BLACK=1 };
enum Castle : int { WKCA=1, WQCA=2, BKCA=4, BQCA=8 };

struct Move { int from=-1, to=-1, promotion=EMPTY; bool enPassant=false, castle=false; };
constexpr int MAX_PLY = 128;
constexpr int MAX_QPLY = 18;
constexpr std::size_t MAX_LEGAL_MOVES = 256;

struct MoveList {
    Move* data = nullptr;
    std::size_t count = 0;
    int ply = 0;

    Move* begin() const { return data; }
    Move* end() const { return data + count; }
    Move& front() const { return data[0]; }
    std::size_t size() const { return count; }
    bool empty() const { return count == 0; }
    Move& operator[](std::size_t index) const { return data[index]; }
    void push_back(const Move& move) {
        if(count>=MAX_LEGAL_MOVES) {
            throw std::runtime_error("legal move buffer capacity exceeded");
        }
        data[count++]=move;
    }
};

struct ScoredMove { Move move; int score; };
struct MoveScratch {
    std::array<Move,MAX_LEGAL_MOVES> pseudo{};
    std::array<Move,MAX_LEGAL_MOVES> legal{};
    std::array<ScoredMove,MAX_LEGAL_MOVES> scored{};
    std::array<std::size_t,MAX_LEGAL_MOVES> order{};
    std::array<std::uint8_t,MAX_LEGAL_MOVES> stageByMove{};
    std::array<std::size_t,6> stageOffsets{};
    std::array<std::size_t,5> stageCursors{};
    std::array<std::size_t,5> stageEnds{};
    std::array<std::uint8_t,5> stageSorted{};
};
std::array<MoveScratch,MAX_PLY> moveScratch{};

struct Position {
    std::array<int,128> board{};
    std::array<std::array<std::uint64_t,7>,2> piecesBB{};
    std::array<std::uint64_t,2> occupancy{};
    int side=WHITE, castling=0, ep=-1, halfmove=0, fullmove=1;
    std::uint64_t key=0;
};

struct Undo {
    int captured=EMPTY, castling=0, ep=-1, halfmove=0, fullmove=1;
    std::uint64_t key=0;
};

struct ZobristKeys {
    std::array<std::array<std::uint64_t, 13>, 128> pieces{};
    std::array<std::uint64_t, 16> castling{};
    std::array<std::uint64_t, 128> enPassant{};
    std::uint64_t side=0;
};

const ZobristKeys& zobristKeys();
std::uint64_t computePositionKey(const Position& p);

constexpr bool onBoard(int s) { return s >= 0 && s < 128 && (s & 0x88) == 0; }
constexpr int fileOf(int s) { return s & 7; }
constexpr int rankOf(int s) { return s >> 4; }
constexpr int colorOf(int p) { return p == EMPTY ? -1 : (p <= WK ? WHITE : BLACK); }
constexpr int typeOf(int p) { return p == EMPTY ? EMPTY : ((p-1)%6)+1; }
constexpr int makePiece(int type, int color) { return type + (color == BLACK ? 6 : 0); }
std::string squareName(int s) { std::string x="a1"; x[0]=static_cast<char>('a'+fileOf(s)); x[1]=static_cast<char>('1'+rankOf(s)); return x; }
int parseSquare(std::string_view s) { if(s.size()!=2 || s[0]<'a'||s[0]>'h'||s[1]<'1'||s[1]>'8') return -1; return (s[1]-'1')*16+(s[0]-'a'); }
char pieceChar(int p) { static constexpr char chars[]=".PNBRQKpnbrqk"; return p>=0&&p<=12?chars[p]:'.'; }
int charPiece(char c) { switch(c) {case 'P':return WP;case 'N':return WN;case 'B':return WB;case 'R':return WR;case 'Q':return WQ;case 'K':return WK;case 'p':return BP;case 'n':return BN;case 'b':return BB;case 'r':return BR;case 'q':return BQ;case 'k':return BK;default:return EMPTY;} }

constexpr int bitboardSquare(int square88) {
    return rankOf(square88)*8+fileOf(square88);
}
constexpr std::uint64_t squareBit(int square88) {
    return onBoard(square88)?(std::uint64_t{1}<<bitboardSquare(square88)):0;
}
void removePositionPiece(Position& position,int square88) {
    const int piece=position.board[square88];
    if(piece==EMPTY) return;
    const int color=colorOf(piece),type=typeOf(piece);
    const std::uint64_t bit=squareBit(square88);
    position.piecesBB[color][type]&=~bit;
    position.occupancy[color]&=~bit;
    position.board[square88]=EMPTY;
}
void putPositionPiece(Position& position,int square88,int piece) {
    if(piece==EMPTY) {
        removePositionPiece(position,square88);
        return;
    }
    if(position.board[square88]!=EMPTY) removePositionPiece(position,square88);
    const int color=colorOf(piece),type=typeOf(piece);
    const std::uint64_t bit=squareBit(square88);
    position.board[square88]=piece;
    position.piecesBB[color][type]|=bit;
    position.occupancy[color]|=bit;
}
void rebuildBitboards(Position& position) {
    position.piecesBB={};
    position.occupancy={};
    for(int square=0;square<128;++square) {
        if(!onBoard(square)) continue;
        const int piece=position.board[square];
        if(piece==EMPTY) continue;
        const int color=colorOf(piece),type=typeOf(piece);
        const std::uint64_t bit=squareBit(square);
        position.piecesBB[color][type]|=bit;
        position.occupancy[color]|=bit;
    }
}
bool bitboardsConsistent(const Position& position) {
    Position rebuilt=position;
    rebuildBitboards(rebuilt);
    return rebuilt.piecesBB==position.piecesBB&&rebuilt.occupancy==position.occupancy;
}

bool parseIntegerToken(std::string_view token, int minimum, int maximum, int& value) {
    int parsed=0;
    const char* first=token.data();
    const char* last=first+token.size();
    auto result=std::from_chars(first,last,parsed);
    if(result.ec!=std::errc{}||result.ptr!=last||parsed<minimum||parsed>maximum) return false;
    value=parsed;
    return true;
}

bool parseFenCounter(const std::string& token, int minimum, int& value) {
    return parseIntegerToken(token,minimum,std::numeric_limits<int>::max(),value);
}

bool loadFen(Position& p, std::string_view fen) {
    p=Position{};
    std::istringstream in{std::string(fen)};
    std::string placement, stm, rights, ep, halfmove, fullmove, extra;
    if(!(in>>placement>>stm>>rights>>ep>>halfmove>>fullmove)||(in>>extra)) return false;
    int rank=7,file=0;
    bool previousDigit=false;
    for(char c:placement) {
        if(c=='/') {
            if(file!=8 || rank==0) return false;
            --rank;
            file=0;
            previousDigit=false;
        } else if(c>='1'&&c<='8') {
            if(previousDigit) return false;
            file+=c-'0';
            if(file>8) return false;
            previousDigit=true;
        } else {
            int pc=charPiece(c);
            if(pc==EMPTY||file>=8) return false;
            p.board[rank*16+file]=pc;
            ++file;
            previousDigit=false;
        }
    }
    if(rank!=0||file!=8) return false;
    if(stm!="w"&&stm!="b") return false;
    p.side=stm=="w"?WHITE:BLACK;
    if(rights!="-") {
        for(char c:rights) {
            int bit=0;
            if(c=='K') bit=WKCA;
            else if(c=='Q') bit=WQCA;
            else if(c=='k') bit=BKCA;
            else if(c=='q') bit=BQCA;
            else return false;
            if(p.castling&bit) return false;
            p.castling|=bit;
        }
    }
    p.ep=ep=="-"?-1:parseSquare(ep);
    if(ep!="-"&&p.ep<0) return false;
    if(p.ep>=0){
        int expectedRank=p.side==WHITE?5:2;
        int capturedSquare=p.ep+(p.side==WHITE?-16:16);
        int originSquare=p.ep+(p.side==WHITE?16:-16);
        if(rankOf(p.ep)!=expectedRank||p.board[p.ep]!=EMPTY||!onBoard(capturedSquare)||!onBoard(originSquare)) return false;
        if(p.board[capturedSquare]!=makePiece(1,1-p.side)||p.board[originSquare]!=EMPTY) return false;
    }
    if(!parseFenCounter(halfmove,0,p.halfmove)||!parseFenCounter(fullmove,1,p.fullmove)) return false;
    int wk=0,bk=0;
    for(int s=0;s<128;++s) if(onBoard(s)) { wk+=p.board[s]==WK; bk+=p.board[s]==BK; }
    if(wk!=1||bk!=1) return false;
    rebuildBitboards(p);
    p.key=computePositionKey(p);
    return true;
}

constexpr int square88From64(int square64) { return (square64/8)*16+(square64%8); }
constexpr int square64From88(int square88) { return rankOf(square88)*8+fileOf(square88); }
constexpr std::array<int,8> KNIGHT_DIRECTIONS{-33,-31,-18,-14,14,18,31,33};
constexpr std::array<int,8> KING_DIRECTIONS{-17,-16,-15,-1,1,15,16,17};
constexpr std::array<int,4> BISHOP_DIRECTIONS{-17,-15,15,17};
constexpr std::array<int,4> ROOK_DIRECTIONS{-16,-1,1,16};
constexpr std::array<std::uint64_t,64> buildKnightAttacks() {
 std::array<std::uint64_t,64> a{};
 for(int s=0;s<64;++s) for(int d:KNIGHT_DIRECTIONS) { int t=square88From64(s)+d; if(onBoard(t)) a[s]|=squareBit(t); }
 return a;
}
constexpr std::array<std::uint64_t,64> buildKingAttacks() {
 std::array<std::uint64_t,64> a{};
 for(int s=0;s<64;++s) for(int d:KING_DIRECTIONS) { int t=square88From64(s)+d; if(onBoard(t)) a[s]|=squareBit(t); }
 return a;
}
constexpr std::array<std::array<std::uint64_t,64>,2> buildPawnAttacks() {
 std::array<std::array<std::uint64_t,64>,2> a{};
 for(int s=0;s<64;++s) for(int c=WHITE;c<=BLACK;++c) for(int df:{-1,1}) {
  int t=square88From64(s)+(c==WHITE?16:-16)+df; if(onBoard(t)) a[c][s]|=squareBit(t);
 }
 return a;
}
inline constexpr auto KNIGHT_ATTACKS=buildKnightAttacks();
inline constexpr auto KING_ATTACKS=buildKingAttacks();
inline constexpr auto PAWN_ATTACKS=buildPawnAttacks();
template<std::size_t N>
std::uint64_t traceSlidingAttacks(int square64,std::uint64_t occupied,
                                  const std::array<int,N>& directions) {
    std::uint64_t attacks=0;
    const int from=square88From64(square64);
    for(int direction:directions) {
        for(int target=from+direction;onBoard(target);target+=direction) {
            const std::uint64_t bit=squareBit(target);
            attacks|=bit;
            if((occupied&bit)!=0) break;
        }
    }
    return attacks;
}

std::uint64_t relevantOccupancyMask(
    int square64,const std::array<int,4>& directions) {
    const int from=square88From64(square64);
    std::uint64_t mask=0;
    for(int direction:directions) {
        for(int target=from+direction;onBoard(target);target+=direction) {
            // The outermost edge square cannot change a ray beyond itself,
            // so it is intentionally omitted from the lookup index.
            if(!onBoard(target+direction)) break;
            mask|=squareBit(target);
        }
    }
    return mask;
}

std::uint64_t expandOccupancyIndex(std::uint32_t index,std::uint64_t mask) {
    std::uint64_t occupancy=0;
    unsigned outputBit=0;
    while(mask) {
        const std::uint64_t bit=mask&(~mask+1);
        mask&=mask-1;
        if(index&(std::uint32_t{1}<<outputBit)) occupancy|=bit;
        ++outputBit;
    }
    return occupancy;
}

// Use the hardware PEXT instruction when the running CPU supports BMI2.
// The portable implementation remains available for older x86 processors,
// WebAssembly, ARM, and compilers without per-function ISA targeting.
#if defined(PRUNEX_RUNTIME_BMI2_DISPATCH)
__attribute__((target("bmi2")))
std::uint32_t compressOccupancyBmi2(std::uint64_t occupied,std::uint64_t mask) {
    return static_cast<std::uint32_t>(_pext_u64(occupied,mask));
}

bool supportsBmi2() {
    static const bool supported=[] {
        __builtin_cpu_init();
        return __builtin_cpu_supports("bmi2");
    }();
    return supported;
}
#endif

std::uint32_t compressOccupancy(std::uint64_t occupied,std::uint64_t mask) {
#if defined(PRUNEX_RUNTIME_BMI2_DISPATCH)
    if(supportsBmi2()) return compressOccupancyBmi2(occupied,mask);
#endif
    std::uint32_t index=0;
    unsigned outputBit=0;
    while(mask) {
        const std::uint64_t bit=mask&(~mask+1);
        mask&=mask-1;
        if(occupied&bit) index|=std::uint32_t{1}<<outputBit;
        ++outputBit;
    }
    return index;
}

struct SliderAttackTable {
    std::array<std::uint64_t,64> masks{};
    std::array<std::size_t,64> offsets{};
    std::vector<std::uint64_t> attacks;

    template<std::size_t N>
    void initialize(const std::array<int,4>& directions) {
        std::size_t total=0;
        for(int square=0;square<64;++square) {
            masks[square]=relevantOccupancyMask(square,directions);
            offsets[square]=total;
            const unsigned bits=static_cast<unsigned>(std::popcount(masks[square]));
            total+=std::size_t{1}<<bits;
        }
        attacks.resize(total);
        for(int square=0;square<64;++square) {
            const unsigned bits=static_cast<unsigned>(std::popcount(masks[square]));
            const std::size_t subsetCount=std::size_t{1}<<bits;
            for(std::size_t subset=0;subset<subsetCount;++subset) {
                const auto occupancy=expandOccupancyIndex(
                    static_cast<std::uint32_t>(subset),masks[square]);
                attacks[offsets[square]+subset]=
                    traceSlidingAttacks(square,occupancy,directions);
            }
        }
    }

    std::uint64_t lookup(int square64,std::uint64_t occupied) const {
        const auto index=compressOccupancy(occupied,masks[square64]);
        return attacks[offsets[square64]+index];
    }
};

struct SlidingAttackTables {
    SliderAttackTable bishops;
    SliderAttackTable rooks;

    SlidingAttackTables() {
        bishops.initialize<4>(BISHOP_DIRECTIONS);
        rooks.initialize<4>(ROOK_DIRECTIONS);
    }
};

const SlidingAttackTables& slidingAttackTables() {
    static const SlidingAttackTables tables;
    return tables;
}

std::uint64_t bishopAttacks(int square,std::uint64_t occupied) {
    return slidingAttackTables().bishops.lookup(square,occupied);
}
std::uint64_t rookAttacks(int square,std::uint64_t occupied) {
    return slidingAttackTables().rooks.lookup(square,occupied);
}
std::uint64_t attackersTo(const Position& p,int sq,int by) {
    if(!onBoard(sq)) return 0;
    const int target=square64From88(sq);
    const std::uint64_t occupied=p.occupancy[WHITE]|p.occupancy[BLACK];
    std::uint64_t attackers=PAWN_ATTACKS[1-by][target]&p.piecesBB[by][1];
    attackers|=KNIGHT_ATTACKS[target]&p.piecesBB[by][2];
    attackers|=KING_ATTACKS[target]&p.piecesBB[by][6];
    attackers|=bishopAttacks(target,occupied)&
        (p.piecesBB[by][3]|p.piecesBB[by][5]);
    attackers|=rookAttacks(target,occupied)&
        (p.piecesBB[by][4]|p.piecesBB[by][5]);
    return attackers;
}
bool attacked(const Position& p,int sq,int by) {
    return attackersTo(p,sq,by)!=0;
}
int kingSquare(const Position& p,int color) {
    const auto kings=p.piecesBB[color][6];
    return kings?square88From64(static_cast<int>(std::countr_zero(kings))):-1;
}
bool inCheck(const Position& p,int color) {
    const int king=kingSquare(p,color);
    return king>=0&&attackersTo(p,king,1-color)!=0;
}
void addMove(MoveList& out,int from,int to,int promo=EMPTY,bool ep=false,bool castle=false) {
 out.push_back({from,to,promo,ep,castle});
}
void addPawnMove(MoveList& out,int from,int to,int color,bool ep=false) {
 if(rankOf(to)==(color==WHITE?7:0)) for(int type:{5,4,3,2}) addMove(out,from,to,makePiece(type,color),ep);
 else addMove(out,from,to,EMPTY,ep);
}
MoveList pseudoMoves(const Position& p,int ply=0) {
    const int scratchPly=std::clamp(ply,0,MAX_PLY-1);
    MoveList out{moveScratch[scratchPly].pseudo.data(),0,scratchPly};
 const int us=p.side, them=1-us, step=us==WHITE?16:-16;
 const std::uint64_t own=p.occupancy[us], occ=own|p.occupancy[them];
 auto pawns=p.piecesBB[us][1];
 while(pawns) {
  int s=static_cast<int>(std::countr_zero(pawns)); pawns&=pawns-1;
  int from=square88From64(s), one=from+step;
  if(onBoard(one)&&p.board[one]==EMPTY) {
   addPawnMove(out,from,one,us);
   int two=one+step;
   if(rankOf(from)==(us==WHITE?1:6)&&p.board[two]==EMPTY) addMove(out,from,two);
  }
  for(int df:{-1,1}) {
   int to=one+df; if(!onBoard(to)) continue;
   int target=p.board[to];
   if(target!=EMPTY&&colorOf(target)==them&&typeOf(target)!=6) addPawnMove(out,from,to,us);
   else if(to==p.ep) addMove(out,from,to,EMPTY,true);
  }
 }
 auto leaper=[&](int type,const auto& table) {
  auto pieces=p.piecesBB[us][type];
  while(pieces) {
   int from64=static_cast<int>(std::countr_zero(pieces)); pieces&=pieces-1;
   int from=square88From64(from64); auto targets=table[from64]&~own;
   while(targets) {
    int to64=static_cast<int>(std::countr_zero(targets)); targets&=targets-1;
    int to=square88From64(to64), target=p.board[to];
    if(target!=EMPTY&&typeOf(target)==6) continue;
    addMove(out,from,to);
   }
  }
 };
 leaper(2,KNIGHT_ATTACKS); leaper(6,KING_ATTACKS);
 auto sliders=[&](int type,bool diagonal,bool orthogonal) {
  auto pieces=p.piecesBB[us][type];
  while(pieces) {
   int from64=static_cast<int>(std::countr_zero(pieces)); pieces&=pieces-1;
   int from=square88From64(from64); std::uint64_t targets=0;
   if(diagonal) targets|=bishopAttacks(from64,occ);
   if(orthogonal) targets|=rookAttacks(from64,occ);
   targets&=~own;
   while(targets) {
    int to64=static_cast<int>(std::countr_zero(targets)); targets&=targets-1;
    int to=square88From64(to64), target=p.board[to];
    if(target!=EMPTY&&typeOf(target)==6) continue;
    addMove(out,from,to);
   }
  }
 };
 sliders(3,true,false); sliders(4,false,true); sliders(5,true,true);
 const int king=us==WHITE?4:116, rook=makePiece(4,us);
 if(p.board[king]==makePiece(6,us)&&!inCheck(p,us)) {
  if(us==WHITE) {
   if((p.castling&WKCA)&&p.board[7]==rook&&p.board[5]==EMPTY&&p.board[6]==EMPTY&&
      !attacked(p,5,them)&&!attacked(p,6,them)) addMove(out,4,6,EMPTY,false,true);
   if((p.castling&WQCA)&&p.board[0]==rook&&p.board[1]==EMPTY&&p.board[2]==EMPTY&&p.board[3]==EMPTY&&
      !attacked(p,3,them)&&!attacked(p,2,them)) addMove(out,4,2,EMPTY,false,true);
  } else {
   if((p.castling&BKCA)&&p.board[119]==rook&&p.board[117]==EMPTY&&p.board[118]==EMPTY&&
      !attacked(p,117,them)&&!attacked(p,118,them)) addMove(out,116,118,EMPTY,false,true);
   if((p.castling&BQCA)&&p.board[112]==rook&&p.board[113]==EMPTY&&p.board[114]==EMPTY&&p.board[115]==EMPTY&&
      !attacked(p,115,them)&&!attacked(p,114,them)) addMove(out,116,114,EMPTY,false,true);
  }
 }
 return out;
}

Undo makeMove(Position& p,const Move& m) {
    Undo undo{p.board[m.to],p.castling,p.ep,p.halfmove,p.fullmove,p.key};
    const auto& keys=zobristKeys();
    const int movingPiece=p.board[m.from];
    const int placedPiece=m.promotion?m.promotion:movingPiece;

    // Remove the old position state before changing pieces or rights.
    p.key^=keys.castling[p.castling];
    if(p.ep>=0) p.key^=keys.enPassant[p.ep];

    p.key^=keys.pieces[m.from][movingPiece];
    if(m.enPassant) {
        const int capturedSquare=m.to+(p.side==WHITE?-16:16);
        undo.captured=p.board[capturedSquare];
        if(undo.captured!=EMPTY) p.key^=keys.pieces[capturedSquare][undo.captured];
        removePositionPiece(p,capturedSquare);
    } else if(undo.captured!=EMPTY) {
        p.key^=keys.pieces[m.to][undo.captured];
    }

    removePositionPiece(p,m.from);
    if(!m.enPassant&&undo.captured!=EMPTY) removePositionPiece(p,m.to);
    putPositionPiece(p,m.to,placedPiece);
    p.key^=keys.pieces[m.to][placedPiece];

    if(m.castle) {
        const int rookFrom=m.to>m.from?m.from+3:m.from-4;
        const int rookTo=m.to>m.from?m.from+1:m.from-1;
        const int rook=p.board[rookFrom];
        if(rook==EMPTY) throw std::logic_error("castling move has no rook");
        p.key^=keys.pieces[rookFrom][rook];
        if(p.board[rookTo]!=EMPTY) p.key^=keys.pieces[rookTo][p.board[rookTo]];
        removePositionPiece(p,rookFrom);
        if(p.board[rookTo]!=EMPTY) removePositionPiece(p,rookTo);
        putPositionPiece(p,rookTo,rook);
        p.key^=keys.pieces[rookTo][rook];
    }

    if(movingPiece==WK) p.castling&=~(WKCA|WQCA);
    if(movingPiece==BK) p.castling&=~(BKCA|BQCA);
    if(m.from==0||m.to==0) p.castling&=~WQCA;
    if(m.from==7||m.to==7) p.castling&=~WKCA;
    if(m.from==112||m.to==112) p.castling&=~BQCA;
    if(m.from==119||m.to==119) p.castling&=~BKCA;

    p.ep=(typeOf(movingPiece)==1&&std::abs(m.to-m.from)==32)
        ?(m.to+m.from)/2:-1;
    p.halfmove=(typeOf(movingPiece)==1||undo.captured!=EMPTY)?0:p.halfmove+1;
    if(p.side==BLACK) ++p.fullmove;
    p.side=1-p.side;

    // Add the new rights, en-passant square and side-to-move key.
    p.key^=keys.castling[p.castling];
    if(p.ep>=0) p.key^=keys.enPassant[p.ep];
    p.key^=keys.side;
    return undo;
}

void undoMove(Position& p,const Move& m,const Undo& undo) {
    p.side=1-p.side;
    if(p.side==BLACK) --p.fullmove;
    p.castling=undo.castling;
    p.ep=undo.ep;
    p.halfmove=undo.halfmove;

    const int movedPiece=p.board[m.to];
    removePositionPiece(p,m.to);
    if(m.castle) {
        const int rookFrom=m.to>m.from?m.from+3:m.from-4;
        const int rookTo=m.to>m.from?m.from+1:m.from-1;
        const int rook=p.board[rookTo];
        removePositionPiece(p,rookTo);
        putPositionPiece(p,rookFrom,rook);
    }
    putPositionPiece(p,m.from,m.promotion?makePiece(1,p.side):movedPiece);
    if(m.enPassant) {
        const int capturedSquare=m.to+(p.side==WHITE?-16:16);
        putPositionPiece(p,capturedSquare,undo.captured);
    } else if(undo.captured!=EMPTY) {
        putPositionPiece(p,m.to,undo.captured);
    }
    p.key=undo.key;
}
struct KingSafetyInfo {
    std::uint64_t checkers=0;
    std::uint64_t pinned=0;
    std::uint64_t evasionMask=~std::uint64_t{0};
    std::array<std::uint64_t,64> pinRay{};
};

KingSafetyInfo buildKingSafetyInfo(const Position& position,int color) {
    KingSafetyInfo info;
    const int king=kingSquare(position,color);
    if(king<0) {
        info.checkers=~std::uint64_t{0};
        return info;
    }

    const int enemy=1-color;
    info.checkers=attackersTo(position,king,enemy);
    const int checkerCount=std::popcount(info.checkers);
    if(checkerCount==1) {
        const int checker64=static_cast<int>(std::countr_zero(info.checkers));
        const int checker=square88From64(checker64);
        const int checkerPiece=position.board[checker];
        const int checkerType=typeOf(checkerPiece);
        const int fileDelta=fileOf(checker)-fileOf(king);
        const int rankDelta=rankOf(checker)-rankOf(king);
        const bool diagonal=std::abs(fileDelta)==std::abs(rankDelta)&&fileDelta!=0;
        const bool straight=(fileDelta==0) != (rankDelta==0);
        const bool slidingChecker=checkerType==5||
            (checkerType==3&&diagonal)||(checkerType==4&&straight);
        info.evasionMask=squareBit(checker);
        if(slidingChecker) {
            const int fileStep=(fileDelta>0)-(fileDelta<0);
            const int rankStep=(rankDelta>0)-(rankDelta<0);
            const int step=rankStep*16+fileStep;
            for(int square=king+step;onBoard(square);square+=step) {
                info.evasionMask|=squareBit(square);
                if(square==checker) break;
            }
        }
    } else if(checkerCount>1) {
        info.evasionMask=0;
    }

    constexpr std::array<int,8> directions{
        -17,-15,15,17,-16,-1,1,16
    };
    for(std::size_t directionIndex=0;directionIndex<directions.size();++directionIndex) {
        const int step=directions[directionIndex];
        const bool diagonal=directionIndex<4;
        int candidate=-1;
        std::uint64_t line=0;
        for(int square=king+step;onBoard(square);square+=step) {
            const int piece=position.board[square];
            line|=squareBit(square);
            if(piece==EMPTY) continue;
            if(colorOf(piece)==color) {
                if(candidate>=0) break;
                candidate=square;
                continue;
            }

            if(candidate>=0) {
                const int type=typeOf(piece);
                const bool pinner=type==5||(diagonal?type==3:type==4);
                if(pinner) {
                    const int candidate64=square64From88(candidate);
                    info.pinned|=squareBit(candidate);
                    info.pinRay[candidate64]=line;
                }
            }
            break;
        }
    }
    return info;
}

MoveList legalMoves(Position& position,int ply=0) {
    const int scratchPly=std::clamp(ply,0,MAX_PLY-1);
    const auto candidates=pseudoMoves(position,scratchPly);
    MoveList legal{moveScratch[scratchPly].legal.data(),0,scratchPly};
    const int movingSide=position.side;
    const KingSafetyInfo kingSafety=buildKingSafetyInfo(position,movingSide);
    const int checkCount=std::popcount(kingSafety.checkers);

    for(const Move& move:candidates) {
        const int movingPiece=position.board[move.from];
        const bool kingMove=typeOf(movingPiece)==6;

        // King moves and en-passant need an exact occupancy update: moving a
        // king changes the attacked square, while en-passant can uncover two
        // lines at once by removing a pawn from a different square.
        if(kingMove||move.enPassant) {
            const Undo undo=makeMove(position,move);
            const bool safe=!inCheck(position,movingSide);
            undoMove(position,move,undo);
            if(safe) legal.push_back(move);
            continue;
        }

        // A double check can only be answered by moving the king.
        if(checkCount>1) continue;

        const std::uint64_t destination=squareBit(move.to);
        if(checkCount==1&&(kingSafety.evasionMask&destination)==0) continue;

        const int from64=square64From88(move.from);
        const std::uint64_t origin=squareBit(move.from);
        if((kingSafety.pinned&origin)!=0&&
           (kingSafety.pinRay[from64]&destination)==0) continue;

        legal.push_back(move);
    }
    return legal;
}

std::string moveUci(const Move&m){std::string s=squareName(m.from)+squareName(m.to);if(m.promotion){char c=static_cast<char>(std::tolower(pieceChar(m.promotion)));s+=c;}return s;}
bool parseUciMove(Position& p,std::string_view text,Move& result){for(const Move&m:legalMoves(p))if(moveUci(m)==text){result=m;return true;}return false;}

#ifndef PRUNEX_TT_BITS
#define PRUNEX_TT_BITS 18
#endif
constexpr int TT_BITS = PRUNEX_TT_BITS;
constexpr std::size_t TT_SIZE = std::size_t{1} << TT_BITS;
constexpr std::size_t TT_WAYS = 2;
constexpr std::size_t TT_BUCKETS = TT_SIZE / TT_WAYS;
constexpr std::array<int, 7> MG_VALUE{0, 100, 325, 335, 510, 950, 0};
constexpr std::array<int, 7> EG_VALUE{0, 120, 315, 350, 525, 930, 0};

enum Bound : std::uint8_t { TT_NONE, TT_EXACT, TT_LOWER, TT_UPPER };

struct TTEntry {
    std::uint64_t key=0;
    Move best{};
    int score=0;
    int depth=-1;
    std::uint8_t bound=TT_NONE;
    std::uint8_t generation=0;
};



using TTCluster = std::array<TTEntry, TT_WAYS>;
constexpr std::size_t MEBIBYTE=1024U*1024U;
constexpr std::size_t DEFAULT_TT_BYTES=TT_BUCKETS*sizeof(TTCluster);
constexpr int DEFAULT_HASH_MB=static_cast<int>(
    std::max<std::size_t>(1,(DEFAULT_TT_BYTES+MEBIBYTE-1)/MEBIBYTE));
std::vector<TTCluster> transpositionTable(TT_BUCKETS);
std::size_t ttBucketCount=TT_BUCKETS;
std::size_t ttBucketMask=TT_BUCKETS-1;
int configuredHashMB=DEFAULT_HASH_MB;
std::array<std::uint64_t, MAX_PLY> searchPathKeys{};
std::array<Move, MAX_PLY> searchPathMoves{};
std::array<int, MAX_PLY> searchPathPieceTypes{};
std::array<std::array<Move, 128>, 7> counterMoves{};
std::array<std::array<Move, 2>, MAX_PLY> killerMoves{};
std::array<std::array<std::array<int, 128>, 128>, 2> historyScores{};
std::uint64_t nodes=0;
int lastSearchScore=0;
int completedSearchDepth=0;
std::uint64_t ttHits=0;
std::uint8_t ttGeneration=0;
bool searchTimeLimited=false;
std::uint64_t searchNodeLimit=0;
std::atomic<bool> searchAborted{false};
bool suppressEngineOutput=false;
#ifndef __EMSCRIPTEN__
std::mutex outputMutex;
#endif

void emitLine(const std::string& line) {
    if(suppressEngineOutput) return;
#ifndef __EMSCRIPTEN__
    std::lock_guard<std::mutex> lock(outputMutex);
#endif
    std::cout << line << '\n' << std::flush;
}

void clearTranspositionTable() {
    for(auto& cluster:transpositionTable) cluster.fill(TTEntry{});
}

bool resizeTranspositionTable(int megabytes) {
    if(megabytes<1||megabytes>4096) return false;
    const std::size_t requestedBytes=static_cast<std::size_t>(megabytes)*MEBIBYTE;
    const std::size_t maximumBuckets=requestedBytes/sizeof(TTCluster);
    if(maximumBuckets==0) return false;
    const std::size_t newBucketCount=std::bit_floor(maximumBuckets);
    if(newBucketCount==0) return false;

    try {
        std::vector<TTCluster> replacement(newBucketCount);
        transpositionTable.swap(replacement);
    } catch(const std::bad_alloc&) {
        return false;
    }

    ttBucketCount=newBucketCount;
    ttBucketMask=newBucketCount-1;
    configuredHashMB=megabytes;
    ttGeneration=0;
    clearTranspositionTable();
    return true;
}

TTEntry& probeTranspositionTable(std::uint64_t key,bool& found) {
    auto& cluster=transpositionTable[key&ttBucketMask];
    TTEntry* replacement=&cluster.front();
    int replacementQuality=std::numeric_limits<int>::max();

    for(auto& entry:cluster) {
        if(entry.bound!=TT_NONE&&entry.key==key) {
            found=true;
            return entry;
        }
        if(entry.bound==TT_NONE) {
            found=false;
            return entry;
        }

        const int age=static_cast<std::uint8_t>(ttGeneration-entry.generation);
        const int quality=entry.depth-age*8;
        if(quality<replacementQuality) {
            replacementQuality=quality;
            replacement=&entry;
        }
    }

    found=false;
    return *replacement;
}

void resetSearchState() {
    clearTranspositionTable();
    searchPathKeys.fill(0);
    searchPathMoves.fill(Move{});
    searchPathPieceTypes.fill(0);
    counterMoves={};
    historyScores={};
    for(auto& pair:killerMoves) pair={Move{},Move{}};
    nodes=0;
    lastSearchScore=0;
    completedSearchDepth=0;
    ttHits=0;
    ttGeneration=0;
    searchTimeLimited=false;
    searchNodeLimit=0;
    searchAborted.store(false,std::memory_order_relaxed);
}
std::chrono::steady_clock::time_point searchDeadline{};

bool searchShouldStop() {
    if(searchAborted.load(std::memory_order_relaxed)) return true;
    if(searchNodeLimit>0&&nodes>=searchNodeLimit) {
        searchAborted.store(true,std::memory_order_relaxed);
        return true;
    }
    if(!searchTimeLimited||(nodes&127ULL)!=0) return false;
    if(std::chrono::steady_clock::now()>=searchDeadline) searchAborted.store(true,std::memory_order_relaxed);
    return searchAborted.load(std::memory_order_relaxed);
}

int hashFullPermille() {
    constexpr std::size_t sampleEntries=1000;
    constexpr std::size_t maximumSampleClusters=sampleEntries/TT_WAYS;
    const std::size_t sampleClusters=std::min(ttBucketCount,maximumSampleClusters);
    std::size_t used=0;
    for(std::size_t index=0;index<sampleClusters;++index) {
        for(const auto& entry:transpositionTable[index]) {
            if(entry.generation==ttGeneration&&entry.bound!=TT_NONE) ++used;
        }
    }
    const std::size_t sampledEntries=sampleClusters*TT_WAYS;
    return sampledEntries==0?0:static_cast<int>(used*1000/sampledEntries);
}

std::uint64_t splitMix64(std::uint64_t& state) {
    std::uint64_t z=(state+=0x9E3779B97F4A7C15ULL);
    z=(z^(z>>30))*0xBF58476D1CE4E5B9ULL;
    z=(z^(z>>27))*0x94D049BB133111EBULL;
    return z^(z>>31);
}

const ZobristKeys& zobristKeys() {
    static const ZobristKeys keys=[] {
        ZobristKeys result;
        std::uint64_t seed=0x5052554E45584348ULL;
        for(auto& square:result.pieces) for(auto& piece:square) piece=splitMix64(seed);
        for(auto& key:result.castling) key=splitMix64(seed);
        for(auto& key:result.enPassant) key=splitMix64(seed);
        result.side=splitMix64(seed);
        return result;
    }();
    return keys;
}

std::uint64_t computePositionKey(const Position& p) {
    const auto& keys=zobristKeys();
    std::uint64_t key=0;
    for(int square=0;square<128;++square) {
        if(!onBoard(square)) continue;
        const int piece=p.board[square];
        if(piece!=EMPTY) key^=keys.pieces[square][piece];
    }
    key^=keys.castling[p.castling];
    if(p.ep>=0) key^=keys.enPassant[p.ep];
    if(p.side==BLACK) key^=keys.side;
    return key;
}

std::uint64_t positionKey(const Position& p) {
    return p.key;
}

bool repeatedPosition(std::uint64_t key,int ply,int reversiblePlies) {
    const int earliest=std::max(0,ply-reversiblePlies);
    for(int previous=ply-2;previous>=earliest;previous-=2) {
        if(searchPathKeys[previous]==key) return true;
    }
    return false;
}

bool sameMove(const Move& a,const Move& b) {
    return a.from==b.from&&a.to==b.to&&a.promotion==b.promotion;
}

int scoreFromTable(int score,int ply) {
    if(score>MATE-100) return score-ply;
    if(score<-MATE+100) return score+ply;
    return score;
}

int scoreToTable(int score,int ply) {
    if(score>MATE-100) return score+ply;
    if(score<-MATE+100) return score-ply;
    return score;
}

bool isCapture(const Position& p,const Move& m) {
    return m.enPassant||p.board[m.to]!=EMPTY;
}

int leastValuableAttacker(const Position& p,int target,int color) {
    if(!onBoard(target)) return -1;
    const int target64=square64From88(target);
    const std::uint64_t occupied=p.occupancy[WHITE]|p.occupancy[BLACK];

    // Examine attackers in ascending material order. The least-significant
    // attacker is selected deterministically within each piece class.
    for(int type=1;type<=6;++type) {
        std::uint64_t attackers=0;
        if(type==1) attackers=PAWN_ATTACKS[1-color][target64]&p.piecesBB[color][1];
        else if(type==2) attackers=KNIGHT_ATTACKS[target64]&p.piecesBB[color][2];
        else if(type==3)
            attackers=bishopAttacks(target64,occupied)&p.piecesBB[color][3];
        else if(type==4)
            attackers=rookAttacks(target64,occupied)&p.piecesBB[color][4];
        else if(type==5) {
            const auto diagonal=bishopAttacks(target64,occupied)&p.piecesBB[color][5];
            const auto orthogonal=rookAttacks(target64,occupied)&p.piecesBB[color][5];
            attackers=diagonal|orthogonal;
        } else attackers=KING_ATTACKS[target64]&p.piecesBB[color][6];

        if(attackers) {
            const int square64=static_cast<int>(std::countr_zero(attackers));
            return square88From64(square64);
        }
    }
    return -1;
}
int staticExchangeEvaluation(const Position& original,const Move& move) {
    if(!isCapture(original,move)) return 0;
    Position position=original;
    const int target=move.to;
    const int capturedSquare=move.enPassant
        ? target+(original.side==WHITE?-16:16)
        : target;
    const int captured=position.board[capturedSquare];
    const int moving=position.board[move.from];
    if(captured==EMPTY||moving==EMPTY) return 0;

    std::array<int,32> gains{};
    int occupant=move.promotion?move.promotion:moving;
    gains[0]=MG_VALUE[typeOf(captured)];
    if(move.promotion) gains[0]+=MG_VALUE[typeOf(move.promotion)]-MG_VALUE[1];

    removePositionPiece(position,move.from);
    removePositionPiece(position,capturedSquare);
    removePositionPiece(position,target);
    putPositionPiece(position,target,occupant);
    int side=1-original.side;
    int depth=0;

    while(depth<30) {
        const int attackerSquare=leastValuableAttacker(position,target,side);
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

int moveOrderingScore(const Position& p,const Move& m,const Move& hashMove,int ply,
                      int* exchangeOut=nullptr) {
    if(exchangeOut) *exchangeOut=0;
    if(hashMove.from>=0&&sameMove(m,hashMove)) return 2000000;
    int score=0;
    if(m.promotion) score+=900000+MG_VALUE[typeOf(m.promotion)]*8;
    if(isCapture(p,m)) {
        const int victim=m.enPassant?makePiece(1,1-p.side):p.board[m.to];
        const int exchange=staticExchangeEvaluation(p,m);
        if(exchangeOut) *exchangeOut=exchange;
        score+=1000000+(exchange>=0?200000:-200000)+exchange*16
            +MG_VALUE[typeOf(victim)]*4-MG_VALUE[typeOf(p.board[m.from])];
        return score;
    }
    if(ply<MAX_PLY) {
        if(sameMove(m,killerMoves[ply][0])) return 800000;
        if(sameMove(m,killerMoves[ply][1])) return 790000;
    }
    if(ply>0&&ply<MAX_PLY) {
        const int previousType=searchPathPieceTypes[ply-1];
        const Move& previous=searchPathMoves[ply-1];
        if(previousType>=1&&previousType<=6&&previous.to>=0&&
           sameMove(m,counterMoves[previousType][previous.to])) return 780000;
    }
    return score+historyScores[p.side][m.from][m.to];
}

// Staged move selection: hash move, profitable captures/promotions,
// killer/counter quiets, remaining quiets, then losing captures. Unlike the
// previous eager full-list sort, the picker selects the next best candidate
// only when the search actually asks for it, so beta cutoffs avoid ordering
// work on moves that are never searched.
class MovePicker {
public:
    MovePicker(const Position& position,MoveList moves,const Move& hashMove,int ply)
        : moves_(moves),scratch_(moveScratch[moves.ply]) {
        std::array<std::size_t,5> counts{};
        scratch_.stageSorted.fill(0);
        for(std::size_t index=0;index<moves_.size();++index) {
            const Move& move=moves_[index];
            int exchange=0;
            const int score=moveOrderingScore(position,move,hashMove,ply,&exchange);
            scratch_.scored[index]={move,score};
            const bool capture=isCapture(position,move);
            const bool promotion=move.promotion!=EMPTY;
            std::uint8_t stage=4;
            if(hashMove.from>=0&&sameMove(move,hashMove)) stage=0;
            else if(promotion||(capture&&exchange>=0)) stage=1;
            else if(!capture&&score>=780000) stage=2;
            else if(!capture) stage=3;
            scratch_.stageByMove[index]=stage;
            ++counts[stage];
        }

        scratch_.stageOffsets[0]=0;
        for(std::size_t stage=0;stage<5;++stage) {
            scratch_.stageOffsets[stage+1]=scratch_.stageOffsets[stage]+counts[stage];
            scratch_.stageCursors[stage]=scratch_.stageOffsets[stage];
            scratch_.stageEnds[stage]=scratch_.stageOffsets[stage+1];
        }

        auto writePositions=scratch_.stageCursors;
        for(std::size_t index=0;index<moves_.size();++index) {
            const std::size_t stage=scratch_.stageByMove[index];
            scratch_.order[writePositions[stage]++]=index;
        }

        // Stage ordering is deferred until that stage is first requested.
        // A cutoff in the capture stage therefore avoids sorting killers,
        // quiets and losing captures that the search never reaches.
    }

    Move next() {
        while(stage_<5) {
            if(!scratch_.stageSorted[stage_]) {
                const auto first=scratch_.order.begin()+static_cast<std::ptrdiff_t>(scratch_.stageOffsets[stage_]);
                const auto last=scratch_.order.begin()+static_cast<std::ptrdiff_t>(scratch_.stageEnds[stage_]);
                std::sort(first,last,[&](std::size_t left,std::size_t right) {
                    const auto& a=scratch_.scored[left];
                    const auto& b=scratch_.scored[right];
                    if(a.score!=b.score) return a.score>b.score;
                    if(a.move.from!=b.move.from) return a.move.from<b.move.from;
                    if(a.move.to!=b.move.to) return a.move.to<b.move.to;
                    return a.move.promotion<b.move.promotion;
                });
                scratch_.stageSorted[stage_]=1;
            }
            if(scratch_.stageCursors[stage_]<scratch_.stageEnds[stage_]) {
                const std::size_t index=scratch_.order[scratch_.stageCursors[stage_]++];
                return scratch_.scored[index].move;
            }
            ++stage_;
        }
        return Move{};
    }

private:
    MoveList moves_;
    MoveScratch& scratch_;
    std::size_t stage_=0;
};

void orderMoves(const Position& p,MoveList& moves,const Move& hashMove,int ply) {
    if(moves.size()>MAX_LEGAL_MOVES) {
        throw std::runtime_error("legal move count exceeds the move-ordering buffer");
    }

    auto& scored=moveScratch[moves.ply].scored;
    const std::size_t count=moves.size();
    for(std::size_t index=0;index<count;++index) {
        const Move& move=moves[index];
        scored[index]={move,moveOrderingScore(p,move,hashMove,ply)};
    }

    std::sort(scored.begin(),scored.begin()+static_cast<std::ptrdiff_t>(count),
        [](const ScoredMove& left,const ScoredMove& right) {
            if(left.score!=right.score) return left.score>right.score;
            if(left.move.from!=right.move.from) return left.move.from<right.move.from;
            if(left.move.to!=right.move.to) return left.move.to<right.move.to;
            return left.move.promotion<right.move.promotion;
        });

    for(std::size_t index=0;index<count;++index) {
        moves[index]=scored[index].move;
    }
}

bool isPassedPawn(const Position& p,int square,int color) {
    if(!onBoard(square)||p.board[square]!=makePiece(1,color)) return false;
    const int file=fileOf(square);
    const int rank=rankOf(square);
    std::uint64_t enemyPawns=p.piecesBB[1-color][1];
    while(enemyPawns) {
        const int enemySquare=static_cast<int>(std::countr_zero(enemyPawns));
        enemyPawns&=enemyPawns-1;
        const int enemyFile=enemySquare%8;
        const int enemyRank=enemySquare/8;
        if(std::abs(enemyFile-file)<=1&&
           (color==WHITE?enemyRank>rank:enemyRank<rank)) return false;
    }
    return true;
}

struct EvaluationMaps {
    std::array<std::array<std::uint8_t,64>,2> attacks{};
    std::array<std::uint64_t,2> pawnAttacks{};
    std::array<int,2> mobilityMiddle{};
    std::array<int,2> mobilityEnding{};
    std::array<int,2> kingPressureMiddle{};
    std::array<int,2> kingPressureEnding{};
};

void buildEvaluationMaps(const Position& p,EvaluationMaps& maps) {
    constexpr std::array<int,7> mobilityMiddleWeight{0,0,4,3,2,1,0};
    constexpr std::array<int,7> mobilityEndingWeight{0,0,3,3,2,1,0};
    constexpr std::array<int,7> mobilityCap{0,0,8,13,14,27,0};
    const std::uint64_t occupied=p.occupancy[WHITE]|p.occupancy[BLACK];

    auto markTargets=[&](int color,std::uint64_t targets) {
        while(targets) {
            const int target=static_cast<int>(std::countr_zero(targets));
            targets&=targets-1;
            auto& count=maps.attacks[color][target];
            if(count<std::numeric_limits<std::uint8_t>::max()) ++count;
        }
    };

    // Attack maps are constructed from the piece bitboards. Slider rays
    // include the first occupied square, matching the board attack semantics.
    for(int color=WHITE;color<=BLACK;++color) {
        for(int type=1;type<=6;++type) {
            std::uint64_t pieces=p.piecesBB[color][type];
            while(pieces) {
                const int square=static_cast<int>(std::countr_zero(pieces));
                pieces&=pieces-1;
                std::uint64_t targets=0;
                if(type==1) {
                    targets=PAWN_ATTACKS[color][square];
                    maps.pawnAttacks[color]|=targets;
                } else if(type==2) targets=KNIGHT_ATTACKS[square];
                else if(type==3) targets=bishopAttacks(square,occupied);
                else if(type==4) targets=rookAttacks(square,occupied);
                else if(type==5)
                    targets=bishopAttacks(square,occupied)|rookAttacks(square,occupied);
                else targets=KING_ATTACKS[square];
                markTargets(color,targets);
            }
        }
    }

    // Safe mobility excludes friendly-occupied squares and enemy pawn
    // attacks. Bit counts avoid repeatedly tracing mailbox rays.
    for(int color=WHITE;color<=BLACK;++color) {
        for(int type=2;type<=5;++type) {
            std::uint64_t pieces=p.piecesBB[color][type];
            while(pieces) {
                const int square=static_cast<int>(std::countr_zero(pieces));
                pieces&=pieces-1;
                std::uint64_t targets=0;
                if(type==2) targets=KNIGHT_ATTACKS[square];
                else if(type==3) targets=bishopAttacks(square,occupied);
                else if(type==4) targets=rookAttacks(square,occupied);
                else targets=bishopAttacks(square,occupied)|rookAttacks(square,occupied);

                targets&=~p.occupancy[color];
                targets&=~maps.pawnAttacks[1-color];
                const int safeMoves=static_cast<int>(std::popcount(targets));
                const int bounded=std::min(safeMoves,mobilityCap[type]);
                maps.mobilityMiddle[color]+=bounded*mobilityMiddleWeight[type];
                maps.mobilityEnding[color]+=bounded*mobilityEndingWeight[type];
            }
        }
    }

    // Reward coordinated attacks around the opposing king, but require
    // pressure on multiple neighbouring squares to avoid overvaluing a
    // single checking piece.
    for(int color=WHITE;color<=BLACK;++color) {
        const int enemyKing=kingSquare(p,1-color);
        if(enemyKing<0) continue;
        int attackedSquares=0;
        int attackUnits=0;
        for(int rankStep=-1;rankStep<=1;++rankStep) {
            for(int fileStep=-1;fileStep<=1;++fileStep) {
                if(rankStep==0&&fileStep==0) continue;
                const int target=enemyKing+rankStep*16+fileStep;
                if(!onBoard(target)) continue;
                const int target64=square64From88(target);
                const int count=maps.attacks[color][target64];
                if(count==0) continue;
                ++attackedSquares;
                attackUnits+=std::min(2,static_cast<int>(count));
            }
        }
        if(attackedSquares>=2&&attackUnits>=3) {
            const int pressure=std::min(36,attackedSquares*2+attackUnits*2);
            maps.kingPressureMiddle[color]=pressure;
            maps.kingPressureEnding[color]=pressure/3;
        }
    }
}

int evaluate(const Position& p) {
    std::array<int,2> middle{};
    std::array<int,2> ending{};
    std::array<std::array<int,8>,2> pawnFiles{};
    EvaluationMaps evaluationMaps;
    buildEvaluationMaps(p,evaluationMaps);
    int phase=0;

    for(int color=WHITE;color<=BLACK;++color) {
        for(int type=1;type<=6;++type) {
            std::uint64_t pieces=p.piecesBB[color][type];
            while(pieces) {
                const int square64=static_cast<int>(std::countr_zero(pieces));
                pieces&=pieces-1;
                const int square=square88From64(square64);
                if(type==2||type==3) phase+=1;
                else if(type==4) phase+=2;
                else if(type==5) phase+=4;
                if(type==1) ++pawnFiles[color][fileOf(square)];

                const int relativeRank=color==WHITE?rankOf(square):7-rankOf(square);
                const int center=14-std::abs(2*fileOf(square)-7)
                    -std::abs(2*rankOf(square)-7);
                int mg=MG_VALUE[type];
                int eg=EG_VALUE[type];
                if(type==1) {
                    mg+=relativeRank*7+center;
                    eg+=relativeRank*11+center*2;
                } else if(type==2) {
                    mg+=center*5;
                    eg+=center*4;
                } else if(type==3) {
                    mg+=center*3+relativeRank;
                    eg+=center*3;
                } else if(type==4) {
                    mg+=relativeRank==6?20:relativeRank*2;
                    eg+=relativeRank*3;
                } else if(type==5) {
                    mg+=center;
                    eg+=center*2;
                } else if(type==6) {
                    mg-=center*4+relativeRank*4;
                    eg+=center*5;
                }
                middle[color]+=mg;
                ending[color]+=eg;
            }
        }
    }

    for(int color=WHITE;color<=BLACK;++color) {
        if(std::popcount(p.piecesBB[color][3])>=2) {
            middle[color]+=28;
            ending[color]+=34;
        }
        for(int file=0;file<8;++file) {
            const int count=pawnFiles[color][file];
            if(count>1) {
                middle[color]-=(count-1)*13;
                ending[color]-=(count-1)*16;
            }
            if(count>0&&(file==0||pawnFiles[color][file-1]==0)
               &&(file==7||pawnFiles[color][file+1]==0)) {
                middle[color]-=11*count;
                ending[color]-=13*count;
            }
        }

        std::uint64_t pawns=p.piecesBB[color][1];
        while(pawns) {
            const int square64=static_cast<int>(std::countr_zero(pawns));
            pawns&=pawns-1;
            const int square=square88From64(square64);
            const int file=fileOf(square);
            const int rank=rankOf(square);
            const int relativeRank=color==WHITE?rank:7-rank;
            if(isPassedPawn(p,square,color)) {
                constexpr std::array<int,8> bonus{0,5,10,18,30,48,78,0};
                middle[color]+=bonus[relativeRank];
                ending[color]+=bonus[relativeRank]*2;
            }

            // Reward connected pawn chains without counting a pair twice.
            bool connected=false;
            for(int adjacentFile:{file-1,file+1}) {
                if(adjacentFile<0||adjacentFile>7) continue;
                for(int adjacentRank:{rank-1,rank,rank+1}) {
                    if(adjacentRank<0||adjacentRank>7) continue;
                    if(p.board[adjacentRank*16+adjacentFile]==makePiece(1,color))
                        connected=true;
                }
            }
            if(connected) {
                middle[color]+=5;
                ending[color]+=7;
            }
        }

        // King shelter matters most while heavy attacking pieces remain.
        const int king=kingSquare(p,color);
        if(king>=0&&(color==WHITE?rankOf(king)<=2:rankOf(king)>=5)) {
            const int enemy=1-color;
            const int enemyHeavy=static_cast<int>(
                std::popcount(p.piecesBB[enemy][4])
                +std::popcount(p.piecesBB[enemy][5]));
            if(enemyHeavy>0) {
                const int shieldRank=rankOf(king)+(color==WHITE?1:-1);
                for(int shieldFile=std::max(0,fileOf(king)-1);
                    shieldFile<=std::min(7,fileOf(king)+1);++shieldFile) {
                    const bool shielded=shieldRank>=0&&shieldRank<8
                        &&p.board[shieldRank*16+shieldFile]==makePiece(1,color);
                    if(shielded) middle[color]+=8;
                    else middle[color]-=6;
                }
            }
        }

        std::uint64_t rooks=p.piecesBB[color][4];
        while(rooks) {
            const int square64=static_cast<int>(std::countr_zero(rooks));
            rooks&=rooks-1;
            const int file=square64%8;
            const bool ownPawn=pawnFiles[color][file]>0;
            const bool enemyPawn=pawnFiles[1-color][file]>0;
            if(!ownPawn&&!enemyPawn) {
                middle[color]+=16;
                ending[color]+=12;
            } else if(!ownPawn) {
                middle[color]+=9;
                ending[color]+=7;
            }
        }
    }

    for(int color=WHITE;color<=BLACK;++color) {
        middle[color]+=evaluationMaps.mobilityMiddle[color]
            +evaluationMaps.kingPressureMiddle[color];
        ending[color]+=evaluationMaps.mobilityEnding[color]
            +evaluationMaps.kingPressureEnding[color];
    }
    phase=std::min(24,phase);
    const int whiteMiddle=middle[WHITE]-middle[BLACK];
    const int whiteEnding=ending[WHITE]-ending[BLACK];
    const int score=(whiteMiddle*phase+whiteEnding*(24-phase))/24;
    return p.side==WHITE?score:-score;
}

bool isInsufficientMaterial(const Position& p) {
    int minorCount=0;
    int bishopColor=-1;
    bool bishopsOnly=true;
    for(int square=0;square<128;++square) {
        if(!onBoard(square)) continue;
        const int piece=p.board[square];
        if(piece==EMPTY||typeOf(piece)==6) continue;
        const int type=typeOf(piece);
        if(type==1||type==4||type==5) return false;
        if(type==2) {
            ++minorCount;
            bishopsOnly=false;
        } else if(type==3) {
            ++minorCount;
            const int squareColor=(fileOf(square)+rankOf(square))&1;
            if(bishopColor<0) bishopColor=squareColor;
            else if(bishopColor!=squareColor) bishopsOnly=false;
        }
    }
    return minorCount<=1||(bishopsOnly&&bishopColor>=0);
}

int quiescence(Position& p,int alpha,int beta,int qply,int searchPly) {
    if(searchShouldStop()) return evaluate(p);
    ++nodes;
    if(searchPly>=MAX_PLY-1) return evaluate(p);
    const std::uint64_t key=positionKey(p);
    searchPathKeys[searchPly]=key;
    const bool drawRule=p.halfmove>=100||repeatedPosition(key,searchPly,p.halfmove);
    const bool insufficient=isInsufficientMaterial(p);
    const bool checked=inCheck(p,p.side);
    if((drawRule||insufficient)&&!checked) return 0;

    // Reuse the pin/check-aware legal generator. The old qsearch path tested
    // every pseudo-legal move by making it, even though the main search now
    // has a faster bitboard legality filter.
    const auto legal=legalMoves(p,searchPly);
    if(legal.empty()) return checked?-MATE+searchPly:0;
    if(drawRule||insufficient) return 0;

    // Filter captures and promotions in the same per-ply buffer. Compaction
    // is safe because the destination never advances beyond the current item.
    MoveList moves{legal.data,0,legal.ply};
    for(const Move& move:legal) {
        if(checked||isCapture(p,move)||move.promotion) moves.push_back(move);
    }

    if(!checked) {
        const int stand=evaluate(p);
        if(stand>=beta) return stand;
        if(stand>alpha) alpha=stand;
        if(qply>=MAX_QPLY||moves.empty()) return alpha;
    }

    MovePicker picker(p,moves,Move{},searchPly);
    while(true) {
        const Move move=picker.next();
        if(move.from<0) break;
        const Undo undo=makeMove(p,move);
        const int score=-quiescence(p,-beta,-alpha,qply+1,searchPly+1);
        undoMove(p,move,undo);
        if(searchAborted.load(std::memory_order_relaxed)) return 0;
        if(score>=beta) return score;
        if(score>alpha) alpha=score;
    }
    return alpha;
}

void makeNullMove(Position& p) {
    const auto& keys=zobristKeys();
    if(p.ep>=0) p.key^=keys.enPassant[p.ep];
    p.ep=-1;
    p.side=1-p.side;
    p.key^=keys.side;
    p.halfmove=0;
}

bool hasNonPawnMaterial(const Position& p,int color) {
    for(int square=0;square<128;++square) {
        if(!onBoard(square)) continue;
        int piece=p.board[square];
        if(colorOf(piece)==color&&typeOf(piece)>=2&&typeOf(piece)<=5) return true;
    }
    return false;
}

bool hasNullMoveMaterial(const Position& p) {
    const auto& pieces=p.piecesBB[p.side];
    if((pieces[4]|pieces[5])!=0) return true;
    return std::popcount(pieces[2]|pieces[3])>=2;
}

int negamax(Position& p,int depth,int alpha,int beta,int ply,bool pvNode,bool allowNullMove=true) {
    if(searchAborted) return 0;
    if(ply>=MAX_PLY-1) return evaluate(p);
    bool checked=inCheck(p,p.side);
    if(checked) ++depth;
    const std::uint64_t key=positionKey(p);
    searchPathKeys[ply]=key;
    const bool drawRule=p.halfmove>=100||repeatedPosition(key,ply,p.halfmove);
    const bool insufficient=isInsufficientMaterial(p);
    if(drawRule||insufficient) {
        if(!checked) return 0;
        const auto evasions=legalMoves(p,ply);
        return evasions.empty()?-MATE+ply:0;
    }
    if(depth<=0) return quiescence(p,alpha,beta,0,ply);
    if(searchShouldStop()) return evaluate(p);
    ++nodes;
    int originalAlpha=alpha;
    bool ttFound=false;
    TTEntry& entry=probeTranspositionTable(key,ttFound);
    Move hashMove{};
    if(ttFound) {
        ++ttHits;
        hashMove=entry.best;
        if(entry.depth>=depth) {
            int ttScore=scoreFromTable(entry.score,ply);
            if(entry.bound==TT_EXACT) return ttScore;
            if(entry.bound==TT_LOWER&&ttScore>=beta) return ttScore;
            if(entry.bound==TT_UPPER&&ttScore<=alpha) return ttScore;
        }
    }
    if(allowNullMove&&!pvNode&&!checked&&depth>=3&&beta<MATE-100&&hasNullMoveMaterial(p)) {
        Position nullPosition=p;
        makeNullMove(nullPosition);
        const Move savedPathMove=searchPathMoves[ply];
        const int savedPathType=searchPathPieceTypes[ply];
        searchPathMoves[ply]=Move{};
        searchPathPieceTypes[ply]=0;
        const int reduction=2+depth/4;
        const int nullScore=-negamax(nullPosition,depth-1-reduction,-beta,-beta+1,ply+1,false,false);
        searchPathMoves[ply]=savedPathMove;
        searchPathPieceTypes[ply]=savedPathType;
        if(searchAborted.load(std::memory_order_relaxed)) return 0;
        if(nullScore>=beta) {
            if(depth<7) return nullScore;
            const int verification=negamax(p,depth-1-reduction,beta-1,beta,ply,false,false);
            if(searchAborted.load(std::memory_order_relaxed)) return 0;
            if(verification>=beta) return nullScore;
        }
    }
    auto moves=legalMoves(p,ply);
    if(moves.empty()) return checked?-MATE+ply:0;
    MovePicker picker(p,moves,hashMove,ply);
    int bestScore=-INF;
    Move bestMove=moves.front();
    int moveNumber=0;
    while(true) {
        const Move m=picker.next();
        if(m.from<0) break;
        const int movingColor=p.side;
        const int movingPieceType=typeOf(p.board[m.from]);
        searchPathMoves[ply]=m;
        searchPathPieceTypes[ply]=movingPieceType;
        bool quiet=!isCapture(p,m)&&!m.promotion;
        Undo undo=makeMove(p,m);
        bool givesCheck=inCheck(p,p.side);
        int childDepth=depth-1;
        int score;
        if(moveNumber==0) {
            score=-negamax(p,childDepth,-beta,-alpha,ply+1,pvNode);
        } else {
            int reduction=0;
            if(!checked&&!givesCheck&&quiet&&depth>=3&&moveNumber>=3) {
                reduction=1;
                if(depth>=5&&moveNumber>=6) ++reduction;
                if(depth>=8&&moveNumber>=12) ++reduction;
                if(pvNode) --reduction;
                const int history=historyScores[movingColor][m.from][m.to];
                if(history>5000) --reduction;
                else if(history<-5000) ++reduction;
                reduction=std::clamp(reduction,0,std::max(0,childDepth-1));
            }
            score=-negamax(p,childDepth-reduction,-alpha-1,-alpha,ply+1,false);
            if(score>alpha&&reduction>0) score=-negamax(p,childDepth,-alpha-1,-alpha,ply+1,false);
            if(score>alpha&&score<beta) score=-negamax(p,childDepth,-beta,-alpha,ply+1,pvNode);
        }
        undoMove(p,m,undo);
        if(searchAborted) return 0;
        ++moveNumber;
        if(score>bestScore) {
            bestScore=score;
            bestMove=m;
        }
        if(score>alpha) alpha=score;
        if(alpha>=beta) {
            if(quiet&&ply<MAX_PLY) {
                // Quiet moves that failed before the cutoff receive a modest
                // history malus; the cutoff move receives the larger reward.
                for(int previous=0;previous<moveNumber-1;++previous) {
                    const Move& rejected=moves[previous];
                    if(isCapture(p,rejected)||rejected.promotion) continue;
                    int& rejectedHistory=historyScores[p.side][rejected.from][rejected.to];
                    rejectedHistory=std::max(-30000,rejectedHistory-depth*depth*8);
                }
                if(!sameMove(m,killerMoves[ply][0])) {
                    killerMoves[ply][1]=killerMoves[ply][0];
                    killerMoves[ply][0]=m;
                }
                int& history=historyScores[p.side][m.from][m.to];
                history=std::min(30000,history+depth*depth*16);

                if(ply>0&&ply<MAX_PLY) {
                    const int previousType=searchPathPieceTypes[ply-1];
                    const Move& previous=searchPathMoves[ply-1];
                    if(previousType>=1&&previousType<=6&&previous.to>=0) {
                        counterMoves[previousType][previous.to]=m;
                    }
                }
            }
            break;
        }
    }
    Bound bound=bestScore<=originalAlpha?TT_UPPER:(bestScore>=beta?TT_LOWER:TT_EXACT);
    if(!ttFound||entry.key!=key||entry.generation!=ttGeneration||depth>=entry.depth) {
        entry.key=key;
        entry.best=bestMove;
        entry.score=scoreToTable(bestScore,ply);
        entry.depth=depth;
        entry.bound=bound;
        entry.generation=ttGeneration;
    }
    return bestScore;
}

Move findBestMove(Position p,int depth,std::int64_t timeLimitMs=-1,std::uint64_t nodeLimit=0) {
    auto moves=legalMoves(p,0);
    if(moves.empty()) return {};
    searchTimeLimited=timeLimitMs>0;
    searchNodeLimit=nodeLimit;
    if(searchTimeLimited) searchDeadline=std::chrono::steady_clock::now()+std::chrono::milliseconds(timeLimitMs);
    ++ttGeneration;
    if(ttGeneration==0) ++ttGeneration;
    for(auto& pair:killerMoves) pair={Move{},Move{}};
    for(auto& side:historyScores) for(auto& from:side) for(int& value:from) value/=2;
    nodes=0;
    ttHits=0;
    searchPathKeys.fill(0);
    searchPathMoves.fill(Move{});
    searchPathPieceTypes.fill(0);
    completedSearchDepth=0;
    lastSearchScore=evaluate(p);
    Move best=moves.front();
    int fallbackScore=-INF;
    for(const Move& move:moves) {
        Position child=p;
        makeMove(child,move);
        const int score=-evaluate(child);
        if(score>fallbackScore) {
            fallbackScore=score;
            best=move;
        }
    }
    int previousScore=0;
    const auto start=std::chrono::steady_clock::now();
    for(int currentDepth=1;currentDepth<=depth;++currentDepth) {
        if(searchTimeLimited&&std::chrono::steady_clock::now()>=searchDeadline) break;
        int window=currentDepth>=3?40:INF;
        int alpha=window==INF?-INF:std::max(-INF,previousScore-window);
        int beta=window==INF?INF:std::min(INF,previousScore+window);
        int score=0;
        while(true) {
            score=negamax(p,currentDepth,alpha,beta,0,true);
            if(searchAborted.load(std::memory_order_relaxed)) break;
            bool rootFound=false;
            TTEntry& rootEntry=probeTranspositionTable(positionKey(p),rootFound);
            if(rootFound&&rootEntry.best.from>=0) best=rootEntry.best;
            if(score<=alpha&&alpha>-INF) {
                window=std::min(INF,window*2);
                alpha=window==INF?-INF:std::max(-INF,previousScore-window);
                continue;
            }
            if(score>=beta&&beta<INF) {
                window=std::min(INF,window*2);
                beta=window==INF?INF:std::min(INF,previousScore+window);
                continue;
            }
            break;
        }
        if(searchAborted.load(std::memory_order_relaxed)) break;
        previousScore=score;
        lastSearchScore=score;
        completedSearchDepth=currentDepth;
        auto elapsed=std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now()-start).count();
        std::ostringstream info;
        info<<"info depth "<<currentDepth<<" score cp "<<score<<" nodes "<<nodes<<" nps "<<(elapsed>0?nodes*1000/static_cast<std::uint64_t>(elapsed):0)<<" tthits "<<ttHits<<" hashfull "<<hashFullPermille()<<" pv "<<moveUci(best);
        emitLine(info.str());
    }
    const auto finalElapsed=std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::steady_clock::now()-start).count();
    if(nodeLimit>0) {
        emitLine("info string node-limit "+std::to_string(nodes)+"/"+std::to_string(nodeLimit));
    }
    std::ostringstream finalInfo;
    finalInfo<<"info string search-final nodes="<<nodes
             <<" depth="<<completedSearchDepth
             <<" elapsed_ms="<<finalElapsed
             <<" tthits="<<ttHits
             <<" node_limit="<<nodeLimit;
    emitLine(finalInfo.str());
    searchTimeLimited=false;
    searchNodeLimit=0;
    return best;
}

void runBenchmark(int depth) {
    struct Case { const char* name; const char* fen; };
    constexpr std::array<Case, 5> suite{{
        {"starting-position", "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"},
        {"kiwipete", "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1"},
        {"rook-endgame", "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1"},
        {"closed-center", "r1bq1rk1/pp1n1ppp/2pbpn2/3p4/3P4/2NBPN2/PPQ1BPPP/R1R3K1 w - - 0 1"},
        {"open-position", "r2q1rk1/pp2bppp/2n1pn2/2pp4/3P4/2P1PN2/PP1NBPPP/R2Q1RK1 w - - 0 1"}
    }};
    std::uint64_t totalNodes=0;
    const auto suiteStart=std::chrono::steady_clock::now();
    std::cout<<"Prunex benchmark depth "<<depth<<" positions "<<suite.size()<<"\n";
    for(const Case& item:suite) {
        Position position;
        if(!loadFen(position,item.fen)) {
            std::cerr<<"Invalid built-in benchmark position: "<<item.name<<"\n";
            continue;
        }
        clearTranspositionTable();
        historyScores={};
        for(auto& pair:killerMoves) pair={Move{},Move{}};
        searchAborted.store(false,std::memory_order_relaxed);
        Move best=findBestMove(position,depth);
        totalNodes+=nodes;
        std::cout<<"bench "<<item.name<<" bestmove "<<(best.from>=0?moveUci(best):"none")
                 <<" nodes "<<nodes<<"\n";
    }
    const auto elapsed=std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::steady_clock::now()-suiteStart).count();
    const auto nps=elapsed>0?totalNodes*1000/static_cast<std::uint64_t>(elapsed):0;
    std::cout<<"bench-total nodes "<<totalNodes<<" time_ms "<<elapsed<<" nps "<<nps<<"\n";
}

std::uint64_t perft(Position& p,int depth,int ply=0){
    if(depth==0) return 1;
    auto moves=legalMoves(p,ply);
    std::uint64_t n=0;
    for(const Move& m:moves) {
        Position q=p;
        makeMove(q,m);
        n+=perft(q,depth-1,ply+1);
    }
    return n;
}

void setPosition(Position& p,const std::string& command){std::istringstream in(command);std::string token;in>>token;in>>token;if(token=="startpos")loadFen(p,START_FEN);else if(token=="fen"){std::string fen,part;for(int i=0;i<6&&in>>part;++i){if(i)fen+=' ';fen+=part;}if(!loadFen(p,fen))loadFen(p,START_FEN);}else loadFen(p,START_FEN);
    while(in>>token){if(token=="moves"){while(in>>token){Move m;if(parseUciMove(p,token,m))makeMove(p,m);else break;}break;}}
}
}

#ifndef PRUNEX_NO_MAIN
int main(int argc,char**argv){using namespace prunex;Position pos;loadFen(pos,START_FEN);
    std::thread searchThread;
    auto stopAndJoin=[&]() {
        if(searchThread.joinable()) {
            searchAborted.store(true,std::memory_order_relaxed);
            searchThread.join();
        }
    };
    if((argc==2||argc==3)&&std::string_view(argv[1])=="--bench") {
        int depth=5;
        if(argc==3&&!parseIntegerToken(argv[2],1,10,depth)) {
            std::cerr<<"Invalid benchmark depth (expected 1-10)\n";
            return 2;
        }
        runBenchmark(depth);
        return 0;
    }
    if(argc==3&&std::string_view(argv[1])=="--perft"){
        int d=0;
        if(!parseIntegerToken(argv[2],0,7,d)){std::cerr<<"Invalid depth (expected 0-7)\n";return 2;}
        std::cout<<"Perft depth "<<d<<": "<<perft(pos,d)<<"\n";
        return 0;
    }
    if(argc==4&&std::string_view(argv[1])=="--perft-fen"){
        int d=0;
        if(!loadFen(pos,argv[2])){std::cerr<<"Invalid FEN\n";return 2;}
        if(!parseIntegerToken(argv[3],0,7,d)){std::cerr<<"Invalid depth (expected 0-7)\n";return 2;}
        std::cout<<"Perft depth "<<d<<": "<<perft(pos,d)<<"\n";
        return 0;
    }
    if(argc==4&&std::string_view(argv[1])=="--divide-fen"){
        int d=0;
        if(!loadFen(pos,argv[2])){std::cerr<<"Invalid FEN\n";return 2;}
        if(!parseIntegerToken(argv[3],1,7,d)){std::cerr<<"Invalid depth (expected 1-7)\n";return 2;}
        std::uint64_t total=0;
        for(const Move&m:legalMoves(pos,0)){Position q=pos;makeMove(q,m);auto n=perft(q,d-1,1);std::cout<<moveUci(m)<<": "<<n<<"\n";total+=n;}
        std::cout<<"Total: "<<total<<"\n";
        return 0;
    }
    std::string line;
    while(std::getline(std::cin,line)){
        std::istringstream in(line);
        std::string cmd;
        in>>cmd;
        if(cmd=="uci"){
            emitLine(
                "id name Prunex 0.8.0\n"
                "id author Prunex Project\n"
                "option name Hash type spin default "+std::to_string(DEFAULT_HASH_MB)+" min 1 max 4096\n"
                "option name Threads type spin default 1 min 1 max 1\n"
                "option name Clear Hash type button\n"
                "uciok"
            );
        } else if(cmd=="setoption"){
            stopAndJoin();
            std::string token,name,value;
            if(!(in>>token)||token!="name") continue;
            while(in>>token&&token!="value") {
                if(!name.empty()) name+=' ';
                name+=token;
            }
            while(in>>token) {
                if(!value.empty()) value+=' ';
                value+=token;
            }
            if(name=="Hash") {
                int requestedHash=0;
                if(!parseIntegerToken(value,1,4096,requestedHash)) {
                    emitLine("info string invalid Hash value; expected 1..4096 MiB");
                } else if(!resizeTranspositionTable(requestedHash)) {
                    emitLine("info string unable to allocate requested Hash size; previous table retained");
                }
            } else if(name=="Clear Hash") {
                clearTranspositionTable();
                ttGeneration=0;
            } else if(name=="Threads") {
                int requestedThreads=0;
                if(!parseIntegerToken(value,1,1,requestedThreads))
                    emitLine("info string this build supports Threads=1 only");
            }
        } else if(cmd=="isready"){
            emitLine("readyok");
        } else if(cmd=="ucinewgame"){
            stopAndJoin();
            loadFen(pos,START_FEN);
            clearTranspositionTable();
            historyScores={};
            counterMoves={};
            searchPathMoves.fill(Move{});
            searchPathPieceTypes.fill(0);
            for(auto& pair:killerMoves)pair={Move{},Move{}};
        } else if(cmd=="position"){
            stopAndJoin();
            setPosition(pos,line);
        } else if(cmd=="go"){
            stopAndJoin();
            int depth=5;
            bool depthSet=false;
            int movesToGo=30;
            std::int64_t moveTime=-1,whiteTime=-1,blackTime=-1,whiteIncrement=0,blackIncrement=0;
            std::uint64_t nodeLimit=0;
            std::string token;
            auto readTime=[&](std::int64_t& value){
                std::string raw;
                if(!(in>>raw)) return;
                std::int64_t parsed=0;
                auto result=std::from_chars(raw.data(),raw.data()+raw.size(),parsed);
                if(result.ec==std::errc{}&&result.ptr==raw.data()+raw.size()&&parsed>=0) value=parsed;
            };
            while(in>>token){
                if(token=="depth"){in>>depth;depthSet=true;}
                else if(token=="movetime") readTime(moveTime);
                else if(token=="wtime") readTime(whiteTime);
                else if(token=="btime") readTime(blackTime);
                else if(token=="winc") readTime(whiteIncrement);
                else if(token=="binc") readTime(blackIncrement);
                else if(token=="movestogo") in>>movesToGo;
                else if(token=="nodes") {
                    std::string raw;
                    if(in>>raw) {
                        std::uint64_t parsed=0;
                        auto result=std::from_chars(raw.data(),raw.data()+raw.size(),parsed);
                        if(result.ec==std::errc{}&&result.ptr==raw.data()+raw.size()) nodeLimit=parsed;
                    }
                }
            }
            if(moveTime<0){
                std::int64_t remaining=pos.side==WHITE?whiteTime:blackTime;
                std::int64_t increment=pos.side==WHITE?whiteIncrement:blackIncrement;
                if(remaining>=0){
                    std::int64_t reserve=std::max<std::int64_t>(20,remaining/20);
                    std::int64_t usable=std::max<std::int64_t>(1,remaining-reserve);
                    int divisor=std::clamp(movesToGo,1,100);
                    moveTime=std::min(usable,usable/divisor+(increment*3)/4);
                    moveTime=std::max<std::int64_t>(1,moveTime);
                }
            }
            if(moveTime==0) moveTime=1;
            // Timed and node-limited searches must keep deepening until
            // their resource limit is reached. A fixed depth-12 ceiling made
            // movetime searches return early with unused time.
            if(!depthSet&&(nodeLimit>0||moveTime>=0)) depth=MAX_PLY-1;
            const int searchDepth=std::clamp(depth,1,MAX_PLY-1);
            const Position searchPosition=pos;
            searchAborted.store(false,std::memory_order_relaxed);
            searchThread=std::thread([searchPosition,searchDepth,moveTime,nodeLimit]() mutable {
                Move best=findBestMove(searchPosition,searchDepth,moveTime,nodeLimit);
                emitLine("bestmove "+(best.from>=0?moveUci(best):"0000"));
            });
        } else if(cmd=="eval"){
            stopAndJoin();
            emitLine("info string static evaluation cp "+std::to_string(evaluate(pos)));
        } else if(cmd=="stop"){
            stopAndJoin();
        } else if(cmd=="quit"){
            stopAndJoin();
            break;
        } else if(cmd=="d"){
            std::lock_guard<std::mutex> lock(outputMutex);
            for(int r=7;r>=0;--r){
                for(int f=0;f<8;++f)std::cout<<pieceChar(pos.board[r*16+f])<<' ';
                std::cout<<'\n';
            }
            std::cout<<std::flush;
        }
    }
    stopAndJoin();
    return 0;
}
#endif // PRUNEX_NO_MAIN
