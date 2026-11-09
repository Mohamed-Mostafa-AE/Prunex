#include <algorithm>
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
#include <string>
#include <string_view>
#include <thread>
#include <vector>

namespace prunex {
constexpr int INF = 32000;
constexpr int MATE = 30000;
constexpr std::string_view START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

enum Piece : int { EMPTY=0, WP=1, WN, WB, WR, WQ, WK, BP=7, BN, BB, BR, BQ, BK };
enum Color : int { WHITE=0, BLACK=1 };
enum Castle : int { WKCA=1, WQCA=2, BKCA=4, BQCA=8 };

struct Move { int from=-1, to=-1, promotion=EMPTY; bool enPassant=false, castle=false; };
struct Position {
    std::array<int,128> board{};
    int side=WHITE, castling=0, ep=-1, halfmove=0, fullmove=1;
};
struct Undo { int captured=EMPTY, castling=0, ep=-1, halfmove=0, fullmove=1; };

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
    return wk==1&&bk==1;
}

bool attacked(const Position& p,int sq,int by) {
    const int pawn=makePiece(1,by), knight=makePiece(2,by);
    const int pawnSources[2]={sq+(by==WHITE?-15:15),sq+(by==WHITE?-17:17)};
    for(int s:pawnSources)if(onBoard(s)&&p.board[s]==pawn)return true;
    constexpr int knights[8]={-33,-31,-18,-14,14,18,31,33};
    for(int d:knights){int s=sq+d;if(onBoard(s)&&p.board[s]==knight)return true;}
    constexpr int dirs[8]={-16,-1,1,16,-17,-15,15,17};
    for(int i=0;i<8;++i){int s=sq+dirs[i];bool first=true;while(onBoard(s)){int pc=p.board[s];if(pc){if(colorOf(pc)==by&&(typeOf(pc)==5||(first&&typeOf(pc)==6)||(i<4&&typeOf(pc)==4)||(i>=4&&typeOf(pc)==3)))return true;break;}first=false;s+=dirs[i];}}
    return false;
}
int kingSquare(const Position& p,int color){int k=makePiece(6,color);for(int s=0;s<128;++s)if(onBoard(s)&&p.board[s]==k)return s;return -1;}
bool inCheck(const Position& p,int color){int k=kingSquare(p,color);return k>=0&&attacked(p,k,1-color);}

void addMove(std::vector<Move>& out,int from,int to,int promo=EMPTY,bool ep=false,bool castle=false){out.push_back({from,to,promo,ep,castle});}
std::vector<Move> pseudoMoves(const Position& p) {
    std::vector<Move> out; out.reserve(96);
    constexpr int knightD[8]={-33,-31,-18,-14,14,18,31,33};
    constexpr int bishopD[4]={-17,-15,15,17}; constexpr int rookD[4]={-16,-1,1,16};
    for(int from=0;from<128;++from){if(!onBoard(from))continue;int pc=p.board[from];if(colorOf(pc)!=p.side)continue;int t=typeOf(pc);
        if(t==1){int step=p.side==WHITE?16:-16;int one=from+step;int last=p.side==WHITE?7:0;
            if(onBoard(one)&&p.board[one]==EMPTY){if(rankOf(one)==last){for(int pr:{5,4,3,2})addMove(out,from,one,makePiece(pr,p.side));}else{addMove(out,from,one);int two=one+step;if(rankOf(from)==(p.side==WHITE?1:6)&&p.board[two]==EMPTY)addMove(out,from,two);}}
            for(int df:{-1,1}){int to=one+df;if(!onBoard(to))continue;if(colorOf(p.board[to])==1-p.side){if(rankOf(to)==last){for(int pr:{5,4,3,2})addMove(out,from,to,makePiece(pr,p.side));}else addMove(out,from,to);}else if(to==p.ep)addMove(out,from,to,EMPTY,true);}
        } else if(t==2){for(int d:knightD){int to=from+d;if(onBoard(to)&&colorOf(p.board[to])!=p.side)addMove(out,from,to);}}
        else {auto slide=[&](const int* ds,int count,bool repeat){for(int i=0;i<count;++i){int to=from+ds[i];while(onBoard(to)){if(colorOf(p.board[to])==p.side)break;addMove(out,from,to);if(p.board[to]!=EMPTY||!repeat)break;to+=ds[i];}}};
            if(t==3)slide(bishopD,4,true);else if(t==4)slide(rookD,4,true);else if(t==5){slide(bishopD,4,true);slide(rookD,4,true);}else if(t==6){constexpr int kingD[8]={-17,-16,-15,-1,1,15,16,17};slide(kingD,8,false);
                if(p.side==WHITE&&from==4&&!inCheck(p,WHITE)){if((p.castling&WKCA)&&p.board[5]==EMPTY&&p.board[6]==EMPTY&&p.board[7]==WR&&!attacked(p,5,BLACK)&&!attacked(p,6,BLACK))addMove(out,from,6,EMPTY,false,true);if((p.castling&WQCA)&&p.board[1]==EMPTY&&p.board[2]==EMPTY&&p.board[3]==EMPTY&&p.board[0]==WR&&!attacked(p,3,BLACK)&&!attacked(p,2,BLACK))addMove(out,from,2,EMPTY,false,true);}
                if(p.side==BLACK&&from==116&&!inCheck(p,BLACK)){if((p.castling&BKCA)&&p.board[117]==EMPTY&&p.board[118]==EMPTY&&p.board[119]==BR&&!attacked(p,117,WHITE)&&!attacked(p,118,WHITE))addMove(out,from,118,EMPTY,false,true);if((p.castling&BQCA)&&p.board[113]==EMPTY&&p.board[114]==EMPTY&&p.board[115]==EMPTY&&p.board[112]==BR&&!attacked(p,115,WHITE)&&!attacked(p,114,WHITE))addMove(out,from,114,EMPTY,false,true);}
            }}
    }return out;
}

