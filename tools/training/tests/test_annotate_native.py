from __future__ import annotations

import importlib.util
import sys
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "annotate_native.py"
SPEC = importlib.util.spec_from_file_location("annotate_native", SCRIPT)
assert SPEC and SPEC.loader
annotate_native = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = annotate_native
SPEC.loader.exec_module(annotate_native)


class NativeAnnotationTests(unittest.TestCase):
    def test_parses_native_side_to_move_score(self):
        self.assertEqual(annotate_native.parse_eval_line("info string static evaluation cp 34"), 34)
        self.assertEqual(annotate_native.parse_eval_line("info string static evaluation cp -127"), -127)

    def test_ignores_non_evaluation_uci_lines(self):
        self.assertIsNone(annotate_native.parse_eval_line("readyok"))
        self.assertIsNone(annotate_native.parse_eval_line("bestmove e2e4"))

    def test_rejects_malformed_score(self):
        with self.assertRaises(ValueError):
            annotate_native.parse_eval_line("info string static evaluation cp winning")


if __name__ == "__main__":
    unittest.main()
