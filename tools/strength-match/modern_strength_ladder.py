#!/usr/bin/env python3
"""Paired-color Prunex strength ladder against pinned public engines.

The three resource tiers are:
  * 100,000 nodes per move
  * 1,000,000 nodes per move
  * timed search with no node cap (500 ms per move by default)

Each opening is played twice with Prunex colors reversed. This is a
reproducible comparison harness, not an Elo-certification tool.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import platform
import random
import re
import statistics
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import chess
import chess.engine
import chess.pgn


@dataclass(frozen=True)
class EngineSpec:
    label: str
    executable: Path
    working_directory: Path


@dataclass(frozen=True)
class Tier:
    name: str
    node_limit: int | None
    movetime_seconds: float | None

    def limit(self) -> chess.engine.Limit:
        if self.node_limit is not None:
            return chess.engine.Limit(nodes=self.node_limit)
        if self.movetime_seconds is not None:
            return chess.engine.Limit(time=self.movetime_seconds)
        raise ValueError(f"Invalid resource tier: {self.name}")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def opening_positions(count: int, seed: int) -> list[tuple[chess.Board, str]]:
    """Make deterministic, paired middlegame starts with White to move."""
    rng = random.Random(seed)
    positions: list[tuple[chess.Board, str]] = []
    seen: set[str] = set()
    attempts = 0
    while len(positions) < count:
        attempts += 1
        if attempts > count * 50:
            raise RuntimeError("Could not generate enough distinct opening positions")
        board = chess.Board()
        san_moves: list[str] = []
        plies = rng.choice((8, 10, 12, 14))
        for _ in range(plies):
            if board.is_game_over():
                break
            legal = list(board.legal_moves)
            move = rng.choice(legal)
            san_moves.append(board.san(move))
            board.push(move)
        if board.is_game_over() or board.turn != chess.WHITE:
            continue
        fen = board.fen()
        if fen in seen:
            continue
        seen.add(fen)
        positions.append((board.copy(), " ".join(san_moves)))
    return positions


def engine_identity(engine: chess.engine.SimpleEngine) -> dict[str, Any]:
    return {
        "name": engine.id.get("name", "unknown"),
        "author": engine.id.get("author", "unknown"),
        "options": sorted(engine.options.keys()),
    }


def configure_engine(
    engine: chess.engine.SimpleEngine,
    hash_mb: int,
    threads: int,
) -> dict[str, Any]:
    requested: dict[str, int] = {}
    if "Hash" in engine.options:
        option = engine.options["Hash"]
        value = max(int(option.min or 1), min(hash_mb, int(option.max or hash_mb)))
        requested["Hash"] = value
    if "Threads" in engine.options:
        option = engine.options["Threads"]
        value = max(int(option.min or 1), min(threads, int(option.max or threads)))
        requested["Threads"] = value
    if requested:
        engine.configure(requested)
    engine.ping()
    return requested


def pgn_result(board: chess.Board, adjudicated_draw: bool) -> str:
    if adjudicated_draw:
        return "1/2-1/2"
    return board.result(claim_draw=True)


def score_from_outcome(board: chess.Board, candidate_color: chess.Color,
                       adjudicated_draw: bool) -> tuple[float, str]:
    if adjudicated_draw:
        return 0.5, "ply-limit-adjudication"
    outcome = board.outcome(claim_draw=True)
    if outcome is None:
        raise RuntimeError("Game ended without a recognized chess outcome")
    if outcome.winner is None:
        return 0.5, outcome.termination.name
    return (1.0 if outcome.winner == candidate_color else 0.0), outcome.termination.name


def parse_final_search_info(value: Any) -> dict[str, int] | None:
    """Parse Prunex's final counters, emitted after the last completed depth."""
    if not isinstance(value, str):
        return None
    match = re.search(
        r"search-final\\s+nodes=(\\d+)\\s+depth=(\\d+)\\s+elapsed_ms=(\\d+)\\s+tthits=(\\d+)\\s+node_limit=(\\d+)",
        value,
    )
    if match is None:
        return None
    nodes, depth, elapsed_ms, tt_hits, node_limit = map(int, match.groups())
    return {
        "nodes": nodes,
        "depth": depth,
        "elapsed_ms": elapsed_ms,
        "tt_hits": tt_hits,
        "node_limit": node_limit,
    }


