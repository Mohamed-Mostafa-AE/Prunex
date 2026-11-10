#!/usr/bin/env python3
"""Test the strict Prunex cap and bounded Stockfish 2.0 polling allowance."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools" / "stockfish-2.0-match"))

from run_match import (  # noqa: E402
    STOCKFISH_2_NODE_POLL_INTERVAL,
    node_budget_allowance,
    validate_node_budget,
)


class MatchNodeBudgetTests(unittest.TestCase):
    def test_prunex_has_no_overshoot_allowance(self):
        self.assertEqual(node_budget_allowance("Prunex", 1_000_000), 0)
        self.assertEqual(validate_node_budget("Prunex", 1_000_000, 1_000_000, 1, 1), 0)

    def test_prunex_one_node_over_limit_is_rejected(self):
        with self.assertRaisesRegex(RuntimeError, "Prunex exceeded its node budget"):
            validate_node_budget("Prunex", 1_000_001, 1_000_000, 1, 1)

    def test_stockfish_2_polling_overshoot_within_documented_interval_is_accepted(self):
        allowance = validate_node_budget(
            "Stockfish 2.0", 1_000_800, 1_000_000, 1, 2
        )
        self.assertEqual(allowance, 1_000)
        self.assertEqual(allowance, STOCKFISH_2_NODE_POLL_INTERVAL)

    def test_stockfish_2_overshoot_beyond_polling_interval_is_rejected(self):
        maximum = 1_000_000 + STOCKFISH_2_NODE_POLL_INTERVAL
        self.assertEqual(
            validate_node_budget("Stockfish 2.0", maximum, 1_000_000, 1, 2),
            STOCKFISH_2_NODE_POLL_INTERVAL,
        )
        with self.assertRaisesRegex(RuntimeError, "Stockfish 2.0 exceeded its node budget"):
            validate_node_budget("Stockfish 2.0", maximum + 1, 1_000_000, 1, 2)

    def test_polling_allowance_scales_down_for_small_node_limits(self):
        self.assertEqual(node_budget_allowance("Stockfish 2.0", 1_000), 1_000)
        self.assertEqual(
            validate_node_budget("Stockfish 2.0", 2_000, 1_000, 1, 2), 1_000
        )

    def test_missing_node_telemetry_is_rejected(self):
        with self.assertRaisesRegex(RuntimeError, "Missing or invalid node-count telemetry"):
            validate_node_budget("Prunex", None, 1_000_000, 1, 1)


if __name__ == "__main__":
    unittest.main(verbosity=2)
