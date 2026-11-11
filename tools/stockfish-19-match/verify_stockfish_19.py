#!/usr/bin/env python3
"""Verify the pinned Stockfish 19 source, UCI identity, and bundled NNUE file."""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import tempfile
from pathlib import Path

EXPECTED_SOURCE_COMMIT = "edb0d9db6731067ec50ce619ff372b463bc4dd5d"
EXPECTED_BENCH_NODES = 2_497_913
EXPECTED_NET_NAME = "nn-1a298aa575a0.nnue"
SUMMARY_LINE = re.compile(r"^\\s*Nodes searched\\s*:\\s*([0-9][0-9,]*)\\s*$", re.I)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def run_bench(engine: Path, timeout: int = 300) -> subprocess.CompletedProcess:
    # Keep stdin open for the full duration of the UCI benchmark command.
    with tempfile.TemporaryFile(mode="w+t", encoding="utf-8") as output:
        process = subprocess.Popen(
            [str(engine), "bench", "16", "1", "13", "default", "depth"],
            cwd=str(engine.parent), stdin=subprocess.PIPE,
            stdout=output, stderr=subprocess.STDOUT, text=True,
        )
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
        return subprocess.CompletedProcess([str(engine), "bench"], code, output.read(), None)


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
    network = engine.parent / EXPECTED_NET_NAME

    result = {
        "source_repository": "https://github.com/official-stockfish/Stockfish",
        "source_tag": "sf_19",
        "source_commit": args.source_commit,
        "expected_source_commit": EXPECTED_SOURCE_COMMIT,
        "source_commit_check_passed": args.source_commit.lower() == EXPECTED_SOURCE_COMMIT,
        "expected_uci_identity": "Stockfish 19",
        "expected_nnue_file": EXPECTED_NET_NAME,
        "identity_check_passed": False,
        "nnue_file_check_passed": False,
        "bench_process_passed": False,
        "bench_signature_passed": False,
        "verified_as_stockfish_19": False,
        "verification_limit": "Pinned upstream source + UCI identity + NNUE filename/hash + official release bench signature; this is a reproducible source/build fingerprint, not a publisher signature.",
    }
    try:
        if not engine.is_file():
            raise FileNotFoundError(f"Engine executable does not exist: {engine}")
        result["engine_path"] = str(engine)
        result["executable_sha256"] = sha256_file(engine)
        uci = subprocess.run(
            [str(engine)], input="uci\\nquit\\n", text=True,
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            cwd=str(engine.parent), timeout=30, check=False,
        )
        uci_file = evidence / "stockfish-19-uci-output.txt"
        uci_file.write_text(uci.stdout, encoding="utf-8")
        names = re.findall(r"(?im)^\\s*id name\\s+(.+?)\\s*$", uci.stdout)
        matched = next((name for name in names if re.search(r"\\bStockfish\\s+19\\b", name, re.I)), None)
        result.update({
            "uci_exit_code": uci.returncode,
            "uci_id_names": names,
            "matched_uci_identity": matched,
            "identity_check_passed": bool(matched and uci.returncode == 0 and "uciok" in uci.stdout),
            "uci_output_sha256": sha256_file(uci_file),
        })
        if network.is_file():
            net_sha = sha256_file(network)
            result.update({
                "nnue_path": str(network),
                "nnue_sha256": net_sha,
                "nnue_filename_hash_matches": net_sha.startswith(EXPECTED_NET_NAME[3:15]),
                "nnue_file_check_passed": net_sha.startswith(EXPECTED_NET_NAME[3:15]),
            })
        bench = run_bench(engine)
        bench_file = evidence / "stockfish-19-bench-output.txt"
        bench_file.write_text(bench.stdout, encoding="utf-8")
        matches = [int(match.group(1).replace(",", "")) for line in bench.stdout.splitlines()
                   if (match := SUMMARY_LINE.match(line))]
        total = matches[-1] if matches else None
        result.update({
            "bench_exit_code": bench.returncode,
            "bench_process_passed": bench.returncode == 0,
            "bench_nodes": total,
            "expected_bench_nodes": EXPECTED_BENCH_NODES,
            "bench_signature_passed": bench.returncode == 0 and total == EXPECTED_BENCH_NODES,
            "bench_output_sha256": sha256_file(bench_file),
        })
    except (OSError, subprocess.TimeoutExpired) as exc:
        result["error"] = str(exc)

    result["verified_as_stockfish_19"] = bool(
        result["source_commit_check_passed"]
        and result["identity_check_passed"]
        and result["nnue_file_check_passed"]
        and result["bench_signature_passed"]
    )
    payload = json.dumps(result, indent=2) + "\\n"
    output.write_text(payload, encoding="utf-8")
    print(payload, end="")
    return 0 if result["verified_as_stockfish_19"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
