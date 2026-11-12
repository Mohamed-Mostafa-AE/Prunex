#!/usr/bin/env python3
"""Capture real UCI search output from a freshly built Prunex executable."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import selectors
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path


class UciProbe:
    def __init__(self, executable: Path) -> None:
        self.process = subprocess.Popen(
            [str(executable.resolve())],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            bufsize=0,
        )
        if self.process.stdin is None or self.process.stdout is None:
            raise RuntimeError("Could not open the UCI process pipes.")
        self.selector = selectors.DefaultSelector()
        self.selector.register(self.process.stdout, selectors.EVENT_READ)
        self.buffer = b""
        self.transcript: list[str] = []

    def send(self, command: str) -> None:
        if self.process.stdin is None:
            raise RuntimeError("The engine input pipe is closed.")
        self.transcript.append(f"> {command}")
        self.process.stdin.write((command + "\n").encode("utf-8"))
        self.process.stdin.flush()

    def read_line(self, timeout: float) -> str:
        deadline = time.monotonic() + timeout
        while b"\n" not in self.buffer:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise TimeoutError("Timed out waiting for a UCI response.")
            ready = self.selector.select(remaining)
            if not ready:
                raise TimeoutError("Timed out waiting for a UCI response.")
            chunk = os.read(self.process.stdout.fileno(), 4096)
            if not chunk:
                raise RuntimeError("Prunex closed stdout before completing the response.")
            self.buffer += chunk

        raw, self.buffer = self.buffer.split(b"\n", 1)
        line = raw.decode("utf-8", errors="replace").rstrip("\r")
        self.transcript.append(f"< {line}")
        return line

    def read_until(self, prefix: str, timeout: float = 30.0) -> list[str]:
        lines: list[str] = []
        deadline = time.monotonic() + timeout
        while True:
            line = self.read_line(max(0.01, deadline - time.monotonic()))
            lines.append(line)
            if line.startswith(prefix):
                return lines

    def handshake(self) -> None:
        self.send("uci")
        uci_lines = self.read_until("uciok")
        if not any(line.startswith("id name Prunex") for line in uci_lines):
            raise RuntimeError("The executable did not identify itself as Prunex.")
        self.send("isready")
        self.read_until("readyok")

    def search(self, label: str, position: str, depth: int) -> list[str]:
        self.transcript.append("")
        self.transcript.append(f"# {label} — depth {depth}")
        self.send(f"position {position}")
        self.send(f"go depth {depth}")
        lines = self.read_until("bestmove ", timeout=120.0)
        info_lines = [line for line in lines if line.startswith("info depth ")]
        if not info_lines:
            raise RuntimeError(f"{label}: no completed search-iteration info was emitted.")
        if not all(
            all(key in line for key in (" nodes ", " nps "))
            and (" score cp " in line or " score mate " in line)
            for line in info_lines
        ):
            raise RuntimeError(f"{label}: an info line is missing expected metrics.")
        return lines

    def close(self) -> None:
        try:
            if self.process.poll() is None and self.process.stdin is not None:
                self.process.stdin.write(b"quit\n")
                self.process.stdin.flush()
                self.process.wait(timeout=5)
        except (BrokenPipeError, subprocess.TimeoutExpired):
            self.process.kill()
            self.process.wait(timeout=5)
        finally:
            self.selector.close()


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--engine", required=True, type=Path)
    parser.add_argument("--commit", required=True)
    parser.add_argument("--compiler", required=True)
    parser.add_argument("--cmake-version", required=True)
    parser.add_argument("--tt-bits", required=True, type=int)
    parser.add_argument("--out", required=True, type=Path)
    args = parser.parse_args()

    if not args.engine.is_file():
        parser.error(f"Engine executable does not exist: {args.engine}")
    if args.tt_bits < 16 or args.tt_bits > 23:
        parser.error("--tt-bits must be from 16 through 23")

    executable_hash = sha256(args.engine)
    probe = UciProbe(args.engine)
    try:
        probe.handshake()
        probe.search("Initial position", "startpos", depth=8)
        kiwipete = (
            "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/"
            "2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1"
        )
        probe.search(
            "Kiwipete tactical / move-generation position",
            f"fen {kiwipete}",
            depth=6,
        )
    finally:
        probe.close()

    timestamp = datetime.now(timezone.utc).isoformat(timespec="seconds")
    header = [
        "PRUNEX NATIVE UCI PROBE",
        "======================",
        f"UTC timestamp: {timestamp}",
        f"Source commit: {args.commit}",
        f"Engine executable: {args.engine}",
        f"Engine SHA-256: {executable_hash}",
        f"Build configuration: CMake Release, PRUNEX_TT_BITS={args.tt_bits}",
        f"Compiler: {args.compiler}",
        f"CMake: {args.cmake_version}",
        "",
        "The lines below are captured directly from the compiled executable.",
        "The diagram is conceptual; this transcript records actual UCI responses.",
        "The current engine's PV output is its root best move, not a full PV line.",
        "",
        "UCI TRANSCRIPT",
        "--------------",
    ]
    transcript = "\n".join(header + probe.transcript) + "\n"
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(transcript, encoding="utf-8")

    metadata = {
        "source_commit": args.commit,
        "timestamp_utc": timestamp,
        "engine_path": str(args.engine),
        "engine_sha256": executable_hash,
        "build_configuration": "Release",
        "prunex_tt_bits": args.tt_bits,
        "compiler": args.compiler,
        "cmake": args.cmake_version,
        "positions": [
            {"name": "Initial position", "depth": 8},
            {"name": "Kiwipete", "depth": 6},
        ],
        "transcript_sha256": hashlib.sha256(transcript.encode("utf-8")).hexdigest(),
    }
    metadata_path = args.out.with_suffix(".json")
    metadata_path.write_text(
        json.dumps(metadata, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(f"Captured UCI transcript: {args.out}")
    print(f"Probe metadata: {metadata_path}")
    print(f"Engine SHA-256: {executable_hash}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
