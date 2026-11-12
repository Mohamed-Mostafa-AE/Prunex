#!/usr/bin/env python3
"""Verify that UCI 'go infinite' searches until an explicit stop command."""

from __future__ import annotations

import queue
import subprocess
import sys
import threading
import time
from pathlib import Path


def main() -> int:
    if len(sys.argv) != 2:
        raise SystemExit("usage: uci_infinite_search.py PATH_TO_PRUNEX")

    engine = Path(sys.argv[1]).resolve()
    if not engine.is_file():
        raise FileNotFoundError(engine)

    process = subprocess.Popen(
        [str(engine)],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )
    output: queue.Queue[str | None] = queue.Queue()

    def read_output() -> None:
        assert process.stdout is not None
        for line in process.stdout:
            output.put(line.rstrip("\r\n"))
        output.put(None)

    reader = threading.Thread(target=read_output, daemon=True)
    reader.start()

    def send(command: str) -> None:
        assert process.stdin is not None
        process.stdin.write(command + "\n")
        process.stdin.flush()

    def wait_for(prefix: str, timeout: float) -> list[str]:
        lines: list[str] = []
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            try:
                line = output.get(timeout=max(0.01, deadline - time.monotonic()))
            except queue.Empty:
                break
            if line is None:
                break
            lines.append(line)
            if line.startswith(prefix):
                return lines
        raise AssertionError(
            f"Engine did not emit {prefix!r} within {timeout:.1f}s: {lines[-20:]}"
        )

    try:
        send("uci")
        wait_for("uciok", 5.0)
        send("isready")
        wait_for("readyok", 5.0)
        send("position startpos")
        send("go infinite depth 1 nodes 1 movetime 1")

        # A normal depth-5 search finishes quickly on this position. A genuine
        # infinite search must still be running when this observation window ends.
        observed: list[str] = []
        deadline = time.monotonic() + 0.5
        while time.monotonic() < deadline:
            try:
                line = output.get(timeout=max(0.01, deadline - time.monotonic()))
            except queue.Empty:
                break
            if line is None:
                raise AssertionError("Engine exited before the stop command")
            observed.append(line)
            if line.startswith("bestmove "):
                raise AssertionError(
                    "'go infinite' returned a move before receiving 'stop': "
                    + "\n".join(observed[-20:])
                )

        send("stop")
        completed = wait_for("bestmove ", 20.0)
        if not any(line.startswith("info depth ") for line in observed + completed):
            raise AssertionError("Infinite search did not report a completed depth")
    finally:
        try:
            send("quit")
        except (BrokenPipeError, OSError):
            pass
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)

    print("UCI go infinite / stop behavior: passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
