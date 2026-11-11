#!/usr/bin/env python3
"""End-to-end tests for the modern strength-ladder replay and media pipeline."""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import chess
import chess.pgn

ROOT = Path(__file__).parents[1]
REPLAY_DIR = ROOT / "tools" / "strength-match" / "replay"
BUILDER = REPLAY_DIR / "build_replay_viewer.py"
RENDERER = REPLAY_DIR / "render_evidence.py"
LADDER_RENDERER = REPLAY_DIR / "render_ladder.py"

OPENINGS = [
    ("0-1", "f3 e5 g4 Qh4#", "white"),
    ("1-0", "e4 e5 Bc4 Nc6 Qh5 Nf6 Qxf7#", "black"),
]


def write_sample_pgn(path: Path, games: int = 2) -> None:
    with path.open("w", encoding="utf-8") as output:
        for index in range(games):
            result, san_line, prunex_color = OPENINGS[index % len(OPENINGS)]
            game = chess.pgn.Game()
            game.headers.update({
                "Event": "Prunex strength ladder: nodes-100000",
                "White": "Prunex" if prunex_color == "white" else "Test opponent",
                "Black": "Test opponent" if prunex_color == "white" else "Prunex",
                "Opening": "Test position",
                "OpeningMoves": "reproducible test line",
                "ResourceTier": "nodes-100000",
                "PrunexColor": prunex_color,
                "Result": result,
                "Termination": "Checkmate",
            })
            board = game.board()
            node = game
            for san in san_line.split():
                move = board.parse_san(san)
                board.push(move)
                node = node.add_variation(move)
            output.write(str(game) + "\n\n")


class ReplayEvidenceTests(unittest.TestCase):
    def test_offline_replay_has_recorded_moves_and_sound_controls(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            pgn = root / "sample.pgn"
            replay = root / "replay.html"
            write_sample_pgn(pgn)
            subprocess.run(
                [
                    sys.executable, str(BUILDER),
                    "--pgn", str(pgn),
                    "--out", str(replay),
                    "--expected-games", "2",
                    "--match-label", "Stockfish 19 · 100k nodes",
                ],
                cwd=ROOT,
                check=True,
                capture_output=True,
                text=True,
            )
            page = replay.read_text(encoding="utf-8")
            for phrase in (
                "Classic wooden tap",
                "Soft felt tap",
                "Quiet click",
                "Enable website-style move sounds",
                "Qh4#",
                "Stockfish 19",
                "nodes-100000",
            ):
                self.assertIn(phrase, page)
            self.assertNotIn("__PRUNEX_REPLAY_DATA__", page)

    def test_mp4_has_audio_track_and_poster_is_rendered(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            pgn = root / "sample.pgn"
            output = root / "rendered"
            write_sample_pgn(pgn)
            subprocess.run(
                [
                    sys.executable, str(RENDERER),
                    "--pgn", str(pgn),
                    "--out", str(output),
                    "--fps", "3",
                    "--expected-games", "2",
                    "--match-label", "Stockfish 19 · 100k nodes",
                ],
                cwd=ROOT,
                check=True,
            )
            video = output / "replay.mp4"
            self.assertTrue(video.is_file())
            self.assertTrue((output / "final-positions.png").is_file())
            self.assertTrue((output / "replay.html").is_file())
            probe = subprocess.run(
                [
                    "ffprobe", "-v", "error", "-select_streams", "a:0",
                    "-show_entries", "stream=codec_name",
                    "-of", "default=noprint_wrappers=1:nokey=1",
                    str(video),
                ],
                check=True,
                capture_output=True,
                text=True,
            )
            self.assertEqual(probe.stdout.strip(), "aac")

    def test_six_stage_archive_index_and_checksums(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "source" / "strength-ladder-results"
            output = root / "archive"
            opponents = ("stockfish-19", "triumviratus-8.1")
            tiers = ("nodes-100000", "nodes-1000000", "timed-no-node-cap")
            rows = []

            for opponent in opponents:
                for tier in tiers:
                    stage = source / opponent / tier
                    stage.mkdir(parents=True)
                    write_sample_pgn(stage / "games.pgn", games=2)
                    summary = {
                        "games": 2,
                        "candidate_wins": 1,
                        "draws": 0,
                        "candidate_losses": 1,
                        "candidate_score_percent": 50.0,
                    }
                    (stage / "summary.json").write_text(
                        json.dumps(summary), encoding="utf-8"
                    )
                    (stage / "per-move.jsonl").write_text(
                        '{"san":"e4"}\n', encoding="utf-8"
                    )
                    rows.append({
                        "opponent": opponent,
                        "tier": tier,
                        "games": 2,
                        "wins": 1,
                        "draws": 0,
                        "losses": 1,
                        "score_percent": 50.0,
                    })

            (source / "report.json").write_text(
                json.dumps({"total_games": 12, "results": rows}),
                encoding="utf-8",
            )
            (source / "manifest.json").write_text(
                json.dumps({"candidate_commit": "test-commit"}),
                encoding="utf-8",
            )
            (source / "openings.json").write_text("[]", encoding="utf-8")

            subprocess.run(
                [
                    sys.executable, str(LADDER_RENDERER),
                    "--input", str(root / "source"),
                    "--out", str(output),
                    "--expected-games", "2",
                    "--expected-total-games", "12",
                    "--fps", "3",
                    "--source-run-id", "12345",
                ],
                cwd=ROOT,
                check=True,
            )
            index = (output / "index.html").read_text(encoding="utf-8")
            self.assertEqual(index.count(">Replay</a>"), 6)
            self.assertTrue((output / "SHA256SUMS.txt").is_file())
            self.assertEqual(
                len(list((output / "replays").rglob("replay.mp4"))),
                6,
            )
            subprocess.run(
                ["sha256sum", "--check", "SHA256SUMS.txt"],
                cwd=output,
                check=True,
                capture_output=True,
                text=True,
            )


if __name__ == "__main__":
    unittest.main(verbosity=2)
