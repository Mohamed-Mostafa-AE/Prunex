#!/usr/bin/env python3
"""Stream licensed standard-chess PGN archives into reproducible JSONL datasets.

This is an offline dataset preparation tool. It does not train or modify the
native Prunex engine. Labels are observed game outcomes and played moves.
"""
from __future__ import annotations

import argparse
import contextlib
import hashlib
import io
import json
import os
import sys
import tempfile
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator, TextIO

try:
    import chess
    import chess.pgn
except ImportError as exc:  # pragma: no cover - exercised by CLI users
    raise SystemExit(
        "Missing dependency. Run: python -m pip install -r tools/training/requirements.txt"
    ) from exc

try:
    import zstandard
except ImportError as exc:  # pragma: no cover - exercised by CLI users
    raise SystemExit(
        "Missing zstandard. Run: python -m pip install -r tools/training/requirements.txt"
    ) from exc


RESULT_TO_WHITE = {"1-0": 1.0, "1/2-1/2": 0.5, "0-1": 0.0}
SPLIT_SCHEMA = {"train": 0.80, "validation": 0.10, "test": 0.10}
IMPORTER_VERSION = "1.0.0"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


@contextlib.contextmanager
def open_pgn(path: Path) -> Iterator[TextIO]:
    """Open plain PGN or a Zstandard-compressed PGN as a streaming text file."""
    with path.open("rb") as raw:
        if path.name.lower().endswith(".zst"):
            with zstandard.ZstdDecompressor().stream_reader(raw) as reader:
                with io.TextIOWrapper(reader, encoding="utf-8", errors="replace") as text:
                    yield text
        else:
            with io.TextIOWrapper(raw, encoding="utf-8", errors="replace") as text:
                yield text


def split_for_group(group: str, seed: str) -> str:
    """Assign a stable group to train/validation/test without position leakage."""
    number = int(sha256_text(seed + ":" + group)[:16], 16) / float(0xFFFFFFFFFFFFFFFF)
    if number < SPLIT_SCHEMA["train"]:
        return "train"
    if number < SPLIT_SCHEMA["train"] + SPLIT_SCHEMA["validation"]:
        return "validation"
    return "test"


def canonical_game_hash(start_fen: str, moves_uci: list[str], result: str) -> str:
    canonical = "\n".join((start_fen, " ".join(moves_uci), result))
    return sha256_text(canonical)


def safe_int(value: str | None) -> int | None:
    if not value or not value.isdigit():
        return None
    result = int(value)
    return result if 0 < result < 10000 else None


def parse_game(game: chess.pgn.Game) -> tuple[chess.Board, list[chess.Move], str] | None:
    """Return a validated standard-chess game or None for unusable PGNs."""
    if game.errors:
        return None
    result = game.headers.get("Result", "")
    if result not in RESULT_TO_WHITE:
        return None
    board = game.board()
    if board.chess960 or board.uci_variant != "chess" or not board.is_valid():
        return None

    moves = list(game.mainline_moves())
    if len(moves) < 2:
        return None
    replay = board.copy()
    for move in moves:
        if move not in replay.legal_moves:
            return None
        replay.push(move)
    # A completed PGN should not continue after a terminal position.
    if not replay.is_game_over(claim_draw=True):
        # PGN result headers are frequently adjudicated before a board-terminal
        # state, so a legal, complete move sequence is still retained.
        pass
    return board, moves, result


