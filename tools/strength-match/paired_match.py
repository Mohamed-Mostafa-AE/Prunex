#!/usr/bin/env python3
"""Paired-color UCI match: candidate branch versus the PR base engine."""
from __future__ import annotations

import argparse
import json
import math
import random
import time
from pathlib import Path

import chess
import chess.engine
import chess.pgn


def opening_positions(count: int, seed: int) -> list[chess.Board]:
    rng = random.Random(seed)
    positions = []
    for _ in range(count):
        board = chess.Board()
        for _ in range(rng.randint(8, 14)):
            if board.is_game_over():
                break
            board.push(rng.choice(list(board.legal_moves)))
        positions.append(board.copy())
    return positions


def play_game(candidate: chess.engine.SimpleEngine,
              baseline: chess.engine.SimpleEngine,
              opening: chess.Board,
              candidate_color: chess.Color,
              seconds: float,
              pair_index: int,
              leg: int) -> tuple[float, str, int]:
    board = opening.copy()
    game = chess.pgn.Game()
    game.setup(board)
    game.headers["Event"] = "Prunex paired regression match"
    game.headers["Round"] = f"{pair_index + 1}.{leg + 1}"
    game.headers["White"] = "Candidate" if candidate_color else "Baseline"
    game.headers["Black"] = "Baseline" if candidate_color else "Candidate"
    game.headers["TimeControl"] = f"{seconds}+0"
    game.headers["OpeningSeed"] = str(pair_index)

    plies = 0
    game_token = object()
    while plies < 300:
        outcome = board.outcome(claim_draw=True)
        if outcome is not None:
            break
        engine = candidate if board.turn == candidate_color else baseline
        result = engine.play(board, chess.engine.Limit(time=seconds), game=game_token)
        if result.move not in board.legal_moves:
            raise RuntimeError(f"Engine returned illegal move: {result.move}")
        board.push(result.move)
        game.add_variation(result.move)
        plies += 1

    outcome = board.outcome(claim_draw=True)
    if outcome is None:
        game.headers["Termination"] = "Ply limit adjudication (draw)"
        score = 0.5
    elif outcome.winner is None:
        game.headers["Termination"] = outcome.termination.name
        score = 0.5
    else:
        game.headers["Termination"] = outcome.termination.name
        score = 1.0 if outcome.winner == candidate_color else 0.0

    game.headers["Result"] = "1-0" if board.result(claim_draw=True) == "1-0" else (
        "0-1" if board.result(claim_draw=True) == "0-1" else "1/2-1/2"
    )
    return score, str(game), plies


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--baseline", required=True)
    parser.add_argument("--candidate", required=True)
    parser.add_argument("--pairs", type=int, default=30)
    parser.add_argument("--seconds", type=float, default=0.20)
    parser.add_argument("--seed", type=int, default=20261109)
    parser.add_argument("--out", default="match-results")
    args = parser.parse_args()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    pgn_path = out / "paired-match.pgn"
    summary_path = out / "summary.json"

    openings = opening_positions(args.pairs, args.seed)
    candidate_wins = draws = candidate_losses = 0
    pair_scores: list[float] = []
    game_records = []
    started = time.time()

    with chess.engine.SimpleEngine.popen_uci(args.baseline, timeout=20) as baseline, \
         chess.engine.SimpleEngine.popen_uci(args.candidate, timeout=20) as candidate, \
         pgn_path.open("w", encoding="utf-8") as pgn_file:
        for index, opening in enumerate(openings):
            scores = []
            for leg, candidate_color in enumerate((chess.WHITE, chess.BLACK)):
                score, pgn, plies = play_game(
                    candidate, baseline, opening, candidate_color,
                    args.seconds, index, leg
                )
                scores.append(score)
                pgn_file.write(pgn + "\n\n")
                if score == 1.0:
                    candidate_wins += 1
                elif score == 0.5:
                    draws += 1
                else:
                    candidate_losses += 1
                game_records.append({
                    "pair": index + 1, "leg": leg + 1,
                    "candidate_color": "white" if candidate_color else "black",
                    "candidate_score": score, "plies": plies
                })
            pair_scores.append(sum(scores) / 2.0)
            print(
                f"pair {index + 1}/{args.pairs}: "
                f"candidate {scores[0]:.1f}+{scores[1]:.1f}",
                flush=True
            )

    games = candidate_wins + draws + candidate_losses
    total_score = candidate_wins + 0.5 * draws
    score_rate = total_score / games if games else 0.0
    elo = None if score_rate in (0.0, 1.0) else 400.0 * math.log10(
        score_rate / (1.0 - score_rate)
    )
    mean_pair = sum(pair_scores) / len(pair_scores)
    if len(pair_scores) > 1:
        variance = sum((x - mean_pair) ** 2 for x in pair_scores) / (len(pair_scores) - 1)
        se = math.sqrt(variance / len(pair_scores))
        ci_low = max(0.0, mean_pair - 1.96 * se)
        ci_high = min(1.0, mean_pair + 1.96 * se)
    else:
        ci_low = ci_high = mean_pair

    summary = {
        "baseline": args.baseline,
        "candidate": args.candidate,
        "pairs": args.pairs,
        "games": games,
        "time_per_move_seconds": args.seconds,
        "opening_seed": args.seed,
        "candidate_wins": candidate_wins,
        "draws": draws,
        "candidate_losses": candidate_losses,
        "candidate_score_percent": round(score_rate * 100, 2),
        "estimated_elo_difference": None if elo is None else round(elo, 1),
        "paired_score_mean": round(mean_pair, 4),
        "paired_score_95ci": [round(ci_low, 4), round(ci_high, 4)],
        "elapsed_seconds": round(time.time() - started, 1),
        "games_detail": game_records,
        "interpretation": (
            "Preliminary signal only; do not treat this small match as a release-grade Elo estimate."
        )
    }
    summary_path.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: v for k, v in summary.items() if k != "games_detail"}, indent=2))
    print(f"PGN: {pgn_path}")
    print(f"Summary: {summary_path}")


if __name__ == "__main__":
    main()
