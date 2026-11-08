from __future__ import annotations

import argparse
import json
import sys
import tempfile
import unittest
from pathlib import Path

import chess
import chess.pgn
import zstandard

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "tools" / "training"))
import ingest_pgn


def pgn_game(*, white: str, black: str, result: str, event: str = "Test Event", moves: str = "1. e4 e5 2. Nf3 Nc6") -> str:
    return f'''[Event "{event}"]
[Site "Test"]
[Date "2026.11.04"]
[Round "1"]
[White "{white}"]
[Black "{black}"]
[WhiteElo "1800"]
[BlackElo "1750"]
[TimeControl "600+5"]
[Result "{result}"]

{moves} {result}

'''


def args_for(input_path: Path, output_dir: Path, **overrides) -> argparse.Namespace:
    values = {
        "input": str(input_path),
        "output_dir": str(output_dir),
        "dataset_name": "test-corpus",
        "source_name": "Synthetic test PGN",
        "source_url": "https://example.invalid/synthetic",
        "license_id": "CC0-1.0",
        "license_url": "https://creativecommons.org/publicdomain/zero/1.0/",
        "attribution": "Synthetic test data",
        "downloaded_at": "2026-11-04",
        "seed": "test-seed",
        "split_group": "game",
        "sample_every": 1,
        "max_positions_per_game": 128,
        "max_games": 0,
        "overwrite": False,
    }
    values.update(overrides)
    return argparse.Namespace(**values)


class IngestPgnTests(unittest.TestCase):
    def test_standard_games_are_exported_with_side_to_move_result_labels(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "games.pgn"
            source.write_text(
                pgn_game(white="Alice", black="Bob", result="1-0"),
                encoding="utf-8",
            )
            output = root / "out"
            manifest = ingest_pgn.ingest(args_for(source, output))
            rows = [json.loads(line) for split in ("train", "validation", "test")
                    for line in (output / f"positions-{split}.jsonl").read_text().splitlines()]
            self.assertEqual(manifest["counts"]["accepted_games"], 1)
            self.assertEqual(manifest["counts"]["positions"], 4)
            self.assertEqual(len(rows), 4)
            by_ply = {row["ply"]: row for row in rows}
            self.assertEqual(by_ply[0]["result_for_side_to_move"], 1.0)
            self.assertEqual(by_ply[1]["result_for_side_to_move"], 0.0)
            self.assertEqual(by_ply[0]["side_to_move"], "w")
            self.assertEqual(by_ply[1]["side_to_move"], "b")
            self.assertEqual(by_ply[0]["played_move_uci"], "e2e4")
            self.assertTrue(by_ply[0]["game_id"])
            self.assertEqual(by_ply[0]["source"]["license"], "CC0-1.0")
            self.assertEqual(manifest["source"]["archive_sha256"], ingest_pgn.sha256_file(source))
            for split in ("train", "validation", "test"):
                output_file = output / f"positions-{split}.jsonl"
                self.assertEqual(manifest["split"]["files"][split]["sha256"], ingest_pgn.sha256_file(output_file))

    def test_exact_duplicate_mainlines_are_removed_even_if_headers_differ(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "duplicate.pgn"
            source.write_text(
                pgn_game(white="Alice", black="Bob", result="1-0") +
                pgn_game(white="Carol", black="Dave", result="1-0"),
                encoding="utf-8",
            )
            manifest = ingest_pgn.ingest(args_for(source, root / "out"))
            self.assertEqual(manifest["counts"]["raw_games"], 2)
            self.assertEqual(manifest["counts"]["accepted_games"], 1)
            self.assertEqual(manifest["counts"]["duplicate_games"], 1)

    def test_incomplete_invalid_and_variant_games_are_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            invalid = pgn_game(white="Alice", black="Bob", result="*", moves="1. e5")
            variant = pgn_game(white="Carol", black="Dave", result="1-0")
            variant = variant.replace('[Event "Test Event"]', '[Event "Variant"]\n[Variant "Crazyhouse"]')
            source = root / "invalid.pgn"
            source.write_text(invalid + variant, encoding="utf-8")
            manifest = ingest_pgn.ingest(args_for(source, root / "out"))
            self.assertEqual(manifest["counts"]["accepted_games"], 0)
            self.assertEqual(manifest["counts"]["rejected_games"], 2)
            self.assertEqual(manifest["counts"]["positions"], 0)

    def test_zstandard_archive_is_streamed(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "games.pgn.zst"
            raw = pgn_game(white="Alice", black="Bob", result="0-1").encode()
            source.write_bytes(zstandard.ZstdCompressor().compress(raw))
            manifest = ingest_pgn.ingest(args_for(source, root / "out"))
            self.assertEqual(manifest["counts"]["accepted_games"], 1)

    def test_event_grouping_keeps_same_event_in_one_split(self):
        seed = "deterministic"
        first = ingest_pgn.split_for_group("Tournament A", seed)
        second = ingest_pgn.split_for_group("Tournament A", seed)
        self.assertEqual(first, second)
        self.assertIn(first, {"train", "validation", "test"})

    def test_output_refuses_to_overwrite_without_explicit_flag(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "games.pgn"
            source.write_text(pgn_game(white="Alice", black="Bob", result="1-0"), encoding="utf-8")
            output = root / "out"
            ingest_pgn.ingest(args_for(source, output))
            with self.assertRaises(FileExistsError):
                ingest_pgn.ingest(args_for(source, output))


if __name__ == "__main__":
    unittest.main()