Undo makeMove(Position& p,const Move& m){Undo u{p.board[m.to],p.castling,p.ep,p.halfmove,p.fullmove};int pc=p.board[m.from];p.board[m.from]=EMPTY;p.board[m.to]=m.promotion?m.promotion:pc;
    if(m.enPassant){int cap=m.to+(p.side==WHITE?-16:16);u.captured=p.board[cap];p.board[cap]=EMPTY;}
    if(m.castle){if(m.to>m.from){p.board[m.from+1]=p.board[m.from+3];p.board[m.from+3]=EMPTY;}else{p.board[m.from-1]=p.board[m.from-4];p.board[m.from-4]=EMPTY;}}
    if(pc==WK)p.castling&=~(WKCA|WQCA);
    if(pc==BK)p.castling&=~(BKCA|BQCA);
    if(m.from==0||m.to==0)p.castling&=~WQCA;
    if(m.from==7||m.to==7)p.castling&=~WKCA;
    if(m.from==112||m.to==112)p.castling&=~BQCA;
    if(m.from==119||m.to==119)p.castling&=~BKCA;
    p.ep=(typeOf(pc)==1&&std::abs(m.to-m.from)==32)?(m.to+m.from)/2:-1;
    p.halfmove=(typeOf(pc)==1||u.captured!=EMPTY)?0:p.halfmove+1;if(p.side==BLACK)++p.fullmove;p.side=1-p.side;return u;}
void undoMove(Position& p,const Move& m,const Undo& u){p.side=1-p.side;if(p.side==BLACK)--p.fullmove;p.castling=u.castling;p.ep=u.ep;p.halfmove=u.halfmove;int pc=p.board[m.to];p.board[m.from]=m.promotion?makePiece(1,p.side):pc;p.board[m.to]=m.enPassant?EMPTY:u.captured;if(m.enPassant)p.board[m.to+(p.side==WHITE?-16:16)]=u.captured;if(m.castle){if(m.to>m.from){p.board[m.from+3]=p.board[m.from+1];p.board[m.from+1]=EMPTY;}else{p.board[m.from-4]=p.board[m.from-1];p.board[m.from-1]=EMPTY;}}}
std::vector<Move> legalMoves(Position& p){auto candidates=pseudoMoves(p);std::vector<Move> legal;legal.reserve(candidates.size());int us=p.side;for(const Move&m:candidates){Position q=p;makeMove(q,m);if(!inCheck(q,us))legal.push_back(m);}return legal;}
std::string moveUci(const Move&m){std::string s=squareName(m.from)+squareName(m.to);if(m.promotion){char c=static_cast<char>(std::tolower(pieceChar(m.promotion)));s+=c;}return s;}
bool parseUciMove(Position& p,std::string_view text,Move& result){for(const Move&m:legalMoves(p))if(moveUci(m)==text){result=m;return true;}return false;}

