#!/usr/bin/env python3
"""Repeatable fixed-position Prunex performance comparison; no opponent engine."""

from __future__ import annotations

import argparse
import json
import platform
import re
import statistics
import subprocess
from pathlib import Path
from typing import Any

POSITION_RE = re.compile(
    r"^bench (?P<name>\S+) bestmove (?P<move>\S+) nodes (?P<nodes>\d+)$",
    re.MULTILINE,
)
TOTAL_RE = re.compile(
    r"^bench-total nodes (?P<nodes>\d+) time_ms (?P<time_ms>\d+) nps (?P<nps>\d+)$",
    re.MULTILINE,
)


def run_engine(executable: Path, depth: int) -> dict[str, Any]:
    completed = subprocess.run(
        [str(executable), "--bench", str(depth)],
        check=True,
        capture_output=True,
        text=True,
        timeout=600,
    )
    positions = [
        {
            "name": match.group("name"),
            "bestmove": match.group("move"),
            "nodes": int(match.group("nodes")),
        }
        for match in POSITION_RE.finditer(completed.stdout)
    ]
    total_match = TOTAL_RE.search(completed.stdout)
    if len(positions) != 5 or total_match is None:
        raise RuntimeError(
            f"Unexpected benchmark output from {executable}:\n{completed.stdout}"
        )
    total = {
        "nodes": int(total_match.group("nodes")),
        "time_ms": int(total_match.group("time_ms")),
        "nps": int(total_match.group("nps")),
    }
    if sum(item["nodes"] for item in positions) != total["nodes"]:
        raise RuntimeError("Per-position node counts do not sum to benchmark total")
    return {"positions": positions, "total": total}


def median_metric(samples: list[dict[str, Any]], key: str) -> float:
    return statistics.median(sample["total"][key] for sample in samples)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--baseline", required=True, type=Path)
    parser.add_argument("--candidate", required=True, type=Path)
    parser.add_argument("--baseline-commit", required=True)
    parser.add_argument("--candidate-commit", required=True)
    parser.add_argument("--depth", type=int, default=5)
    parser.add_argument("--runs", type=int, default=5)
    parser.add_argument("--output", type=Path, default=Path("internal-benchmark.json"))
    args = parser.parse_args()

    if not 1 <= args.depth <= 10:
        parser.error("--depth must be between 1 and 10")
    if not 3 <= args.runs <= 20:
        parser.error("--runs must be between 3 and 20")
    for executable in (args.baseline, args.candidate):
        if not executable.is_file():
            raise FileNotFoundError(executable)

    samples: dict[str, list[dict[str, Any]]] = {
        "baseline": [],
        "candidate": [],
    }
    # Alternate order to reduce systematic first-run or thermal bias.
    for index in range(args.runs):
        order = (
            (("baseline", args.baseline), ("candidate", args.candidate))
            if index % 2 == 0
            else (("candidate", args.candidate), ("baseline", args.baseline))
        )
        for label, executable in order:
            samples[label].append(run_engine(executable, args.depth))

    baseline_nps = median_metric(samples["baseline"], "nps")
    candidate_nps = median_metric(samples["candidate"], "nps")
    baseline_time = median_metric(samples["baseline"], "time_ms")
    candidate_time = median_metric(samples["candidate"], "time_ms")
    baseline_nodes = median_metric(samples["baseline"], "nodes")
    candidate_nodes = median_metric(samples["candidate"], "nodes")

    report = {
        "kind": "fixed-position-engine-performance-comparison",
        "opponent_games_run": False,
        "baseline_commit": args.baseline_commit,
        "candidate_commit": args.candidate_commit,
        "depth": args.depth,
        "positions": [item["name"] for item in samples["baseline"][0]["positions"]],
        "runs_per_engine": args.runs,
        "runner": platform.platform(),
        "python": platform.python_version(),
        "baseline": {
            "median_nodes": baseline_nodes,
            "median_time_ms": baseline_time,
            "median_nps": baseline_nps,
            "samples": samples["baseline"],
        },
        "candidate": {
            "median_nodes": candidate_nodes,
            "median_time_ms": candidate_time,
            "median_nps": candidate_nps,
            "samples": samples["candidate"],
        },
        "ratios": {
            "candidate_over_baseline_nps": (
                candidate_nps / baseline_nps if baseline_nps else None
            ),
            "candidate_over_baseline_nodes": (
                candidate_nodes / baseline_nodes if baseline_nodes else None
            ),
            "candidate_over_baseline_time": (
                candidate_time / baseline_time if baseline_time else None
            ),
        },
        "interpretation": (
            "Fixed-suite performance only. Different move ordering can change node "
            "counts. This result is not an Elo estimate or playing-strength claim."
        ),
    }
    args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