def make_game_rows(
    game: chess.pgn.Game,
    start_board: chess.Board,
    moves: list[chess.Move],
    result: str,
    *,
    game_id: str,
    split: str,
    source_name: str,
    source_url: str,
    source_license: str,
    license_url: str,
    sample_every: int,
    max_positions: int,
) -> list[dict]:
    headers = game.headers
    white_score = RESULT_TO_WHITE[result]
    board = start_board.copy()
    rows: list[dict] = []
    for ply, move in enumerate(moves):
        if ply % sample_every == 0 and len(rows) < max_positions:
            score_for_turn = white_score if board.turn == chess.WHITE else 1.0 - white_score
            rows.append({
                "schema_version": 1,
                "label_kind": "observed_game_result_and_played_move",
                "game_id": game_id,
                "split": split,
                "source": {
                    "name": source_name,
                    "url": source_url,
                    "license": source_license,
                    "license_url": license_url,
                },
                "event": headers.get("Event", ""),
                "site": headers.get("Site", ""),
                "date": headers.get("Date", ""),
                "round": headers.get("Round", ""),
                "white_elo": safe_int(headers.get("WhiteElo")),
                "black_elo": safe_int(headers.get("BlackElo")),
                "time_control": headers.get("TimeControl", ""),
                "eco": headers.get("ECO", ""),
                "ply": ply,
                "fen": board.fen(),
                "side_to_move": "w" if board.turn == chess.WHITE else "b",
                "played_move_uci": move.uci(),
                "played_move_san": board.san(move),
                "game_result": result,
                "result_for_side_to_move": score_for_turn,
            })
        board.push(move)
        if len(rows) >= max_positions:
            break
    return rows


