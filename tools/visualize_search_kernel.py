#!/usr/bin/env python3
"""Build an expert, source-derived diagram of Prunex's native C++20 search."""
from __future__ import annotations
import argparse
from pathlib import Path
from xml.sax.saxutils import escape

W, H = 2200, 1720
S: list[str] = []

def text(x, y, value, cls="body", anchor=None):
    a = f' text-anchor="{anchor}"' if anchor else ""
    S.append(f'<text class="{cls}" x="{x}" y="{y}"{a}>{escape(value)}</text>')

def card(x, y, w, h, kicker, title, rows, accent="teal", tag=None, fs="body"):
    S.append(f'<rect class="card" x="{x}" y="{y}" width="{w}" height="{h}" rx="17"/>')
    S.append(f'<rect class="bar {accent}" x="{x}" y="{y}" width="7" height="{h}" rx="3"/>')
    text(x+24, y+27, kicker.upper(), "kicker "+accent)
    text(x+24, y+57, title, "title")
    if tag: text(x+w-18, y+25, tag, "tag "+accent, "end")
    for i,row in enumerate(rows): text(x+24, y+86+i*25, row, fs)

def panel(x, y, w, h, title, rows, accent="blue", tag=None, fs="body"):
    S.append(f'<rect class="panel" x="{x}" y="{y}" width="{w}" height="{h}" rx="17"/>')
    S.append(f'<rect class="bar {accent}" x="{x}" y="{y}" width="7" height="{h}" rx="3"/>')
    text(x+23, y+34, title, "ptitle")
    if tag: text(x+w-18, y+31, tag, "tag "+accent, "end")
    for i,row in enumerate(rows): text(x+23, y+70+i*26, row, fs)

def arrow(points, color="teal", label=None, pos=None, dashed=False, width=3):
    d="M "+" L ".join(f"{x} {y}" for x,y in points)
    dash=' stroke-dasharray="8 7"' if dashed else ""
    S.append(f'<path class="line {color}" d="{d}" stroke-width="{width}" marker-end="url(#{color})"{dash}/>')
    if label and pos: text(pos[0],pos[1],label,"edge-label "+color)

def decision(cx,cy,w,h,label):
    points=f"{cx},{cy-h/2} {cx+w/2},{cy} {cx},{cy+h/2} {cx-w/2},{cy}"
    S.append(f'<polygon points="{points}" class="decision"/>')
    text(cx,cy+6,label,"decision-label","middle")

