#!/usr/bin/env python3
"""Regression tests for the Stockfish 2.0 verification helper."""
from __future__ import annotations
import importlib.util
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).parents[1]
MODULE_PATH = ROOT / "tools" / "stockfish-2.0-match" / "verify_stockfish_2.py"
spec = importlib.util.spec_from_file_location("verify_stockfish_2", MODULE_PATH)
assert spec and spec.loader
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class Stockfish20VerifierTests(unittest.TestCase):
    def test_real_build_uses_console_signature_and_preserves_48_node_delta(self):
        counts = [158071, 1474552, 203643, 648048, 156596, 564678, 614250, 677505,
                  331919, 215045, 465151, 509624, 734249, 262320, 94733, 113931]
        self.assertEqual(len(counts), 16)
        self.assertEqual(sum(counts), 7_224_315)
        result = module.assess_bench(counts, 7_224_363, True)
        self.assertTrue(result["bench_signature_passed"])
        self.assertEqual(result["bench_log_console_delta"], 48)

    def test_wrong_console_total_fails(self):
        self.assertFalse(module.assess_bench([451518] + [451523] * 15, 7_224_362, True)["bench_signature_passed"])

    def test_missing_position_records_fails(self):
        self.assertFalse(module.assess_bench([7_224_363], 7_224_363, True)["bench_signature_passed"])

    def test_node_lines_are_not_confused_with_nps_or_console_summary(self):
        self.assertEqual(module.parse_position_node_counts(
            "Nodes/second: 12345\nNodes searched : 999\nNodes: 1,234\n"), [1234])
        self.assertEqual(module.parse_bench_summary("Nodes searched  : 7,224,363\n"), 7_224_363)

    def test_bench_stdin_pipe_remains_open_until_exit(self):
        child = "import select,sys; ready,_,_=select.select([sys.stdin],[],[],.15); print('EOF' if ready and sys.stdin.read(1)=='' else 'OPEN')"
        with tempfile.TemporaryDirectory() as temp:
            result = module.run_bench_keep_stdin_open([sys.executable, "-c", child], cwd=Path(temp), timeout=5)
        self.assertEqual(result.returncode, 0)
        self.assertIn("OPEN", result.stdout)


if __name__ == "__main__":
    unittest.main(verbosity=2)
