import argparse
import hashlib
import json
import os
import pathlib
import sys
import time
from datetime import datetime, timezone

import chess
import chess.engine
import chess.pgn

OPENINGS = [
    ("Ruy Lopez", ["e2e4", "e7e5", "g1f3", "b8c6", "f1b5", "a7a6"]),
    ("Italian Game", ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "f8c5"]),
    ("Scotch Game", ["e2e4", "e7e5", "g1f3", "b8c6", "d2d4", "e5d4"]),
    ("Sicilian Defense", ["e2e4", "c7c5", "g1f3", "d7d6", "d2d4", "c5d4", "f3d4"]),
    ("French Defense", ["e2e4", "e7e6", "d2d4", "d7d5", "b1c3", "g8f6"]),
    ("Caro-Kann Defense", ["e2e4", "c7c6", "d2d4", "d7d5", "b1c3", "d5e4"]),
    ("Queen's Gambit Declined", ["d2d4", "d7d5", "c2c4", "e7e6", "b1c3", "g8f6"]),
    ("Slav Defense", ["d2d4", "d7d5", "c2c4", "c7c6", "g1f3", "g8f6"]),
    ("Nimzo-Indian Defense", ["d2d4", "g8f6", "c2c4", "e7e6", "b1c3", "f8b4"]),
    ("King's Indian Defense", ["d2d4", "g8f6", "c2c4", "g7g6", "b1c3", "f8g7"]),
    ("English Opening", ["c2c4", "e7e5", "b1c3", "g8f6", "g2g3", "d7d5"]),
    ("Réti Opening", ["g1f3", "d7d5", "g2g3", "g8f6", "f1g2", "c7c6"]),
    ("Pirc Defense", ["e2e4", "d7d6", "d2d4", "g8f6", "b1c3", "g7g6"]),
    ("Scandinavian Defense", ["e2e4", "d7d5", "e4d5", "d8d5", "b1c3", "d5a5"]),
    ("Dutch Defense", ["d2d4", "f7f5", "c2c4", "g8f6", "g1f3", "e7e6"]),
    ("Grünfeld Defense", ["d2d4", "g8f6", "c2c4", "g7g6", "b1c3", "d7d5"]),
]


def utc_now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def sha256_file(path):
    digest = hashlib.sha256()
    with pathlib.Path(path).open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def atomic_json(path, value):
    path = pathlib.Path(path)
    temp = path.with_suffix(path.suffix + ".tmp")
    with temp.open("w", encoding="utf-8", newline="\n") as handle:
        handle.write(json.dumps(value, indent=2, ensure_ascii=False) + "\n")
        handle.flush()
        os.fsync(handle.fileno())
    os.replace(temp, path)


def read_results(path):
    path = pathlib.Path(path)
    if not path.exists():
        return []

    records = []
    valid_end = 0
    with path.open("r+b") as handle:
        while True:
            line = handle.readline()
            if not line:
                break
            try:
                record = json.loads(line)
            except (UnicodeDecodeError, json.JSONDecodeError):
                if handle.tell() == path.stat().st_size:
                    handle.truncate(valid_end)
                    break
                raise RuntimeError(f"Corrupt result record before the end of {path}")
            if not isinstance(record, dict) or "game_id" not in record:
                raise RuntimeError(f"Invalid result record in {path}")
            records.append(record)
            valid_end = handle.tell()

    ids = [record["game_id"] for record in records]
    if len(ids) != len(set(ids)):
        raise RuntimeError("Duplicate game IDs found in results.jsonl")
    return records


def write_pgn(game, path):
    path = pathlib.Path(path)
    temp = path.with_suffix(path.suffix + ".tmp")
    with temp.open("w", encoding="utf-8", newline="\n") as handle:
        handle.write(str(game) + "\n")
        handle.flush()
        os.fsync(handle.fileno())
    os.replace(temp, path)


