#!/usr/bin/env python3
"""Prepare a reproducible Prunex NNUE corpus from the Lichess eval export."""

from __future__ import annotations

import argparse
import contextlib
import hashlib
import io
import json
import os
import tempfile
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator, TextIO

import chess
import zstandard


IMPORTER_VERSION = "1.0.0"
SPLITS = ("train", "validation", "test")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


@contextlib.contextmanager
def open_jsonl(path: Path) -> Iterator[TextIO]:
    with path.open("rb") as raw:
        if path.name.lower().endswith(".zst"):
            with zstandard.ZstdDecompressor().stream_reader(raw) as reader:
                with io.TextIOWrapper(reader, encoding="utf-8", errors="replace") as text:
                    yield text
        else:
            with io.TextIOWrapper(raw, encoding="utf-8", errors="replace") as text:
                yield text


def normalize_fen(value: str) -> str | None:
    fields = value.split()
    if len(fields) == 4:
        fields.extend(("0", "1"))
    if len(fields) != 6:
        return None
    return " ".join(fields)


def select_deepest_cp(record: dict, min_depth: int, min_knodes: int) -> tuple[int, int, int] | None:
    entries = record.get("evals")
    if not isinstance(entries, list):
        return None

    candidates: list[tuple[int, int, int]] = []
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        depth = entry.get("depth")
        knodes = entry.get("knodes")
        pvs = entry.get("pvs")
        if not isinstance(depth, int) or depth < min_depth:
            continue
        if not isinstance(knodes, int) or knodes < min_knodes:
            continue
        if not isinstance(pvs, list) or not pvs or not isinstance(pvs[0], dict):
            continue
        cp = pvs[0].get("cp")
        if isinstance(cp, bool) or not isinstance(cp, int):
            # Mate labels are intentionally excluded from this first score model.
            continue
        candidates.append((depth, knodes, cp))

    if not candidates:
        return None
    return max(candidates, key=lambda item: (item[0], item[1]))


def split_for_position(position_hash: str, seed: str) -> str:
    bucket = int(sha256_text(seed + ":" + position_hash)[:16], 16) % 10_000
    if bucket < 8_000:
        return "train"
    if bucket < 9_000:
        return "validation"
    return "test"


