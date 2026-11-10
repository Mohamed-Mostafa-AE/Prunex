#!/usr/bin/env python3
"""Smoke-test the bounded node limit on the first Ruy Lopez game sequence."""
from __future__ import annotations

import argparse
import re
from pathlib import Path
import sys

import chess
import chess.engine

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools" / "stockfish-2.0-match"))

from run_match import opening_board, validate_node_budget  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--prunex", required=True)
    parser.add_argument("--stockfish", required=True)
    parser.add_argument("--nodes", type=int, default=1_000_000)
    parser.add_argument("--stockfish-hash-mb", type=int, default=256)
    args = parser.parse_args()

    board = opening_board("e4 e5 Nf3 Nc6 Bb5 a6")
    game_token = object()

    with chess.engine.SimpleEngine.popen_uci(args.prunex, timeout=60) as prunex, \
         chess.engine.SimpleEngine.popen_uci(args.stockfish, timeout=60) as stockfish:
        prunex_id = prunex.id.get("name", "")
        stockfish_id = stockfish.id.get("name", "")
        if "Prunex 0.8.0" not in prunex_id:
            raise RuntimeError(f"Unexpected Prunex UCI identity: {prunex_id!r}")
        if "Stockfish 2.0" not in stockfish_id:
            raise RuntimeError(f"Unexpected Stockfish UCI identity: {stockfish_id!r}")
        stockfish.configure({"Hash": args.stockfish_hash_mb, "Threads": 1})

        # Reproduce the opening phase that previously exposed the qsearch
        # overshoot: Prunex has White, Stockfish 2.0 has Black.
        for ply in range(1, 7):
            is_prunex = board.turn == chess.WHITE
            engine = prunex if is_prunex else stockfish
            engine_name = "Prunex" if is_prunex else "Stockfish 2.0"
            result = engine.play(
                board,
                chess.engine.Limit(nodes=args.nodes),
                game=game_token,
                info=chess.engine.INFO_ALL,
            )
            if result.move not in board.legal_moves:
                raise RuntimeError(f"{engine_name} returned an illegal move: {result.move}")

            info = result.info or {}
            node_report = re.search(
                r"node-limit (\\d+)/(\\d+)", str(info.get("string", ""))
            )
            actual_nodes = int(node_report.group(1)) if node_report else info.get("nodes")
            allowance = validate_node_budget(
                engine_name, actual_nodes, args.nodes, 1, ply
            )
            print(
                f"ply {ply}/6 | {engine_name} | {actual_nodes} nodes "
                f"(requested {args.nodes}, allowance {allowance})",
                flush=True,
            )
            board.push(result.move)


if __name__ == "__main__":
    main()
