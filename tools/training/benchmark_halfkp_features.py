#!/usr/bin/env python3
"""Compare the direct FEN HalfKP parser with python-chess feature extraction."""

from __future__ import annotations

import argparse
import importlib.util
import json
import random
import statistics
import time
from pathlib import Path

import chess

ROOT = Path(__file__).resolve().parents[2]
TRAINER_PATH = ROOT / "tools" / "training" / "train_halfkp.py"
SPEC = importlib.util.spec_from_file_location("prunex_halfkp_benchmark", TRAINER_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("Could not load the Prunex trainer")
TRAINER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(TRAINER)


def reference_features(fen: str) -> tuple[list[int], list[int], bool]:
    board = chess.Board(fen)
    if not board.is_valid():
        raise ValueError(f"Invalid benchmark FEN: {fen}")
    result: list[list[int]] = [[], []]
    for perspective in (chess.WHITE, chess.BLACK):
        king = board.king(perspective)
        if king is None:
            raise ValueError("Missing king")
        oriented_king = king if perspective == chess.WHITE else king ^ 56
        output = result[0 if perspective == chess.WHITE else 1]
        for square, piece in board.piece_map().items():
            if piece.piece_type == chess.KING:
                continue
            oriented_piece = square if perspective == chess.WHITE else square ^ 56
            relative_color = 0 if piece.color == perspective else 1
            piece_slot = (piece.piece_type - 1) * 2 + relative_color
            output.append((oriented_king * 10 + piece_slot) * 64 + oriented_piece)
    return result[0], result[1], board.turn == chess.WHITE


def make_positions(count: int, seed: int) -> list[str]:
    rng = random.Random(seed)
    result: list[str] = []
    while len(result) < count:
        board = chess.Board()
        while not board.is_game_over(claim_draw=True) and len(result) < count:
            result.append(board.fen(en_passant="fen"))
            legal = list(board.legal_moves)
            if not legal:
                break
            board.push(rng.choice(legal))
    return result


def measure(function, positions: list[str], runs: int) -> list[float]:
    timings: list[float] = []
    for _ in range(runs):
        start = time.perf_counter()
        output = [function(fen) for fen in positions]
        timings.append(time.perf_counter() - start)
        if len(output) != len(positions):
            raise RuntimeError("Feature extraction lost benchmark positions")
    return timings


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--positions", type=int, default=20_000)
    parser.add_argument("--runs", type=int, default=5)
    parser.add_argument("--seed", type=int, default=20261113)
    args = parser.parse_args()
    if args.positions < 100 or not 3 <= args.runs <= 20:
        parser.error("Use at least 100 positions and between 3 and 20 runs")

    positions = make_positions(args.positions, args.seed)
    for fen in positions[:min(1000, len(positions))]:
        if TRAINER.halfkp_features(fen) != reference_features(fen):
            raise RuntimeError(f"Feature mismatch for {fen}")

    reference_times = measure(reference_features, positions, args.runs)
    fast_times = measure(TRAINER.halfkp_features, positions, args.runs)
    reference_median = statistics.median(reference_times)
    fast_median = statistics.median(fast_times)
    report = {
        "kind": "halfkp-fen-feature-extraction-comparison",
        "positions": len(positions),
        "runs": args.runs,
        "seed": args.seed,
        "reference": {
            "median_seconds": reference_median,
            "positions_per_second": len(positions) / reference_median,
            "samples_seconds": reference_times,
        },
        "direct_parser": {
            "median_seconds": fast_median,
            "positions_per_second": len(positions) / fast_median,
            "samples_seconds": fast_times,
        },
        "speedup": reference_median / fast_median,
        "validation": "First 1,000 positions matched exactly against python-chess.",
    }
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