def prepare(args: argparse.Namespace) -> dict:
    source = Path(args.input).expanduser().resolve()
    output = Path(args.output_dir).expanduser().resolve()
    if not source.is_file():
        raise FileNotFoundError(source)
    if not args.dataset_name.strip():
        raise ValueError("dataset name is required")
    if args.score_pov not in ("white", "side-to-move"):
        raise ValueError("score perspective must be 'white' or 'side-to-move'")

    output.mkdir(parents=True, exist_ok=True)
    targets = {split: output / f"positions-{split}.jsonl" for split in SPLITS}
    manifest_path = output / "corpus-manifest.json"
    existing = [path for path in [*targets.values(), manifest_path] if path.exists()]
    if existing and not args.overwrite:
        raise FileExistsError(
            "Output already exists. Choose a new directory or pass --overwrite: "
            + ", ".join(str(path) for path in existing)
        )

    archive_hash = sha256_file(source)
    temp_paths: dict[str, Path] = {}
    handles: dict[str, TextIO] = {}
    for split, target in targets.items():
        fd, temporary = tempfile.mkstemp(prefix=target.name + ".", suffix=".tmp", dir=output)
        temp_paths[split] = Path(temporary)
        handles[split] = os.fdopen(fd, "w", encoding="utf-8", newline="\n")

    counters: Counter[str] = Counter()
    seen: set[str] = set()
    split_counts: Counter[str] = Counter()
    try:
        with open_jsonl(source) as records:
            for line_number, line in enumerate(records, start=1):
                if not line.strip():
                    continue
                counters["records_read"] += 1
                try:
                    record = json.loads(line)
                except json.JSONDecodeError:
                    counters["invalid_json"] += 1
                    continue
                if not isinstance(record, dict):
                    counters["invalid_records"] += 1
                    continue

                fen = normalize_fen(record.get("fen", ""))
                if fen is None:
                    counters["invalid_fen_shape"] += 1
                    continue
                try:
                    board = chess.Board(fen)
                except ValueError:
                    counters["invalid_fen"] += 1
                    continue
                if not board.is_valid():
                    counters["illegal_positions"] += 1
                    continue

                evaluation = select_deepest_cp(
                    record,
                    min_depth=args.min_depth,
                    min_knodes=args.min_knodes,
                )
                if evaluation is None:
                    counters["missing_or_mate_evaluations"] += 1
                    continue
                depth, knodes, cp_white = evaluation

                canonical = " ".join(fen.split()[:4])
                position_hash = sha256_text(canonical)
                if position_hash in seen:
                    counters["duplicates"] += 1
                    continue
                seen.add(position_hash)

                if args.score_pov == "white":
                    cp_side_to_move = cp_white if board.turn == chess.WHITE else -cp_white
                else:
                    cp_side_to_move = cp_white
                cp_side_to_move = max(
                    -args.max_abs_cp, min(args.max_abs_cp, cp_side_to_move)
                )

                split = split_for_position(position_hash, args.split_seed)
                row = {
                    "schema_version": 1,
                    "label_kind": "teacher_centipawn_evaluation",
                    "position_id": position_hash,
                    "fen": fen,
                    "score_cp": cp_side_to_move,
                    "score_perspective": "side-to-move",
                    "source_score_cp": cp_white,
                    "source_score_perspective": args.score_pov,
                    "teacher_depth": depth,
                    "teacher_knodes": knodes,
                    "source": {
                        "name": "Lichess Open Database — Evaluations",
                        "url": args.source_url,
                        "license": "CC0-1.0",
                        "license_url": "https://creativecommons.org/publicdomain/zero/1.0/",
                    },
                    "split": split,
                    "source_record_line": line_number,
                }
                handles[split].write(
                    json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n"
                )
                counters["positions_written"] += 1
                split_counts[split] += 1
                if args.max_positions and counters["positions_written"] >= args.max_positions:
                    counters["stopped_at_max_positions"] = 1
                    break
    finally:
        for handle in handles.values():
            handle.close()

    for split, target in targets.items():
        os.replace(temp_paths[split], target)

    output_hashes = {
        split: {"file": path.name, "sha256": sha256_file(path), "bytes": path.stat().st_size}
        for split, path in targets.items()
    }
    manifest = {
        "manifest_version": 1,
        "dataset_name": args.dataset_name,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "importer": {"name": "Prunex Lichess evaluation importer", "version": IMPORTER_VERSION},
        "source": {
            "name": "Lichess Open Database — Evaluations",
            "url": args.source_url,
            "archive_name": source.name,
            "archive_bytes": source.stat().st_size,
            "archive_sha256": archive_hash,
            "downloaded_at": args.downloaded_at or None,
            "license": "CC0-1.0",
            "license_url": "https://creativecommons.org/publicdomain/zero/1.0/",
            "teacher": "Stockfish analyses supplied by Lichess; underlying engine versions vary",
        },
        "label_definition": {
            "source_field": "evals[deepest depth].pvs[0].cp",
            "source_perspective": args.score_pov,
            "model_perspective": "side-to-move",
            "mate_labels": "excluded",
            "clipping_cp": args.max_abs_cp,
            "minimum_depth": args.min_depth,
            "minimum_knodes": args.min_knodes,
        },
        "split": {
            "method": "SHA-256 position hash bucketing; duplicate positions share a split",
            "seed": args.split_seed,
            "fractions": {"train": 0.80, "validation": 0.10, "test": 0.10},
            "counts": dict(split_counts),
        },
        "counters": dict(counters),
        "outputs": output_hashes,
        "limitations": [
            "Labels are teacher evaluations, not game outcomes or verified best-move targets.",
            "Lichess states that its evaluation archive contains analyses from various Stockfish flavours.",
            "Training on these labels distils that teacher signal; it does not establish playing strength.",
        ],
    }
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return manifest


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--dataset-name", required=True)
    parser.add_argument("--source-url", default="https://database.lichess.org/")
    parser.add_argument("--score-pov", choices=("white", "side-to-move"), required=True)
    parser.add_argument("--split-seed", default="prunex-halfkp-v1")
    parser.add_argument("--min-depth", type=int, default=16)
    parser.add_argument("--min-knodes", type=int, default=1000)
    parser.add_argument("--max-abs-cp", type=int, default=2000)
    parser.add_argument("--max-positions", type=int, default=0,
                        help="Stop after this many unique positions; 0 means all records")
    parser.add_argument("--downloaded-at")
    parser.add_argument("--overwrite", action="store_true")
    args = parser.parse_args()

    if args.min_depth < 1 or args.min_knodes < 0 or args.max_abs_cp < 100:
        parser.error("invalid depth, node, or score-clipping setting")
    if args.max_positions < 0:
        parser.error("--max-positions cannot be negative")

    manifest = prepare(args)
    print(json.dumps({
        "dataset_name": manifest["dataset_name"],
        "source_sha256": manifest["source"]["archive_sha256"],
        "counters": manifest["counters"],
        "split_counts": manifest["split"]["counts"],
        "manifest": str(args.output_dir / "corpus-manifest.json"),
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
