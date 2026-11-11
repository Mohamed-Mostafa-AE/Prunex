#!/usr/bin/env python3
"""Unit tests for the pinned Stockfish 2.0 node-budget contract."""
from __future__ import annotations

import importlib.util
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
MATCH = ROOT / "tools" / "stockfish-2.0-match" / "run_match.py"
PATCH = ROOT / "tools" / "stockfish-2.0-match" / "patches" / "stockfish-2-node-budget.patch"

spec = importlib.util.spec_from_file_location("prunex_stockfish_match", MATCH)
assert spec and spec.loader
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class StockfishNodeBudgetTests(unittest.TestCase):
    def test_poll_interval_is_tighter_than_the_documented_hard_allowance(self):
        self.assertEqual(module.STOCKFISH_2_NODE_POLL_INTERVAL, 800)
        self.assertEqual(module.STOCKFISH_2_NODE_MAX_OVERSHOOT, 800)
        self.assertEqual(
            module.STOCKFISH_2_NODE_POLL_INTERVAL,
            module.STOCKFISH_2_NODE_MAX_OVERSHOOT,
        )

    def test_prunex_must_obey_the_requested_limit_exactly(self):
        self.assertEqual(module.validate_node_budget("Prunex", 1_000_000, 1_000_000, 1, 1), 0)
        with self.assertRaisesRegex(RuntimeError, "Prunex exceeded its node budget"):
            module.validate_node_budget("Prunex", 1_000_001, 1_000_000, 1, 2)

    def test_stockfish_can_use_only_the_explicit_bounded_allowance(self):
        self.assertEqual(
            module.validate_node_budget("Stockfish 2.0", 1_001_000, 1_000_000, 1, 1),
            1_000,
        )
        for reported_nodes in (1_000_801, 1_001_011):
            with self.subTest(reported_nodes=reported_nodes):
                with self.assertRaisesRegex(RuntimeError, "Stockfish 2.0 exceeded its node budget"):
                    module.validate_node_budget(
                        "Stockfish 2.0", reported_nodes, 1_000_000, 3, 86
                    )

    def test_polling_patch_covers_main_search_and_quiescence(self):
        patch = PATCH.read_text(encoding="utf-8")
        self.assertIn("+      NodesBetweenPolls = Min(MaxNodes, 799);", patch)
        self.assertIn("Quiescence can expand many nodes", patch)
        self.assertIn("+    if (StopRequest)", patch)
        self.assertGreaterEqual(patch.count("+    while (   !StopRequest"), 2)

    def test_missing_node_telemetry_and_unknown_engines_are_rejected(self):
        with self.assertRaisesRegex(RuntimeError, "Missing or invalid node-count telemetry"):
            module.validate_node_budget("Stockfish 2.0", None, 1_000_000, 1, 1)
        with self.assertRaisesRegex(ValueError, "Unknown engine"):
            module.node_budget_allowance("Unknown engine", 1_000_000)


if __name__ == "__main__":
    unittest.main(verbosity=2)
