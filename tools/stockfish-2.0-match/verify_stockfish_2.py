#!/usr/bin/env python3
"""Verify the official Stockfish 2.0 source build and historical bench signature.

Stockfish 2.0 polls stdin during search. Closing stdin makes its input loop
interpret EOF as a UCI 'quit' command, which aborts the benchmark after the
current position. The benchmark helper below keeps the pipe open until the
process exits naturally.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Sequence

EXPECTED_NODES = 7_224_363
EXPECTED_POSITIONS = 16
EXPECTED_SOURCE_COMMIT = "aa2de53a83ca5423c8c8007abf71f9afdf589d93"
NODE_LINE = re.compile(r"^\s*Nodes:\s*([0-9][0-9,]*)\s*$", re.IGNORECASE)
SUMMARY_LINE = re.compile(r"^\s*Nodes searched\s*:\s*([0-9][0-9,]*)\s*$", re.IGNORECASE)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def parse_position_node_counts(search_log: str) -> list[int]:
    """Extract per-position Nodes totals from Stockfish 2.0 bench.txt."""
    counts: list[int] = []
    for line in search_log.splitlines():
        match = NODE_LINE.match(line)
        if match:
            counts.append(int(match.group(1).replace(",", "")))
    return counts


def parse_bench_summary(bench_output: str) -> int | None:
    """Read the aggregate printed by Stockfish 2.0 benchmark.cpp."""
    values: list[int] = []
    for line in bench_output.splitlines():
        match = SUMMARY_LINE.match(line)
        if match:
            values.append(int(match.group(1).replace(",", "")))
    return values[-1] if values else None


def run_capture(command: Sequence[str], *, input_text: str | None = None,
                cwd: Path | None = None, timeout: int = 300) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        list(command), input=input_text, cwd=str(cwd) if cwd else None,
        text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        timeout=timeout, check=False,
    )


def run_bench_keep_stdin_open(command: Sequence[str], *, cwd: Path,
                              timeout: int = 300) -> subprocess.CompletedProcess[str]:
    """Run legacy Stockfish bench without sending EOF mid-search.

    Stockfish 2.0 maps EOF to quit in its input polling path. subprocess.run()
    with no input closes stdin immediately, so the old engine can finish one
    position and then stop its 16-position benchmark loop. A pipe kept open
    with no bytes is not readable and does not signal EOF.
    """
    with tempfile.TemporaryFile(mode="w+t", encoding="utf-8") as output:
        process = subprocess.Popen(
            list(command),
            cwd=str(cwd),
            stdin=subprocess.PIPE,
            stdout=output,
            stderr=subprocess.STDOUT,
            text=True,
        )
        try:
            return_code = process.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()
            raise
        finally:
            if process.stdin is not None and not process.stdin.closed:
                process.stdin.close()
        output.seek(0)
        captured = output.read()
    return subprocess.CompletedProcess(list(command), return_code, captured, None)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--engine", required=True, help="Path to the built Stockfish executable")
    parser.add_argument("--source-commit", required=True, help="Resolved upstream Git commit used for this build")
    parser.add_argument("--output", required=True, help="Path for stockfish-verification.json")
    parser.add_argument("--evidence-dir", required=True, help="Directory in which raw bench evidence is retained")
    args = parser.parse_args()

    engine = Path(args.engine).resolve()
    output = Path(args.output).resolve()
    evidence_dir = Path(args.evidence_dir).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    evidence_dir.mkdir(parents=True, exist_ok=True)

    result: dict[str, object] = {
        "engine_path": str(engine),
        "source_repository": "https://github.com/official-stockfish/Stockfish",
        "source_tag": "sf_2.0",
        "source_commit": args.source_commit,
        "expected_source_commit": EXPECTED_SOURCE_COMMIT,
        "source_commit_check_passed": args.source_commit.lower() == EXPECTED_SOURCE_COMMIT,
        "expected_bench_positions": EXPECTED_POSITIONS,
        "expected_bench_nodes": EXPECTED_NODES,
        "bench_parameters": {"hash_mb": 128, "threads": 1, "limit": 12, "positions": "default", "limit_type": "depth"},
        "identity_check_passed": False,
        "bench_process_passed": False,
        "bench_position_count_passed": False,
        "bench_signature_passed": False,
        "verified_as_stockfish_2_0": False,
        "verification_limit": "Pinned official source commit, UCI identity, historical benchmark signature, and executable SHA-256; not a cryptographic publisher signature.",
    }

    if not engine.is_file():
        result["error"] = f"Engine executable does not exist: {engine}"
        output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(result, indent=2))
        return 2

    result["executable_sha256"] = sha256_file(engine)

    try:
        uci = run_capture([str(engine)], input_text="uci\nquit\n", timeout=30)
        uci_output_path = evidence_dir / "stockfish-2.0-uci-output.txt"
        uci_output_path.write_text(uci.stdout, encoding="utf-8")
        result["uci_process_exit_code"] = uci.returncode
        result["uci_id_names"] = re.findall(r"(?im)^\s*id name\s+(.+?)\s*$", uci.stdout)
        result["matched_stockfish_2_0_id"] = next(
            (name for name in result["uci_id_names"] if re.search(r"\bStockfish\s+2\.0\b", name, re.IGNORECASE)),
            None,
        )
        result["identity_check_passed"] = (
            bool(result["matched_stockfish_2_0_id"])
            and uci.returncode == 0
            and "uciok" in uci.stdout
        )
        result["uci_output_sha256"] = sha256_file(uci_output_path)

        with tempfile.TemporaryDirectory(prefix="stockfish-2.0-bench-") as temp_name:
            workdir = Path(temp_name)
            bench = run_bench_keep_stdin_open(
                [str(engine), "bench", "128", "1", "12", "default", "depth"],
                cwd=workdir,
                timeout=300,
            )
            bench_output_path = evidence_dir / "stockfish-2.0-bench-output.txt"
            bench_output_path.write_text(bench.stdout, encoding="utf-8")
            result["bench_process_exit_code"] = bench.returncode
            result["bench_process_passed"] = bench.returncode == 0
            result["bench_output_sha256"] = sha256_file(bench_output_path)

            log_path = workdir / "bench.txt"
            if log_path.is_file():
                saved_log = evidence_dir / "stockfish-2.0-bench-search.log"
                shutil.copyfile(log_path, saved_log)
                log_text = log_path.read_text(encoding="utf-8", errors="replace")
                counts = parse_position_node_counts(log_text)
                result["bench_position_node_counts"] = counts
                result["bench_position_count"] = len(counts)
                result["bench_nodes"] = sum(counts)
                result["bench_position_count_passed"] = len(counts) == EXPECTED_POSITIONS
                result["bench_log_sha256"] = sha256_file(saved_log)
            else:
                result["bench_position_node_counts"] = []
                result["bench_position_count"] = 0
                result["bench_nodes"] = None
                result["bench_position_count_passed"] = False
                result["bench_log_error"] = "Stockfish 2.0 did not create bench.txt in the isolated working directory."

            console_total = parse_bench_summary(bench.stdout)
            result["bench_console_summary_nodes"] = console_total
            if console_total is not None and result["bench_nodes"] is not None:
                result["bench_console_summary_matches_log"] = console_total == result["bench_nodes"]
            else:
                result["bench_console_summary_matches_log"] = None

        log_total_valid = result.get("bench_nodes") == EXPECTED_NODES
        console_consistent = result.get("bench_console_summary_matches_log") is True
        result["bench_signature_passed"] = bool(
            result["bench_process_passed"]
            and result["bench_position_count_passed"]
            and log_total_valid
            and console_consistent
        )
        result["verified_as_stockfish_2_0"] = bool(
            result["source_commit_check_passed"]
            and result["identity_check_passed"]
            and result["bench_signature_passed"]
        )
    except subprocess.TimeoutExpired as exc:
        result["error"] = f"Verification command timed out: {exc.cmd}"
    except OSError as exc:
        result["error"] = f"Could not execute verification command: {exc}"

    payload = json.dumps(result, indent=2) + "\n"
    output.write_text(payload, encoding="utf-8")
    print(payload, end="")
    return 0 if result.get("verified_as_stockfish_2_0") else 2


if __name__ == "__main__":
    raise SystemExit(main())
