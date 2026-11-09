#!/usr/bin/env python3
"""Generate a detailed, source-grounded architecture plate for Prunex 0.8.0."""
from __future__ import annotations
import argparse
from pathlib import Path
from xml.sax.saxutils import escape

W, H = 2600, 2110
BG = "#07111f"
PANEL = "#0d1b2c"
CARD = "#11243a"
EDGE = "#294660"
TEXT = "#eef5ff"
MUTED = "#a8bdd0"
DIM = "#708aa3"
CYAN = "#55e2d0"
BLUE = "#79aaff"
AMBER = "#f2c56b"
RED = "#ff8d9b"
GREEN = "#8fe0a8"

parts: list[str] = []

def txt(x: float, y: float, value: str, size: int = 19, color: str = TEXT,
        weight: int = 400, anchor: str = "start", letter: float = 0) -> None:
    parts.append(f'<text x="{x}" y="{y}" font-family="Inter,Segoe UI,Arial,sans-serif" '
                 f'font-size="{size}" font-weight="{weight}" fill="{color}" '
                 f'text-anchor="{anchor}" letter-spacing="{letter}">{escape(value)}</text>')

def rect(x: float, y: float, w: float, h: float, fill: str = CARD,
         stroke: str = EDGE, radius: int = 16, sw: int = 2) -> None:
    parts.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{radius}" '
                 f'fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>')

def panel(x: float, y: float, w: float, h: float, title: str, rows: list[str],
          accent: str = CYAN, tag: str | None = None, row_size: int = 16) -> None:
    rect(x, y, w, h, PANEL, EDGE, 18, 2)
    rect(x, y, 7, h, accent, accent, 3, 0)
    txt(x + 24, y + 34, title, 21, TEXT, 700)
    if tag:
        txt(x + w - 20, y + 31, tag, 13, accent, 700, "end", 1)
    for i, row in enumerate(rows):
        txt(x + 24, y + 70 + i * 27, row, row_size, MUTED, 450)

def block(x: float, y: float, w: float, h: float, label: str, title: str,
          rows: list[str], accent: str = CYAN, tag: str | None = None,
          row_size: int = 16) -> None:
    rect(x, y, w, h, CARD, EDGE, 17, 2)
    rect(x, y, 7, h, accent, accent, 3, 0)
    txt(x + 23, y + 24, label.upper(), 12, accent, 750, letter=1.4)
    txt(x + 23, y + 53, title, 22, TEXT, 700)
    if tag:
        txt(x + w - 18, y + 25, tag, 12, accent, 700, "end", 1)
    for i, row in enumerate(rows):
        txt(x + 23, y + 83 + i * 25, row, row_size, MUTED, 450)

def arrow(points: list[tuple[float, float]], color: str = CYAN,
          label: str | None = None, label_at: tuple[float, float] | None = None,
          width: int = 3, dash: str | None = None) -> None:
    d = "M " + " L ".join(f"{x} {y}" for x, y in points)
    dash_attr = f' stroke-dasharray="{dash}"' if dash else ""
    parts.append(f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{width}" '
                 f'stroke-linecap="round" stroke-linejoin="round" marker-end="url(#{color[1:]})"{dash_attr}/>')
    if label and label_at:
        txt(label_at[0], label_at[1], label, 13, color, 700)

def diamond(cx: float, cy: float, w: float, h: float, label: str,
            accent: str = AMBER) -> None:
    points = f"{cx},{cy-h/2} {cx+w/2},{cy} {cx},{cy+h/2} {cx-w/2},{cy}"
    parts.append(f'<polygon points="{points}" fill="#1b2b3c" stroke="{accent}" stroke-width="2.5"/>')
    txt(cx, cy + 7, label, 17, TEXT, 700, "middle")

