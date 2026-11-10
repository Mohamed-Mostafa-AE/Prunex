#!/usr/bin/env python3
"""Integration test for legal PGN replay, sound-enabled HTML, and MP4 audio."""
from __future__ import annotations
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
import chess
import chess.pgn

ROOT = Path(__file__).parents[1]
BUILDER = ROOT / "tools" / "stockfish-2.0-match" / "build_replay_viewer.py"
RENDERER = ROOT / "tools" / "stockfish-2.0-match" / "render_evidence.py"


class ReplayEvidenceTests(unittest.TestCase):
    def write_sample(self, path: Path):
        records = [
            ("0-1", "Fool's Mate", ["f3", "e5", "g4", "Qh4#"], "White"),
            ("1-0", "Scholar's Mate", ["e4", "e5", "Bc4", "Nc6", "Qh5", "Nf6", "Qxf7#"], "Black"),
        ]
        with path.open("w", encoding="utf-8") as output:
            for result, opening, sans, color in records:
                game = chess.pgn.Game()
                game.headers.update({"Opening": opening, "Result": result,
                                     "PrunexColor": color, "Repetition": "1",
                                     "Termination": "Checkmate"})
                node, board = game, game.board()
                for san in sans:
                    move = board.parse_san(san)
                    board.push(move)
                    node = node.add_variation(move)
                output.write(str(game) + "\n\n")

    def test_legal_records_generate_sound_html_and_audio_mp4(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            pgn = root / "sample.pgn"
            html = root / "replay.html"
            evidence = root / "evidence"
            self.write_sample(pgn)
            subprocess.run([sys.executable, str(BUILDER), "--pgn", str(pgn),
                            "--out", str(html), "--expected-games", "2"],
                           cwd=ROOT, check=True, capture_output=True, text=True)
            page = html.read_text(encoding="utf-8")
            for phrase in ("Classic wooden tap", "Soft felt tap", "Quiet click",
                           "Enable website-style move sounds", "Fool's Mate", "Qh4#"):
                self.assertIn(phrase, page)
            self.assertNotIn("__PRUNEX_REPLAY_DATA__", page)

            result = subprocess.run([sys.executable, str(RENDERER), "--pgn", str(pgn),
                                     "--out", str(evidence), "--fps", "3",
                                     "--expected-games", "2"],
                                    cwd=ROOT, check=True, capture_output=True, text=True)
            self.assertIn("Verified 2 legal PGN games", result.stdout)
            video = evidence / "64-game-replay.mp4"
            self.assertTrue(video.is_file())
            self.assertTrue((evidence / "64-game-final-positions.png").is_file())
            self.assertTrue((evidence / "replay.html").is_file())
            probe = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "a:0",
                                    "-show_entries", "stream=codec_name",
                                    "-of", "default=noprint_wrappers=1:nokey=1", str(video)],
                                   check=True, capture_output=True, text=True)
            self.assertTrue(probe.stdout.strip(), "MP4 must contain a move-sound audio stream.")

    def test_unfinished_pgn_is_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            pgn = Path(temp) / "unfinished.pgn"
            game = chess.pgn.Game()
            pgn.write_text(str(game) + "\n", encoding="utf-8")
            result = subprocess.run([sys.executable, str(BUILDER), "--pgn", str(pgn),
                                     "--out", str(Path(temp) / "replay.html"),
                                     "--expected-games", "1"],
                                    cwd=ROOT, capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("unfinished", result.stderr)


if __name__ == "__main__":
    unittest.main(verbosity=2)
