#!/usr/bin/env python3
"""Verify the pinned Stockfish 2.0 source build and historical bench signature."""
from __future__ import annotations
import argparse
import hashlib
import json
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

EXPECTED_NODES = 7_224_363
EXPECTED_POSITIONS = 16
EXPECTED_SOURCE_COMMIT = "aa2de53a83ca5423c8c8007abf71f9afdf589d93"
NODE_LINE = re.compile(r"^\s*Nodes:\s*([0-9][0-9,]*)\s*$", re.I)
SUMMARY_LINE = re.compile(r"^\s*Nodes searched\s*:\s*([0-9][0-9,]*)\s*$", re.I)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def parse_position_node_counts(text: str) -> list[int]:
    return [int(match.group(1).replace(",", "")) for line in text.splitlines()
            if (match := NODE_LINE.match(line))]


def parse_bench_summary(text: str) -> int | None:
    values = [int(match.group(1).replace(",", "")) for line in text.splitlines()
              if (match := SUMMARY_LINE.match(line))]
    return values[-1] if values else None


def assess_bench(position_counts: list[int], console_total: int | None, process_passed: bool) -> dict:
    # Historical Stockfish 2.0 reports an official console total that can differ
    # slightly from the sum of the per-position bench.txt records. Keep both.
    position_sum = sum(position_counts)
    return {
        "bench_position_count": len(position_counts),
        "bench_position_count_passed": len(position_counts) == EXPECTED_POSITIONS,
        "bench_position_node_sum": position_sum,
        "bench_console_summary_nodes": console_total,
        "bench_log_console_delta": console_total - position_sum if console_total is not None else None,
        "bench_signature_passed": bool(
            process_passed and len(position_counts) == EXPECTED_POSITIONS
            and console_total == EXPECTED_NODES
        ),
    }


def run_capture(command: list[str], *, input_text: str | None = None, timeout: int = 300):
    return subprocess.run(command, input=input_text, text=True, stdout=subprocess.PIPE,
                          stderr=subprocess.STDOUT, timeout=timeout, check=False)


def run_bench_keep_stdin_open(command: list[str], cwd: Path, timeout: int = 300):
    # Stockfish 2.0 treats stdin EOF as quit while the legacy bench is running.
    with tempfile.TemporaryFile(mode="w+t", encoding="utf-8") as output:
        process = subprocess.Popen(command, cwd=str(cwd), stdin=subprocess.PIPE,
                                   stdout=output, stderr=subprocess.STDOUT, text=True)
        try:
            code = process.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()
            raise
        finally:
            if process.stdin is not None and not process.stdin.closed:
                process.stdin.close()
        output.seek(0)
        return subprocess.CompletedProcess(command, code, output.read(), None)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--engine", required=True)
    parser.add_argument("--source-commit", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--evidence-dir", required=True)
    args = parser.parse_args()
    engine = Path(args.engine).resolve()
    output = Path(args.output).resolve()
    evidence = Path(args.evidence_dir).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    evidence.mkdir(parents=True, exist_ok=True)
    result = {
        "engine_path": str(engine),
        "source_repository": "https://github.com/official-stockfish/Stockfish",
        "source_tag": "sf_2.0",
        "source_commit": args.source_commit,
        "expected_source_commit": EXPECTED_SOURCE_COMMIT,
        "source_commit_check_passed": args.source_commit.lower() == EXPECTED_SOURCE_COMMIT,
        "expected_bench_positions": EXPECTED_POSITIONS,
        "expected_bench_nodes": EXPECTED_NODES,
        "bench_parameters": {"hash_mb": 128, "threads": 1, "limit": 12,
                             "positions": "default", "limit_type": "depth"},
        "identity_check_passed": False,
        "bench_process_passed": False,
        "bench_position_count_passed": False,
        "bench_signature_passed": False,
        "verified_as_stockfish_2_0": False,
        "verification_method": "Pinned source commit + UCI identity + 16-position bench + official console aggregate + executable SHA-256.",
        "verification_limit": "Practical source/build fingerprint, not a cryptographic publisher signature.",
    }
    if not engine.is_file():
        result["error"] = f"Engine executable does not exist: {engine}"
    else:
        result["executable_sha256"] = sha256_file(engine)
        try:
            uci = run_capture([str(engine)], input_text="uci\nquit\n", timeout=30)
            uci_file = evidence / "stockfish-2.0-uci-output.txt"
            uci_file.write_text(uci.stdout, encoding="utf-8")
            names = re.findall(r"(?im)^\s*id name\s+(.+?)\s*$", uci.stdout)
            matched = next((name for name in names if re.search(r"\bStockfish\s+2\.0\b", name, re.I)), None)
            result.update({
                "uci_process_exit_code": uci.returncode,
                "uci_id_names": names,
                "matched_stockfish_2_0_id": matched,
                "identity_check_passed": bool(matched and uci.returncode == 0 and "uciok" in uci.stdout),
                "uci_output_sha256": sha256_file(uci_file),
            })
            with tempfile.TemporaryDirectory(prefix="stockfish-2.0-bench-") as temp:
                workdir = Path(temp)
                bench = run_bench_keep_stdin_open(
                    [str(engine), "bench", "128", "1", "12", "default", "depth"],
                    cwd=workdir, timeout=300)
                bench_file = evidence / "stockfish-2.0-bench-output.txt"
                bench_file.write_text(bench.stdout, encoding="utf-8")
                result.update({
                    "bench_process_exit_code": bench.returncode,
                    "bench_process_passed": bench.returncode == 0,
                    "bench_output_sha256": sha256_file(bench_file),
                })
                log = workdir / "bench.txt"
                if log.is_file():
                    saved = evidence / "stockfish-2.0-bench-search.log"
                    shutil.copyfile(log, saved)
                    counts = parse_position_node_counts(log.read_text(encoding="utf-8", errors="replace"))
                    result["bench_position_node_counts"] = counts
                    result["bench_log_sha256"] = sha256_file(saved)
                else:
                    counts = []
                    result["bench_position_node_counts"] = []
                    result["bench_log_error"] = "bench.txt was not produced."
                console_total = parse_bench_summary(bench.stdout)
                result.update(assess_bench(counts, console_total, bench.returncode == 0))
                result["bench_console_summary_matches_position_sum"] = (
                    console_total == sum(counts) if console_total is not None else None
                )
            result["verified_as_stockfish_2_0"] = bool(
                result["source_commit_check_passed"]
                and result["identity_check_passed"]
                and result["bench_signature_passed"]
            )
        except (OSError, subprocess.TimeoutExpired) as exc:
            result["error"] = f"Verification command failed: {exc}"
    payload = json.dumps(result, indent=2) + "\n"
    output.write_text(payload, encoding="utf-8")
    print(payload, end="")
    return 0 if result.get("verified_as_stockfish_2_0") else 2


if __name__ == "__main__":
    raise SystemExit(main())
