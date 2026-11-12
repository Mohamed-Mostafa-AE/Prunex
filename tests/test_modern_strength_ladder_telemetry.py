#!/usr/bin/env python3
"""Regression tests for the final UCI search telemetry parser."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools" / "strength-match"))

from modern_strength_ladder import configure_engine, parse_final_search_info


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

    class FakeOption:
        def __init__(self, minimum: int, maximum: int) -> None:
            self.min = minimum
            self.max = maximum

    class FakeEngine:
        id = {"name": "Test Engine"}
        options = {
            "Hash": FakeOption(1, 4096),
            "Threads": FakeOption(1, 256),
        }

        def __init__(self) -> None:
            self.configured = None

        def configure(self, values: dict[str, int]) -> None:
            self.configured = values

        def ping(self) -> None:
            pass

    engine = FakeEngine()
    configured = configure_engine(engine, 256, 1)
    if configured != {"Hash": 256, "Threads": 1} or engine.configured != configured:
        raise AssertionError(f"Resource settings were not applied exactly: {configured!r}")

    class RestrictedEngine(FakeEngine):
        options = {
            "Hash": FakeOption(1, 128),
            "Threads": FakeOption(1, 1),
        }

    try:
        configure_engine(RestrictedEngine(), 256, 1)
    except RuntimeError as exc:
        if "Hash=256" not in str(exc):
            raise
    else:
        raise AssertionError("The comparison must reject silently reduced Hash settings")

    try:
        class MissingOptionEngine(FakeEngine):
            options = {"Threads": FakeOption(1, 1)}
        configure_engine(MissingOptionEngine(), 256, 1)
    except RuntimeError as exc:
        if "Hash" not in str(exc):
            raise
    else:
        raise AssertionError("The comparison must require a Hash option")

    print("Final UCI telemetry and strict resource configuration: 6 checks passed")


if __name__ == "__main__":
    main()
