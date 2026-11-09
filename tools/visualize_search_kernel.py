#!/usr/bin/env python3
"""Generate a source-accurate flow diagram of Prunex 0.8.0's native search.

Run from the repository root:
    python3 tools/visualize_search_kernel.py
This writes docs/assets/prunex-search-kernel.svg. The SVG is self-contained and
uses only Python's standard library. It visualizes the implementation in
src/main.cpp; it is not a trace of a particular game or a strength claim.
"""
from __future__ import annotations
import argparse
from pathlib import Path
from xml.sax.saxutils import escape

W, H = 1900, 1660
BG, PANEL, BOX, EDGE = "#08111f", "#101d30", "#14263d", "#365473"
WHITE, MUTED = "#f1f5fc", "#b0bfd4"
TEAL, BLUE, GOLD, RED = "#58dec7", "#82b5ff", "#f2c66d", "#ff9292"

def t(x, y, value, size=19, color=WHITE, weight="400", anchor="start"):
    return (f'<text x="{x}" y="{y}" font-family="Inter,Segoe UI,Arial,sans-serif" '
            f'font-size="{size}" font-weight="{weight}" fill="{color}" '
            f'text-anchor="{anchor}">{escape(value)}</text>')

def node(x, y, w, h, title, rows, accent=TEAL, tag=None):
    out = [f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="18" fill="{BOX}" stroke="{EDGE}" stroke-width="2"/>',
           f'<rect x="{x}" y="{y}" width="8" height="{h}" rx="4" fill="{accent}"/>',
           t(x+26,y+37,title,18 if len(title)>30 else 22,WHITE,"700")]
    if tag: out.append(t(x+w-18,y+34,tag,14,accent,"700","end"))
    for i,row in enumerate(rows): out.append(t(x+26,y+72+i*27,row,17,MUTED))
    return "\n".join(out)

def link(points, label=None, color=TEAL, label_pos=None):
    path="M "+" L ".join(f"{x} {y}" for x,y in points)
    out=[f'<path d="{path}" fill="none" stroke="{color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" marker-end="url(#arr)"/>']
    if label and label_pos: out.append(t(*label_pos,label,15,color,"700"))
    return "\n".join(out)