def refresh_combined_pgn(outdir, records):
    temp = outdir / "all-games.pgn.tmp"
    with temp.open("w", encoding="utf-8", newline="\n") as handle:
        for record in sorted(records, key=lambda item: item["round"]):
            pgn_path = outdir / record["pgn_file"]
            handle.write(pgn_path.read_text(encoding="utf-8").rstrip())
            handle.write("\n\n")
        handle.flush()
        os.fsync(handle.fileno())
    os.replace(temp, outdir / "all-games.pgn")


def make_opening(name, moves):
    board = chess.Board()
    for token in moves:
        move = chess.Move.from_uci(token)
        if move not in board.legal_moves:
            raise ValueError(f"Illegal opening move {token} in {name}")
        board.push(move)
    return name, board


def configure_engine(engine, hash_mb, threads):
    settings = {}
    for name, value in (("Hash", hash_mb), ("Threads", threads)):
        if name not in engine.options:
            raise RuntimeError(f"{engine.id.get('name', 'Engine')} does not expose the required {name} option")
        option = engine.options[name]
        if option.min is not None and value < option.min:
            raise RuntimeError(f"{name}={value} is below the engine's minimum ({option.min})")
        if option.max is not None and value > option.max:
            raise RuntimeError(f"{name}={value} exceeds the engine's maximum ({option.max})")
        settings[name] = value

    for name, value in (("Ponder", False), ("OwnBook", False), ("Contempt", 0), ("Contempt Factor", 0)):
        if name in engine.options:
            settings[name] = value

    engine.configure(settings)
    engine.ping()
    return settings


def make_schedule():
    schedule = []
    for opening_index, opening_data in enumerate(OPENINGS, start=1):
        for repeat in range(1, 3):
            for prunex_white in (True, False):
                color = "W" if prunex_white else "B"
                game_id = f"O{opening_index:02d}-R{repeat}-{color}"
                schedule.append({
                    "game_id": game_id,
                    "opening_index": opening_index,
                    "opening": opening_data,
                    "repeat": repeat,
                    "prunex_white": prunex_white,
                })
    return schedule


def play_game(prunex, opponent, item, args, round_number):
    opening_name, initial_board = make_opening(*item["opening"])
    board = initial_board.copy()
    game_token = object()
    white = prunex if item["prunex_white"] else opponent
    black = opponent if item["prunex_white"] else prunex
    limit = chess.engine.Limit(nodes=args.nodes_per_move)
    started = time.monotonic()

    while not board.is_game_over(claim_draw=True):
        engine = white if board.turn == chess.WHITE else black
        result = engine.play(board, limit, game=game_token)
        if result.move is None or result.move not in board.legal_moves:
            raise RuntimeError(f"Illegal or missing move from {engine.id}: {result.move}")
        board.push(result.move)

    outcome = board.outcome(claim_draw=True)
    if outcome is None:
        raise RuntimeError("The game ended without a recognised chess result")

    result_text = outcome.result()
    if result_text == "1-0":
        score = 1.0 if item["prunex_white"] else 0.0
    elif result_text == "0-1":
        score = 0.0 if item["prunex_white"] else 1.0
    else:
        score = 0.5

    game = chess.pgn.Game.from_board(board)
    game.headers["Event"] = "Prunex 0.8.0 vs official Stockfish 2.0"
    game.headers["Site"] = "Local benchmark"
    game.headers["Round"] = str(round_number)
    game.headers["White"] = "Prunex 0.8.0 (Stockfish 19-derived)" if item["prunex_white"] else "Stockfish 2.0"
    game.headers["Black"] = "Stockfish 2.0" if item["prunex_white"] else "Prunex 0.8.0 (Stockfish 19-derived)"
    game.headers["Result"] = result_text
    game.headers["Opening"] = opening_name
    game.headers["Termination"] = outcome.termination.name
    game.headers["NodeLimit"] = str(args.nodes_per_move)
    game.headers["HashMB"] = str(args.hash_mb)
    game.headers["Threads"] = str(args.threads)

    return {
        "game": game,
        "opening": opening_name,
        "prunex_color": "White" if item["prunex_white"] else "Black",
        "result": result_text,
        "termination": outcome.termination.name,
        "score": score,
        "plies": board.ply(),
        "seconds": round(time.monotonic() - started, 3),
    }