def circle(cx: float, cy: float, r: int, fill: str, stroke: str = "none") -> None:
    parts.append(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{fill}" stroke="{stroke}" stroke-width="2"/>')

def build() -> str:
    parts.clear()
    parts.append(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">')
    parts.append('''<defs>
      <pattern id="grid" width="34" height="34" patternUnits="userSpaceOnUse">
        <path d="M34 0H0V34" fill="none" stroke="#14263a" stroke-width="1"/>
      </pattern>
      <marker id="55e2d0" markerWidth="11" markerHeight="11" refX="9" refY="5" orient="auto"><path d="M0 0L10 5L0 10Z" fill="#55e2d0"/></marker>
      <marker id="79aaff" markerWidth="11" markerHeight="11" refX="9" refY="5" orient="auto"><path d="M0 0L10 5L0 10Z" fill="#79aaff"/></marker>
      <marker id="f2c56b" markerWidth="11" markerHeight="11" refX="9" refY="5" orient="auto"><path d="M0 0L10 5L0 10Z" fill="#f2c56b"/></marker>
      <marker id="ff8d9b" markerWidth="11" markerHeight="11" refX="9" refY="5" orient="auto"><path d="M0 0L10 5L0 10Z" fill="#ff8d9b"/></marker>
      <marker id="8fe0a8" markerWidth="11" markerHeight="11" refX="9" refY="5" orient="auto"><path d="M0 0L10 5L0 10Z" fill="#8fe0a8"/></marker>
      <marker id="708aa3" markerWidth="11" markerHeight="11" refX="9" refY="5" orient="auto"><path d="M0 0L10 5L0 10Z" fill="#708aa3"/></marker>
    </defs>''')
    rect(0, 0, W, H, BG, BG, 0, 0)
    parts.append(f'<rect width="{W}" height="{H}" fill="url(#grid)" opacity=".62"/>')
    txt(78, 66, "PRUNEX 0.8.0  /  NATIVE C++20 ENGINE", 15, CYAN, 750, letter=2.0)
    txt(78, 132, "Inside the Search Kernel", 58, TEXT, 750, letter=-1.0)
    txt(82, 177, "Source-derived architecture of the current native implementation — control flow, search state, pruning and evaluation", 21, MUTED, 450)
    for i, (col, label) in enumerate([(CYAN, "CONTROL FLOW"), (BLUE, "SEARCH STATE"), (AMBER, "EVALUATION / LEAF"), (RED, "PRUNING / CUTOFF"), (GREEN, "RESULT / FEEDBACK")]):
        x = 86 + i * 300
        rect(x, 205, 13, 13, col, col, 3, 0)
        txt(x + 23, 217, label, 12, MUTED, 700, letter=1.0)

    txt(78, 270, "01  /  ROOT ORCHESTRATION", 13, BLUE, 800, letter=1.6)
    block(78, 292, 520, 145, "UCI INPUT", "Position + go limits", [
        "FEN / start position + move sequence",
        "depth · movetime · clock · optional node cap"], BLUE)
    block(660, 292, 550, 145, "ROOT DRIVER", "findBestMove(position, depth, …)", [
        "Generate legal root moves; set time / node limit",
        "Advance TT generation; reset counters and PV state"], CYAN, row_size=15)
    block(1274, 292, 550, 145, "ITERATION SCHEDULE", "Iterative deepening", [
        "Depth 1 → requested limit; preserve last complete result",
        "Age history scores; clear killer moves for the search"], BLUE)
    block(1888, 292, 630, 145, "WINDOW CONTROL", "Aspiration search", [
        "Depth ≥ 3: previous score ± 40 centipawns",
        "Fail-low / fail-high → widen window and re-search"], AMBER)
    arrow([(598, 365), (660, 365)], BLUE)
    arrow([(1210, 365), (1274, 365)], CYAN)
    arrow([(1824, 365), (1888, 365)], AMBER)
    arrow([(2203, 437), (2203, 472), (1745, 472), (1745, 515)], AMBER, "root call", (2010, 463))

    txt(820, 510, "02  /  RECURSIVE NEGAMAX PIPELINE", 13, CYAN, 800, letter=1.6)
    block(820, 535, 970, 116, "NODE ENTRY", "negamax(position, depth, α, β, ply, pvNode)", [
        "Abort / maximum-ply guard · check extension increments depth when side to move is in check"], CYAN, row_size=16)
    arrow([(1305, 651), (1305, 683)], CYAN)
    block(820, 685, 970, 126, "POSITION VALIDATION", "Hash + terminal / draw rules", [
        "Zobrist key → search-path repetition; halfmove clock ≥ 100; insufficient material",
        "If a draw condition occurs while checked, test legal evasions to distinguish mate"], BLUE, row_size=15)
    arrow([(1305, 811), (1305, 840)], BLUE)
    diamond(1305, 894, 520, 98, "depth ≤ 0 ?", AMBER)
    arrow([(1045, 894), (740, 894), (740, 946), (650, 946)], AMBER, "YES", (760, 877))
    panel(78, 830, 570, 265, "QUIESCENCE SEARCH  /  qsearch()", [
        "Entered at depth ≤ 0; non-check q-ply cap = 18",
        "Outside check: stand-pat evaluation updates α / β",
        "Search captures and promotions; order with SEE",
        "In check: every legal evasion (no stand-pat or q-ply cap)",
        "Alpha–beta cutoffs; mate / stalemate terminal handling"], AMBER, "LEAF EXTENSION", 15)
    arrow([(1305, 943), (1305, 969)], CYAN, "NO", (1330, 960))

    block(820, 972, 970, 137, "TRANSPOSITION PROBE", "Direct-mapped transposition table", [
        "Index = Zobrist key & (TT_SIZE − 1); confirm the stored full key",
        "Sufficient depth: EXACT returns · LOWER cuts at β · UPPER cuts at α",
        "Hash move is retained for ordering even when the stored bound cannot return"], BLUE, row_size=15)
    arrow([(1790, 1038), (1840, 1038), (1840, 750), (1900, 750)], BLUE, "probe / store", (1847, 900))
    panel(1900, 635, 620, 236, "POSITION HASH + TT ENTRY", [
        "Zobrist key components: pieces · side to move",
        "castling rights · en-passant square",
        "2^18 entries (TT_BITS = 18), indexed directly",
        "Entry: key · best move · score · depth",
        "bound (EXACT / LOWER / UPPER) · generation",
        "Mate scores normalized for ply on store / retrieval"], BLUE, "STATE CACHE", 15)
    arrow([(1900, 690), (1850, 690), (1850, 990), (1790, 990)], GREEN, "usable bound → return", (1860, 715), 2, "7 6")

    arrow([(1305, 1109), (1305, 1135)], CYAN)
    block(820, 1137, 970, 139, "SELECTIVE PRUNING", "Null-move pruning gate", [
        "Only non-PV · not in check · depth ≥ 3 · below mate threshold",
        "Require non-pawn material; null search uses R = 2 + depth / 4",
        "Cutoff at depth < 7 is accepted; deeper cutoff gets a verification search"], AMBER, row_size=15)
    panel(1900, 925, 620, 248, "NULL-MOVE / REDUCTION POLICY", [
        "Null position: flip side; clear en-passant",
        "Search a reduced null window (−β, −β + 1)",
        "If score ≥ β: candidate fail-high",
        "At depth ≥ 7: verify with null-move disabled",
        "Verification is another reduced-depth search"], AMBER, "CONDITIONAL", 15)
    arrow([(1790, 1202), (1845, 1202), (1845, 1050), (1900, 1050)], AMBER, "gate / verify", (1848, 1185), 2, "7 6")

    arrow([(1305, 1276), (1305, 1301)], CYAN)
    block(820, 1303, 970, 122, "EXPANSION", "Legal moves + ordered candidate list", [
        "Generate legal moves; detect mate / stalemate when the list is empty",
        "Score and sort candidates before entering the recursive move loop"], CYAN, row_size=15)
    panel(78, 1243, 570, 230, "POSITION / MOVE GENERATION", [
        "0x88 mailbox board (128 slots; on-board mask)",
        "Pseudo-legal generation + make / undo legality test",
        "Castling · en-passant · promotions · king safety",
        "Position state: side · castling · EP · halfmove / fullmove"], CYAN, "BOARD CORE", 15)
    arrow([(648, 1350), (820, 1350)], CYAN, "legal move set", (685, 1335), 2)

    arrow([(1305, 1425), (1305, 1450)], CYAN)
    block(820, 1452, 970, 183, "PRINCIPAL-VARIATION SEARCH", "PVS move loop  /  Negamax recursion", [
        "Move 1: full α–β window; later moves: null-window probe (−α−1, −α)",
        "Quiet, non-check moves may receive LMR: depth ≥ 3 and move index ≥ 3",
        "At depth ≥ 6 and move index ≥ 8, the reduction can increase by one",
        "Fail-high after reduction → re-search; PV improvement inside window → full re-search",
        "If α ≥ β: cutoff; update killer and history scores for quiet moves"], CYAN, row_size=15)
    panel(1900, 1210, 620, 260, "MOVE ORDERING / HEURISTICS", [
        "1  Hash move (highest priority)",
        "2  Captures: SEE + victim / attacker value",
        "3  Promotions: priority bonus (capture-promotions combine both)",
        "4  Killer moves (two slots per ply)",
        "5  History score (side · from-square · to-square), for quiet moves",
        "Quiet beta-cutoff moves update killer + history tables"], BLUE, "ORDER BEFORE SEARCH", 15)
    arrow([(1900, 1360), (1850, 1360), (1790, 1360)], BLUE, "move scores", (1822, 1344), 2)
    arrow([(1790, 1590), (1855, 1590), (1855, 1440), (1900, 1440)], BLUE, "killer / history updates", (1860, 1572), 2, "7 6")

    panel(1900, 1505, 620, 295, "PVS SEARCH-TREE VIEW", [
        "Conceptual branch structure — not a measured tree or fixed width"], CYAN, "PRINCIPLE, NOT SCALE", 14)
    root = (1980, 1660)
    children = [(2120, 1608), (2120, 1660), (2120, 1712)]
    for x, y in children:
        arrow([root, (x - 18, y)], BLUE, width=2)
    circle(*root, 11, CYAN)
    for i, (x, y) in enumerate(children):
        circle(x, y, 10, AMBER if i == 0 else BLUE)
        if i == 0:
            circle(2255, 1608, 10, GREEN)
            arrow([(x + 11, y), (2242, 1608)], GREEN, width=2)
        elif i == 1:
            circle(2255, 1660, 10, RED)
            arrow([(x + 11, y), (2242, 1660)], RED, width=2)
        else:
            circle(2255, 1712, 10, DIM)
            arrow([(x + 11, y), (2242, 1712)], DIM, width=2, dash="5 5")
    txt(2290, 1614, "PV re-search", 13, GREEN, 700)
    txt(2290, 1666, "β cutoff", 13, RED, 700)
    txt(2290, 1718, "sibling pruned", 13, DIM, 700)

    panel(78, 1510, 570, 300, "HANDCRAFTED STATIC EVALUATION", [
        "Material values + piece-square / activity terms",
        "Pawn terms: advancement · doubled · isolated",
        "passed · connected pawn bonuses",
        "Bishop-pair bonus; king-shelter adjustments",
        "Rook open / semi-open file bonuses",
        "Middlegame ↔ endgame phase blend (phase capped at 24)",
        "Root baseline · qsearch stand-pat · stop / max-ply fallback"], AMBER, "evaluate(position)", 14)
    arrow([(648, 1645), (700, 1645), (700, 1070), (648, 1070)], AMBER, "stand-pat / leaf score", (705, 1320), 2, "7 6")

    arrow([(1305, 1635), (1305, 1662)], GREEN)
    block(820, 1664, 970, 119, "NODE COMPLETION", "Bound classification + TT store", [
        "best ≤ original α → UPPER · best ≥ β → LOWER · otherwise EXACT",
        "Store score, best move, depth and generation; then return node score"], GREEN, row_size=15)
    arrow([(1790, 1723), (1868, 1723), (1868, 592), (1790, 592)], GREEN, "recursive return to caller", (1875, 1705), 2, "8 7")

    arrow([(1305, 1783), (1305, 1820)], GREEN)
    panel(560, 1830, 1480, 170, "COMPLETED ITERATION  /  UCI OBSERVABILITY", [
        "info depth · score cp · nodes · NPS · TT hits · hashfull · pv field (root move only)",
        "Only a completed iteration updates score / depth; final response emits bestmove",
        "Node / time stop is checked during search; time polling is sampled every 128 nodes"], GREEN, "MEASURED AT RUNTIME", 16)
    arrow([(2040, 1910), (2550, 1910), (2550, 258), (1548, 258), (1548, 292)], GREEN, "next depth / retain last complete result", (1580, 250), 2, "8 7")

    txt(78, 2040, "SOURCE MAP  ·  src/main.cpp: 589–628 quiescence  |  653–752 negamax / TT / pruning  |  755–807 root iteration  |  432–563 evaluation", 14, MUTED, 500)
    txt(78, 2072, "This is a source-level architecture plate, not a captured search trace. The branching inset is explanatory; node counts, tree widths and performance vary by position.", 13, DIM, 450)
    txt(2518, 2072, "PRUNEX  /  SEARCH SYSTEMS", 12, CYAN, 750, "end", 1.2)
    parts.append('</svg>')
    return "\n".join(parts)

def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--output", default="docs/assets/prunex-search-kernel.svg")
    args = ap.parse_args()
    destination = Path(args.output)
    destination.parent.mkdir(parents=True, exist_ok=True)
    svg = build()
    destination.write_text(svg + "\n", encoding="utf-8")
    print(f"Wrote {destination} ({len(svg):,} SVG characters)")

if __name__ == "__main__":
    main()