def build():
    S.clear()
    S.append(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">')
    S.append('''<defs>
    <style>
      text{font-family:Inter,Segoe UI,Arial,sans-serif}
      .bg{fill:#07111f}.grid{fill:url(#grid);opacity:.55}
      .card{fill:#11243a;stroke:#294660;stroke-width:2}.panel{fill:#0d1b2c;stroke:#294660;stroke-width:2}
      .bar{stroke:none}.teal{fill:#55e2d0}.blue{fill:#79aaff}.amber{fill:#f2c56b}.red{fill:#ff8d9b}.green{fill:#8fe0a8}
      .kicker{font-size:13px;font-weight:800;letter-spacing:1.5px}.title{font-size:23px;font-weight:700;fill:#eef5ff}
      .ptitle{font-size:21px;font-weight:750;fill:#eef5ff}.tag{font-size:12px;font-weight:750;letter-spacing:1.1px}
      .body{font-size:16px;font-weight:450;fill:#a8bdd0}.small{font-size:14px;font-weight:450;fill:#a8bdd0}
      .line{fill:none;stroke-linecap:round;stroke-linejoin:round}.line.teal{stroke:#55e2d0}.line.blue{stroke:#79aaff}.line.amber{stroke:#f2c56b}.line.red{stroke:#ff8d9b}.line.green{stroke:#8fe0a8}
      .decision{fill:#1b2b3c;stroke:#f2c56b;stroke-width:2.5}.decision-label{font-size:19px;font-weight:750;fill:#eef5ff}
      .edge-label{font-size:13px;font-weight:750}.header-kicker{font-size:15px;font-weight:800;letter-spacing:2px;fill:#55e2d0}
      .main-title{font-size:58px;font-weight:800;letter-spacing:-1px;fill:#eef5ff}.subtitle{font-size:21px;font-weight:450;fill:#a8bdd0}
      .legend{font-size:12px;font-weight:750;letter-spacing:1px;fill:#a8bdd0}.foot{font-size:14px;fill:#708aa3}
    </style>
    <pattern id="grid" width="36" height="36" patternUnits="userSpaceOnUse"><path d="M36 0H0V36" fill="none" stroke="#14263a" stroke-width="1"/></pattern>
    <marker id="teal" markerWidth="11" markerHeight="11" refX="9" refY="5" orient="auto"><path d="M0 0L10 5L0 10Z" fill="#55e2d0"/></marker>
    <marker id="blue" markerWidth="11" markerHeight="11" refX="9" refY="5" orient="auto"><path d="M0 0L10 5L0 10Z" fill="#79aaff"/></marker>
    <marker id="amber" markerWidth="11" markerHeight="11" refX="9" refY="5" orient="auto"><path d="M0 0L10 5L0 10Z" fill="#f2c56b"/></marker>
    <marker id="red" markerWidth="11" markerHeight="11" refX="9" refY="5" orient="auto"><path d="M0 0L10 5L0 10Z" fill="#ff8d9b"/></marker>
    <marker id="green" markerWidth="11" markerHeight="11" refX="9" refY="5" orient="auto"><path d="M0 0L10 5L0 10Z" fill="#8fe0a8"/></marker>
    </defs>''')
    S.append(f'<rect class="bg" width="{W}" height="{H}"/><rect class="grid" width="{W}" height="{H}"/>')
    text(60,58,"PRUNEX 0.8.0  /  NATIVE C++20 ENGINE","header-kicker")
    text(60,123,"Inside the Search Kernel","main-title")
    text(62,164,"Source-derived architecture of the actual search path, state caches, selective pruning and handcrafted evaluation","subtitle")
    for i,(c,l) in enumerate([("teal","CONTROL FLOW"),("blue","SEARCH STATE"),("amber","EVALUATION / LEAF"),("red","PRUNING / CUTOFF"),("green","RESULT / FEEDBACK")]):
        x=65+i*270
        S.append(f'<rect class="{c}" x="{x}" y="190" width="12" height="12" rx="3"/>')
        text(x+22,201,l,"legend")

    # Root orchestration layer
    text(60,250,"01  /  ROOT ORCHESTRATION","kicker blue")
    card(60,270,480,145,"UCI COMMAND","Position + go limits",["FEN / start position + move sequence","depth · movetime · clock · optional node cap"],"blue")
    card(600,270,480,145,"ROOT CONTROLLER","findBestMove(position, depth, …)",["Generate legal root moves; set time / node limit","Advance TT generation; reset counters and PV state"],"teal")
    card(1140,270,480,145,"ITERATION SCHEDULE","Iterative deepening",["Depth 1 → requested limit; keep last completed result","Age history scores; clear killer moves"],"blue")
    card(1680,270,460,145,"WINDOW CONTROL","Aspiration search",["From depth 3: previous score ± 40 cp","Fail-low / high → widen window and re-search"],"amber")
    arrow([(540,342),(600,342)],"blue")
    arrow([(1080,342),(1140,342)],"teal")
    arrow([(1620,342),(1680,342)],"amber")
    arrow([(1910,415),(1910,465),(1110,465),(1110,500)],"amber")

    # Main recursive search lane
    text(690,492,"02  /  RECURSIVE NEGAMAX + PVS CORE","kicker teal")
    card(690,510,840,100,"NODE ENTRY","negamax(position, depth, α, β, ply, pvNode)",["Abort / max-ply guards · check extension adds one ply when in check"],"teal")
    arrow([(1110,610),(1110,635)],"teal")
    card(690,638,840,112,"POSITION VALIDATION","Zobrist + terminal / draw rules",["Search-path repetition · halfmove clock ≥ 100 · insufficient material","When checked, test legal evasions before returning a draw"],"blue")
    arrow([(1110,750),(1110,772)],"blue")
    decision(1110,820,390,96,"depth ≤ 0 ?")
    arrow([(915,820),(610,820),(610,705)],"amber","YES · qsearch",(650,805))
    arrow([(1110,868),(1110,895)],"teal","NO",(1130,888))
    card(690,898,840,118,"TT PROBE","Direct-mapped transposition table",["Index: Zobrist key & (TT_SIZE − 1); confirm full key","Sufficient-depth EXACT / LOWER / UPPER bound can return or cut"],"blue")
    arrow([(1110,1016),(1110,1035)],"teal")
    card(690,1038,840,112,"SELECTIVE PRUNING","Null-move pruning gate",["Non-PV · not in check · depth ≥ 3 · below mate threshold","Require non-pawn material · R = 2 + depth / 4 · verify at depth ≥ 7"],"amber")
    arrow([(1110,1150),(1110,1168)],"teal")
    card(690,1170,840,117,"EXPANSION","Legal moves + scored candidate list",["Generate legal moves; empty list distinguishes mate from stalemate","Order hash move, captures / promotions, killers and history"],"teal")
    arrow([(1110,1276),(1110,1295)],"teal")
    card(690,1297,840,170,"PVS MOVE LOOP","Negamax recursion + late-move reductions",["Move 1: full α–β window; later moves: null-window probes","Quiet non-check LMR: depth ≥ 3 / move index ≥ 3; extra reduction at depth ≥ 6 / index ≥ 8","Reduced improvement → re-search; in-window PV improvement → full-window re-search","α ≥ β → cutoff; update killer + history for quiet moves"],"teal",fs="small")
    arrow([(1110,1439),(1110,1457)],"green")
    card(690,1460,840,85,"NODE RETURN","Bound classification + TT store",["UPPER / LOWER / EXACT from original α, β · store score / best move / depth / generation"],"green",fs="small")

    # Left supporting branches
    panel(60,540,550,230,"QUIESCENCE SEARCH  /  qsearch()",["Depth ≤ 0 enters tactical leaf search","Not in check: stand pat, then captures / promotions","Non-check q-ply cap = 18; SEE ordering and α–β cutoffs","In check: no stand pat or q-ply cap; search every legal evasion"],"amber","LEAF EXTENSION","small")
    panel(60,815,550,188,"BOARD + MOVE GENERATION",["0x88 mailbox board (128 slots)","Pseudo-legal generation + make / undo legality test","Castling · en-passant · four promotions · king safety","Side, castling, EP, halfmove / fullmove state"],"teal","POSITION CORE","small")
    panel(60,1048,550,280,"HANDCRAFTED STATIC EVALUATION",["Tapered middlegame / endgame score; phase capped at 24","Material + piece-square activity / centralization","Pawn structure: doubled, isolated, passed, connected","Bishop pair · king shelter · rook open / semi-open files","Called for root baseline, qsearch stand-pat, stop / max-ply fallback","No neural network or NNUE inference in this path"],"amber","evaluate(position)","small")
    arrow([(60,1168),(30,1168),(30,655),(60,655)],"amber",None,None,True,2)
    arrow([(610,910),(650,910),(650,1220),(690,1220)],"teal",None,None,False,2)
    

    # Right support modules
    panel(1570,510,570,235,"ZOBRIST KEY + TT ENTRY",["Key covers pieces · side to move","castling rights · en-passant square","2^18 direct-mapped entries (TT_BITS = 18)","Entry: full key · best move · score · depth","Bound: EXACT / LOWER / UPPER · generation","Mate scores normalized for ply on store / retrieval"],"blue","SEARCH STATE","small")
    panel(1570,780,570,175,"NULL-MOVE / REDUCTION POLICY",["Null position flips side and clears en-passant","Reduced null-window probe: (−β, −β + 1)","Fail-high at depth < 7 accepted; deeper result verified","Verification runs with null move disabled"],"amber","CONDITIONAL PRUNING","small")
    panel(1570,990,570,210,"MOVE ORDERING / HEURISTICS",["1  Hash move (highest priority)","2  Captures: SEE + victim / attacker values","3  Promotions receive a priority bonus","4  Two killer slots per ply","5  History score for quiet moves","Quiet beta-cutoff updates killer + history"],"blue","ORDER BEFORE SEARCH","small")
    panel(1570,1225,570,235,"PVS SEARCH-TREE VIEW",["Conceptual branch pattern — not a measured trace","Root candidate → first full-window search","Later siblings → null-window probes / LMR","PV improvement → conditional re-search","α ≥ β → sibling subtree cutoff"],"teal","PRINCIPLE, NOT SCALE","small")
    # State feedback and ordering inputs
    arrow([(1530,955),(1550,955),(1550,640),(1570,640)],"blue",None,None,True,2)
    arrow([(1530,1090),(1550,1090),(1550,865),(1570,865)],"amber",None,None,True,2)
    arrow([(1570,1090),(1548,1090),(1548,1340),(1530,1340)],"blue",None,None,False,2)
    arrow([(1530,1370),(1550,1370),(1550,1335),(1570,1335)],"teal",None,None,True,2)
    arrow([(1530,1530),(1550,1530),(1550,735),(1530,735)],"green",None,None,True,2)

    # Completed iteration / UCI layer
    panel(690,1590,1450,72,"COMPLETED ITERATION  /  UCI OBSERVABILITY",["info depth · score cp · nodes · NPS · TT hits · hashfull · pv field (root best move only) · final response: bestmove"],"green","RUNTIME OUTPUT","small")
    arrow([(1110,1580),(1110,1590)],"green")
    arrow([(2040,1625),(2160,1625),(2160,235),(1380,235),(1380,270)],"green",None,None,True,2)
    text(60,1690,"SOURCE MAP · src/main.cpp: qsearch 589–628 | negamax / TT / pruning 653–752 | root iteration 755–807 | evaluation 432–563","foot")
    text(2140,1690,"SOURCE-LEVEL VIEW · NOT A RUNTIME TRACE","foot","end")
    S.append('</svg>')
    return ''.join(S)

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--output',default='docs/assets/prunex-search-kernel.svg')
    args=ap.parse_args()
    p=Path(args.output);p.parent.mkdir(parents=True,exist_ok=True)
    svg=build();p.write_text(svg+'\n',encoding='utf-8')
    print(f'Wrote {p} ({len(svg):,} characters)')

if __name__=='__main__': main()