def make_summary(records, config, complete):
    wins = sum(record["score"] == 1.0 for record in records)
    draws = sum(record["score"] == 0.5 for record in records)
    losses = sum(record["score"] == 0.0 for record in records)
    points = sum(record["score"] for record in records)
    total = config["games"]
    return {
        "status": "complete" if complete else "in progress",
        "completed_games": len(records),
        "total_games": total,
        "remaining_games": total - len(records),
        "prunex": "Prunex 0.8.0 (Stockfish 19-derived)",
        "opponent": "Official Stockfish 2.0",
        "wins": wins,
        "draws": draws,
        "losses": losses,
        "points": points,
        "score_percent": round(points * 100 / len(records), 2) if records else None,
        "nodes_per_move": config["nodes_per_move"],
        "hash_mb_each": config["hash_mb_each"],
        "threads_each": config["threads_each"],
        "openings": config["openings"],
        "repeats": config["repeats"],
        "color_balance": {
            "prunex_white": sum(record["prunex_color"] == "White" for record in records),
            "prunex_black": sum(record["prunex_color"] == "Black" for record in records),
        },
        "updated_at": utc_now(),
    }


def append_record(path, record):
    with pathlib.Path(path).open("a", encoding="utf-8", newline="\n") as handle:
        handle.write(json.dumps(record, ensure_ascii=False) + "\n")
        handle.flush()
        os.fsync(handle.fileno())


