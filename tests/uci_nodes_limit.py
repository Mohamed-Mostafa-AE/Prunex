#!/usr/bin/env python3
"""Regression-test exact UCI node caps on a branching middlegame position."""
from __future__ import annotations
import subprocess
import sys

engine = sys.argv[1]
limits = (12_000, 1_000_000)
position = "position startpos moves e2e4 e7e5 g1f3 b8c6 f1b5 a7a6"

def run_limit(limit: int) -> None:
    proc = subprocess.Popen(
        [engine], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT, text=True, bufsize=1
    )

    def send(line: str) -> None:
        assert proc.stdin is not None
        proc.stdin.write(line + "\n")
        proc.stdin.flush()

    def wait_for(prefix: str) -> str:
        assert proc.stdout is not None
        for line in proc.stdout:
            line = line.strip()
            if line.startswith(prefix):
                return line
        raise RuntimeError(f"Engine exited before {prefix!r}")

    try:
        send("uci")
        wait_for("uciok")
        send("isready")
        wait_for("readyok")
        send(position)
        send(f"go nodes {limit}")
        budget_line = wait_for("info string node-limit ")
        bestmove_line = wait_for("bestmove ")
        actual = int(budget_line.rsplit(" ", 1)[1].split("/", 1)[0])
        if not 0 < actual <= limit:
            raise RuntimeError(f"Node budget violated: {actual}/{limit}")
        if bestmove_line.split()[-1] in ("0000", "(none)"):
            raise RuntimeError(f"No legal best move returned: {bestmove_line}")
        print(f"UCI node limit passed: {actual}/{limit}; {bestmove_line}")
    finally:
        if proc.poll() is None:
            try:
                send("quit")
            except Exception:
                pass
            proc.wait(timeout=10)

for budget in limits:
    run_limit(budget)
