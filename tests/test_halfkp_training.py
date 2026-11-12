#!/usr/bin/env python3
"""End-to-end smoke test for Prunex HalfKP training and native loading."""

from __future__ import annotations

import hashlib
import importlib.util
import json
import math
import random
import subprocess
import sys
import tempfile
from pathlib import Path

import chess
import torch

ROOT = Path(__file__).resolve().parents[1]
TRAINER = ROOT / "tools" / "training" / "train_halfkp.py"
TRAINER_SPEC = importlib.util.spec_from_file_location("prunex_halfkp_trainer", TRAINER)
if TRAINER_SPEC is None or TRAINER_SPEC.loader is None:
    raise RuntimeError("Could not load the Prunex HalfKP trainer module")
TRAINER_MODULE = importlib.util.module_from_spec(TRAINER_SPEC)
TRAINER_SPEC.loader.exec_module(TRAINER_MODULE)
SEED = "prunex-halfkp-ci-fixture-v1"


def position_id(fen: str) -> str:
    return hashlib.sha256(" ".join(fen.split()[:2]).encode("utf-8")).hexdigest()


def split_name(identifier: str) -> str:
    digest = hashlib.sha256(f"{SEED}:{identifier}".encode("utf-8")).hexdigest()
    bucket = int(digest[:16], 16) % 10_000
    return "train" if bucket < 8_000 else "validation" if bucket < 9_000 else "test"