def info_value(info: dict[str, Any], key: str) -> Any:
    value = info.get(key)
    if key == "pv" and value:
        return [move.uci() for move in value]
    if key == "score" and value is not None:
        try:
            return str(value.pov(chess.WHITE))
        except Exception:
            return str(value)
    return value


def play_one_game(
    candidate: chess.engine.SimpleEngine,
    opponent: chess.engine.SimpleEngine,
    candidate_name: str,
    opponent_name: str,
    opening: chess.Board,
    opening_san: str,
    candidate_color: chess.Color,
    tier: Tier,
    pair_index: int,
    leg_index: int,
    output_pgn: Any,
    telemetry_file: Any,
    max_plies: int,
) -> tuple[float, dict[str, Any]]:
    board = opening.copy()
    game = chess.pgn.Game()
    game.setup(board)
    game.headers["Event"] = f"Prunex strength ladder: {tier.name}"
    game.headers["Site"] = "Automated reproducibility run"
    game.headers["Round"] = f"{pair_index + 1}.{leg_index + 1}"
    game.headers["White"] = candidate_name if candidate_color else opponent_name
    game.headers["Black"] = opponent_name if candidate_color else candidate_name
    game.headers["Opening"] = "Deterministic randomized legal opening"
    game.headers["OpeningMoves"] = opening_san
    game.headers["ResourceTier"] = tier.name
    game.headers["NodeLimit"] = str(tier.node_limit or "none")
    game.headers["MoveTimeSeconds"] = (
        str(tier.movetime_seconds) if tier.movetime_seconds is not None else "none"
    )
    game.headers["PrunexColor"] = "white" if candidate_color else "black"

    token = (tier.name, pair_index, leg_index)
    node = game
    ply = 0
    started = time.monotonic()
    nodes_total = {candidate_name: 0, opponent_name: 0}
    depth_total = {candidate_name: 0, opponent_name: 0}
    missing_node_counts = {candidate_name: 0, opponent_name: 0}

    while ply < max_plies:
        if board.outcome(claim_draw=True) is not None:
            break

        is_candidate_turn = board.turn == candidate_color
        engine = candidate if is_candidate_turn else opponent
        engine_name = candidate_name if is_candidate_turn else opponent_name
        before_fen = board.fen()
        result = engine.play(
            board,
            tier.limit(),
            game=token,
            info=chess.engine.INFO_ALL,
        )
        if result.move not in board.legal_moves:
            raise RuntimeError(
                f"{engine_name} returned illegal move {result.move} in {tier.name}, "
                f"pair {pair_index + 1}, ply {ply + 1}"
            )

        info = result.info or {}
        reported_nodes = info.get("nodes")
        final_search = parse_final_search_info(info.get("string"))
        nodes = (
            final_search["nodes"]
            if final_search is not None
            else reported_nodes
        )
        if isinstance(nodes, int) and nodes >= 0:
            nodes_total[engine_name] += nodes
        else:
            missing_node_counts[engine_name] += 1
        depth = (
            final_search["depth"]
            if final_search is not None
            else info.get("depth")
        )
        if isinstance(depth, int):
            depth_total[engine_name] += depth

        if tier.node_limit is not None and isinstance(nodes, int):
            # UCI engines may poll node limits at slightly different points.
            # Permit a small, explicit 1%/2k-node tolerance, and report all
            # actual node counts in telemetry for review.
            overshoot_allowance = max(2_000, tier.node_limit // 100)
            if nodes > tier.node_limit + overshoot_allowance:
                raise RuntimeError(
                    f"{engine_name} exceeded node budget: {nodes} > "
                    f"{tier.node_limit}+{overshoot_allowance}"
                )

        san = board.san(result.move)
        record = {
            "opponent": opponent_name,
            "tier": tier.name,
            "pair": pair_index + 1,
            "leg": leg_index + 1,
            "ply": ply + 1,
            "engine": engine_name,
            "color": "white" if board.turn else "black",
            "fen_before": before_fen,
            "uci": result.move.uci(),
            "san": san,
            "nodes": nodes,
            "nodes_in_last_completed_info": reported_nodes,
            "node_count_source": (
                "final-search-info" if final_search is not None else "last-uci-info"
            ),
            "search_elapsed_ms": (
                final_search["elapsed_ms"] if final_search is not None else None
            ),
            "search_tt_hits": (
                final_search["tt_hits"] if final_search is not None else None
            ),
            "depth": depth,
            "seldepth": info.get("seldepth"),
            "nps": info.get("nps"),
            "time_seconds": info.get("time"),
            "tbhits": info.get("tbhits"),
            "hashfull": info.get("hashfull"),
            "score_white_pov": info_value(info, "score"),
            "pv_uci": info_value(info, "pv"),
            "requested_node_limit": tier.node_limit,
            "requested_movetime_seconds": tier.movetime_seconds,
            "final_search_info": info.get("string"),
        }
        telemetry_file.write(json.dumps(record, separators=(",", ":")) + "\n")
        telemetry_file.flush()

        board.push(result.move)
        node = node.add_variation(result.move)
        ply += 1

    adjudicated_draw = ply >= max_plies and board.outcome(claim_draw=True) is None
    score, termination = score_from_outcome(board, candidate_color, adjudicated_draw)
    game.headers["Result"] = pgn_result(board, adjudicated_draw)
    game.headers["Termination"] = termination
    game.headers["PlyCount"] = str(ply)
    output_pgn.write(game.accept(chess.pgn.StringExporter(headers=True, variations=True, comments=False)))
    output_pgn.write("\n\n")
    output_pgn.flush()

    details = {
        "pair": pair_index + 1,
        "leg": leg_index + 1,
        "candidate_color": "white" if candidate_color else "black",
        "candidate_score": score,
        "termination": termination,
        "plies": ply,
        "nodes_total": nodes_total,
        "depth_sum": depth_total,
        "node_count_missing": missing_node_counts,
        "elapsed_seconds": round(time.monotonic() - started, 3),
    }
    return score, details


def confidence_interval(pair_scores: list[float]) -> tuple[float, float, float]:
    mean = statistics.mean(pair_scores)
    if len(pair_scores) < 2:
        return mean, mean, mean
    standard_error = statistics.stdev(pair_scores) / math.sqrt(len(pair_scores))
    return mean, max(0.0, mean - 1.96 * standard_error), min(1.0, mean + 1.96 * standard_error)


def run_tier(
    candidate: chess.engine.SimpleEngine,
    opponent: chess.engine.SimpleEngine,
    candidate_name: str,
    opponent_name: str,
    openings: list[tuple[chess.Board, str]],
    tier: Tier,
    output_dir: Path,
    max_plies: int,
) -> dict[str, Any]:
    output_dir.mkdir(parents=True, exist_ok=True)
    pgn_path = output_dir / "games.pgn"
    telemetry_path = output_dir / "per-move.jsonl"
    candidate_wins = draws = candidate_losses = 0
    pair_scores: list[float] = []
    games_detail: list[dict[str, Any]] = []
    started = time.monotonic()

    with pgn_path.open("w", encoding="utf-8") as pgn_file, telemetry_path.open(
        "w", encoding="utf-8"
    ) as telemetry_file:
        for pair_index, (opening, opening_san) in enumerate(openings):
            leg_scores: list[float] = []
            # Same starting position, both colors. White starts the opening FEN.
            for leg_index, candidate_color in enumerate((chess.WHITE, chess.BLACK)):
                score, details = play_one_game(
                    candidate, opponent, candidate_name, opponent_name,
                    opening, opening_san, candidate_color, tier,
                    pair_index, leg_index, pgn_file, telemetry_file, max_plies
                )
                leg_scores.append(score)
                games_detail.append(details)
                if score == 1.0:
                    candidate_wins += 1
                elif score == 0.5:
                    draws += 1
                else:
                    candidate_losses += 1
            pair_score = sum(leg_scores) / 2.0
            pair_scores.append(pair_score)
            print(
                f"{opponent_name} | {tier.name} | pair {pair_index + 1}/"
                f"{len(openings)} | Prunex {leg_scores[0]:.1f} + {leg_scores[1]:.1f}",
                flush=True,
            )

    games = candidate_wins + draws + candidate_losses
    total_score = candidate_wins + 0.5 * draws
    score_rate = total_score / games if games else 0.0
    mean, ci_low, ci_high = confidence_interval(pair_scores)
    elo = None
    if 0.0 < score_rate < 1.0:
        elo = 400.0 * math.log10(score_rate / (1.0 - score_rate))

    summary = {
        "candidate": candidate_name,
        "opponent": opponent_name,
        "tier": tier.name,
        "pairs": len(openings),
        "games": games,
        "node_limit_per_move": tier.node_limit,
        "movetime_seconds_per_move": tier.movetime_seconds,
        "candidate_wins": candidate_wins,
        "draws": draws,
        "candidate_losses": candidate_losses,
        "candidate_score_percent": round(score_rate * 100, 2),
        "paired_score_mean": round(mean, 4),
        "paired_score_95ci": [round(ci_low, 4), round(ci_high, 4)],
        "unadjusted_elo_difference_not_rating": (
            None if elo is None else round(elo, 1)
        ),
        "elapsed_seconds": round(time.monotonic() - started, 2),
        "games_detail": games_detail,
        "pgn": str(pgn_path),
        "per_move_telemetry": str(telemetry_path),
        "interpretation": (
            "Small paired sample; an interval containing 50% is inconclusive. "
            "This is a relative match result, not a published Elo rating."
        ),
    }
    (output_dir / "summary.json").write_text(
        json.dumps(summary, indent=2) + "\n", encoding="utf-8"
    )
    return summary


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--candidate", required=True)
    parser.add_argument("--stockfish", required=True)
    parser.add_argument("--triumviratus", required=True)
    parser.add_argument("--triumviratus-cwd", required=True)
    parser.add_argument("--stockfish-source-commit", required=True)
    parser.add_argument("--triumviratus-release-commit", required=True)
    parser.add_argument("--candidate-commit", required=True)
    parser.add_argument("--pairs", type=int, default=12)
    parser.add_argument("--seed", type=int, default=20261112)
    parser.add_argument("--hash-mb", type=int, default=256)
    parser.add_argument("--threads", type=int, default=1)
    parser.add_argument("--movetime-ms", type=int, default=500)
    parser.add_argument("--max-plies", type=int, default=300)
    parser.add_argument("--out", default="strength-ladder-results")
    args = parser.parse_args()

    if args.pairs < 2 or args.pairs > 100:
        parser.error("--pairs must be between 2 and 100")
    if args.movetime_ms < 50 or args.movetime_ms > 60_000:
        parser.error("--movetime-ms must be between 50 and 60000")
    if args.threads != 1:
        parser.error("This comparison protocol requires one thread per engine")

    candidate_path = Path(args.candidate).resolve()
    stockfish_path = Path(args.stockfish).resolve()
    triumviratus_path = Path(args.triumviratus).resolve()
    triumviratus_cwd = Path(args.triumviratus_cwd).resolve()
    output = Path(args.out).resolve()
    output.mkdir(parents=True, exist_ok=True)

    for path in (candidate_path, stockfish_path, triumviratus_path):
        if not path.is_file():
            raise FileNotFoundError(path)
    if not triumviratus_cwd.is_dir():
        raise NotADirectoryError(triumviratus_cwd)

    candidate_spec = EngineSpec("Prunex", candidate_path, candidate_path.parent)
    opponent_specs = [
        EngineSpec("Stockfish 19", stockfish_path, stockfish_path.parent),
        EngineSpec("Triumviratus 8.1", triumviratus_path, triumviratus_cwd),
    ]
    tiers = [
        Tier("nodes-100000", 100_000, None),
        Tier("nodes-1000000", 1_000_000, None),
        Tier("timed-no-node-cap", None, args.movetime_ms / 1000.0),
    ]
    openings = opening_positions(args.pairs, args.seed)
    (output / "openings.json").write_text(
        json.dumps([
            {"pair": i + 1, "fen": board.fen(), "opening_san": san}
            for i, (board, san) in enumerate(openings)
        ], indent=2) + "\n",
        encoding="utf-8",
    )

    summaries: list[dict[str, Any]] = []
    started = time.monotonic()
    with chess.engine.SimpleEngine.popen_uci(
        str(candidate_spec.executable), timeout=180,
        cwd=str(candidate_spec.working_directory)
    ) as candidate:
        candidate_identity = engine_identity(candidate)
        if "Prunex" not in candidate_identity["name"]:
            raise RuntimeError(f"Unexpected candidate identity: {candidate_identity}")
        candidate_options = configure_engine(candidate, args.hash_mb, args.threads)

        manifest = {
            "candidate_commit": args.candidate_commit,
            "stockfish_source_commit": args.stockfish_source_commit,
            "triumviratus_release_commit": args.triumviratus_release_commit,
            "candidate": {
                **candidate_identity,
                "path": str(candidate_path),
                "sha256": sha256_file(candidate_path),
                "configured_options": candidate_options,
            },
            "opponents": [],
            "conditions": {
                "pairs_per_tier_per_opponent": args.pairs,
                "games_per_tier_per_opponent": args.pairs * 2,
                "opening_seed": args.seed,
                "hash_mb": args.hash_mb,
                "threads": args.threads,
                "tiers": [
                    {
                        "name": tier.name,
                        "node_limit_per_move": tier.node_limit,
                        "movetime_seconds_per_move": tier.movetime_seconds,
                    } for tier in tiers
                ],
                "max_plies": args.max_plies,
            },
            "python": platform.python_version(),
            "python_chess": chess.__version__,
        }

        for spec in opponent_specs:
            with chess.engine.SimpleEngine.popen_uci(
                str(spec.executable), timeout=180, cwd=str(spec.working_directory)
            ) as opponent:
                identity = engine_identity(opponent)
                if spec.label == "Stockfish 19" and "Stockfish" not in identity["name"]:
                    raise RuntimeError(f"Unexpected Stockfish identity: {identity}")
                if spec.label == "Triumviratus 8.1" and "Triumviratus" not in identity["name"]:
                    raise RuntimeError(f"Unexpected Triumviratus identity: {identity}")
                options = configure_engine(opponent, args.hash_mb, args.threads)
                manifest["opponents"].append({
                    "label": spec.label,
                    **identity,
                    "path": str(spec.executable),
                    "sha256": sha256_file(spec.executable),
                    "configured_options": options,
                })

                for tier in tiers:
                    stage_dir = output / spec.label.lower().replace(" ", "-") / tier.name
                    summary = run_tier(
                        candidate, opponent, candidate_identity["name"],
                        identity["name"], openings, tier, stage_dir, args.max_plies
                    )
                    summaries.append(summary)

    report = {
        "candidate_commit": args.candidate_commit,
        "opponents": [
            "Stockfish 19",
            "Triumviratus 8.1",
        ],
        "pairs_per_tier_per_opponent": args.pairs,
        "total_games": sum(item["games"] for item in summaries),
        "elapsed_seconds": round(time.monotonic() - started, 2),
        "results": [
            {
                "opponent": item["opponent"],
                "tier": item["tier"],
                "games": item["games"],
                "wins": item["candidate_wins"],
                "draws": item["draws"],
                "losses": item["candidate_losses"],
                "score_percent": item["candidate_score_percent"],
                "paired_score_mean": item["paired_score_mean"],
                "paired_score_95ci": item["paired_score_95ci"],
            }
            for item in summaries
        ],
        "interpretation": (
            "A tier is promising only when Prunex's paired score and interval "
            "support an advantage. One test run does not establish superiority "
            "against all engines or a CCRL rating."
        ),
    }
    (output / "manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )
    (output / "report.json").write_text(
        json.dumps(report, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
