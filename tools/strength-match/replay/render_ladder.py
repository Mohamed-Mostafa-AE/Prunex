#!/usr/bin/env python3
"""Validate and render all six PGN records from a completed modern ladder run."""
from __future__ import annotations

import argparse
import hashlib
import html
import json
import shutil
import subprocess
import sys
from pathlib import Path

STAGES = [
    ("stockfish-19", "nodes-100000"),
    ("stockfish-19", "nodes-1000000"),
    ("stockfish-19", "timed-no-node-cap"),
    ("triumviratus-8.1", "nodes-100000"),
    ("triumviratus-8.1", "nodes-1000000"),
    ("triumviratus-8.1", "timed-no-node-cap"),
]


def find_results_root(input_dir: Path) -> Path:
    candidates = [path.parent for path in input_dir.rglob("report.json")]
    if input_dir.is_file() and input_dir.name == "report.json":
        candidates.append(input_dir.parent)
    for candidate in candidates:
        if all(
            (candidate / opponent / tier / "games.pgn").is_file()
            for opponent, tier in STAGES
        ):
            return candidate
    raise FileNotFoundError(
        "Could not find report.json and all six opponent/tier PGN folders."
    )


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--expected-games", type=int, default=24)
    parser.add_argument("--expected-total-games", type=int, default=144)
    parser.add_argument("--fps", type=int, default=3)
    parser.add_argument("--source-run-id", default="unknown")
    args = parser.parse_args()

    source = find_results_root(Path(args.input))
    output = Path(args.out)
    if output.exists():
        shutil.rmtree(output)
    output.mkdir(parents=True)

    report = json.loads((source / "report.json").read_text(encoding="utf-8"))
    manifest = json.loads((source / "manifest.json").read_text(encoding="utf-8"))
    if report.get("total_games") != args.expected_total_games:
        raise ValueError(
            f"Expected {args.expected_total_games} match games; "
            f"report records {report.get('total_games')}."
        )
    if len(report.get("results", [])) != len(STAGES):
        raise ValueError("The match report must contain all six opponent/tier results.")

    for name in ("report.json", "manifest.json", "openings.json"):
        path = source / name
        if not path.is_file():
            raise FileNotFoundError(f"Missing match metadata: {name}")
        shutil.copy2(path, output / name)

    input_root = Path(args.input)
    provenance_candidates = [source.parent / "opponents", input_root / "opponents"]
    for provenance in provenance_candidates:
        if provenance.is_dir():
            shutil.copytree(
                provenance,
                output / "opponent-verification",
                dirs_exist_ok=True,
            )
            break

    rows = []
    for opponent, tier in STAGES:
        source_stage = source / opponent / tier
        pgn = source_stage / "games.pgn"
        summary_path = source_stage / "summary.json"
        telemetry = source_stage / "per-move.jsonl"
        for required in (pgn, summary_path, telemetry):
            if not required.is_file():
                raise FileNotFoundError(f"Missing evidence file: {required}")

        summary = json.loads(summary_path.read_text(encoding="utf-8"))
        if summary.get("games") != args.expected_games:
            raise ValueError(
                f"{opponent}/{tier}: expected {args.expected_games} completed games; "
                f"found {summary.get('games')}."
            )
        if (
            summary.get("candidate_wins", 0)
            + summary.get("draws", 0)
            + summary.get("candidate_losses", 0)
            != args.expected_games
        ):
            raise ValueError(f"{opponent}/{tier}: W/D/L counts do not sum to game total.")

        records_dir = output / "records" / opponent / tier
        records_dir.mkdir(parents=True, exist_ok=True)
        for file_path in (pgn, summary_path, telemetry):
            shutil.copy2(file_path, records_dir / file_path.name)

        label = f"{opponent.replace('-', ' ').title()} · {tier}"
        replay_dir = output / "replays" / opponent / tier
        subprocess.run(
            [
                sys.executable,
                str(Path(__file__).with_name("render_evidence.py")),
                "--pgn", str(pgn),
                "--out", str(replay_dir),
                "--fps", str(args.fps),
                "--expected-games", str(args.expected_games),
                "--match-label", label,
            ],
            check=True,
        )

        rows.append({
            "opponent": opponent,
            "tier": tier,
            "wins": summary["candidate_wins"],
            "draws": summary["draws"],
            "losses": summary["candidate_losses"],
            "score_percent": summary["candidate_score_percent"],
            "games": summary["games"],
        })

    table_rows = []
    for row in rows:
        key = f"{row['opponent']}/{row['tier']}"
        replay_base = f"replays/{key}"
        record_base = f"records/{key}"
        table_rows.append(
            "<tr>"
            f"<td>{html.escape(row['opponent'])}</td>"
            f"<td>{html.escape(row['tier'])}</td>"
            f"<td>{row['wins']}–{row['draws']}–{row['losses']}</td>"
            f"<td>{row['score_percent']:.2f}%</td>"
            f"<td><a href='{replay_base}/replay.html'>Replay</a> · "
            f"<a href='{replay_base}/replay.mp4'>MP4</a> · "
            f"<a href='{replay_base}/final-positions.png'>Poster</a></td>"
            f"<td><a href='{record_base}/games.pgn'>PGN</a> · "
            f"<a href='{record_base}/per-move.jsonl'>Telemetry</a> · "
            f"<a href='{record_base}/summary.json'>Summary</a></td>"
            "</tr>"
        )

    index_html = """<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Prunex · Strength Ladder Evidence</title>
<style>
body{margin:0;background:#091321;color:#eef4ff;font:16px/1.5 system-ui,sans-serif}
main{max-width:1100px;margin:40px auto;padding:0 22px}
h1{color:#58dec7}p{color:#b0bfd4}
table{width:100%;border-collapse:collapse;background:#12233a;border:1px solid #365473}
th,td{padding:12px;text-align:left;border-bottom:1px solid #29415c}
th{color:#58dec7;font-size:12px;text-transform:uppercase}
a{color:#8ec2ff}code{color:#f4d58d}
@media(max-width:760px){main{overflow-x:auto}table{min-width:850px}}
</style></head><body><main>
<h1>Prunex · Strength Ladder Evidence</h1>
<p>This archive contains the original PGNs, per-move telemetry, summaries, interactive
replays, sound-enabled MP4s, final-position posters, engine provenance and SHA-256 checksums.</p>
<p>Source workflow run: <code>RUN_ID</code> · Candidate commit: <code>CANDIDATE_COMMIT</code></p>
<table><thead><tr><th>Opponent</th><th>Tier</th><th>Prunex W–D–L</th><th>Score</th><th>Visuals</th><th>Raw evidence</th></tr></thead>
<tbody>ROWS</tbody></table>
<p>Board positions and moves are reconstructed from retained PGN records. The MP4 audio
uses the website's Classic wooden-tap profile. The offline replay also offers Classic,
Soft and Muted sound profiles.</p>
</main></body></html>
"""
    index_html = (
        index_html
        .replace("RUN_ID", html.escape(str(args.source_run_id)))
        .replace(
            "CANDIDATE_COMMIT",
            html.escape(str(manifest.get("candidate_commit", "unknown"))),
        )
        .replace("ROWS", "\n".join(table_rows))
    )
    (output / "index.html").write_text(index_html, encoding="utf-8")

    checksums = []
    for path in sorted(item for item in output.rglob("*") if item.is_file()):
        if path.name != "SHA256SUMS.txt":
            checksums.append(
                f"{sha256(path)}  {path.relative_to(output).as_posix()}"
            )
    (output / "SHA256SUMS.txt").write_text(
        "\n".join(checksums) + "\n",
        encoding="utf-8",
    )

    print(
        f"Rendered and validated {args.expected_total_games} games "
        f"across {len(STAGES)} opponent/tier stages."
    )
    print(f"Evidence index: {output / 'index.html'}")
    print(f"Checksums: {output / 'SHA256SUMS.txt'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
