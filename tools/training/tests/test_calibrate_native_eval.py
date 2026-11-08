from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "calibrate_native_eval.py"
SPEC = importlib.util.spec_from_file_location("calibrate_native_eval", SCRIPT)
assert SPEC and SPEC.loader
calibration = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = calibration
SPEC.loader.exec_module(calibration)

ENGINE_HASH = "a" * 64


def rows_for(split: str, prefix: str, games: int, positions_per_game: int = 5) -> list[dict]:
    rows = []
    for game_index in range(games):
        for position_index in range(positions_per_game):
            score = (position_index - (positions_per_game - 1) / 2) * 220 + (game_index % 3) * 15
            result = 1.0 if score >= 180 else 0.0 if score <= -180 else 0.5
            rows.append({
                "game_id": f"{prefix}-{game_index}",
                "score_cp": int(score),
                "result": result,
                "version": "Prunex 0.8.0",
                "binary_sha256": ENGINE_HASH,
            })
    return rows


def write_jsonl(path: Path, split: str, rows: list[dict]) -> None:
    with path.open("w", encoding="utf-8") as handle:
        for row in rows:
            item = {
                "game_id": row["game_id"],
                "split": split,
                "label_kind": calibration.EXPECTED_LABEL_KIND,
                "prunex_static_eval_cp": row["score_cp"],
                "prunex_static_eval_pov": "side_to_move",
                "result_for_side_to_move": row["result"],
                "native_engine_version": row["version"],
                "native_engine_sha256": row["binary_sha256"],
            }
            handle.write(json.dumps(item) + "\n")


class NativeEvaluationCalibrationTests(unittest.TestCase):
    def make_splits(self):
        return (
            rows_for("train", "train", 25),
            rows_for("validation", "validation", 5),
            rows_for("test", "test", 5),
        )

    def calibrate(self, splits):
        return calibration.calibrate(
            *splits,
            epochs=500,
            min_train_positions=100,
            min_eval_positions=20,
            min_train_games=20,
            min_eval_games=5,
        )

    def test_fits_only_train_and_reports_held_out_metrics(self):
        train, validation, test = self.make_splits()
        report = self.calibrate((train, validation, test))
        self.assertTrue(report["diagnostic_only"])
        self.assertEqual(report["native_engine_version"], "Prunex 0.8.0")
        self.assertEqual(report["native_engine_sha256"], ENGINE_HASH)
        self.assertGreater(report["slope"], 0)
        self.assertEqual(report["splits"]["train"]["games"], 25)
        self.assertEqual(report["splits"]["validation"]["games"], 5)
        self.assertIn("log_loss", report["splits"]["test"]["calibrated"])
        self.assertIn("brier_score", report["splits"]["test"]["raw_evaluation"])

    def test_rejects_game_leakage_between_splits(self):
        train, validation, test = self.make_splits()
        validation[0] = {**validation[0], "game_id": train[0]["game_id"]}
        with self.assertRaisesRegex(ValueError, "Game leakage"):
            self.calibrate((train, validation, test))

    def test_rejects_mixed_engine_binaries(self):
        train, validation, test = self.make_splits()
        test[0] = {**test[0], "binary_sha256": "b" * 64}
        with self.assertRaisesRegex(ValueError, "same native engine version and binary SHA-256"):
            self.calibrate((train, validation, test))

    def test_rejects_small_splits(self):
        train, validation, test = self.make_splits()
        with self.assertRaisesRegex(ValueError, "requires at least"):
            calibration.calibrate(
                train[:10], validation, test,
                min_train_positions=100, min_eval_positions=20,
                min_train_games=20, min_eval_games=5,
            )

    def test_jsonl_loader_checks_split_and_score_perspective(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "positions.jsonl"
            _, validation, _ = self.make_splits()
            write_jsonl(path, "validation", validation)
            loaded = calibration.read_split(path, "validation")
            self.assertEqual(len(loaded), 25)
            row = json.loads(path.read_text(encoding="utf-8").splitlines()[0])
            row["prunex_static_eval_pov"] = "white"
            path.write_text(json.dumps(row) + "\n", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "side-to-move perspective"):
                calibration.read_split(path, "validation")

    def test_writes_json_report_atomically(self):
        train, validation, test = self.make_splits()
        report = self.calibrate((train, validation, test))
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "reports" / "native-calibration.json"
            calibration.write_report(path, report)
            loaded = json.loads(path.read_text(encoding="utf-8"))
            self.assertEqual(loaded["model"], calibration.MODEL_NAME)
            self.assertTrue(loaded["diagnostic_only"])
            self.assertEqual(list(path.parent.iterdir()), [path])


if __name__ == "__main__":
    unittest.main()
