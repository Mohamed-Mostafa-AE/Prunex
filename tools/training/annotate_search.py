#!/usr/bin/env python3
"""Annotate licensed PGN position rows with bounded Prunex UCI search scores.

The score is captured from a completed iterative-deepening iteration and is
recorded from the root side-to-move perspective. This is the score source used
by the browser's timed WebAssembly review, unlike the separate static "eval"
command.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import queue
import re
import subprocess
import sys
import tempfile
import threading
import time
from pathlib import Path

INFO_SCORE = re.compile(r"(?:^|\s)score\s+(cp|mate)\s+(-?\d+)(?:\s|$)")
INFO_DEPTH = re.compile(r"(?:^|\s)depth\s+(\d+)(?:\s|$)")
INFO_NODES = re.compile(r"(?:^|\s)nodes\s+(\d+)(?:\s|$)")
BESTMOVE = re.compile(r"^bestmove\s+([a-h][1-8][a-h][1-8][qrbn]?|0000)(?:\s|$)")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def parse_search_info(line: str) -> dict | None:
    text = line.strip()
    if not text.startswith("info "):
        return None
    depth = INFO_DEPTH.search(text)
    score = INFO_SCORE.search(text)
    if not depth or not score:
        return None
    nodes = INFO_NODES.search(text)
    score_type, raw_score = score.groups()
    value = int(raw_score)
    if score_type == "mate":
        # The current Prunex UCI search reports cp scores, but retain a safe
        # conversion for UCI-compatible builds that expose mate distance.
        value = (1 if value >= 0 else -1) * (10000 - min(900, abs(value)))
    return {
        "depth": int(depth.group(1)),
        "score_cp": value,
        "nodes": int(nodes.group(1)) if nodes else 0,
    }


class UciReader:
    def __init__(self, process: subprocess.Popen[str]) -> None:
        self.process = process
        self.lines: queue.Queue[str | None] = queue.Queue()
        self.thread = threading.Thread(target=self._read, daemon=True)
        self.thread.start()

    def _read(self) -> None:
        assert self.process.stdout is not None
        try:
            for line in self.process.stdout:
                self.lines.put(line)
        finally:
            self.lines.put(None)

    def next_line(self, timeout: float, description: str) -> str:
        try:
            line = self.lines.get(timeout=timeout)
        except queue.Empty:
            raise TimeoutError(f"Timed out waiting for {description}.") from None
        if line is None:
            raise RuntimeError(f"Prunex exited while waiting for {description}.")
        return line.rstrip("\r\n")

    def wait_for(self, predicate, timeout: float, description: str) -> str:
        deadline = time.monotonic() + timeout
        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise TimeoutError(f"Timed out waiting for {description}.")
            line = self.next_line(remaining, description)
            if predicate(line):
                return line


def validate_input_row(row: dict, line_number: int) -> None:
    if not isinstance(row, dict):
        raise ValueError(f"Expected a JSON object on line {line_number}.")
    if not isinstance(row.get("game_id"), str) or not row["game_id"].strip():
        raise ValueError(f"Missing game_id on line {line_number}.")
    if row.get("split") not in {"train", "validation", "test"}:
        raise ValueError(f"Invalid or missing split on line {line_number}.")
    fen = row.get("fen")
    if not isinstance(fen, str) or not fen.strip():
        raise ValueError(f"Missing FEN on line {line_number}.")
    result = row.get("result_for_side_to_move")
    if isinstance(result, bool) or result not in (0, 0.5, 1):
        raise ValueError(f"Invalid result_for_side_to_move on line {line_number}.")


def search_position(
    process: subprocess.Popen[str],
    reader: UciReader,
    fen: str,
    movetime_ms: int,
    timeout_seconds: float,
) -> dict:
    assert process.stdin is not None
    process.stdin.write("ucinewgame\n")
    process.stdin.write("position fen " + fen.strip() + "\n")
    process.stdin.write(f"go movetime {movetime_ms}\n")
    process.stdin.flush()

    deadline = time.monotonic() + timeout_seconds
    latest = None
    while True:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise TimeoutError("Timed out waiting for Prunex search completion.")
        line = reader.next_line(remaining, "Prunex search completion")
        parsed = parse_search_info(line)
        if parsed is not None and (latest is None or parsed["depth"] >= latest["depth"]):
            latest = parsed
        if BESTMOVE.match(line):
            if latest is None or latest["depth"] < 1:
                raise RuntimeError("Prunex returned a best move without a completed search iteration.")
            return latest


def annotate(args: argparse.Namespace) -> int:
    engine = Path(args.engine).expanduser().resolve()
    source = Path(args.input).expanduser().resolve()
    output = Path(args.output).expanduser().resolve()
    if not engine.is_file():
        raise FileNotFoundError(f"Native Prunex executable not found: {engine}")
    if not source.is_file():
        raise FileNotFoundError(f"Input position file not found: {source}")
    if output.exists() and not args.overwrite:
        raise FileExistsError(f"Output exists; choose another path or pass --overwrite: {output}")
    if not 1 <= args.movetime_ms <= 30000:
        raise ValueError("--movetime-ms must be between 1 and 30000.")
    if args.timeout <= args.movetime_ms / 1000:
        raise ValueError("--timeout must exceed the requested search budget.")

    binary_hash = sha256_file(engine)
    output.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_name = tempfile.mkstemp(prefix=output.name + ".", suffix=".tmp", dir=output.parent)
    os.close(fd)
    temporary = Path(temp_name)
    process = subprocess.Popen(
        [str(engine)],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        text=True,
        encoding="utf-8",
        bufsize=1,
    )
    assert process.stdin is not None
    reader = UciReader(process)
    annotated = 0
    try:
        process.stdin.write("uci\n")
        process.stdin.flush()
        reader.wait_for(lambda line: line.strip() == "uciok", args.timeout, "UCI handshake")
        process.stdin.write("isready\n")
        process.stdin.flush()
        reader.wait_for(lambda line: line.strip() == "readyok", args.timeout, "ready response")

        with source.open("r", encoding="utf-8") as input_file, temporary.open(
            "w", encoding="utf-8", newline="\n"
        ) as output_file:
            for line_number, line in enumerate(input_file, start=1):
                if not line.strip():
                    continue
                if args.max_positions and annotated >= args.max_positions:
                    break
                try:
                    row = json.loads(line)
                except json.JSONDecodeError as exc:
                    raise ValueError(f"Invalid JSON on line {line_number}: {exc}") from exc
                validate_input_row(row, line_number)
                result = search_position(
                    process, reader, row["fen"], args.movetime_ms, args.timeout
                )
                row["prunex_search_score_cp"] = result["score_cp"]
                row["prunex_search_score_pov"] = "side_to_move"
                row["search_budget_ms"] = args.movetime_ms
                row["search_depth"] = result["depth"]
                row["search_nodes"] = result["nodes"]
                row["native_engine_version"] = args.engine_version
                row["native_engine_sha256"] = binary_hash
                output_file.write(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n")
                annotated += 1

        process.stdin.write("quit\n")
        process.stdin.flush()
        process.wait(timeout=args.timeout)
        os.replace(temporary, output)
    except Exception:
        temporary.unlink(missing_ok=True)
        process.kill()
        process.wait()
        raise

    print(json.dumps({
        "input": str(source),
        "output": str(output),
        "annotated_positions": annotated,
        "search_budget_ms": args.movetime_ms,
        "engine_version": args.engine_version,
        "engine_sha256": binary_hash,
        "score_perspective": "side_to_move",
    }, indent=2))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--engine", required=True, help="Path to the compiled native Prunex executable")
    parser.add_argument("--input", required=True, help="One game-level-split corpus JSONL file")
    parser.add_argument("--output", required=True, help="Annotated JSONL output file")
    parser.add_argument("--engine-version", default="Prunex 0.8.0")
    parser.add_argument("--movetime-ms", type=int, default=15000,
                        help="Fixed UCI search budget per position (default: 15000)")
    parser.add_argument("--timeout", type=float, default=45.0,
                        help="Maximum wall-clock wait for one position")
    parser.add_argument("--max-positions", type=int, default=0,
                        help="0 means annotate all positions")
    parser.add_argument("--overwrite", action="store_true")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    try:
        if args.max_positions < 0:
            raise ValueError("--max-positions cannot be negative.")
        return annotate(args)
    except (OSError, ValueError, RuntimeError, TimeoutError) as exc:
        print(f"Prunex search annotation failed: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
