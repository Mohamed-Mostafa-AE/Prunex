#define main prunex_console_entry
#include "main.cpp"
#undef main

#ifdef _WIN32
#define NOMINMAX
#include <windows.h>
#include <windowsx.h>
#include <string>
#include <vector>

namespace {
using namespace prunex;
constexpr int BOARD_X = 34;
constexpr int BOARD_Y = 94;
constexpr int CELL = 76;
constexpr int BOARD_SIZE = CELL * 8;
constexpr COLORREF BG = RGB(19, 24, 32);
constexpr COLORREF PANEL = RGB(27, 34, 44);
constexpr COLORREF LIGHT = RGB(232, 225, 210);
constexpr COLORREF DARK = RGB(105, 133, 125);
constexpr COLORREF ACCENT = RGB(91, 165, 145);
constexpr COLORREF TEXT = RGB(235, 239, 242);
constexpr COLORREF MUTED = RGB(151, 164, 176);

struct Snapshot { Position position; std::vector<Move> moves; };
Position position;
std::vector<Move> history;
std::vector<Snapshot> undoStack;
int selected = -1;
int depth = 4;
bool flipped = false;
std::wstring status = L"White to move";
HWND windowHandle = nullptr;
HFONT pieceFont = nullptr;
HFONT uiFont = nullptr;
HFONT titleFont = nullptr;

std::wstring pieceGlyph(int piece) {
    static const wchar_t* glyphs[] = {L"",L"♙",L"♘",L"♗",L"♖",L"♕",L"♔",L"♟",L"♞",L"♝",L"♜",L"♛",L"♚"};
    return piece >= 1 && piece <= 12 ? glyphs[piece] : L"";
}
int squareAt(int x, int y) {
    int file = (x - BOARD_X) / CELL;
    int row = (y - BOARD_Y) / CELL;
    if (x < BOARD_X || y < BOARD_Y || file < 0 || file > 7 || row < 0 || row > 7) return -1;
    int f = flipped ? 7 - file : file;
    int r = flipped ? row : 7 - row;
    return r * 16 + f;
}
void setStatus() {
    auto moves = legalMoves(position);
    if (moves.empty()) status = inCheck(position, position.side) ? L"Checkmate" : L"Draw by stalemate";
    else if (inCheck(position, position.side)) status = position.side == WHITE ? L"White is in check" : L"Black is in check";
    else status = position.side == WHITE ? L"White to move" : L"Black to move";
}
void text(HDC dc, int x, int y, const std::wstring& value, COLORREF color, HFONT font = nullptr) {
    SetTextColor(dc, color);
    SetBkMode(dc, TRANSPARENT);
    HFONT old = font ? (HFONT)SelectObject(dc, font) : nullptr;
    TextOutW(dc, x, y, value.c_str(), static_cast<int>(value.size()));
    if (old) SelectObject(dc, old);
}
void fill(HDC dc, int x, int y, int w, int h, COLORREF color) {
    HBRUSH brush = CreateSolidBrush(color);
    RECT r{x,y,x+w,y+h};
    FillRect(dc, &r, brush);
    DeleteObject(brush);
}
void drawButton(HDC dc, int x, int y, int w, const wchar_t* label) {
    fill(dc, x, y, w, 38, RGB(43, 55, 68));
    text(dc, x + 13, y + 10, label, TEXT);
}
void paintBoard(HDC dc) {
    fill(dc, 0, 0, 1100, 760, BG);
    text(dc, 34, 26, L"PRUNEX", RGB(242,246,248), titleFont);
    text(dc, 183, 39, L"CHESS ENGINE  /  DESKTOP", MUTED);
    for (int row = 0; row < 8; ++row) for (int col = 0; col < 8; ++col) {
        int f = flipped ? 7-col : col;
        int r = flipped ? row : 7-row;
        int sq = r*16+f;
        int x = BOARD_X+col*CELL, y=BOARD_Y+row*CELL;
        COLORREF base = ((row+col)&1) ? DARK : LIGHT;
        if (sq == selected) base = RGB(218,190,95);
        else if (selected >= 0) {
            for (const Move& m : legalMoves(position)) if (m.from == selected && m.to == sq) base = RGB(156,177,113);
        }
        fill(dc,x,y,CELL,CELL,base);
        int pc=position.board[sq];
        if (pc) {
            std::wstring glyph=pieceGlyph(pc);
            SetBkMode(dc,TRANSPARENT);
            HFONT old=(HFONT)SelectObject(dc,pieceFont);
            SetTextColor(dc, pc <= WK ? RGB(250,250,245) : RGB(28,34,40));
            TextOutW(dc,x+13,y+3,glyph.c_str(),1);
            SelectObject(dc,old);
        }
        if (row==7) { wchar_t c=static_cast<wchar_t>(L'a'+f); text(dc,x+CELL-15,y+CELL-20,std::wstring(1,c),((row+col)&1)?LIGHT:DARK); }
        if (col==0) { wchar_t c=static_cast<wchar_t>(L'1'+r); text(dc,x+5,y+3,std::wstring(1,c),((row+col)&1)?LIGHT:DARK); }
    }
    fill(dc, BOARD_X+8*CELL+28, 94, 300, 608, PANEL);
    text(dc, BOARD_X+8*CELL+52, 122, L"GAME", ACCENT);
    text(dc, BOARD_X+8*CELL+52, 158, status, TEXT);
    text(dc, BOARD_X+8*CELL+52, 207, L"ENGINE", ACCENT);
    text(dc, BOARD_X+8*CELL+52, 241, L"Prunex native search", TEXT);
    text(dc, BOARD_X+8*CELL+52, 272, L"Search depth", MUTED);
    text(dc, BOARD_X+8*CELL+52, 300, std::to_wstring(depth), TEXT);
    drawButton(dc, BOARD_X+8*CELL+52, 342, 42, L"-");
    drawButton(dc, BOARD_X+8*CELL+104, 342, 42, L"+");
    drawButton(dc, BOARD_X+8*CELL+52, 406, 190, L"New game");
    drawButton(dc, BOARD_X+8*CELL+52, 454, 190, L"Undo move");
    drawButton(dc, BOARD_X+8*CELL+52, 502, 190, L"Flip board");
    text(dc, BOARD_X+8*CELL+52, 570, L"CONTROLS", ACCENT);
    text(dc, BOARD_X+8*CELL+52, 600, L"Select a piece, then a square", MUTED);
    text(dc, BOARD_X+8*CELL+52, 624, L"Play as White against Prunex", MUTED);
    text(dc, BOARD_X+8*CELL+52, 648, L"Promotions default to queen", MUTED);
    text(dc, 34, 720, L"BUILT BY PASSION. DRIVEN BY CHESS.", MUTED);
}
void redraw() { InvalidateRect(windowHandle,nullptr,FALSE); }
void computerMove() {
    auto moves=legalMoves(position);
    if (moves.empty()) { setStatus(); redraw(); return; }
    Move best=findBestMove(position,depth);
    if (best.from>=0) { undoStack.push_back({position,history}); makeMove(position,best); history.push_back(best); }
    setStatus(); redraw();
}
void onSquare(int sq) {
    if (sq<0 || position.side!=WHITE) return;
    if (selected<0) {
        if (colorOf(position.board[sq])==WHITE) selected=sq;
    } else {
        bool moved=false;
        for (const Move& m:legalMoves(position)) if (m.from==selected&&m.to==sq) {
            undoStack.push_back({position,history});
            Move chosen=m;
            if (m.promotion) chosen.promotion=WQ;
            makeMove(position,chosen); history.push_back(chosen); moved=true; break;
        }
        if (!moved && colorOf(position.board[sq])==WHITE) selected=sq;
        else selected=-1;
        if (moved) { setStatus(); redraw(); computerMove(); return; }
    }
    redraw();
}
LRESULT CALLBACK windowProc(HWND hwnd, UINT msg, WPARAM wp, LPARAM lp) {
    switch(msg) {
    case WM_PAINT: { PAINTSTRUCT ps; HDC dc=BeginPaint(hwnd,&ps); paintBoard(dc); EndPaint(hwnd,&ps); return 0; }
    case WM_LBUTTONDOWN: {
        int x=GET_X_LPARAM(lp), y=GET_Y_LPARAM(lp);
        int sq=squareAt(x,y);
        if (sq>=0) { onSquare(sq); return 0; }
        int panelX=BOARD_X+8*CELL+52;
        if (x>=panelX&&x<panelX+50&&y>=342&&y<382) depth=std::max(1,depth-1);
        else if (x>=panelX+52&&x<panelX+100&&y>=342&&y<382) depth=std::min(8,depth+1);
        else if (x>=panelX&&x<panelX+210&&y>=406&&y<444) { loadFen(position,START_FEN); history.clear(); undoStack.clear(); selected=-1; setStatus(); }
        else if (x>=panelX&&x<panelX+210&&y>=454&&y<492) { if(!undoStack.empty()){auto s=undoStack.back();undoStack.pop_back();position=s.position;history=s.moves;if(position.side==BLACK&&!undoStack.empty()){auto prev=undoStack.back();undoStack.pop_back();position=prev.position;history=prev.moves;}selected=-1;setStatus();} }
        else if (x>=panelX&&x<panelX+210&&y>=502&&y<540) flipped=!flipped;
        redraw(); return 0;
    }
    case WM_ERASEBKGND: return 1;
    case WM_DESTROY: PostQuitMessage(0); return 0;
    }
    return DefWindowProcW(hwnd,msg,wp,lp);
}
}

