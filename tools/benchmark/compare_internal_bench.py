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

FEN_POSITIONS = [
    ("starting-position", "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"),
    ("kiwipete", "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1"),
    ("rook-endgame", "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1"),
    ("closed-center", "r1bq1rk1/pp1n1ppp/2pbpn2/3p4/3P4/2NBPN2/PPQ1BPPP/R1R3K1 w - - 0 1"),
    ("open-position", "r2q1rk1/pp2bppp/2n1pn2/2pp4/3P4/2P1PN2/PP1NBPPP/R2Q1RK1 w - - 0 1"),
]
INFO_RE = re.compile(
    r"^info depth (?P<depth>\d+) score cp (?P<score>-?\d+) nodes (?P<nodes>\d+)"
)
FINAL_RE = re.compile(
    r"search-final nodes=(?P<nodes>\d+) depth=(?P<depth>\d+) "
    r"elapsed_ms=(?P<time_ms>\d+) tthits=(?P<tthits>\d+) "
    r"node_limit=(?P<node_limit>\d+)"
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


def run_node_suite(executable: Path, node_budget: int) -> dict[str, Any]:
    """Run each fixed FEN at an equal UCI node budget, in one process."""
    process = subprocess.Popen(
        [str(executable)],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )

    def send(command: str) -> None:
        if process.stdin is None:
            raise RuntimeError("Engine stdin is unavailable")
        process.stdin.write(command + "\n")
        process.stdin.flush()

    def read_until(prefix: str, transcript: list[str]) -> str:
        if process.stdout is None:
            raise RuntimeError("Engine stdout is unavailable")
        while True:
            line = process.stdout.readline()
            if line == "":
                raise RuntimeError(
                    f"Engine exited before {prefix!r}. Transcript:\n"
                    + "".join(transcript[-80:])
                )
            transcript.append(line)
            if line.startswith(prefix):
                return line.rstrip("\r\n")

    try:
        transcript: list[str] = []
        send("uci")
        read_until("uciok", transcript)
        send("isready")
        read_until("readyok", transcript)

        positions: list[dict[str, Any]] = []
        for name, fen in FEN_POSITIONS:
            transcript.clear()
            send("ucinewgame")
            send(f"position fen {fen}")
            send(f"go nodes {node_budget}")

            info_depth = 0
            info_score_cp: int | None = None
            final: dict[str, int] | None = None
            bestmove = None
            while bestmove is None:
                line = read_until_any = None
                if process.stdout is None:
                    raise RuntimeError("Engine stdout is unavailable")
                line = process.stdout.readline()
                if line == "":
                    raise RuntimeError(
                        f"Engine exited before bestmove for {name}. "
                        f"Transcript:\n{''.join(transcript[-80:])}"
                    )
                transcript.append(line)
                stripped = line.strip()
                info_match = INFO_RE.match(stripped)
                if info_match:
                    info_depth = int(info_match.group("depth"))
                    info_score_cp = int(info_match.group("score"))
                final_match = FINAL_RE.search(stripped)
                if final_match:
                    final = {key: int(value) for key, value in final_match.groupdict().items()}
                if stripped.startswith("bestmove "):
                    bestmove = stripped.split()[1]

            if final is None:
                raise RuntimeError(
                    f"Missing final search summary for {name}:\n"
                    + "".join(transcript[-80:])
                )
            if final["nodes"] > node_budget:
                raise RuntimeError(
                    f"{executable} exceeded equal-node budget on {name}: "
                    f"{final['nodes']}/{node_budget}"
                )
            positions.append({
                "name": name,
                "bestmove": bestmove,
                "completed_depth": final["depth"],
                "last_info_depth": info_depth,
                "score_cp_side_to_move": info_score_cp,
                "nodes": final["nodes"],
                "elapsed_ms": final["time_ms"],
                "tt_hits": final["tthits"],
                "requested_node_budget": final["node_limit"],
            })

        send("quit")
        process.wait(timeout=10)
        return {
            "node_budget_per_position": node_budget,
            "positions": positions,
            "median_completed_depth": statistics.median(
                item["completed_depth"] for item in positions
            ),
            "median_elapsed_ms": statistics.median(
                item["elapsed_ms"] for item in positions
            ),
            "total_nodes": sum(item["nodes"] for item in positions),
        }
    finally:
        if process.poll() is None:
            process.kill()
            process.wait(timeout=10)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--baseline", required=True, type=Path)
    parser.add_argument("--candidate", required=True, type=Path)
    parser.add_argument("--baseline-commit", required=True)
    parser.add_argument("--candidate-commit", required=True)
    parser.add_argument("--depth", type=int, default=5)
    parser.add_argument("--runs", type=int, default=5)
    parser.add_argument("--node-budget", type=int, default=200_000)
    parser.add_argument("--output", type=Path, default=Path("internal-benchmark.json"))
    args = parser.parse_args()

    if not 1 <= args.depth <= 10:
        parser.error("--depth must be between 1 and 10")
    if not 3 <= args.runs <= 20:
        parser.error("--runs must be between 3 and 20")
    if not 10_000 <= args.node_budget <= 5_000_000:
        parser.error("--node-budget must be between 10,000 and 5,000,000")
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

    # A complementary equal-node test compares completed search depth and score.
    # The depth benchmark alone gives engines different node budgets, while this
    # section fixes the per-position node cap to expose search-efficiency changes.
    node_samples: dict[str, list[dict[str, Any]]] = {
        "baseline": [],
        "candidate": [],
    }
    for index in range(args.runs):
        order = (
            (("baseline", args.baseline), ("candidate", args.candidate))
            if index % 2 == 0
            else (("candidate", args.candidate), ("baseline", args.baseline))
        )
        for label, executable in order:
            node_samples[label].append(run_node_suite(executable, args.node_budget))

    baseline_node_depth = statistics.median(
        item["median_completed_depth"] for item in node_samples["baseline"]
    )
    candidate_node_depth = statistics.median(
        item["median_completed_depth"] for item in node_samples["candidate"]
    )
    baseline_equal_time = statistics.median(
        item["median_elapsed_ms"] for item in node_samples["baseline"]
    )
    candidate_equal_time = statistics.median(
        item["median_elapsed_ms"] for item in node_samples["candidate"]
    )

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
        "equal_node_budget": {
            "node_budget_per_position": args.node_budget,
            "runs_per_engine": args.runs,
            "baseline": {
                "median_completed_depth": baseline_node_depth,
                "median_elapsed_ms": baseline_equal_time,
                "samples": node_samples["baseline"],
            },
            "candidate": {
                "median_completed_depth": candidate_node_depth,
                "median_elapsed_ms": candidate_equal_time,
                "samples": node_samples["candidate"],
            },
            "interpretation": (
                "This is an equal-node search-efficiency comparison. Completed "
                "depth and static scores are diagnostics, not playing-strength ratings."
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