def main():
    parser = argparse.ArgumentParser(description="Resumable local Prunex 0.8.0 / Stockfish 2.0 match")
    parser.add_argument("--prunex", required=True, help="Path to the Prunex 0.8.0 executable")
    parser.add_argument("--stockfish", required=True, help="Path to the official Stockfish 2.0 executable")
    parser.add_argument("--output", required=True, help="Directory for PGNs, checkpoints, and results")
    parser.add_argument("--provenance-file", help="Text file containing the exact upstream source revisions")
    parser.add_argument("--nodes-per-move", type=int, default=1_000_000)
    parser.add_argument("--hash-mb", type=int, default=256)
    parser.add_argument("--threads", type=int, default=1)
    parser.add_argument("--engine-timeout", type=float, default=600)
    args = parser.parse_args()

    if args.nodes_per_move != 1_000_000 or args.hash_mb != 256 or args.threads != 1:
        raise SystemExit("This run is fixed at 1,000,000 nodes/move, 256 MB hash, and one thread per engine.")

    prunex_path = pathlib.Path(args.prunex).resolve()
    opponent_path = pathlib.Path(args.stockfish).resolve()
    for path in (prunex_path, opponent_path):
        if not path.is_file():
            raise SystemExit(f"Engine executable not found: {path}")

    outdir = pathlib.Path(args.output).resolve()
    outdir.mkdir(parents=True, exist_ok=True)
    results_path = outdir / "results.jsonl"
    config_path = outdir / "run-config.json"

    prunex = None
    opponent = None
    try:
        prunex = chess.engine.SimpleEngine.popen_uci(str(prunex_path), timeout=args.engine_timeout)
        opponent = chess.engine.SimpleEngine.popen_uci(str(opponent_path), timeout=args.engine_timeout)

        prunex_id = prunex.id.get("name", "")
        opponent_id = opponent.id.get("name", "")
        if "prunex 0.8.0" not in prunex_id.lower():
            raise RuntimeError(f"Unexpected Prunex engine identity: {prunex_id!r}")
        if "stockfish 2.0" not in opponent_id.lower():
            raise RuntimeError(f"Unexpected opponent identity: {opponent_id!r}")

        prunex_settings = configure_engine(prunex, args.hash_mb, args.threads)
        opponent_settings = configure_engine(opponent, args.hash_mb, args.threads)
        provenance = pathlib.Path(args.provenance_file).read_text(encoding="utf-8") if args.provenance_file else ""

        config = {
            "benchmark": "Prunex 0.8.0 vs official Stockfish 2.0",
            "nodes_per_move": args.nodes_per_move,
            "hash_mb_each": args.hash_mb,
            "threads_each": args.threads,
            "openings": len(OPENINGS),
            "repeats": 2,
            "games": 64,
            "draw_policy": "python-chess claimable and automatic draw rules; no artificial ply cap",
            "prunex_uci_id": prunex_id,
            "opponent_uci_id": opponent_id,
            "prunex_sha256": sha256_file(prunex_path),
            "opponent_sha256": sha256_file(opponent_path),
            "prunex_options": prunex_settings,
            "opponent_options": opponent_settings,
            "source_provenance": provenance,
        }

        if config_path.exists():
            saved_config = json.loads(config_path.read_text(encoding="utf-8"))
            if saved_config != config:
                raise RuntimeError(
                    "The existing results folder belongs to a different engine build or benchmark setup. "
                    "Keep it intact and use a new output folder for a different run."
                )
        else:
            if results_path.exists() and results_path.stat().st_size:
                raise RuntimeError("results.jsonl exists without run-config.json; refusing to mix results.")
            atomic_json(config_path, config)

        schedule = make_schedule()
        records = read_results(results_path)
        refresh_combined_pgn(outdir, records)
        expected_ids = {item["game_id"] for item in schedule}
        found_ids = {record["game_id"] for record in records}
        if not found_ids.issubset(expected_ids):
            raise RuntimeError("The results file contains game IDs that do not belong to this match.")

        atomic_json(outdir / "progress.json", make_summary(records, config, len(records) == 64))
        print(f"Prunex: {prunex_id}", flush=True)
        print(f"Opponent: {opponent_id}", flush=True)
        print("Settings: 1,000,000 nodes/move | 256 MB hash each | 1 thread each", flush=True)
        print(f"Completed already: {len(records)}/64. Resuming at the next unfinished game.", flush=True)

        for round_number, item in enumerate(schedule, start=1):
            if item["game_id"] in found_ids:
                continue

            print(
                f"Game {round_number}/64 — {item['opening'][0]}, "
                f"Prunex {'White' if item['prunex_white'] else 'Black'}",
                flush=True,
            )
            result = play_game(prunex, opponent, item, args, round_number)
            pgn_name = f"{round_number:02d}-{item['game_id']}.pgn"
            write_pgn(result.pop("game"), outdir / pgn_name)

            record = {
                "game_id": item["game_id"],
                "round": round_number,
                "opening": result["opening"],
                "repeat": item["repeat"],
                "prunex_color": result["prunex_color"],
                "result": result["result"],
                "termination": result["termination"],
                "score": result["score"],
                "plies": result["plies"],
                "seconds": result["seconds"],
                "pgn_file": pgn_name,
                "completed_at": utc_now(),
            }
            append_record(results_path, record)
            records.append(record)
            found_ids.add(item["game_id"])
            refresh_combined_pgn(outdir, records)
            summary = make_summary(records, config, len(records) == 64)
            atomic_json(outdir / "progress.json", summary)
            atomic_json(outdir / "summary.json", summary)
            print(
                f"  {record['result']} ({record['termination']}); "
                f"{summary['completed_games']}/64 complete",
                flush=True,
            )

        final = make_summary(records, config, len(records) == 64)
        if len(records) != 64:
            raise RuntimeError(f"Match stopped with {len(records)}/64 completed games.")
        atomic_json(outdir / "summary.json", final)
        atomic_json(outdir / "progress.json", final)
        print(json.dumps(final, indent=2), flush=True)
        print(f"PGN: {outdir / 'all-games.pgn'}", flush=True)
        print(f"Results: {results_path}", flush=True)

    except KeyboardInterrupt:
        print("\nStopped. Completed games are saved; run the same command again to resume.", file=sys.stderr, flush=True)
        raise SystemExit(130)
    finally:
        for engine in (opponent, prunex):
            if engine is not None:
                try:
                    engine.quit()
                except Exception:
                    pass


if __name__ == "__main__":
    main()
