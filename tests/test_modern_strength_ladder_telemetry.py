#!/usr/bin/env python3
"""Regression tests for the final UCI search telemetry parser."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools" / "strength-match"))

from modern_strength_ladder import parse_final_search_info


def main() -> None:
    parsed = parse_final_search_info(
        "search-final nodes=987654 depth=11 elapsed_ms=502 tthits=12345 node_limit=1000000"
    )
    expected = {
        "nodes": 987654,
        "depth": 11,
        "elapsed_ms": 502,
        "tt_hits": 12345,
        "node_limit": 1000000,
    }
    if parsed != expected:
        raise AssertionError(f"final search info parsed incorrectly: {parsed!r}")

    if parse_final_search_info(None) is not None:
        raise AssertionError("missing final info must remain distinguishable")

    if parse_final_search_info("unrelated engine info") is not None:
        raise AssertionError("unrecognized engine info must not be interpreted as final counters")

    print("Final UCI search telemetry parser: 3 checks passed")


if __name__ == "__main__":
    main()
