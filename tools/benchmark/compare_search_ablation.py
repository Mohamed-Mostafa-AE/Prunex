#!/usr/bin/env python3
"""Compare Prunex search checkpoints on the same fixed suite."""

from __future__ import annotations

import argparse
import json
import platform
import statistics
import sys
from collections import Counter
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))
from compare_internal_bench import run_engine, run_node_suite


def median(values: list[float]) -> float:
    return statistics.median(values)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--variants", required=True, type=Path)
    parser.add_argument("--depth", type=int, default=5)
    parser.add_argument("--runs", type=int, default=3)
    parser.add_argument("--node-budget", type=int, default=200_000)
    parser.add_argument("--output", type=Path, default=Path("search-ablation.json"))
    args = parser.parse_args()

    if not 1 <= args.depth <= 10:
        parser.error("--depth must be between 1 and 10")
    if not 3 <= args.runs <= 10:
        parser.error("--runs must be between 3 and 10")
    if not 10_000 <= args.node_budget <= 5_000_000:
        parser.error("--node-budget must be between 10,000 and 5,000,000")

    variants = json.loads(args.variants.read_text(encoding="utf-8"))
    if not isinstance(variants, list) or len(variants) < 3:
        raise ValueError("The variants file must contain at least three engines.")

    labels: set[str] = set()
    for variant in variants:
        if not isinstance(variant, dict):
            raise ValueError("Each variant must be an object.")
        label = variant.get("label")
        binary = Path(variant.get("binary", "")).resolve()
        if not isinstance(label, str) or not label or label in labels:
            raise ValueError(f"Invalid or duplicate variant label: {label!r}")
        if not binary.is_file():
            raise FileNotFoundError(f"Engine executable not found: {binary}")
        labels.add(label)
        variant["binary"] = binary

    depth_runs: dict[str, list[dict[str, Any]]] = {
        item["label"]: [] for item in variants
    }
    node_runs: dict[str, list[dict[str, Any]]] = {
        item["label"]: [] for item in variants
    }

    # Rotate the run order so one build does not always receive the cold CPU.
    for run_index in range(args.runs):
        order = variants[run_index % len(variants):] + variants[:run_index % len(variants)]
        for item in order:
            label = item["label"]
            binary = item["binary"]
            depth_runs[label].append(run_engine(binary, args.depth))
            node_runs[label].append(run_node_suite(binary, args.node_budget))

    reports: dict[str, Any] = {}
    for item in variants:
        label = item["label"]
        depth_samples = depth_runs[label]
        node_samples = node_runs[label]
        per_position_depth: dict[str, list[int]] = {}
        per_position_scores: dict[str, list[int | None]] = {}
        per_position_moves: dict[str, list[str]] = {}
        for sample in node_samples:
            for position in sample["positions"]:
                name = position["name"]
                per_position_depth.setdefault(name, []).append(position["completed_depth"])
                if position["score_cp_side_to_move"] is not None:
                    per_position_scores.setdefault(name, []).append(position["score_cp_side_to_move"])
                per_position_moves.setdefault(name, []).append(position["bestmove"])

        reports[label] = {
            "commit": item["commit"],
            "binary": str(item["binary"]),
            "fixed_depth": {
                "median_nodes": median([sample["total"]["nodes"] for sample in depth_samples]),
                "median_time_ms": median([sample["total"]["time_ms"] for sample in depth_samples]),
                "median_nps": median([sample["total"]["nps"] for sample in depth_samples]),
                "samples": depth_samples,
            },
            "equal_node_budget": {
                "node_budget_per_position": args.node_budget,
                "median_completed_depth": median(
                    [sample["median_completed_depth"] for sample in node_samples]
                ),
                "median_time_ms": median(
                    [sample["median_elapsed_ms"] for sample in node_samples]
                ),
                "median_depth_by_position": {
                    name: median(values) for name, values in per_position_depth.items()
                },
                "median_score_cp_by_position": {
                    name: median(values) for name, values in per_position_scores.items()
                },
                "most_common_bestmove_by_position": {
                    name: Counter(values).most_common(1)[0][0]
                    for name, values in per_position_moves.items()
                },
                "samples": node_samples,
            },
        }

    baseline_label = variants[0]["label"]
    baseline = reports[baseline_label]
    comparisons = {}
    for item in variants[1:]:
        label = item["label"]
        candidate = reports[label]
        comparisons[label] = {
            "fixed_depth_nps_ratio": (
                candidate["fixed_depth"]["median_nps"]
                / baseline["fixed_depth"]["median_nps"]
            ),
            "fixed_depth_time_ratio": (
                candidate["fixed_depth"]["median_time_ms"]
                / baseline["fixed_depth"]["median_time_ms"]
            ),
            "equal_node_depth_delta": (
                candidate["equal_node_budget"]["median_completed_depth"]
                - baseline["equal_node_budget"]["median_completed_depth"]
            ),
            "equal_node_time_ratio": (
                candidate["equal_node_budget"]["median_time_ms"]
                / baseline["equal_node_budget"]["median_time_ms"]
            ),
        }

    report = {
        "kind": "prunex-search-ablation",
        "opponent_games_run": False,
        "baseline": baseline_label,
        "depth": args.depth,
        "runs_per_variant": args.runs,
        "node_budget_per_position": args.node_budget,
        "runner": platform.platform(),
        "variants": reports,
        "comparisons_to_baseline": comparisons,
        "interpretation": (
            "This is fixed-position search/performance diagnostics only. It is not "
            "an Elo estimate and does not establish playing-strength improvement."
        ),
    }
    args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
