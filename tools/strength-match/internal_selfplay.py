#!/usr/bin/env python3
"""Paired-colour regression match between two Prunex builds."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import random
import re
import statistics
import time
from pathlib import Path
from typing import Any

import chess
import chess.engine
import chess.pgn


FINAL_INFO = re.compile(
    r"search-final\s+nodes=(\d+)\s+depth=(\d+)\s+"
    r"elapsed_ms=(\d+)\s+tthits=(\d+)\s+node_limit=(\d+)"
)
NODE_LIMIT_INFO = re.compile(r"node-limit\s+(\d+)/(\d+)")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def opening_positions(count: int, seed: int) -> list[tuple[chess.Board, str]]:
    """Create deterministic, distinct, legal opening positions with White to move."""
    rng = random.Random(seed)
    positions: list[tuple[chess.Board, str]] = []
    seen: set[str] = set()
    attempts = 0

    while len(positions) < count:
        attempts += 1
        if attempts > count * 100:
            raise RuntimeError("Could not generate enough distinct opening positions")

        board = chess.Board()
        san_moves: list[str] = []
        for _ in range(rng.choice((8, 10, 12, 14))):
            if board.is_game_over(claim_draw=True):
                break
            move = rng.choice(list(board.legal_moves))
            san_moves.append(board.san(move))
            board.push(move)

        if board.is_game_over(claim_draw=True) or board.turn != chess.WHITE:
            continue
        fen = board.fen()
        if fen in seen:
            continue
        seen.add(fen)
        positions.append((board.copy(), " ".join(san_moves)))

    return positions


def search_stats(info: dict[str, Any], requested_nodes: int) -> dict[str, Any]:
    """Prefer final engine counters; keep the weaker UCI info snapshot labelled."""
    raw = info.get("string")
    if not isinstance(raw, str):
        raw = ""

    final = FINAL_INFO.search(raw)
    if final:
        nodes, depth, elapsed, tt_hits, node_limit = map(int, final.groups())
        return {
            "nodes": nodes,
            "depth": depth,
            "elapsed_ms": elapsed,
            "tt_hits": tt_hits,
            "node_limit": node_limit,
            "source": "final-search-info",
            "raw": raw,
        }

    node_line = NODE_LIMIT_INFO.search(raw)
    if node_line:
        nodes, node_limit = map(int, node_line.groups())
        return {
            "nodes": nodes,
            "depth": info.get("depth"),
            "elapsed_ms": None,
            "tt_hits": None,
            "node_limit": node_limit,
            "source": "node-limit-info",
            "raw": raw,
        }

    nodes = info.get("nodes")
    return {
        "nodes": nodes if isinstance(nodes, int) else None,
        "depth": info.get("depth"),
        "elapsed_ms": None,
        "tt_hits": info.get("tthits"),
        "node_limit": requested_nodes,
        "source": "last-uci-info" if isinstance(nodes, int) else "missing",
        "raw": raw or None,
    }


def configure_engine(
    engine: chess.engine.SimpleEngine, hash_mb: int, threads: int
) -> dict[str, int]:
    requested: dict[str, int] = {}
    for name, value in (("Hash", hash_mb), ("Threads", threads)):
        if name not in engine.options:
            raise RuntimeError(f"Engine does not expose the required UCI option: {name}")
        option = engine.options[name]
        minimum = int(option.min) if option.min is not None else value
        maximum = int(option.max) if option.max is not None else value
        selected = max(minimum, min(value, maximum))
        if selected != value:
            raise RuntimeError(
                f"Engine cannot use the requested {name}={value}; supported range "
                f"is {minimum}..{maximum}"
            )
        requested[name] = selected
    engine.configure(requested)
    engine.ping()
    return requested


def play_game(
    candidate: chess.engine.SimpleEngine,
    baseline: chess.engine.SimpleEngine,
    opening: chess.Board,
    opening_san: str,
    candidate_color: chess.Color,
    *,
    pair_index: int,
    leg_index: int,
    node_limit: int,
    max_plies: int,
    seed: int,
    output_pgn: Any,
    telemetry_file: Any,
) -> tuple[float, dict[str, Any]]:
    board = opening.copy()
    game = chess.pgn.Game()
    game.setup(board)
    game.headers["Event"] = "Prunex internal paired regression"
    game.headers["Site"] = "Automated fixed-node test"
    game.headers["Round"] = f"{pair_index + 1}.{leg_index + 1}"
    game.headers["White"] = "Prunex candidate" if candidate_color else "Prunex baseline"
    game.headers["Black"] = "Prunex baseline" if candidate_color else "Prunex candidate"
    game.headers["Opening"] = "Deterministic legal opening"
    game.headers["OpeningMoves"] = opening_san
    game.headers["OpeningSeed"] = str(seed)
    game.headers["CandidateColor"] = "white" if candidate_color else "black"
    game.headers["NodeLimitPerMove"] = str(node_limit)
    game.headers["HashMB"] = "128"
    game.headers["Threads"] = "1"

    token = ("prunex-internal", pair_index, leg_index)
    node = game
    ply = 0
    nodes_by_engine = {"candidate": 0, "baseline": 0}
    max_nodes_seen = {"candidate": 0, "baseline": 0}
    missing_node_counts = {"candidate": 0, "baseline": 0}
    depth_sums = {"candidate": 0, "baseline": 0}
    started = time.monotonic()

    while ply < max_plies and board.outcome(claim_draw=True) is None:
        is_candidate_turn = board.turn == candidate_color
        label = "candidate" if is_candidate_turn else "baseline"
        engine = candidate if is_candidate_turn else baseline
        before_fen = board.fen()
        result = engine.play(
            board,
            chess.engine.Limit(nodes=node_limit),
            game=token,
            info=chess.engine.INFO_ALL,
        )
        if result.move not in board.legal_moves:
            raise RuntimeError(
                f"{label} engine returned illegal move {result.move} in pair "
                f"{pair_index + 1}, game leg {leg_index + 1}, ply {ply + 1}"
            )

        stats = search_stats(result.info or {}, node_limit)
        actual_nodes = stats["nodes"]
        if actual_nodes is None:
            missing_node_counts[label] += 1
        else:
            if actual_nodes > node_limit + max(2_000, node_limit // 100):
                raise RuntimeError(
                    f"{label} exceeded node budget: {actual_nodes} for "
                    f"requested {node_limit} nodes"
                )
            nodes_by_engine[label] += actual_nodes
            max_nodes_seen[label] = max(max_nodes_seen[label], actual_nodes)
        if isinstance(stats["depth"], int):
            depth_sums[label] += stats["depth"]

        san = board.san(result.move)
        telemetry_file.write(json.dumps({
            "pair": pair_index + 1,
            "leg": leg_index + 1,
            "ply": ply + 1,
            "engine": label,
            "color": "white" if board.turn else "black",
            "fen_before": before_fen,
            "move_uci": result.move.uci(),
            "move_san": san,
            "requested_nodes": node_limit,
            **stats,
        }, separators=(",", ":")) + "\n")
        telemetry_file.flush()

        node = node.add_variation(result.move)
        board.push(result.move)
        ply += 1

    outcome = board.outcome(claim_draw=True)
    adjudicated_draw = outcome is None
    if adjudicated_draw:
        game.headers["Termination"] = "Ply-limit adjudication (draw)"
        score = 0.5
        result_text = "1/2-1/2"
    elif outcome.winner is None:
        game.headers["Termination"] = outcome.termination.name
        score = 0.5
        result_text = "1/2-1/2"
    else:
        game.headers["Termination"] = outcome.termination.name
        score = 1.0 if outcome.winner == candidate_color else 0.0
        result_text = "1-0" if outcome.winner == chess.WHITE else "0-1"

    game.headers["Result"] = result_text
    game.headers["PlyCount"] = str(ply)
    output_pgn.write(game.accept(chess.pgn.StringExporter(
        headers=True, variations=True, comments=False
    )))
    output_pgn.write("\n\n")
    output_pgn.flush()

    details = {
        "pair": pair_index + 1,
        "leg": leg_index + 1,
        "candidate_color": "white" if candidate_color else "black",
        "candidate_score": score,
        "result": result_text,
        "termination": game.headers["Termination"],
        "plies": ply,
        "nodes": nodes_by_engine,
        "max_nodes_in_one_move": max_nodes_seen,
        "missing_node_counts": missing_node_counts,
        "depth_sums": depth_sums,
        "elapsed_seconds": round(time.monotonic() - started, 3),
    }
    return score, details


def paired_confidence_interval(pair_scores: list[float]) -> tuple[float, float, float]:
    mean = statistics.mean(pair_scores)
    if len(pair_scores) < 2:
        return mean, mean, mean
    standard_error = statistics.stdev(pair_scores) / math.sqrt(len(pair_scores))
    return mean, max(0.0, mean - 1.96 * standard_error), min(1.0, mean + 1.96 * standard_error)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--baseline", required=True, type=Path)
    parser.add_argument("--candidate", required=True, type=Path)
    parser.add_argument("--baseline-commit", required=True)
    parser.add_argument("--candidate-commit", required=True)
    parser.add_argument("--pairs", type=int, default=100)
    parser.add_argument("--nodes", type=int, default=100_000)
    parser.add_argument("--hash-mb", type=int, default=128)
    parser.add_argument("--threads", type=int, default=1)
    parser.add_argument("--seed", type=int, default=20261112)
    parser.add_argument("--max-plies", type=int, default=240)
    parser.add_argument("--out", type=Path, default=Path("internal-selfplay"))
    args = parser.parse_args()

    if not 2 <= args.pairs <= 100:
        parser.error("--pairs must be between 2 and 100")
    if not 10_000 <= args.nodes <= 1_000_000:
        parser.error("--nodes must be between 10,000 and 1,000,000")
    if not 1 <= args.hash_mb <= 1024:
        parser.error("--hash-mb must be between 1 and 1024")
    if args.threads != 1:
        parser.error("This protocol fixes both engines to one thread")
    if not 60 <= args.max_plies <= 400:
        parser.error("--max-plies must be between 60 and 400")

    baseline_path = args.baseline.resolve()
    candidate_path = args.candidate.resolve()
    if not baseline_path.is_file() or not candidate_path.is_file():
        raise FileNotFoundError("Both baseline and candidate executables must exist")

    args.out.mkdir(parents=True, exist_ok=True)
    pgn_path = args.out / "games.pgn"
    telemetry_path = args.out / "per-move.jsonl"
    summary_path = args.out / "summary.json"
    manifest_path = args.out / "manifest.json"

    openings = opening_positions(args.pairs, args.seed)
    candidate_wins = draws = candidate_losses = 0
    pair_scores: list[float] = []
    games_detail: list[dict[str, Any]] = []
    started = time.monotonic()

    with chess.engine.SimpleEngine.popen_uci(str(baseline_path), timeout=180) as baseline, \
         chess.engine.SimpleEngine.popen_uci(str(candidate_path), timeout=180) as candidate:
        baseline_identity = {"name": baseline.id.get("name", "unknown"),
                             "author": baseline.id.get("author", "unknown")}
        candidate_identity = {"name": candidate.id.get("name", "unknown"),
                              "author": candidate.id.get("author", "unknown")}
        baseline_options = configure_engine(baseline, args.hash_mb, args.threads)
        candidate_options = configure_engine(candidate, args.hash_mb, args.threads)

        with pgn_path.open("w", encoding="utf-8") as pgn_file, telemetry_path.open(
            "w", encoding="utf-8"
        ) as telemetry_file:
            for pair_index, (opening, opening_san) in enumerate(openings):
                leg_scores: list[float] = []
                for leg_index, candidate_color in enumerate((chess.WHITE, chess.BLACK)):
                    score, details = play_game(
                        candidate, baseline, opening, opening_san, candidate_color,
                        pair_index=pair_index, leg_index=leg_index, node_limit=args.nodes,
                        max_plies=args.max_plies, seed=args.seed,
                        output_pgn=pgn_file, telemetry_file=telemetry_file,
                    )
                    leg_scores.append(score)
                    games_detail.append(details)
                    if score == 1.0:
                        candidate_wins += 1
                    elif score == 0.5:
                        draws += 1
                    else:
                        candidate_losses += 1
                pair_scores.append(sum(leg_scores) / 2.0)
                print(
                    f"pair {pair_index + 1}/{args.pairs}: "
                    f"candidate {leg_scores[0]:.1f}+{leg_scores[1]:.1f}",
                    flush=True,
                )

    games = candidate_wins + draws + candidate_losses
    score_rate = (candidate_wins + 0.5 * draws) / games if games else 0.0
    mean_pair, ci_low, ci_high = paired_confidence_interval(pair_scores)
    summary = {
        "kind": "internal-paired-prunex-regression-match",
        "external_opponent": False,
        "baseline_commit": args.baseline_commit,
        "candidate_commit": args.candidate_commit,
        "pairs": args.pairs,
        "games": games,
        "node_limit_per_move": args.nodes,
        "hash_mb": args.hash_mb,
        "threads": args.threads,
        "opening_seed": args.seed,
        "candidate_wins": candidate_wins,
        "draws": draws,
        "candidate_losses": candidate_losses,
        "candidate_score_percent": round(score_rate * 100, 2),
        "paired_score_mean": round(mean_pair, 4),
        "paired_score_95ci": [round(ci_low, 4), round(ci_high, 4)],
        "elapsed_seconds": round(time.monotonic() - started, 2),
        "games_detail": games_detail,
        "pgn": str(pgn_path),
        "per_move_telemetry": str(telemetry_path),
        "interpretation": (
            "Internal version-to-version signal only. It is not an Elo rating "
            "and does not establish strength against external engines."
        ),
    }
    manifest = {
        "baseline": {
            "commit": args.baseline_commit,
            "path": str(baseline_path),
            "sha256": sha256_file(baseline_path),
            "identity": baseline_identity,
            "options": baseline_options,
        },
        "candidate": {
            "commit": args.candidate_commit,
            "path": str(candidate_path),
            "sha256": sha256_file(candidate_path),
            "identity": candidate_identity,
            "options": candidate_options,
        },
        "protocol": {
            "pairs": args.pairs,
            "nodes_per_move": args.nodes,
            "hash_mb": args.hash_mb,
            "threads": args.threads,
            "opening_seed": args.seed,
            "max_plies": args.max_plies,
            "opening_positions": [
                {"pair": i + 1, "fen": board.fen(), "moves_san": san}
                for i, (board, san) in enumerate(openings)
            ],
        },
    }
    summary_path.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: v for k, v in summary.items() if k != "games_detail"}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
