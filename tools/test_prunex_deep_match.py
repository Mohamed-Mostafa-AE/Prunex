import json
import tempfile
import unittest
from pathlib import Path

from prunex_deep_match import OPENINGS, make_opening, make_schedule, make_summary, read_results


class DeepMatchTests(unittest.TestCase):
    def test_openings_are_legal(self):
        for name, moves in OPENINGS:
            with self.subTest(opening=name):
                _, board = make_opening(name, moves)
                self.assertEqual(board.ply(), len(moves))

    def test_schedule_has_64_color_balanced_games(self):
        schedule = make_schedule()
        self.assertEqual(len(schedule), 64)
        self.assertEqual(sum(item["prunex_white"] for item in schedule), 32)
        self.assertEqual(sum(not item["prunex_white"] for item in schedule), 32)
        for opening_index in range(1, 17):
            games = [item for item in schedule if item["opening_index"] == opening_index]
            self.assertEqual(len(games), 4)
            self.assertEqual(sum(item["prunex_white"] for item in games), 2)

    def test_truncated_last_record_is_discarded(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "results.jsonl"
            valid = {"game_id": "O01-R1-W", "score": 1.0}
            path.write_text(json.dumps(valid) + "\n" + '{"game_id":', encoding="utf-8")
            self.assertEqual(read_results(path), [valid])
            self.assertEqual(path.read_text(encoding="utf-8"), json.dumps(valid) + "\n")

    def test_duplicate_game_ids_are_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "results.jsonl"
            record = {"game_id": "O01-R1-W", "score": 1.0}
            path.write_text(json.dumps(record) + "\n" + json.dumps(record) + "\n", encoding="utf-8")
            with self.assertRaises(RuntimeError):
                read_results(path)

    def test_summary_counts_partial_match(self):
        config = {
            "games": 64,
            "nodes_per_move": 1_000_000,
            "hash_mb_each": 256,
            "threads_each": 1,
            "openings": 16,
            "repeats": 2,
        }
        records = [
            {"score": 1.0, "prunex_color": "White"},
            {"score": 0.5, "prunex_color": "Black"},
            {"score": 0.0, "prunex_color": "White"},
        ]
        summary = make_summary(records, config, False)
        self.assertEqual(summary["completed_games"], 3)
        self.assertEqual(summary["wins"], 1)
        self.assertEqual(summary["draws"], 1)
        self.assertEqual(summary["losses"], 1)
        self.assertEqual(summary["points"], 1.5)
        self.assertEqual(summary["score_percent"], 50.0)
        self.assertEqual(summary["status"], "in progress")


if __name__ == "__main__":
    unittest.main(verbosity=2)
