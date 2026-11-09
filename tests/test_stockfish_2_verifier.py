#!/usr/bin/env python3
"""Unit tests for the historical Stockfish 2.0 bench-log parser."""
from __future__ import annotations

import importlib.util
from pathlib import Path
import unittest

MODULE_PATH = Path(__file__).parents[1] / "tools" / "stockfish-2.0-match" / "verify_stockfish_2.py"
spec = importlib.util.spec_from_file_location("verify_stockfish_2", MODULE_PATH)
assert spec and spec.loader
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class Stockfish20BenchParserTests(unittest.TestCase):
    def test_parses_sixteen_position_totals_and_expected_signature(self) -> None:
        values = [451_518] + [451_523] * 15
        fixture = "Stockfish 2.0 benchmark log\n" + "\n".join(f"Nodes: {value:,}" for value in values)
        parsed = module.parse_position_node_counts(fixture)
        self.assertEqual(len(parsed), 16)
        self.assertEqual(sum(parsed), 7_224_363)

    def test_ignores_nodes_per_second_and_other_unrelated_lines(self) -> None:
        fixture = "Nodes/second: 12345\nNodes searched : 999\nNodes: 1,234\n"
        self.assertEqual(module.parse_position_node_counts(fixture), [1234])

    def test_parses_historical_console_summary_spacing(self) -> None:
        self.assertEqual(module.parse_bench_summary("Nodes searched  : 7,224,363\n"), 7_224_363)

    def test_missing_position_records_do_not_synthesize_a_signature(self) -> None:
        parsed = module.parse_position_node_counts("Nodes: 7,224,363\n")
        self.assertEqual(len(parsed), 1)
        self.assertNotEqual(len(parsed), module.EXPECTED_POSITIONS)


if __name__ == "__main__":
    unittest.main(verbosity=2)
