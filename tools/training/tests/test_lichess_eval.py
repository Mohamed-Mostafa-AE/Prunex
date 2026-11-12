#!/usr/bin/env python3
"""Tests for the Lichess evaluation corpus importer."""

import importlib.util
import json
import tempfile
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "prepare_lichess_eval.py"
SPEC = importlib.util.spec_from_file_location("prepare_lichess_eval", SCRIPT)
assert SPEC is not None and SPEC.loader is not None
module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(module)


def main() -> None:
    fen_white = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -"
    fen_black = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq -"
    assert len(module.normalize_fen(fen_white).split()) == 6
    assert module.normalize_fen("invalid") is None

    selected = module.select_deepest_cp({
        "evals": [
            {"depth": 20, "knodes": 1000, "pvs": [{"cp": 25}]},
            {"depth": 24, "knodes": 800, "pvs": [{"cp": 35}]},
            {"depth": 24, "knodes": 1200, "pvs": [{"mate": 3}]},
        ]
    }, min_depth=16, min_knodes=500)
    assert selected == (24, 800, 35)

    first = module.split_for_position("abc", "seed")
    second = module.split_for_position("abc", "seed")
    assert first == second

    with tempfile.TemporaryDirectory() as temporary:
        root = Path(temporary)
        source = root / "sample.jsonl"
        records = [
            {"fen": fen_white, "evals": [{"depth": 30, "knodes": 2000, "pvs": [{"cp": 75}]}]},
            {"fen": fen_black, "evals": [{"depth": 30, "knodes": 2000, "pvs": [{"cp": 75}]}]},
            {"fen": fen_white, "evals": [{"depth": 30, "knodes": 2000, "pvs": [{"cp": 75}]}]},
        ]
        source.write_text("\n".join(json.dumps(row) for row in records) + "\n", encoding="utf-8")
        output = root / "out"
        import argparse
        args = argparse.Namespace(
            input=source, output_dir=output, dataset_name="test-fixture",
            source_url="https://database.lichess.org/",
            split_seed="unit-test", min_depth=1, min_knodes=0, max_abs_cp=2000,
            max_positions=0, downloaded_at=None, overwrite=False,
        )
        manifest = module.prepare(args)
        assert manifest["counters"]["positions_written"] == 2
        assert manifest["counters"]["duplicates"] == 1
        assert not list(output.glob("prunex-position-index-*"))
        rows = []
        for path in output.glob("positions-*.jsonl"):
            rows.extend(json.loads(line) for line in path.read_text(encoding="utf-8").splitlines())
        assert len(rows) == 2
        values = {row["side_to_move"] if "side_to_move" in row else row["fen"].split()[1]: row["score_cp"] for row in rows}
        assert values["w"] == 75
        assert values["b"] == -75
        assert (output / "corpus-manifest.json").is_file()

    print("Lichess evaluation importer: 5 groups of checks passed")


if __name__ == "__main__":
    main()