def make_fixture(directory: Path, count: int = 16) -> None:
    rows = {"train": [], "validation": [], "test": []}
    seen: set[str] = set()
    rng = random.Random(20261112)

    for attempt in range(50_000):
        if all(len(values) >= count for values in rows.values()):
            break
        board = chess.Board()
        for _ in range(rng.randint(4, 32)):
            if board.is_game_over(claim_draw=True):
                break
            board.push(rng.choice(list(board.legal_moves)))
        if board.is_game_over(claim_draw=True) or not board.is_valid():
            continue
        fen = board.fen()
        identifier = position_id(fen)
        split = split_name(identifier)
        if identifier in seen or len(rows[split]) >= count:
            continue
        seen.add(identifier)
        rows[split].append({
            "schema_version": 1,
            "label_kind": "teacher_centipawn_evaluation",
            "position_id": identifier,
            "fen": fen,
            "score_cp": rng.randint(-600, 600),
            "score_perspective": "side-to-move",
            "source_score_cp": 0,
            "source_score_perspective": "white",
            "teacher_depth": 20,
            "teacher_knodes": 2000,
            "source": {
                "name": "Lichess Open Database — Evaluations (CI fixture)",
                "url": "https://database.lichess.org/",
                "license": "CC0-1.0",
                "license_url": "https://creativecommons.org/publicdomain/zero/1.0/",
            },
            "split": split,
            "source_record_line": attempt + 1,
        })
    else:
        raise RuntimeError("Could not generate a balanced fixture for all splits")

    outputs = {}
    for split, values in rows.items():
        path = directory / f"positions-{split}.jsonl"
        path.write_text(
            "".join(json.dumps(row, separators=(",", ":")) + "\n" for row in values),
            encoding="utf-8",
        )
        data = path.read_bytes()
        outputs[split] = {
            "file": path.name,
            "sha256": hashlib.sha256(data).hexdigest(),
            "bytes": len(data),
        }

    manifest = {
        "manifest_version": 1,
        "dataset_name": "prunex-halfkp-ci-fixture",
        "source": {
            "license": "CC0-1.0",
            "score_schema_reference": "https://huggingface.co/datasets/Lichess/fishnet-evals",
        },
        "split": {
            "method": "SHA-256 HalfKP input identity (piece placement + side to move); duplicate feature positions share a split",
            "seed": SEED,
            "fractions": {"train": 0.80, "validation": 0.10, "test": 0.10},
            "counts": {key: len(value) for key, value in rows.items()},
        },
        "outputs": outputs,
    }
    (directory / "corpus-manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )


def test_factorized_weights_are_shared_and_coalesced() -> None:
    model = TRAINER_MODULE.PrunexHalfKP(hidden=8, dense1=4, dense2=4)
    factor_index = 17
    selected_king_bucket = 9
    selected_real_index = selected_king_bucket * 640 + factor_index

    with torch.no_grad():
        model.feature_weights.weight.zero_()
        model.factorized_weights.weight.zero_()
        model.factorized_weights.weight[factor_index, 0] = 32 / 127
        model.feature_weights.weight[selected_real_index, 0] = 12 / 127

    coalesced = model.coalesced_feature_weights()
    integer_weights = torch.round(coalesced[:, 0] * 127).to(torch.int16)

    for king_bucket in range(64):
        expected = 32 + (12 if king_bucket == selected_king_bucket else 0)
        actual = int(integer_weights[king_bucket * 640 + factor_index])
        if actual != expected:
            raise AssertionError(
                "P factor was not coalesced into its HalfKP bucket: "
                f"king bucket {king_bucket}, expected {expected}, got {actual}"
            )


def test_sparse_clipping_only_touches_updated_rows() -> None:
    model = TRAINER_MODULE.PrunexHalfKP(hidden=8, dense1=4, dense2=4)
    real_limit = TRAINER_MODULE.FEATURE_WEIGHT_LIMIT / 127.0

    with torch.no_grad():
        model.feature_weights.weight[7].fill_(1.0)
        model.feature_weights.weight[8].fill_(1.0)
        model.factorized_weights.weight[9].fill_(1.0)
        model.factorized_weights.weight[10].fill_(1.0)

    model.clamp_parameters(
        torch.tensor([7], dtype=torch.long),
        torch.tensor([9], dtype=torch.long),
    )

    if torch.any(model.feature_weights.weight[7].abs() > real_limit):
        raise AssertionError("Updated HalfKP row was not clipped")
    if torch.any(model.factorized_weights.weight[9].abs() > real_limit):
        raise AssertionError("Updated P row was not clipped")
    if not torch.all(model.feature_weights.weight[8] == 1.0):
        raise AssertionError("An untouched HalfKP row was modified")
    if not torch.all(model.factorized_weights.weight[10] == 1.0):
        raise AssertionError("An untouched P row was modified")

def read_until(process: subprocess.Popen, prefix: str) -> list[str]:
    captured: list[str] = []
    assert process.stdout is not None
    for _ in range(500):
        line = process.stdout.readline()
        if not line:
            break
        captured.append(line.rstrip("\r\n"))
        if line.startswith(prefix):
            return captured
    raise AssertionError(f"Engine did not emit {prefix!r}: {captured[-40:]}")


def main() -> int:
    if len(sys.argv) != 2:
        raise SystemExit("usage: test_halfkp_training.py PATH_TO_PRUNEX")
    test_factorized_weights_are_shared_and_coalesced()
    test_sparse_clipping_only_touches_updated_rows()

    engine = Path(sys.argv[1]).resolve()
    if not engine.is_file():
        raise FileNotFoundError(engine)

    with tempfile.TemporaryDirectory(prefix="prunex-halfkp-ci-") as temporary:
        work = Path(temporary)
        corpus = work / "corpus"
        corpus.mkdir()
        make_fixture(corpus)

        network = work / "prunex-ci-halfkp.nnue"
        subprocess.run([
            sys.executable, str(TRAINER),
            "--input-dir", str(corpus),
            "--output", str(network),
            "--device", "cpu",
            "--epochs", "1",
            "--batch-size", "4",
            "--learning-rate", "0.001",
            "--hidden", "8",
            "--dense1", "4",
            "--dense2", "4",
            "--train-limit", "12",
            "--validation-limit", "8",
            "--max-steps", "3",
            "--seed", "20261112",
        ], check=True, cwd=ROOT, timeout=180)

        report = json.loads(network.with_suffix(".nnue.json").read_text(encoding="utf-8"))
        if report["held_out_test"]["positions"] != 16:
            raise AssertionError("Held-out test split was not evaluated")
        if report["settings"]["global_steps"] != 3:
            raise AssertionError("Training step limit was not respected")
        if not network.with_suffix(".nnue.pt").is_file():
            raise AssertionError("PyTorch checkpoint was not written")
        if network.read_bytes()[:8] != b"PRUNEXQ1":
            raise AssertionError("Export does not use the Prunex network format")

        checkpoint = torch.load(
            network.with_suffix(".nnue.pt"),
            map_location="cpu",
            weights_only=True,
        )
        dimensions = checkpoint["dimensions"]
        model = TRAINER_MODULE.PrunexHalfKP(
            hidden=dimensions["hidden"],
            dense1=dimensions["dense1"],
            dense2=dimensions["dense2"],
        )
        model.load_state_dict(checkpoint["model"])
        model.eval()

        held_out_rows = [
            json.loads(line)
            for line in (corpus / "positions-test.jsonl").read_text(
                encoding="utf-8"
            ).splitlines()
            if line.strip()
        ]
        if len(held_out_rows) != 16:
            raise AssertionError("Expected 16 held-out positions for inference parity")

        expected_scores: list[tuple[str, int]] = []
        with torch.no_grad():
            for row in held_out_rows:
                white, black, stm_white = TRAINER_MODULE.halfkp_features(row["fen"])
                indices, offsets, stm, _ = TRAINER_MODULE.collate(
                    [(white, black, stm_white, row["score_cp"])],
                    torch.device("cpu"),
                )
                logit = float(model(indices, offsets, stm)[0].item())
                centipawns = logit * float(checkpoint["score_scale"])
                expected = (
                    math.floor(centipawns + 0.5)
                    if centipawns >= 0
                    else math.ceil(centipawns - 0.5)
                )
                expected_scores.append((row["fen"], expected))

        process = subprocess.Popen(
            [str(engine)],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT, text=True, bufsize=1,
        )

        def send(command: str) -> None:
            assert process.stdin is not None
            process.stdin.write(command + "\n")
            process.stdin.flush()

        try:
            send("uci")
            read_until(process, "uciok")
            send(f"setoption name EvalFile value {network}")
            send("isready")
            ready = read_until(process, "readyok")
            if not any("loaded Prunex NNUE evaluation" in line for line in ready):
                raise AssertionError(f"Native engine rejected the exported model: {ready}")

            for fen, expected in expected_scores:
                send(f"position fen {fen}")
                send("eval")
                evaluation = read_until(
                    process, "info string static evaluation cp "
                )
                line = next(
                    (
                        item for item in evaluation
                        if item.startswith("info string static evaluation cp ")
                    ),
                    None,
                )
                if line is None:
                    raise AssertionError(
                        f"Native engine did not report an evaluation for {fen}: "
                        f"{evaluation}"
                    )
                actual = int(line.rsplit(" ", 1)[1])
                if abs(actual - expected) > 1:
                    raise AssertionError(
                        "Python/native NNUE mismatch: "
                        f"expected {expected} cp, received {actual} cp "
                        f"for {fen}"
                    )

            send("position startpos")
            send("go depth 2")
            search = read_until(process, "bestmove ")
            if not any(line.startswith("info depth ") for line in search):
                raise AssertionError("Native search did not finish a depth with NNUE enabled")
        finally:
            try:
                send("quit")
            except (BrokenPipeError, OSError):
                pass
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=5)

    print(
        "HalfKP training/export/native-load and Python/native inference parity: passed"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
