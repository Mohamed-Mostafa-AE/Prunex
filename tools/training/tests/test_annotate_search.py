from __future__ import annotations

import argparse
import importlib.util
import json
import os
import tempfile
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).parents[1] / "annotate_search.py"
SPEC = importlib.util.spec_from_file_location("annotate_search", MODULE_PATH)
assert SPEC and SPEC.loader
ANNOTATOR = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(ANNOTATOR)


class SearchInfoTests(unittest.TestCase):
    def test_parse_completed_search_info(self) -> None:
        parsed = ANNOTATOR.parse_search_info(
            "info depth 9 score cp -124 nodes 20480 nps 14000 pv e2e4"
        )
        self.assertEqual(parsed, {"depth": 9, "score_cp": -124, "nodes": 20480})

    def test_parse_mate_info(self) -> None:
        parsed = ANNOTATOR.parse_search_info("info depth 6 score mate -3 nodes 600 pv e2e4")
        self.assertEqual(parsed, {"depth": 6, "score_cp": -9997, "nodes": 600})

    def test_ignores_non_score_and_partial_info(self) -> None:
        self.assertIsNone(ANNOTATOR.parse_search_info("info depth 3 nodes 200"))
        self.assertIsNone(ANNOTATOR.parse_search_info("bestmove e2e4"))


class SearchAnnotationIntegrationTests(unittest.TestCase):
    def test_annotates_same_side_to_move_score_and_provenance(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            fake_engine = root / "fake-prunex"
            fake_engine.write_text(
                "#!/usr/bin/env python3\n"
                "import sys\n"
                "for raw in sys.stdin:\n"
                "    command = raw.strip()\n"
                "    if command == 'uci':\n"
                "        print('uciok', flush=True)\n"
                "    elif command == 'isready':\n"
                "        print('readyok', flush=True)\n"
                "    elif command.startswith('go movetime '):\n"
                "        print('info depth 7 score cp 86 nodes 12345 nps 4000 pv e2e4', flush=True)\n"
                "        print('bestmove e2e4', flush=True)\n"
                "    elif command == 'quit':\n"
                "        break\n",
                encoding="utf-8",
            )
            fake_engine.chmod(0o755)
            source = root / "positions.jsonl"
            source.write_text(json.dumps({
                "game_id": "game-001",
                "split": "train",
                "fen": "startpos",
                "result_for_side_to_move": 1.0,
                "side_to_move": "w",
            }) + "\n", encoding="utf-8")
            output = root / "annotated.jsonl"

            args = argparse.Namespace(
                engine=str(fake_engine),
                input=str(source),
                output=str(output),
                engine_version="Prunex test build",
                movetime_ms=15000,
                timeout=20.0,
                max_positions=0,
                overwrite=False,
            )
            self.assertEqual(ANNOTATOR.annotate(args), 0)
            row = json.loads(output.read_text(encoding="utf-8").splitlines()[0])
            self.assertEqual(row["prunex_search_score_cp"], 86)
            self.assertEqual(row["prunex_search_score_pov"], "side_to_move")
            self.assertEqual(row["search_budget_ms"], 15000)
            self.assertEqual(row["search_depth"], 7)
            self.assertEqual(row["search_nodes"], 12345)
            self.assertEqual(row["native_engine_version"], "Prunex test build")
            self.assertEqual(len(row["native_engine_sha256"]), 64)
            self.assertEqual(row["result_for_side_to_move"], 1.0)

    def test_rejects_position_without_game_level_result(self) -> None:
        row = {"game_id": "game-001", "split": "train", "fen": "startpos"}
        with self.assertRaisesRegex(ValueError, "result_for_side_to_move"):
            ANNOTATOR.validate_input_row(row, 1)


if __name__ == "__main__":
    unittest.main()