def render():
    s=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">',
       '<defs><marker id="arr" markerWidth="12" markerHeight="12" refX="9" refY="5" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="#58dec7"/></marker></defs>',
       f'<rect width="{W}" height="{H}" fill="{BG}"/>',
       t(70,78,"PRUNEX 0.8.0  /  C++20",19,TEAL,"700"),
       t(70,148,"Inside the search kernel",62,WHITE,"700"),
       t(72,194,"A source-based map of the native engine's actual search path",23,MUTED),
       t(70,245,"ROOT SEARCH",15,BLUE,"700"),
       t(70,550,"NEGAMAX CORE",15,TEAL,"700"),
       t(70,1230,"SUPPORTING SYSTEMS",15,GOLD,"700")]

    # Root orchestration
    s += [
      node(70,275,490,125,"findBestMove(position, depth, timeLimit)",[
        "Generate legal root moves; set optional search deadline",
        "Advance TT generation; reset per-search ordering state"],BLUE),
      node(705,275,490,125,"Iterative deepening",[
        "Search depth 1 through the requested limit",
        "Keep the last fully completed iteration"],BLUE),
      node(1340,275,490,125,"Aspiration window",[
        "From depth 3: previous score ± 40 centipawns",
        "Fail-low / fail-high widens the window and retries"],GOLD),
      link([(560,337),(705,337)]),
      link([(1195,337),(1340,337)])]

    # Main search spine
    s += [
      node(705,475,490,110,"negamax(alpha, beta, depth, ply, PV)",[
        "Abort / max-ply guards · extend depth when in check"],TEAL),
      node(705,620,490,125,"Position and draw rules",[
        "Zobrist position key + search-path repetition detection",
        "50-move rule and insufficient-material detection"],TEAL),
      node(705,780,490,125,"Depth boundary",[
        "At depth ≤ 0, enter quiescence search",
        "Otherwise continue full-width search"],GOLD),
      node(705,940,490,145,"Transposition-table probe",[
        "Look up by Zobrist key; recover the hash move",
        "Use EXACT / LOWER / UPPER bounds when deep enough",
        "A usable bound can return immediately"],BLUE),
      node(705,1120,490,135,"Null-move pruning",[
        "Only suitable non-PV, non-check nodes at depth ≥ 3",
        "Reduced null search; verify cutoffs at depth ≥ 7"],GOLD),
      node(705,1290,490,150,"Legal moves + PVS loop",[
        "Generate legal moves; order hash / captures / killers / history",
        "First move full-window; later moves null-window",
        "Late-move reductions, re-search, alpha–beta cutoff"],TEAL),
      link([(1585,400),(1585,440),(945,440),(945,475)],"root search",TEAL,(1450,425)),
      link([(945,585),(945,620)]),
      link([(945,745),(945,780)]),
      link([(945,905),(945,940)]),
      link([(945,1085),(945,1120)]),
      link([(945,1255),(945,1290)])]

    # Supporting systems, accurately reflecting evaluate() and quiescence().
    s += [
      node(70,625,500,175,"Quiescence search",[
        "Stand-pat evaluation when not in check",
        "Search captures, promotions, and all legal check evasions",
        "Bounded q-ply; alpha–beta cutoffs"],GOLD),
      node(70,855,500,175,"Move ordering + SEE",[
        "Hash move and promotions receive priority",
        "Captures scored by static-exchange evaluation",
        "Killer moves and history scores order quiet moves"],BLUE),
      node(1340,625,490,205,"Handcrafted tapered evaluation",[
        "Material, centralization, activity, relative advancement",
        "Doubled / isolated / passed / connected pawn terms",
        "Bishop pair, king shelter, rook-file bonuses",
        "Middlegame / endgame blend by material phase"],GOLD),
      node(1340,875,490,185,"Zobrist + transposition table",[
        "Position key includes pieces, side, castling, en-passant",
        "Entry stores key, best move, score, depth, bound, generation",
        "Mate scores are normalized for storage and retrieval"],BLUE),
      node(70,1100,500,130,"Move generation + position",[
        "0x88 mailbox board · legal moves · make / undo",
        "Castling, en-passant, promotions, king-safety checks"],TEAL),
      node(1340,1100,490,130,"Search state",[
        "Node / TT-hit counters, killer moves, history scores",
        "Search path keys, deadline, abort flag"],BLUE),
      link([(705,835),(620,835),(620,710),(570,710)],"depth ≤ 0",GOLD,(615,690)),
      link([(705,1360),(620,1360),(620,940),(570,940)],"move ordering",BLUE,(620,920)),
      link([(1195,1000),(1260,1000),(1260,725),(1340,725)],"evaluate()",GOLD,(1270,700)),
      link([(1195,1000),(1260,1000),(1260,965),(1340,965)],"Zobrist key",BLUE,(1268,945)),
      link([(705,680),(625,680),(625,1165),(570,1165)],"position state",TEAL,(620,1145)),
      link([(1195,1165),(1260,1165),(1260,1165),(1340,1165)],"counters / heuristics",BLUE,(1268,1145))]

    # Explicit completion path and UCI observability
    s += [
      node(705,1450,490,90,"Completed iteration → UCI info",[
        "Depth · centipawn score · nodes / NPS · TT hits · hashfull · PV"],TEAL),
      link([(945,1440),(945,1450)]),
      link([(705,1495),(640,1495),(640,430),(945,430),(945,400)],"next depth",BLUE,(650,420)),
      t(70,1570,"Root retries aspiration windows until the score fits; then emits bestmove after the final completed iteration.",17,MUTED),
      t(1830,1610,"SOURCE MAP",14,TEAL,"700","end"),
      t(70,1610,"Source: src/main.cpp on main · diagram describes code paths, not a recorded match or measured strength.",15,MUTED),
      '</svg>']
    return "\n".join(s)

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--output",default="docs/assets/prunex-search-kernel.svg")
    args=ap.parse_args()
    dest=Path(args.output)
    dest.parent.mkdir(parents=True,exist_ok=True)
    dest.write_text(render()+"\n",encoding="utf-8")
    print(f"Prunex search-kernel diagram written to {dest}")

if __name__=="__main__":
    main()
