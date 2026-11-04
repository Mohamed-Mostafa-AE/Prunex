#!/usr/bin/env python3
"""Annotate corpus position JSONL with the native Prunex static evaluation."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import queue
import subprocess
import sys
import tempfile
import threading
import time
from pathlib import Path


EVAL_PREFIX = "info string static evaluation cp "


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def parse_eval_line(line: str) -> int | None:
    text = line.strip()
    if not text.startswith(EVAL_PREFIX):
        return None
    raw = text[len(EVAL_PREFIX):].strip().split()[0]
    try:
        return int(raw)
    except (ValueError, IndexError):
        raise ValueError(f"Invalid native evaluation line: {line!r}") from None


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

    def wait_for(self, predicate, timeout: float, description: str) -> str:
        deadline = time.monotonic() + timeout
        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise TimeoutError(f"Timed out waiting for native engine {description}.")
            try:
                line = self.lines.get(timeout=remaining)
            except queue.Empty:
                raise TimeoutError(f"Timed out waiting for native engine {description}.") from None
            if line is None:
                raise RuntimeError(f"Native engine exited while waiting for {description}.")
            if predicate(line):
                return line.rstrip("\r\n")


def annotate(args: argparse.Namespace) -> int:
    engine = Path(args.engine).expanduser().resolve()
    source = Path(args.input).expanduser().resolve()
    output = Path(args.output).expanduser().resolve()
    if not engine.is_file():
        raise FileNotFoundError(f"Native engine executable not found: {engine}")
    if not source.is_file():
        raise FileNotFoundError(f"Input position file not found: {source}")
    if output.exists() and not args.overwrite:
        raise FileExistsError(f"Output exists; choose another path or pass --overwrite: {output}")

    engine_hash = sha256_file(engine)
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

        with source.open("r", encoding="utf-8") as input_file, temporary.open("w", encoding="utf-8", newline="\n") as output_file:
            for line_number, line in enumerate(input_file, start=1):
                if not line.strip():
                    continue
                if args.max_positions and annotated >= args.max_positions:
                    break
                try:
                    row = json.loads(line)
                except json.JSONDecodeError as exc:
                    raise ValueError(f"Invalid JSON on line {line_number}: {exc}") from exc
                fen = row.get("fen")
                if not isinstance(fen, str) or not fen.strip():
                    raise ValueError(f"Missing FEN on line {line_number}.")

                process.stdin.write("position fen " + fen.strip() + "\n")
                process.stdin.write("eval\n")
                process.stdin.flush()
                response = reader.wait_for(
                    lambda value: value.startswith(EVAL_PREFIX),
                    args.timeout,
                    f"evaluation for input line {line_number}",
                )
                score = parse_eval_line(response)
                if score is None:
                    raise ValueError(f"Native engine did not return an evaluation for line {line_number}.")
                row["prunex_static_eval_cp"] = score
                row["prunex_static_eval_pov"] = "side_to_move"
                row["native_engine_version"] = args.engine_version
                row["native_engine_sha256"] = engine_hash
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
        "native_engine_version": args.engine_version,
        "native_engine_sha256": engine_hash,
        "evaluation_pov": "side_to_move",
    }, indent=2))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--engine", required=True, help="Path to the compiled native Prunex executable")
    parser.add_argument("--input", required=True, help="One corpus split JSONL file")
    parser.add_argument("--output", required=True, help="Annotated JSONL output file")
    parser.add_argument("--engine-version", default="Prunex 0.8.0")
    parser.add_argument("--timeout", type=float, default=15.0)
    parser.add_argument("--max-positions", type=int, default=0, help="0 means annotate all positions")
    parser.add_argument("--overwrite", action="store_true")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    if args.timeout <= 0 or args.max_positions < 0:
        print("timeout must be positive and max-positions cannot be negative.", file=sys.stderr)
        return 2
    try:
        return annotate(args)
    except (OSError, ValueError, RuntimeError, TimeoutError, subprocess.SubprocessError) as exc:
        print(f"Annotation failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
