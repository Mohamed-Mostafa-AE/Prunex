#!/usr/bin/env python3
"""Write the source-authored Prunex native-engine architecture SVG."""
from __future__ import annotations

import argparse
from pathlib import Path

SVG = r'''<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080" role="img" aria-labelledby="title desc">
<title id="title">Prunex native engine architecture</title>
<desc id="desc">A source-derived overview of the Prunex C++20 engine: hybrid 0x88 and bitboard position state, legal move generation, iterative deepening, Negamax principal-variation search, transposition-table and selective-search heuristics, quiescence, handcrafted tapered evaluation, and UCI output.</desc>
<defs>
  <style>
    text{font-family:Inter,Segoe UI,Arial,sans-serif}
    .eyebrow{font-size:15px;font-weight:800;letter-spacing:2.4px;fill:#2463a6}
    .heading{font-size:48px;font-weight:800;letter-spacing:-1.2px;fill:#122a45}
    .subtitle{font-size:21px;font-weight:450;fill:#536b84}
    .card{fill:#ffffff;stroke:#d5e1ef;stroke-width:2}
    .cardhead{fill:#eaf3ff}
    .num{fill:#2166b1}
    .numtext{font-size:16px;font-weight:800;fill:#ffffff;text-anchor:middle}
    .kicker{font-size:13px;font-weight:800;letter-spacing:1.6px;fill:#2869ae}
    .title{font-size:22px;font-weight:750;fill:#172f4b}
    .body{font-size:16px;font-weight:450;fill:#526981}
    .bodystrong{font-size:16px;font-weight:700;fill:#284a70}
    .arrow{fill:none;stroke:#3478bf;stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round}
    .arrowsoft{fill:none;stroke:#8eabc9;stroke-width:2.4;stroke-dasharray:7 7;stroke-linecap:round}
    .panel{fill:#f0f6fd;stroke:#cfdeef;stroke-width:2}
    .paneltitle{font-size:16px;font-weight:800;letter-spacing:1.2px;fill:#1d5c9e}
    .panelbody{font-size:17px;font-weight:500;fill:#3e5873}
    .note{font-size:15px;font-weight:600;fill:#617990}
    .output{fill:#173d66;stroke:#173d66;stroke-width:2}
    .outputtitle{font-size:17px;font-weight:800;letter-spacing:1.5px;fill:#b9d7f7}
    .outputbody{font-size:21px;font-weight:650;fill:#ffffff}
    .foot{font-size:14px;font-weight:500;fill:#73879b}
  </style>
  <marker id="arrowhead" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto">
    <path d="M0 0L12 6L0 12Z" fill="#3478bf"/>
  </marker>
  <marker id="arrowheadsoft" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
    <path d="M0 0L10 5L0 10Z" fill="#8eabc9"/>
  </marker>
  <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
    <path d="M32 0H0V32" fill="none" stroke="#eaf0f7" stroke-width="1"/>
  </pattern>
</defs>
<rect width="1920" height="1080" fill="#f8fbff"/>
<rect width="1920" height="1080" fill="url(#grid)" opacity=".62"/>
<rect x="72" y="62" width="8" height="112" rx="4" fill="#2a73ba"/>
<text x="104" y="84" class="eyebrow">PRUNEX 0.8.0 · NATIVE C++20 CHESS ENGINE</text>
<text x="104" y="143" class="heading">Inside the Engine</text>
<text x="104" y="181" class="subtitle">A source-derived view of Prunex's position model, search pipeline and handcrafted evaluation.</text>

<!-- Flow cards -->
<g>
  <rect x="72" y="252" width="260" height="292" rx="18" class="card"/>
  <path d="M90 252H314Q332 252 332 270V319H72V270Q72 252 90 252Z" class="cardhead"/>
  <circle cx="104" cy="286" r="17" class="num"/><text x="104" y="292" class="numtext">01</text>
  <text x="132" y="291" class="kicker">POSITION STATE</text>
  <text x="96" y="357" class="title">Hybrid board</text>
  <text x="96" y="393" class="bodystrong">0x88 mailbox + bitboards</text>
  <text x="96" y="430" class="body">• board[128] mailbox</text>
  <text x="96" y="459" class="body">• piece and occupancy masks</text>
  <text x="96" y="488" class="body">• side, castling, en-passant</text>
  <text x="96" y="517" class="body">• Zobrist position key</text>
</g>
<g>
  <rect x="382" y="252" width="260" height="292" rx="18" class="card"/>
  <path d="M400 252H624Q642 252 642 270V319H382V270Q382 252 400 252Z" class="cardhead"/>
  <circle cx="414" cy="286" r="17" class="num"/><text x="414" y="292" class="numtext">02</text>
  <text x="442" y="291" class="kicker">MOVE GENERATION</text>
  <text x="406" y="357" class="title">Legal moves</text>
  <text x="406" y="393" class="bodystrong">pseudoMoves → legalMoves</text>
  <text x="406" y="430" class="body">• attack and slider lookups</text>
  <text x="406" y="459" class="body">• make / undo transitions</text>
  <text x="406" y="488" class="body">• king-safety validation</text>
  <text x="406" y="517" class="body">• castle, en-passant, promotion</text>
</g>
<g>
  <rect x="692" y="252" width="260" height="292" rx="18" class="card"/>
  <path d="M710 252H934Q952 252 952 270V319H692V270Q692 252 710 252Z" class="cardhead"/>
  <circle cx="724" cy="286" r="17" class="num"/><text x="724" y="292" class="numtext">03</text>
  <text x="752" y="291" class="kicker">ROOT CONTROLLER</text>
  <text x="716" y="357" class="title">findBestMove()</text>
  <text x="716" y="393" class="bodystrong">Iterative deepening</text>
  <text x="716" y="430" class="body">• depth / time / node limits</text>
  <text x="716" y="459" class="body">• aspiration windows</text>
  <text x="716" y="488" class="body">• retry on window failure</text>
  <text x="716" y="517" class="body">• keep last completed iteration</text>
</g>
<g>
  <rect x="1002" y="252" width="260" height="292" rx="18" class="card"/>
  <path d="M1020 252H1244Q1262 252 1262 270V319H1002V270Q1002 252 1020 252Z" class="cardhead"/>
  <circle cx="1034" cy="286" r="17" class="num"/><text x="1034" y="292" class="numtext">04</text>
  <text x="1062" y="291" class="kicker">SEARCH CORE</text>
  <text x="1026" y="357" class="title">Negamax + PVS</text>
  <text x="1026" y="393" class="bodystrong">Alpha–beta bounds</text>
  <text x="1026" y="430" class="body">• first move: full window</text>
  <text x="1026" y="459" class="body">• later moves: null window</text>
  <text x="1026" y="488" class="body">• check extensions</text>
  <text x="1026" y="517" class="body">• conditional re-search</text>
</g>
<g>
  <rect x="1312" y="252" width="260" height="292" rx="18" class="card"/>
  <path d="M1330 252H1554Q1572 252 1572 270V319H1312V270Q1312 252 1330 252Z" class="cardhead"/>
  <circle cx="1344" cy="286" r="17" class="num"/><text x="1344" y="292" class="numtext">05</text>
  <text x="1372" y="291" class="kicker">ORDER + PRUNE</text>
  <text x="1336" y="357" class="title">Selective search</text>
  <text x="1336" y="393" class="bodystrong">TT + search heuristics</text>
  <text x="1336" y="430" class="body">• Zobrist transposition table</text>
  <text x="1336" y="459" class="body">• hash move, SEE, killer, history</text>
  <text x="1336" y="488" class="body">• null-move pruning</text>
  <text x="1336" y="517" class="body">• late-move reductions</text>
</g>
<g>
  <rect x="1622" y="252" width="226" height="292" rx="18" class="card"/>
  <path d="M1640 252H1830Q1848 252 1848 270V319H1622V270Q1622 252 1640 252Z" class="cardhead"/>
  <circle cx="1654" cy="286" r="17" class="num"/><text x="1654" y="292" class="numtext">06</text>
  <text x="1682" y="291" class="kicker">LEAF SEARCH</text>
  <text x="1646" y="357" class="title">qsearch()</text>
  <text x="1646" y="393" class="bodystrong">Tactical leaf</text>
  <text x="1646" y="430" class="body">• captures / promotions</text>
  <text x="1646" y="459" class="body">• all check evasions</text>
  <text x="1646" y="488" class="body">• alpha–beta cutoffs</text>
  <text x="1646" y="517" class="body">• evaluates quiet leaves</text>
</g>
<path d="M332 399H376" class="arrow" marker-end="url(#arrowhead)"/>
<path d="M642 399H686" class="arrow" marker-end="url(#arrowhead)"/>
<path d="M952 399H996" class="arrow" marker-end="url(#arrowhead)"/>
<path d="M1262 399H1306" class="arrow" marker-end="url(#arrowhead)"/>
<path d="M1572 399H1616" class="arrow" marker-end="url(#arrowhead)"/>

<!-- lower architecture panels -->
<rect x="72" y="610" width="520" height="210" rx="18" class="panel"/>
<text x="104" y="655" class="paneltitle">STATIC EVALUATION · evaluate()</text>
<text x="104" y="700" class="panelbody">Handcrafted tapered middlegame / endgame score</text>
<text x="104" y="735" class="body">Material · activity · centralization · pawn structure</text>
<text x="104" y="767" class="body">Bishop pair · king shelter · rook-file bonuses</text>
<text x="104" y="797" class="body">Material-phase blending (phase capped at 24)</text>

<rect x="632" y="610" width="650" height="210" rx="18" class="panel"/>
<text x="664" y="655" class="paneltitle">SHARED SEARCH STATE</text>
<text x="664" y="700" class="panelbody">Transposition table · full Zobrist key verification · generation</text>
<text x="664" y="735" class="body">Default TT: 2^18 entries · ladder candidate build: 2^22 entries</text>
<text x="664" y="767" class="body">Repeated-position history · halfmove clock · material draw checks</text>
<text x="664" y="797" class="body">Cached bounds: EXACT · LOWER · UPPER</text>

<rect x="1322" y="610" width="526" height="210" rx="18" class="panel"/>
<text x="1354" y="655" class="paneltitle">UCI OBSERVABILITY</text>
<text x="1354" y="700" class="panelbody">Completed search iteration reports</text>
<text x="1354" y="735" class="body">depth · score · nodes · NPS · TT hits · hashfull</text>
<text x="1354" y="767" class="body">pv field: current root best move only</text>
<text x="1354" y="797" class="bodystrong">Final command: bestmove</text>

<!-- evaluation / result and loop -->
<path d="M1735 544V575H1585V604" class="arrowsoft" marker-end="url(#arrowheadsoft)"/>
<path d="M1760 544V582H330V604" class="arrowsoft" marker-end="url(#arrowheadsoft)"/>
<path d="M1400 544V584H960V604" class="arrowsoft" marker-end="url(#arrowheadsoft)"/>

<rect x="72" y="866" width="1776" height="112" rx="18" class="output"/>
<text x="108" y="907" class="outputtitle">ENGINE RESPONSE</text>
<text x="108" y="948" class="outputbody">uci → info depth / score / nodes / nps → bestmove</text>
<text x="1000" y="913" class="outputtitle">IMPLEMENTATION NOTE</text>
<text x="1000" y="948" class="outputbody">Handcrafted evaluation · no neural-network / NNUE inference</text>

<text x="74" y="1021" class="foot">Conceptual architecture derived from the C++ source. It is not a runtime trace, benchmark result, or playing-strength claim.</text>
<text x="1846" y="1021" text-anchor="end" class="foot">PRUNEX · ENGINE ARCHITECTURE</text>
</svg>'''


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output",
        default="docs/assets/prunex-engine-architecture.svg",
    )
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()

    path = Path(args.output)
    expected = SVG.strip() + "\n"
    if args.check:
        if not path.is_file() or path.read_text(encoding="utf-8") != expected:
            raise SystemExit(f"{path} is missing or differs from the generated SVG.")
        print(f"Verified {path}")
        return 0

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(expected, encoding="utf-8")
    print(f"Wrote {path} ({len(expected):,} characters)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
