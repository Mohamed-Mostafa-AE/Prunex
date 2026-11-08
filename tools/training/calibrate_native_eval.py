#!/usr/bin/env python3
"""Fit and evaluate a diagnostic calibration for native Prunex static scores.

This tool reads three separately annotated corpus splits. It never modifies the
engine, website calibration, or source dataset. Each game receives equal total
weight so longer games do not dominate the fit or reported metrics.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import re
import sys
import tempfile
from collections import Counter
from pathlib import Path
from typing import Iterable

MODEL_NAME = "native-static-evaluation-logistic-v1"
EXPECTED_LABEL_KIND = "observed_game_result_and_played_move"
EPSILON = 1e-12


def sigmoid(value: float) -> float:
    if value >= 0:
        return 1.0 / (1.0 + math.exp(-min(value, 40.0)))
    exp_value = math.exp(max(value, -40.0))
    return exp_value / (1.0 + exp_value)


def read_split(path: Path, expected_split: str) -> list[dict]:
    if not path.is_file():
        raise FileNotFoundError(f"{expected_split} split not found: {path}")
    rows: list[dict] = []
    with path.open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            if not line.strip():
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError as exc:
                raise ValueError(f"Invalid JSON in {path}, line {line_number}: {exc}") from exc
            if not isinstance(row, dict):
                raise ValueError(f"Expected a JSON object in {path}, line {line_number}.")
            if row.get("split") != expected_split:
                raise ValueError(
                    f"Unexpected split in {path}, line {line_number}: "
                    f"expected {expected_split!r}, got {row.get('split')!r}."
                )
            if row.get("label_kind") != EXPECTED_LABEL_KIND:
                raise ValueError(f"Unsupported label kind in {path}, line {line_number}.")
            game_id = row.get("game_id")
            if not isinstance(game_id, str) or not game_id.strip():
                raise ValueError(f"Missing game_id in {path}, line {line_number}.")
            score = row.get("prunex_static_eval_cp")
            if isinstance(score, bool) or not isinstance(score, int):
                raise ValueError(f"Invalid native centipawn score in {path}, line {line_number}.")
            if row.get("prunex_static_eval_pov") != "side_to_move":
                raise ValueError(f"Native score must use side-to-move perspective in {path}, line {line_number}.")
            result = row.get("result_for_side_to_move")
            if isinstance(result, bool) or not isinstance(result, (int, float)) or result not in (0, 0.5, 1):
                raise ValueError(f"Invalid side-to-move result in {path}, line {line_number}.")
            version = row.get("native_engine_version")
            binary_hash = row.get("native_engine_sha256")
            if not isinstance(version, str) or not version.strip():
                raise ValueError(f"Missing native engine version in {path}, line {line_number}.")
            if not isinstance(binary_hash, str) or not re.fullmatch(r"[0-9a-fA-F]{64}", binary_hash):
                raise ValueError(f"Invalid native engine SHA-256 in {path}, line {line_number}.")
            rows.append({
                "game_id": game_id,
                "score_cp": score,
                "result": float(result),
                "version": version,
                "binary_sha256": binary_hash.lower(),
            })
    if not rows:
        raise ValueError(f"The {expected_split} split is empty: {path}")
    return rows


def game_weights(rows: list[dict]) -> list[float]:
    counts = Counter(row["game_id"] for row in rows)
    return [1.0 / counts[row["game_id"]] for row in rows]


def weighted_mean(values: Iterable[float], weights: Iterable[float]) -> float:
    numerator = 0.0
    denominator = 0.0
    for value, weight in zip(values, weights):
        numerator += value * weight
        denominator += weight
    if denominator <= 0:
        raise ValueError("Cannot compute a weighted mean from an empty dataset.")
    return numerator / denominator


def fit_logistic(
    rows: list[dict], *, epochs: int = 4000, learning_rate: float = 0.015, l2: float = 0.0001
) -> tuple[float, float]:
    """Fit sigmoid(slope * (score_cp / 400) + intercept), weighting games equally."""
    if epochs < 1 or not math.isfinite(learning_rate) or learning_rate <= 0:
        raise ValueError("epochs and learning_rate must be positive.")
    if not math.isfinite(l2) or l2 < 0:
        raise ValueError("l2 must be finite and non-negative.")
    weights = game_weights(rows)
    weight_total = sum(weights)
    slope, intercept = 1.0, 0.0
    for epoch in range(epochs):
        slope_gradient = 0.0
        intercept_gradient = 0.0
        for row, weight in zip(rows, weights):
            x = max(-10.0, min(10.0, row["score_cp"] / 400.0))
            error = sigmoid(slope * x + intercept) - row["result"]
            slope_gradient += weight * error * x
            intercept_gradient += weight * error
        slope_gradient = slope_gradient / weight_total + l2 * (slope - 1.0)
        intercept_gradient /= weight_total
        rate = learning_rate / math.sqrt(1.0 + epoch / 250.0)
        slope = max(0.05, min(5.0, slope - rate * slope_gradient))
        intercept = max(-2.0, min(2.0, intercept - rate * intercept_gradient))
    return slope, intercept


def score_metrics(rows: list[dict], slope: float, intercept: float) -> dict:
    weights = game_weights(rows)
    outcomes = [row["result"] for row in rows]
    predictions = [
        sigmoid(slope * max(-10.0, min(10.0, row["score_cp"] / 400.0)) + intercept)
        for row in rows
    ]
    log_loss = weighted_mean([
        -(y * math.log(max(EPSILON, min(1.0 - EPSILON, p))) +
          (1.0 - y) * math.log(max(EPSILON, min(1.0 - EPSILON, 1.0 - p)))
        )
        for y, p in zip(outcomes, predictions)
    ], weights)
    brier = weighted_mean([(p - y) ** 2 for p, y in zip(predictions, outcomes)], weights)
    return {"log_loss": log_loss, "brier_score": brier}


def calibrate(
    train_rows: list[dict], validation_rows: list[dict], test_rows: list[dict], *,
    epochs: int = 4000, learning_rate: float = 0.015, l2: float = 0.0001,
    min_train_positions: int = 100, min_eval_positions: int = 20,
    min_train_games: int = 20, min_eval_games: int = 5,
) -> dict:
    splits = {"train": train_rows, "validation": validation_rows, "test": test_rows}
    for name, rows in splits.items():
        min_positions = min_train_positions if name == "train" else min_eval_positions
        min_games = min_train_games if name == "train" else min_eval_games
        games = {row["game_id"] for row in rows}
        if len(rows) < min_positions:
            raise ValueError(f"{name} split has {len(rows)} positions; requires at least {min_positions}.")
        if len(games) < min_games:
            raise ValueError(f"{name} split has {len(games)} games; requires at least {min_games}.")

    game_sets = {name: {row["game_id"] for row in rows} for name, rows in splits.items()}
    if (game_sets["train"] & game_sets["validation"] or
            game_sets["train"] & game_sets["test"] or
            game_sets["validation"] & game_sets["test"]):
        raise ValueError("Game leakage detected: game_id values must be disjoint across all three splits.")

    versions = {row["version"] for rows in splits.values() for row in rows}
    hashes = {row["binary_sha256"] for rows in splits.values() for row in rows}
    if len(versions) != 1 or len(hashes) != 1:
        raise ValueError("All splits must be annotated by the same native engine version and binary SHA-256.")

    slope, intercept = fit_logistic(train_rows, epochs=epochs, learning_rate=learning_rate, l2=l2)
    train_mean = weighted_mean(
        [row["result"] for row in train_rows], game_weights(train_rows)
    )
    constant = {
        "slope": 0.0,
        "intercept": math.log(max(EPSILON, train_mean) / max(EPSILON, 1.0 - train_mean)),
    }

    def split_report(rows: list[dict]) -> dict:
        return {
            "positions": len(rows),
            "games": len({row["game_id"] for row in rows}),
            "raw_evaluation": score_metrics(rows, 1.0, 0.0),
            "calibrated": score_metrics(rows, slope, intercept),
            "training_mean_baseline": score_metrics(rows, constant["slope"], constant["intercept"]),
        }

    return {
        "model": MODEL_NAME,
        "diagnostic_only": True,
        "target": "empirical_game_result_for_side_to_move",
        "score_perspective": "side_to_move",
        "formula": "sigmoid(slope * clamp(score_cp / 400, -10, 10) + intercept)",
        "slope": slope,
        "intercept": intercept,
        "training_weighting": "equal_total_weight_per_game",
        "native_engine_version": next(iter(versions)),
        "native_engine_sha256": next(iter(hashes)),
        "splits": {
            "train": {"positions": len(train_rows), "games": len(game_sets["train"])},
            "validation": split_report(validation_rows),
            "test": split_report(test_rows),
        },
        "note": (
            "This report evaluates score calibration only; it does not train or modify "
            "the engine and does not establish playing strength."
        ),
    }


def write_report(path: Path, report: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary_name = tempfile.mkstemp(prefix=path.name + ".", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as handle:
            json.dump(report, handle, indent=2, ensure_ascii=False, allow_nan=False)
            handle.write("\n")
        os.replace(temporary_name, path)
    except Exception:
        try:
            os.unlink(temporary_name)
        except FileNotFoundError:
            pass
        raise


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--train", required=True, type=Path, help="Annotated positions-train JSONL")
    parser.add_argument("--validation", required=True, type=Path, help="Annotated positions-validation JSONL")
    parser.add_argument("--test", required=True, type=Path, help="Annotated positions-test JSONL")
    parser.add_argument("--output", required=True, type=Path, help="Diagnostic JSON report path")
    parser.add_argument("--epochs", type=int, default=4000)
    parser.add_argument("--learning-rate", type=float, default=0.015)
    parser.add_argument("--l2", type=float, default=0.0001)
    parser.add_argument("--min-train-positions", type=int, default=100)
    parser.add_argument("--min-eval-positions", type=int, default=20)
    parser.add_argument("--min-train-games", type=int, default=20)
    parser.add_argument("--min-eval-games", type=int, default=5)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    try:
        for value, label in ((args.min_train_positions, "min-train-positions"),
                             (args.min_eval_positions, "min-eval-positions"),
                             (args.min_train_games, "min-train-games"),
                             (args.min_eval_games, "min-eval-games")):
            if value < 1:
                raise ValueError(f"{label} must be at least 1.")
        train = read_split(args.train, "train")
        validation = read_split(args.validation, "validation")
        test = read_split(args.test, "test")
        report = calibrate(
            train, validation, test,
            epochs=args.epochs, learning_rate=args.learning_rate, l2=args.l2,
            min_train_positions=args.min_train_positions,
            min_eval_positions=args.min_eval_positions,
            min_train_games=args.min_train_games,
            min_eval_games=args.min_eval_games,
        )
        write_report(args.output, report)
        print(json.dumps({"output": str(args.output), **report}, indent=2))
        return 0
    except (OSError, ValueError, TimeoutError) as exc:
        print(f"Native evaluation calibration failed: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
