#!/usr/bin/env python3
"""Play one reproducible Prunex-versus-Stockfish-2.0 game."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import platform
import re
import time
from pathlib import Path

import chess
import chess.engine
import chess.pgn

OPENING_NAME = "Ruy Lopez"
OPENING_SAN = "e4 e5 Nf3 Nc6 Bb5 a6"
STOCKFISH_SOURCE_COMMIT = "aa2de53a83ca5423c8c8007abf71f9afdf589d93"
STOCKFISH_NODE_OVERSHOOT = 800


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def open_game() -> tuple[chess.Board, chess.pgn.Game, chess.pgn.GameNode]:
    board = chess.Board()
    game = chess.pgn.Game()
    node: chess.pgn.GameNode = game

    for san in OPENING_SAN.split():
        move = board.parse_san(san)
        board.push(move)
        node = node.add_variation(move)

    game.headers["Event"] = "Prunex single-game validation vs Stockfish 2.0"
    game.headers["Site"] = "Automated reproducibility run"
    game.headers["Round"] = "1"
    game.headers["White"] = "Prunex 0.8.0 (development branch)"
    game.headers["Black"] = "Stockfish 2.0 (disclosed node-polling patch)"
    game.headers["Opening"] = OPENING_NAME
    game.headers["TimeControl"] = "1000000 nodes per move"
    game.headers["PrunexColor"] = "White"
    return board, game, node


def inspect_node_count(
    engine_name: str,
    info: dict,
    requested_nodes: int,
    ply: int,
) -> tuple[int, int]:
    report = re.search(r"node-limit\s+(\d+)/(\d+)", str(info.get("string", "")))
    actual = int(report.group(1)) if report else info.get("nodes")
    if not isinstance(actual, int) or actual < 0:
        raise RuntimeError(f"Missing node telemetry from {engine_name} at ply {ply}")

    allowance = STOCKFISH_NODE_OVERSHOOT if engine_name == "Stockfish 2.0" else 0
    maximum = requested_nodes + allowance
    if actual > maximum:
        raise RuntimeError(
            f"{engine_name} exceeded the allowed node budget at ply {ply}: "
            f"{actual} nodes (maximum {maximum})"
        )
    return actual, allowance


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--prunex", required=True)
    parser.add_argument("--stockfish", required=True)
    parser.add_argument("--nodes", type=int, default=1_000_000)
    parser.add_argument("--stockfish-hash-mb", type=int, default=256)
    parser.add_argument("--out", default="single-game-evidence")
    args = parser.parse_args()

    if args.nodes < 1_000:
        parser.error("--nodes must be at least 1000")

    output = Path(args.out)
    output.mkdir(parents=True, exist_ok=True)
    prunex_path = Path(args.prunex).resolve()
    stockfish_path = Path(args.stockfish).resolve()
    board, game, node = open_game()
    telemetry: list[dict] = []
    started = time.time()
    game_token = object()

    with chess.engine.SimpleEngine.popen_uci(str(prunex_path), timeout=60) as prunex, \
         chess.engine.SimpleEngine.popen_uci(str(stockfish_path), timeout=60) as stockfish:
        prunex_id = prunex.id.get("name", "")
        stockfish_id = stockfish.id.get("name", "")
        if "Prunex 0.8.0" not in prunex_id:
            raise RuntimeError(f"Unexpected Prunex UCI identity: {prunex_id!r}")
        if "Stockfish 2.0" not in stockfish_id:
            raise RuntimeError(f"Unexpected Stockfish UCI identity: {stockfish_id!r}")

        required_options = {"Hash", "Threads"}
        missing = required_options.difference(stockfish.options)
        if missing:
            raise RuntimeError(f"Stockfish 2.0 is missing UCI options: {sorted(missing)}")

        stockfish.configure({"Hash": args.stockfish_hash_mb, "Threads": 1})
        if "Threads" in prunex.options:
            prunex.configure({"Threads": 1})

        ply = 0
        while ply < 300:
            outcome = board.outcome(claim_draw=True)
            if outcome is not None:
                break

            prunex_to_move = board.turn == chess.WHITE
            engine = prunex if prunex_to_move else stockfish
            engine_name = "Prunex" if prunex_to_move else "Stockfish 2.0"
            before = board.fen()
            result = engine.play(
                board,
                chess.engine.Limit(nodes=args.nodes),
                game=game_token,
                info=chess.engine.INFO_ALL,
            )
            if result.move not in board.legal_moves:
                raise RuntimeError(f"{engine_name} returned illegal move {result.move}")

            info = result.info or {}
            actual_nodes, allowance = inspect_node_count(
                engine_name, info, args.nodes, ply + 1
            )
            san = board.san(result.move)
            telemetry.append({
                "ply": ply + 1,
                "side": engine_name,
                "fen_before": before,
                "uci": result.move.uci(),
                "san": san,
                "nodes": actual_nodes,
                "requested_node_limit": args.nodes,
                "permitted_overshoot": allowance,
                "depth": info.get("depth"),
                "seldepth": info.get("seldepth"),
                "nps": info.get("nps"),
                "score": str(info["score"]) if "score" in info else None,
                "principal_variation": [
                    move.uci() for move in info.get("pv", [])
                ],
            })
            board.push(result.move)
            node = node.add_variation(result.move)
            ply += 1
            print(
                f"ply {ply:03d} | {engine_name:14s} | {san:8s} | "
                f"depth {info.get('depth', '?')} | nodes {actual_nodes}",
                flush=True,
            )

    outcome = board.outcome(claim_draw=True)
    if outcome is None:
        result_text = "1/2-1/2"
        termination = "300-ply adjudication draw"
    else:
        result_text = board.result(claim_draw=True)
        termination = outcome.termination.name

    game.headers["Result"] = result_text
    game.headers["Termination"] = termination
    game.headers["PlyCount"] = str(ply)

    pgn_path = output / "single-game.pgn"
    with pgn_path.open("w", encoding="utf-8") as stream:
        exporter = chess.pgn.FileExporter(stream)
        game.accept(exporter)

    summary = {
        "event": "Prunex single game vs pinned Stockfish 2.0",
        "games_completed": 1,
        "result": result_text,
        "termination": termination,
        "plies_played_after_opening": ply,
        "opening": OPENING_NAME,
        "opening_moves": OPENING_SAN,
        "prunex_color": "white",
        "nodes_per_move": args.nodes,
        "prunex_transposition_table_entries": 1 << 22,
        "stockfish_hash_mb": args.stockfish_hash_mb,
        "threads": {"prunex": 1, "stockfish": 1},
        "node_limit_policy": {
            "prunex": "strict",
            "stockfish_2_0": (
                "Disclosed source patch polls main search and quiescence "
                "search; actual node telemetry is retained."
            ),
            "stockfish_max_overshoot": STOCKFISH_NODE_OVERSHOOT,
        },
        "prunex_uci_id": prunex_id,
        "stockfish_uci_id": stockfish_id,
        "prunex_sha256": file_sha256(prunex_path),
        "stockfish_sha256": file_sha256(stockfish_path),
        "stockfish_source_commit": STOCKFISH_SOURCE_COMMIT,
        "stockfish_patch_sha256": os.environ.get(
            "STOCKFISH_SOURCE_PATCH_SHA256", "unknown"
        ),
        "source_commit": os.environ.get("GITHUB_SHA", "unknown"),
        "python": platform.python_version(),
        "python_chess": chess.__version__,
        "elapsed_seconds": round(time.time() - started, 2),
        "per_move": telemetry,
        "interpretation": (
            "A single game is a smoke test and anecdotal result, not an Elo "
            "estimate or evidence of general superiority."
        ),
    }
    (output / "single-game.json").write_text(
        json.dumps(summary, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps({key: value for key, value in summary.items()
                      if key != "per_move"}, indent=2))


if __name__ == "__main__":
    main()