int WINAPI wWinMain(HINSTANCE instance,HINSTANCE, PWSTR,int show) {
    using namespace prunex;
    loadFen(position,START_FEN);
    WNDCLASSW wc{}; wc.lpfnWndProc=windowProc; wc.hInstance=instance; wc.lpszClassName=L"PrunexChessWindow"; wc.hCursor=LoadCursor(nullptr,IDC_ARROW); wc.hbrBackground=CreateSolidBrush(BG);
    RegisterClassW(&wc);
    pieceFont=CreateFontW(62,0,0,0,FW_NORMAL,FALSE,FALSE,FALSE,DEFAULT_CHARSET,OUT_DEFAULT_PRECIS,CLIP_DEFAULT_PRECIS,CLEARTYPE_QUALITY,DEFAULT_PITCH,L"Segoe UI Symbol");
    uiFont=CreateFontW(18,0,0,0,FW_NORMAL,FALSE,FALSE,FALSE,DEFAULT_CHARSET,OUT_DEFAULT_PRECIS,CLIP_DEFAULT_PRECIS,CLEARTYPE_QUALITY,DEFAULT_PITCH,L"Segoe UI");
    titleFont=CreateFontW(30,0,0,0,FW_BOLD,FALSE,FALSE,FALSE,DEFAULT_CHARSET,OUT_DEFAULT_PRECIS,CLIP_DEFAULT_PRECIS,CLEARTYPE_QUALITY,DEFAULT_PITCH,L"Segoe UI");
    windowHandle=CreateWindowExW(0,wc.lpszClassName,L"Prunex Chess",WS_OVERLAPPED|WS_CAPTION|WS_SYSMENU|WS_MINIMIZEBOX, CW_USEDEFAULT,CW_USEDEFAULT,1120,790,nullptr,nullptr,instance,nullptr);
    if(!windowHandle) return 1;
    setStatus(); ShowWindow(windowHandle,show); UpdateWindow(windowHandle);
    MSG msg{}; while(GetMessageW(&msg,nullptr,0,0)>0){TranslateMessage(&msg);DispatchMessageW(&msg);}
    DeleteObject(pieceFont); DeleteObject(uiFont); DeleteObject(titleFont);
    return static_cast<int>(msg.wParam);
}
#else
int main() { return 0; }
#endif