def ingest(args: argparse.Namespace) -> dict:
    source = Path(args.input).expanduser().resolve()
    output = Path(args.output_dir).expanduser().resolve()
    if not source.is_file():
        raise FileNotFoundError(f"PGN archive not found: {source}")
    if not args.source_name or not args.source_url or not args.license_id or not args.license_url:
        raise ValueError("Source name/URL and license identifier/URL are required.")

    output.mkdir(parents=True, exist_ok=True)
    targets = {name: output / f"positions-{name}.jsonl" for name in SPLIT_SCHEMA}
    manifest_path = output / "corpus-manifest.json"
    existing = [p for p in [*targets.values(), manifest_path] if p.exists()]
    if existing and not args.overwrite:
        raise FileExistsError(
            "Output already exists. Use a new output directory or pass --overwrite: "
            + ", ".join(str(p) for p in existing)
        )

    archive_sha = sha256_file(source)
    temp_paths: dict[str, Path] = {}
    handles = {}
    for name, target in targets.items():
        fd, temp_name = tempfile.mkstemp(prefix=target.name + ".", suffix=".tmp", dir=output)
        temp_paths[name] = Path(temp_name)
        handles[name] = os.fdopen(fd, "w", encoding="utf-8", newline="\n")

    counters: Counter[str] = Counter()
    seen_games: set[str] = set()
    group_splits: dict[str, str] = {}
    split_positions: Counter[str] = Counter()
    try:
        with open_pgn(source) as pgn_stream:
            while True:
                game = chess.pgn.read_game(pgn_stream)
                if game is None:
                    break
                counters["raw_games"] += 1
                parsed = parse_game(game)
                if parsed is None:
                    counters["rejected_games"] += 1
                    continue
                start_board, moves, result = parsed
                move_uci = [move.uci() for move in moves]
                game_id = canonical_game_hash(start_board.fen(), move_uci, result)
                if game_id in seen_games:
                    counters["duplicate_games"] += 1
                    continue
                seen_games.add(game_id)

                event = game.headers.get("Event", "").strip()
                group = event if args.split_group == "event" and event and event not in {"?", "-"} else game_id
                if group not in group_splits:
                    group_splits[group] = split_for_group(group, args.seed)
                split = group_splits[group]
                rows = make_game_rows(
                    game, start_board, moves, result,
                    game_id=game_id,
                    split=split,
                    source_name=args.source_name,
                    source_url=args.source_url,
                    source_license=args.license_id,
                    license_url=args.license_url,
                    sample_every=args.sample_every,
                    max_positions=args.max_positions_per_game,
                )
                if not rows:
                    counters["rejected_games"] += 1
                    continue
                for row in rows:
                    handles[split].write(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n")
                counters["accepted_games"] += 1
                counters["positions"] += len(rows)
                split_positions[split] += len(rows)
                if args.max_games and counters["accepted_games"] >= args.max_games:
                    break
    finally:
        for handle in handles.values():
            handle.close()

    for name, target in targets.items():
        os.replace(temp_paths[name], target)

    output_hashes = {name: sha256_file(path) for name, path in targets.items()}
    manifest = {
        "manifest_version": 1,
        "dataset_name": args.dataset_name,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "importer": {"name": "Prunex PGN corpus importer", "version": IMPORTER_VERSION},
        "source": {
            "name": args.source_name,
            "url": args.source_url,
            "archive_path": source.name,
            "archive_bytes": source.stat().st_size,
            "archive_sha256": archive_sha,
            "downloaded_at": args.downloaded_at or None,
            "license": args.license_id,
            "license_url": args.license_url,
            "attribution": args.attribution,
        },
        "labels": {
            "kind": "observed_game_result_and_played_move",
            "note": (
                "PGN results label the eventual outcome for the side to move; "
                "played moves are human/game-derived move targets. They are not "
                "engine evaluations or proof of optimal moves."
            ),
        },
        "filtering": {
            "variants": "standard chess only; Chess960 and other variants rejected",
            "results": ["1-0", "1/2-1/2", "0-1"],
            "illegal_or_parser_error_games": "rejected",
            "sampling_every_plies": args.sample_every,
            "max_positions_per_game": args.max_positions_per_game,
            "deduplication": "SHA-256(start FEN + mainline UCI moves + result)",
        },
        "split": {
            "grouping": args.split_group,
            "seed": args.seed,
            "target_proportions": SPLIT_SCHEMA,
            "actual_positions": dict(split_positions),
            "actual_games": {},
            "files": {
                name: {"path": path.name, "sha256": output_hashes[name]}
                for name, path in targets.items()
            },
        },
        "counts": dict(counters),
    }
    # Derive game counts from the output rows without retaining the entire
    # corpus in memory. The same deterministic game_id may span several rows.
    game_counts = {name: set() for name in SPLIT_SCHEMA}
    for name, path in targets.items():
        with path.open("r", encoding="utf-8") as handle:
            for line in handle:
                game_counts[name].add(json.loads(line)["game_id"])
    manifest["split"]["actual_games"] = {name: len(ids) for name, ids in game_counts.items()}
    manifest["dataset_id"] = sha256_text(
        archive_sha + args.source_url + args.license_id + args.seed
    )
    temp_manifest = manifest_path.with_suffix(".json.tmp")
    temp_manifest.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    os.replace(temp_manifest, manifest_path)
    return manifest


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, help="Input .pgn or .pgn.zst archive")
    parser.add_argument("--output-dir", required=True, help="Output directory outside the Git repository")
    parser.add_argument("--dataset-name", default="prunex-standard-chess")
    parser.add_argument("--source-name", required=True)
    parser.add_argument("--source-url", required=True)
    parser.add_argument("--license-id", required=True, help="SPDX identifier or explicit permission label")
    parser.add_argument("--license-url", required=True)
    parser.add_argument("--attribution", required=True)
    parser.add_argument("--downloaded-at", default="")
    parser.add_argument("--seed", default="prunex-corpus-v1")
    parser.add_argument("--split-group", choices=("game", "event"), default="game")
    parser.add_argument("--sample-every", type=int, default=2, help="Sample one position every N half-moves")
    parser.add_argument("--max-positions-per-game", type=int, default=128)
    parser.add_argument("--max-games", type=int, default=0, help="0 means unlimited")
    parser.add_argument("--overwrite", action="store_true")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    if args.sample_every < 1 or args.max_positions_per_game < 1 or args.max_games < 0:
        print("sample-every/max-positions must be positive; max-games cannot be negative.", file=sys.stderr)
        return 2
    try:
        manifest = ingest(args)
    except (OSError, ValueError, zstandard.ZstdError) as exc:
        print(f"Import failed: {exc}", file=sys.stderr)
        return 1
    print(json.dumps({
        "dataset_id": manifest["dataset_id"],
        "counts": manifest["counts"],
        "split_positions": manifest["split"]["actual_positions"],
        "manifest": str(Path(args.output_dir).resolve() / "corpus-manifest.json"),
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