constexpr int MAX_PLY = 128;
constexpr int MAX_QPLY = 18;
#ifndef PRUNEX_TT_BITS
#define PRUNEX_TT_BITS 18
#endif
constexpr int TT_BITS = PRUNEX_TT_BITS;
constexpr std::size_t TT_SIZE = std::size_t{1} << TT_BITS;
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

struct ZobristKeys {
    std::array<std::array<std::uint64_t, 13>, 128> pieces{};
    std::array<std::uint64_t, 16> castling{};
    std::array<std::uint64_t, 128> enPassant{};
    std::uint64_t side=0;
};

std::array<TTEntry, TT_SIZE> transpositionTable{};
std::array<std::uint64_t, MAX_PLY> searchPathKeys{};
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

void resetSearchState() {
    transpositionTable.fill(TTEntry{});
    searchPathKeys.fill(0);
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
    constexpr std::size_t sample=1000;
    std::size_t used=0;
    for(std::size_t i=0;i<sample;++i) if(transpositionTable[i].generation==ttGeneration&&transpositionTable[i].bound!=TT_NONE) ++used;
    return static_cast<int>(used);
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

std::uint64_t positionKey(const Position& p) {
    const auto& keys=zobristKeys();
    std::uint64_t key=0;
    for(int square=0;square<128;++square) {
        if(!onBoard(square)) continue;
        int piece=p.board[square];
        if(piece!=EMPTY) key^=keys.pieces[square][piece];
    }
    key^=keys.castling[p.castling];
    if(p.ep>=0) key^=keys.enPassant[p.ep];
    if(p.side==BLACK) key^=keys.side;
    return key;
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

bool pieceAttacksSquare(const Position& p,int from,int target,int piece) {
    const int fileDelta=fileOf(target)-fileOf(from);
    const int rankDelta=rankOf(target)-rankOf(from);
    const int absFile=std::abs(fileDelta);
    const int absRank=std::abs(rankDelta);
    const int type=typeOf(piece);
    if(fileDelta==0&&rankDelta==0) return false;
    if(type==1) return absFile==1&&rankDelta==(colorOf(piece)==WHITE?1:-1);
    if(type==2) return (absFile==1&&absRank==2)||(absFile==2&&absRank==1);
    if(type==6) return absFile<=1&&absRank<=1;
    if(type==3&&absFile!=absRank) return false;
    if(type==4&&fileDelta!=0&&rankDelta!=0) return false;
    if(type==5&&fileDelta!=0&&rankDelta!=0&&absFile!=absRank) return false;
    if(type!=3&&type!=4&&type!=5) return false;
    const int step=(rankDelta>0?16:rankDelta<0?-16:0)+(fileDelta>0?1:fileDelta<0?-1:0);
    for(int square=from+step;square!=target;square+=step) {
        if(!onBoard(square)||p.board[square]!=EMPTY) return false;
    }
    return true;
}

int leastValuableAttacker(const Position& p,int target,int color) {
    int bestSquare=-1;
    int bestValue=INF;
    for(int square=0;square<128;++square) {
        if(!onBoard(square)) continue;
        const int piece=p.board[square];
        if(piece==EMPTY||colorOf(piece)!=color) continue;
        if(!pieceAttacksSquare(p,square,target,piece)) continue;
        const int value=MG_VALUE[typeOf(piece)];
        if(value<bestValue) {
            bestValue=value;
            bestSquare=square;
        }
    }
    return bestSquare;
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

    position.board[move.from]=EMPTY;
    position.board[capturedSquare]=EMPTY;
    position.board[target]=occupant;
    int side=1-original.side;
    int depth=0;

    while(depth<30) {
        const int attackerSquare=leastValuableAttacker(position,target,side);
        if(attackerSquare<0) break;
        int attacker=position.board[attackerSquare];
        if(typeOf(attacker)==6) {
            Position kingCapture=position;
            kingCapture.board[attackerSquare]=EMPTY;
            kingCapture.board[target]=attacker;
            if(attacked(kingCapture,target,1-side)) break;
        }

        ++depth;
        int promotionGain=0;
        if(typeOf(attacker)==1&&rankOf(target)==(side==WHITE?7:0)) {
            promotionGain=MG_VALUE[5]-MG_VALUE[1];
            attacker=makePiece(5,side);
        }
        gains[depth]=MG_VALUE[typeOf(occupant)]+promotionGain-gains[depth-1];
        position.board[attackerSquare]=EMPTY;
        position.board[target]=attacker;
        occupant=attacker;
        side=1-side;
    }

    while(depth>0) {
        gains[depth-1]=-std::max(-gains[depth-1],gains[depth]);
        --depth;
    }
    return gains[0];
}

int moveOrderingScore(const Position& p,const Move& m,const Move& hashMove,int ply) {
    if(hashMove.from>=0&&sameMove(m,hashMove)) return 2000000;
    int score=0;
    if(m.promotion) score+=900000+MG_VALUE[typeOf(m.promotion)]*8;
    if(isCapture(p,m)) {
        const int victim=m.enPassant?makePiece(1,1-p.side):p.board[m.to];
        const int exchange=staticExchangeEvaluation(p,m);
        score+=1000000+(exchange>=0?200000:-200000)+exchange*16
            +MG_VALUE[typeOf(victim)]*4-MG_VALUE[typeOf(p.board[m.from])];
        return score;
    }
    if(ply<MAX_PLY) {
        if(sameMove(m,killerMoves[ply][0])) return 800000;
        if(sameMove(m,killerMoves[ply][1])) return 790000;
    }
    return score+historyScores[p.side][m.from][m.to];
}

void orderMoves(const Position& p,std::vector<Move>& moves,const Move& hashMove,int ply) {
    struct ScoredMove { Move move; int score; };
    std::vector<ScoredMove> scored;
    scored.reserve(moves.size());
    for(const Move& move:moves) scored.push_back({move,moveOrderingScore(p,move,hashMove,ply)});
    std::stable_sort(scored.begin(),scored.end(),[](const ScoredMove& a,const ScoredMove& b) {
        return a.score>b.score;
    });
    for(std::size_t index=0;index<moves.size();++index) moves[index]=scored[index].move;
}

int evaluate(const Position& p) {
    std::array<int, 2> middle{};
    std::array<int, 2> ending{};
    std::array<std::array<int, 8>, 2> pawnFiles{};
    int phase=0;
    for(int square=0;square<128;++square) {
        if(!onBoard(square)) continue;
        int piece=p.board[square];
        if(piece==EMPTY) continue;
        int color=colorOf(piece),type=typeOf(piece);
        if(type==2||type==3) phase+=1;
        else if(type==4) phase+=2;
        else if(type==5) phase+=4;
        if(type==1) ++pawnFiles[color][fileOf(square)];
        int relativeRank=color==WHITE?rankOf(square):7-rankOf(square);
        int center=14-std::abs(2*fileOf(square)-7)-std::abs(2*rankOf(square)-7);
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
    for(int color=WHITE;color<=BLACK;++color) {
        if(std::count_if(p.board.begin(),p.board.end(),[&](int piece) { return piece==makePiece(3,color); })>=2) {
            middle[color]+=28;
            ending[color]+=34;
        }
        for(int file=0;file<8;++file) {
            int count=pawnFiles[color][file];
            if(count>1) {
                middle[color]-=(count-1)*13;
                ending[color]-=(count-1)*16;
            }
            if(count>0&&(file==0||pawnFiles[color][file-1]==0)&&(file==7||pawnFiles[color][file+1]==0)) {
                middle[color]-=11*count;
                ending[color]-=13*count;
            }
        }
        for(int square=0;square<128;++square) {
            if(!onBoard(square)||p.board[square]!=makePiece(1,color)) continue;
            int file=fileOf(square);
            int rank=rankOf(square);
            int relativeRank=color==WHITE?rank:7-rank;
            bool passed=true;
            for(int enemySquare=0;enemySquare<128&&passed;++enemySquare) {
                if(!onBoard(enemySquare)||p.board[enemySquare]!=makePiece(1,1-color)) continue;
                int enemyFile=fileOf(enemySquare);
                int enemyRank=rankOf(enemySquare);
                int enemyRelativeRank=color==WHITE?enemyRank:7-enemyRank;
                if(std::abs(enemyFile-file)<=1&&enemyRelativeRank>relativeRank) passed=false;
            }
            if(passed) {
                constexpr std::array<int, 8> bonus{0, 5, 10, 18, 30, 48, 78, 0};
                middle[color]+=bonus[relativeRank];
                ending[color]+=bonus[relativeRank]*2;
            }
        }
        // Reward connected pawn chains without counting a pair twice.
        for(int square=0;square<128;++square) {
            if(!onBoard(square)||p.board[square]!=makePiece(1,color)) continue;
            const int file=fileOf(square);
            const int rank=rankOf(square);
            bool connected=false;
            for(int adjacentFile:{file-1,file+1}) {
                if(adjacentFile<0||adjacentFile>7) continue;
                for(int adjacentRank:{rank-1,rank,rank+1}) {
                    if(adjacentRank<0||adjacentRank>7) continue;
                    if(p.board[adjacentRank*16+adjacentFile]==makePiece(1,color)) connected=true;
                }
            }
            if(connected) {
                middle[color]+=5;
                ending[color]+=7;
            }
        }

        // King shelter matters most while heavy attacking pieces remain.
        int king=kingSquare(p,color);
        if(king>=0&&(color==WHITE?rankOf(king)<=2:rankOf(king)>=5)) {
            const int enemy=1-color;
            // The board has 128 slots, so this count safely fits in int.
            const int enemyHeavy=static_cast<int>(
                std::count(p.board.begin(),p.board.end(),makePiece(4,enemy))
                +std::count(p.board.begin(),p.board.end(),makePiece(5,enemy)));
            if(enemyHeavy>0) {
                const int shieldRank=rankOf(king)+(color==WHITE?1:-1);
                for(int shieldFile=std::max(0,fileOf(king)-1);shieldFile<=std::min(7,fileOf(king)+1);++shieldFile) {
                    const bool shielded=shieldRank>=0&&shieldRank<8
                        &&p.board[shieldRank*16+shieldFile]==makePiece(1,color);
                    if(shielded) middle[color]+=8;
                    else middle[color]-=6;
                }
            }
        }

        for(int square=0;square<128;++square) {
            if(!onBoard(square)||p.board[square]!=makePiece(4,color)) continue;
            int file=fileOf(square);
            bool ownPawn=pawnFiles[color][file]>0;
            bool enemyPawn=pawnFiles[1-color][file]>0;
            if(!ownPawn&&!enemyPawn) {
                middle[color]+=16;
                ending[color]+=12;
            } else if(!ownPawn) {
                middle[color]+=9;
                ending[color]+=7;
            }
        }
    }
    phase=std::min(24,phase);
    int whiteMiddle=middle[WHITE]-middle[BLACK];
    int whiteEnding=ending[WHITE]-ending[BLACK];
    int score=(whiteMiddle*phase+whiteEnding*(24-phase))/24;
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
    ++nodes;
    if(searchShouldStop()) return evaluate(p);
    if(searchPly>=MAX_PLY-1) return evaluate(p);
    const std::uint64_t key=positionKey(p);
    searchPathKeys[searchPly]=key;
    const bool drawRule=p.halfmove>=100||repeatedPosition(key,searchPly,p.halfmove);
    const bool insufficient=isInsufficientMaterial(p);
    bool checked=inCheck(p,p.side);
    if((drawRule||insufficient)&&!checked) return 0;
    auto candidates=pseudoMoves(p);
    std::vector<Move> moves;
    moves.reserve(candidates.size());
    bool hasLegalMove=false;
    for(const Move& m:candidates) {
        Undo undo=makeMove(p,m);
        bool legal=!inCheck(p,1-p.side);
        undoMove(p,m,undo);
        if(!legal) continue;
        hasLegalMove=true;
        if(checked||isCapture(p,m)||m.promotion) moves.push_back(m);
    }
    if(!hasLegalMove) return checked?-MATE+searchPly:0;
    if(drawRule||insufficient) return 0;
    if(!checked) {
        int stand=evaluate(p);
        if(stand>=beta) return stand;
        if(stand>alpha) alpha=stand;
        if(qply>=MAX_QPLY||moves.empty()) return alpha;
    }
    orderMoves(p,moves,Move{},searchPly);
    for(const Move& m:moves) {
        Undo undo=makeMove(p,m);
        int score=-quiescence(p,-beta,-alpha,qply+1,searchPly+1);
        undoMove(p,m,undo);
        if(searchAborted) return 0;
        if(score>=beta) return score;
        if(score>alpha) alpha=score;
    }
    return alpha;
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
    int minorPieces=0;
    for(int square=0;square<128;++square) {
        if(!onBoard(square)) continue;
        const int piece=p.board[square];
        if(colorOf(piece)!=p.side) continue;
        const int type=typeOf(piece);
        if(type==4||type==5) return true;
        if(type==2||type==3) ++minorPieces;
    }
    return minorPieces>=2;
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
        const auto evasions=legalMoves(p);
        return evasions.empty()?-MATE+ply:0;
    }
    if(depth<=0) return quiescence(p,alpha,beta,0,ply);
    ++nodes;
    if(searchShouldStop()) return evaluate(p);
    int originalAlpha=alpha;
    TTEntry& entry=transpositionTable[key&(TT_SIZE-1)];
    Move hashMove{};
    if(entry.key==key) {
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
        nullPosition.side=1-nullPosition.side;
        nullPosition.ep=-1;
        nullPosition.halfmove=0;
        const int reduction=2+depth/4;
        const int nullScore=-negamax(nullPosition,depth-1-reduction,-beta,-beta+1,ply+1,false,false);
        if(searchAborted.load(std::memory_order_relaxed)) return 0;
        if(nullScore>=beta) {
            if(depth<7) return nullScore;
            const int verification=negamax(p,depth-1-reduction,beta-1,beta,ply,false,false);
            if(searchAborted.load(std::memory_order_relaxed)) return 0;
            if(verification>=beta) return nullScore;
        }
    }
    auto moves=legalMoves(p);
    if(moves.empty()) return checked?-MATE+ply:0;
    orderMoves(p,moves,hashMove,ply);
    int bestScore=-INF;
    Move bestMove=moves.front();
    int moveNumber=0;
    for(const Move& m:moves) {
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
                if(depth>=6&&moveNumber>=8) ++reduction;
                reduction=std::min(reduction,std::max(0,childDepth-1));
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
                if(!sameMove(m,killerMoves[ply][0])) {
                    killerMoves[ply][1]=killerMoves[ply][0];
                    killerMoves[ply][0]=m;
                }
                int& history=historyScores[p.side][m.from][m.to];
                history=std::min(30000,history+depth*depth*16);
            }
            break;
        }
    }
    Bound bound=bestScore<=originalAlpha?TT_UPPER:(bestScore>=beta?TT_LOWER:TT_EXACT);
    if(entry.key!=key||entry.generation!=ttGeneration||depth>=entry.depth) {
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
    auto moves=legalMoves(p);
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
    completedSearchDepth=0;
    lastSearchScore=evaluate(p);
    Move best=moves.front();
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
            TTEntry& rootEntry=transpositionTable[positionKey(p)&(TT_SIZE-1)];
            if(rootEntry.key==positionKey(p)&&rootEntry.best.from>=0) best=rootEntry.best;
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
        transpositionTable.fill(TTEntry{});
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

std::uint64_t perft(Position& p,int depth){if(depth==0)return 1;auto moves=legalMoves(p);std::uint64_t n=0;for(const Move&m:moves){Position q=p;makeMove(q,m);n+=perft(q,depth-1);}return n;}

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
        for(const Move&m:legalMoves(pos)){Position q=pos;makeMove(q,m);auto n=perft(q,d-1);std::cout<<moveUci(m)<<": "<<n<<"\n";total+=n;}
        std::cout<<"Total: "<<total<<"\n";
        return 0;
    }
    std::string line;
    while(std::getline(std::cin,line)){
        std::istringstream in(line);
        std::string cmd;
        in>>cmd;
        if(cmd=="uci"){
            emitLine("id name Prunex 0.8.0\nid author Prunex Project\nuciok");
        } else if(cmd=="isready"){
            emitLine("readyok");
        } else if(cmd=="ucinewgame"){
            stopAndJoin();
            loadFen(pos,START_FEN);
            transpositionTable.fill(TTEntry{});
            historyScores={};
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
            if(!depthSet&&(moveTime>=0||nodeLimit>0)) depth=12;
            const int searchDepth=std::clamp(depth,1,12);
            const Position searchPosition=pos;
            searchAborted.store(false,std::memory_order_relaxed);
            searchThread=std::thread([searchPosition,searchDepth,moveTime,nodeLimit]() mutable {
                Move best=findBestMove(searchPosition,searchDepth,moveTime,nodeLimit);
                if(nodeLimit>0) emitLine("info string node-limit "+std::to_string(nodes)+"/"+std::to_string(nodeLimit));
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
