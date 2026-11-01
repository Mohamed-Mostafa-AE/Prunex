#!/usr/bin/env python3
"""Verify that a local executable matches the official Stockfish 2.0 identity/signature.

The Stockfish team documented the 2.0 bench signature as 7,224,363 nodes:
https://stockfishchess.org/blog/2011/stockfish-2/

This is a practical build-identity check, not a cryptographic signature of the
historical release binary. Always record the SHA-256 printed by this script.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path


EXPECTED_BENCH_NODES = 7_224_363
UCI_TIMEOUT_SECONDS = 30
BENCH_TIMEOUT_SECONDS = 300


def run_engine(command: list[str], *, input_text: str | None, timeout: int) -> str:
    try:
        completed = subprocess.run(
            command,
            input=input_text,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            timeout=timeout,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError(
            f"Engine timed out after {timeout} seconds: {' '.join(command)}"
        ) from exc
    except OSError as exc:
        raise RuntimeError(f"Could not launch engine: {exc}") from exc

    if completed.returncode != 0:
        tail = "\n".join(completed.stdout.splitlines()[-20:])
        raise RuntimeError(
            f"Engine command exited with code {completed.returncode}.\n{tail}"
        )
    return completed.stdout


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Check a native Stockfish 2.0 UCI executable."
    )
    parser.add_argument(
        "--engine",
        required=True,
        help="Path to the Stockfish 2.0 executable inside the current environment.",
    )
    args = parser.parse_args()

    engine = Path(args.engine).expanduser().resolve()
    if not engine.is_file():
        parser.error(f"Engine file does not exist: {engine}")

    uci_output = run_engine([str(engine)], input_text="uci\nquit\n", timeout=UCI_TIMEOUT_SECONDS)
    id_names = re.findall(r"(?im)^\s*id name\s+(.+?)\s*$", uci_output)
    stockfish_20_name = next(
        (name for name in id_names if re.search(r"\bStockfish\s+2\.0\b", name, re.I)),
        None,
    )

    bench_output = run_engine(
        [str(engine), "bench"],
        input_text=None,
        timeout=BENCH_TIMEOUT_SECONDS,
    )
    node_counts = re.findall(
        r"(?im)^\s*(?:total\s+)?nodes\s+searched\s*[:=]\s*([0-9][0-9,]*)\s*$",
        bench_output,
    )
    bench_nodes = int(node_counts[-1].replace(",", "")) if node_counts else None

    identity_ok = stockfish_20_name is not None
    signature_ok = bench_nodes == EXPECTED_BENCH_NODES
    result = {
        "engine_path": str(engine),
        "sha256": sha256_file(engine),
        "uci_id_names": id_names,
        "matched_stockfish_2_0_id": stockfish_20_name,
        "bench_nodes": bench_nodes,
        "expected_bench_nodes": EXPECTED_BENCH_NODES,
        "identity_check_passed": identity_ok,
        "bench_signature_passed": signature_ok,
        "verified_as_stockfish_2_0": identity_ok and signature_ok,
        "verification_note": (
            "The official Stockfish 2.0 announcement documents this bench signature. "
            "The result is a practical identity check, not a cryptographic proof of "
            "the original publisher's binary."
        ),
    }
    print(json.dumps(result, indent=2))

    if not result["verified_as_stockfish_2_0"]:
        print(
            "Stockfish 2.0 verification failed. Do not treat this executable as the "
            "verified historical opponent.",
            file=sys.stderr,
        )
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
