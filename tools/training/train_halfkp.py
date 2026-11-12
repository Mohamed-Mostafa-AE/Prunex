#!/usr/bin/env python3
"""Train and export an original Prunex HalfKP evaluation network."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import random
import struct
import tempfile
import time
from pathlib import Path
from typing import Iterator

import chess
import torch
from torch import Tensor, nn
from torch.nn import functional as F


FEATURE_COUNT = 64 * 64 * 5 * 2
NETWORK_MAGIC = b"PRUNEXN1"
NETWORK_VERSION = 1
DEFAULT_SCORE_SCALE = 400.0


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def halfkp_features(fen: str) -> tuple[list[int], list[int], bool]:
    """Return White and Black HalfKP feature indices for a standard position."""
    board = chess.Board(fen)
    if not board.is_valid():
        raise ValueError(f"Invalid chess position: {fen}")

    perspective_features: list[list[int]] = [[], []]
    for perspective in (chess.WHITE, chess.BLACK):
        king_square = board.king(perspective)
        if king_square is None:
            raise ValueError("Position must contain both kings")

        oriented_king = king_square if perspective == chess.WHITE else king_square ^ 56
        features = perspective_features[0 if perspective == chess.WHITE else 1]

        for square, piece in board.piece_map().items():
            if piece.piece_type == chess.KING:
                continue

            oriented_piece = square if perspective == chess.WHITE else square ^ 56
            relative_color = 0 if piece.color == perspective else 1
            piece_type = piece.piece_type - 1
            piece_slot = piece_type * 2 + relative_color
            feature_index = (oriented_king * 10 + piece_slot) * 64 + oriented_piece
            if not 0 <= feature_index < FEATURE_COUNT:
                raise ValueError(f"HalfKP feature index out of range: {feature_index}")
            features.append(feature_index)

    return (
        perspective_features[0],
        perspective_features[1],
        board.turn == chess.WHITE,
    )


def split_for_position(position_id: str, seed: str) -> str:
    bucket = int(hashlib.sha256((seed + ":" + position_id).encode("utf-8")).hexdigest()[:16], 16) % 10_000
    if bucket < 8_000:
        return "train"
    if bucket < 9_000:
        return "validation"
    return "test"


def verify_corpus(input_dir: Path) -> tuple[dict, str]:
    """Validate the importer manifest and output hashes before training."""
    manifest_path = input_dir / "corpus-manifest.json"
    if not manifest_path.is_file():
        raise FileNotFoundError(f"Corpus manifest is missing: {manifest_path}")

    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ValueError("Corpus manifest is not valid JSON") from exc

    source = manifest.get("source", {})
    split_info = manifest.get("split", {})
    outputs = manifest.get("outputs", {})
    if source.get("license") != "CC0-1.0":
        raise ValueError("This training pipeline currently accepts only the declared CC0 Lichess corpus")
    if source.get("score_schema_reference") != "https://huggingface.co/datasets/Lichess/fishnet-evals":
        raise ValueError("Unrecognized teacher-score schema reference")
    seed = split_info.get("seed")
    if not isinstance(seed, str) or not seed:
        raise ValueError("Corpus split seed is missing")
    if split_info.get("method") != "SHA-256 position hash bucketing; duplicate positions share a split":
        raise ValueError("Unrecognized corpus split method")

    for split in ("train", "validation", "test"):
        expected_name = f"positions-{split}.jsonl"
        entry = outputs.get(split)
        path = input_dir / expected_name
        if not isinstance(entry, dict) or entry.get("file") != expected_name:
            raise ValueError(f"Corpus manifest does not describe {expected_name}")
        if not path.is_file():
            raise FileNotFoundError(path)
        if entry.get("bytes") != path.stat().st_size:
            raise ValueError(f"Corpus size does not match manifest: {expected_name}")
        if entry.get("sha256") != sha256_file(path):
            raise ValueError(f"Corpus SHA-256 does not match manifest: {expected_name}")

    return manifest, seed


def read_examples(
    path: Path,
    split_seed: str,
    limit: int = 0,
) -> Iterator[tuple[list[int], list[int], bool, int]]:
    if not path.is_file():
        raise FileNotFoundError(path)

    yielded = 0
    with path.open("r", encoding="utf-8") as stream:
        for line_number, line in enumerate(stream, start=1):
            if not line.strip():
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError as exc:
                raise ValueError(f"Invalid JSON in {path}, line {line_number}") from exc

            if not isinstance(row, dict) or row.get("label_kind") != "teacher_centipawn_evaluation":
                raise ValueError(f"Unexpected row schema in {path}, line {line_number}")
            split = path.stem.removeprefix("positions-")
            if row.get("split") != split:
                raise ValueError(f"Unexpected data split in {path}, line {line_number}")
            if row.get("schema_version") != 1:
                raise ValueError(f"Unsupported row schema in {path}, line {line_number}")
            if row.get("score_perspective") != "side-to-move":
                raise ValueError(f"Score perspective mismatch in {path}, line {line_number}")
            source = row.get("source")
            if not isinstance(source, dict) or source.get("license") != "CC0-1.0":
                raise ValueError(f"Unverified source license in {path}, line {line_number}")
            score = row.get("score_cp")
            if isinstance(score, bool) or not isinstance(score, int):
                raise ValueError(f"Invalid score in {path}, line {line_number}")

            fen = row.get("fen")
            if not isinstance(fen, str):
                raise ValueError(f"Missing FEN in {path}, line {line_number}")
            position_id = hashlib.sha256(
                " ".join(fen.split()[:4]).encode("utf-8")
            ).hexdigest()
            if row.get("position_id") != position_id:
                raise ValueError(f"Position hash mismatch in {path}, line {line_number}")
            if split_for_position(position_id, split_seed) != split:
                raise ValueError(f"Position assigned to the wrong data split in {path}, line {line_number}")

            white, black, white_to_move = halfkp_features(fen)
            yield white, black, white_to_move, score
            yielded += 1
            if limit and yielded >= limit:
                break


def batches(
    path: Path,
    batch_size: int,
    seed: int,
    limit: int,
    split_seed: str,
    shuffle_buffer_batches: int = 8,
) -> Iterator[list[tuple[list[int], list[int], bool, int]]]:
    """Shuffle bounded blocks so training does not require loading the corpus."""
    rng = random.Random(seed)
    buffer: list[tuple[list[int], list[int], bool, int]] = []
    block_size = batch_size * shuffle_buffer_batches

    for example in read_examples(path, split_seed, limit):
        buffer.append(example)
        if len(buffer) >= block_size:
            rng.shuffle(buffer)
            for start in range(0, len(buffer), batch_size):
                yield buffer[start:start + batch_size]
            buffer.clear()

    if buffer:
        rng.shuffle(buffer)
        for start in range(0, len(buffer), batch_size):
            yield buffer[start:start + batch_size]


def collate(
    rows: list[tuple[list[int], list[int], bool, int]],
    device: torch.device,
) -> tuple[Tensor, Tensor, Tensor, Tensor]:
    indices: list[int] = []
    offsets: list[int] = []
    white_to_move: list[bool] = []
    scores: list[float] = []

    for white_features, black_features, stm_white, score_cp in rows:
        offsets.append(len(indices))
        indices.extend(white_features)
        offsets.append(len(indices))
        indices.extend(black_features)
        white_to_move.append(stm_white)
        scores.append(float(score_cp))

    index_tensor = torch.tensor(indices, dtype=torch.long, device=device)
    offset_tensor = torch.tensor(offsets, dtype=torch.long, device=device)
    stm_tensor = torch.tensor(white_to_move, dtype=torch.bool, device=device)
    score_tensor = torch.tensor(scores, dtype=torch.float32, device=device)
    return index_tensor, offset_tensor, stm_tensor, score_tensor


class PrunexHalfKP(nn.Module):
    """Shared HalfKP feature transformer with a compact side-to-move head."""

    def __init__(self, hidden: int = 128, dense1: int = 32, dense2: int = 16):
        super().__init__()
        if not 8 <= hidden <= 256 or not 4 <= dense1 <= 128 or not 4 <= dense2 <= 128:
            raise ValueError("Network dimensions are outside the supported range")

        self.hidden = hidden
        self.dense1_size = dense1
        self.dense2_size = dense2
        self.feature_weights = nn.EmbeddingBag(
            FEATURE_COUNT, hidden, mode="sum", sparse=True
        )
        self.feature_bias = nn.Parameter(torch.full((hidden,), 0.10))
        self.dense1 = nn.Linear(hidden * 2, dense1)
        self.dense2 = nn.Linear(dense1, dense2)
        self.output = nn.Linear(dense2, 1)

        nn.init.normal_(self.feature_weights.weight, mean=0.0, std=0.01)
        nn.init.xavier_uniform_(self.dense1.weight)
        nn.init.zeros_(self.dense1.bias)
        nn.init.xavier_uniform_(self.dense2.weight)
        nn.init.zeros_(self.dense2.bias)
        nn.init.xavier_uniform_(self.output.weight)
        nn.init.zeros_(self.output.bias)

    def forward(self, indices: Tensor, offsets: Tensor, stm_white: Tensor) -> Tensor:
        batch_size = stm_white.shape[0]
        accumulators = self.feature_weights(indices, offsets)
        accumulators = accumulators + self.feature_bias
        accumulators = accumulators.clamp(0.0, 1.0).reshape(batch_size, 2, self.hidden)

        white = accumulators[:, 0, :]
        black = accumulators[:, 1, :]
        first = torch.where(stm_white.unsqueeze(1), white, black)
        second = torch.where(stm_white.unsqueeze(1), black, white)
        combined = torch.cat((first, second), dim=1)

        layer1 = self.dense1(combined).clamp(0.0, 1.0)
        layer2 = self.dense2(layer1).clamp(0.0, 1.0)
        return self.output(layer2).squeeze(1)


def target_probability(score_cp: Tensor, score_scale: float) -> Tensor:
    return torch.sigmoid(score_cp / score_scale)


def validate(
    model: PrunexHalfKP,
    path: Path,
    device: torch.device,
    batch_size: int,
    score_scale: float,
    limit: int,
    split_seed: str,
) -> dict[str, float]:
    model.eval()
    squared_error = 0.0
    log_loss = 0.0
    count = 0
    epsilon = 1e-7

    with torch.no_grad():
        for rows in batches(
            path, batch_size, 71, limit, split_seed, shuffle_buffer_batches=1
        ):
            indices, offsets, stm, scores = collate(rows, device)
            logits = model(indices, offsets, stm)
            target = target_probability(scores, score_scale)
            probability = torch.sigmoid(logits).clamp(epsilon, 1.0 - epsilon)
            squared_error += float(torch.sum((probability - target) ** 2).item())
            log_loss += float(torch.sum(
                -(target * torch.log(probability)
                  + (1.0 - target) * torch.log(1.0 - probability))
            ).item())
            count += len(rows)

    if count == 0:
        raise ValueError(f"Validation data is empty: {path}")
    return {"positions": count, "brier_score": squared_error / count, "log_loss": log_loss / count}


def write_tensor(stream, tensor: Tensor) -> None:
    array = tensor.detach().to(device="cpu", dtype=torch.float32).contiguous().numpy()
    stream.write(array.astype("<f4", copy=False).tobytes(order="C"))


def export_network(
    model: PrunexHalfKP,
    output_path: Path,
    score_scale: float,
) -> str:
    """Write the float32 inference file consumed by src/nnue.hpp."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary_name = tempfile.mkstemp(
        prefix=output_path.name + ".", suffix=".tmp", dir=output_path.parent
    )
    os.close(fd)
    temporary = Path(temporary_name)

    try:
        with temporary.open("wb") as stream:
            stream.write(struct.pack(
                "<8sIIIIIf",
                NETWORK_MAGIC,
                NETWORK_VERSION,
                FEATURE_COUNT,
                model.hidden,
                model.dense1_size,
                model.dense2_size,
                float(score_scale),
            ))
            write_tensor(stream, model.feature_weights.weight)
            write_tensor(stream, model.feature_bias)
            write_tensor(stream, model.dense1.weight)
            write_tensor(stream, model.dense1.bias)
            write_tensor(stream, model.dense2.weight)
            write_tensor(stream, model.dense2.bias)
            write_tensor(stream, model.output.weight)
            write_tensor(stream, model.output.bias)
        os.replace(temporary, output_path)
    except Exception:
        temporary.unlink(missing_ok=True)
        raise

    return sha256_file(output_path)


def train(args: argparse.Namespace) -> dict:
    input_dir = Path(args.input_dir).expanduser().resolve()
    train_path = input_dir / "positions-train.jsonl"
    validation_path = input_dir / "positions-validation.jsonl"
    test_path = input_dir / "positions-test.jsonl"
    output_path = Path(args.output).expanduser().resolve()
    checkpoint_path = output_path.with_suffix(output_path.suffix + ".pt")
    report_path = output_path.with_suffix(output_path.suffix + ".json")

    manifest, split_seed = verify_corpus(input_dir)
    if not train_path.is_file() or not validation_path.is_file() or not test_path.is_file():
        raise FileNotFoundError("Training, validation and test JSONL splits must all exist")
    if args.epochs < 1 or args.batch_size < 1 or args.learning_rate <= 0:
        raise ValueError("Epochs, batch size and learning rate must be positive")
    if args.train_limit < 0 or args.validation_limit < 0:
        raise ValueError("Position limits cannot be negative")
    if args.score_scale < 50 or args.score_scale > 2000:
        raise ValueError("Score scale must be between 50 and 2000")
    if output_path.exists() and not args.overwrite:
        raise FileExistsError(f"Output exists; pass --overwrite to replace: {output_path}")

    random.seed(args.seed)
    torch.manual_seed(args.seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(args.seed)

    device = torch.device(args.device)
    if device.type == "cuda" and not torch.cuda.is_available():
        raise RuntimeError("CUDA was requested but is not available")
    if device.type not in ("cpu", "cuda"):
        raise ValueError("Only CPU and CUDA training devices are supported")

    model = PrunexHalfKP(args.hidden, args.dense1, args.dense2).to(device)
    embedding_optimizer = torch.optim.SparseAdam(
        [model.feature_weights.weight], lr=args.learning_rate
    )
    dense_parameters = [
        parameter for name, parameter in model.named_parameters()
        if name != "feature_weights.weight"
    ]
    dense_optimizer = torch.optim.AdamW(
        dense_parameters, lr=args.learning_rate, weight_decay=1e-5
    )

    history: list[dict] = []
    started = time.monotonic()
    global_step = 0

    for epoch in range(args.epochs):
        model.train()
        epoch_loss = 0.0
        epoch_positions = 0

        for rows in batches(
            train_path, args.batch_size, args.seed + epoch, args.train_limit, split_seed
        ):
            indices, offsets, stm, scores = collate(rows, device)
            target = target_probability(scores, args.score_scale)
            logits = model(indices, offsets, stm)
            loss = F.binary_cross_entropy_with_logits(logits, target)

            embedding_optimizer.zero_grad(set_to_none=True)
            dense_optimizer.zero_grad(set_to_none=True)
            loss.backward()
            dense_optimizer.step()
            embedding_optimizer.step()

            epoch_loss += float(loss.detach().item()) * len(rows)
            epoch_positions += len(rows)
            global_step += 1
            if args.max_steps and global_step >= args.max_steps:
                break

        if epoch_positions == 0:
            raise ValueError("Training data is empty")
        validation = validate(
            model,
            validation_path,
            device,
            args.batch_size,
            args.score_scale,
            args.validation_limit,
            split_seed,
        )
        history.append({
            "epoch": epoch + 1,
            "training_positions": epoch_positions,
            "training_log_loss": epoch_loss / epoch_positions,
            "validation": validation,
        })
        print(json.dumps(history[-1]), flush=True)
        if args.max_steps and global_step >= args.max_steps:
            break

    # The test split is evaluated only after all fitting decisions are over.
    test_metrics = validate(
        model, test_path, device, args.batch_size,
        args.score_scale, 0, split_seed
    )
    model = model.to("cpu").eval()
    network_hash = export_network(model, output_path, args.score_scale)
    checkpoint_path.parent.mkdir(parents=True, exist_ok=True)
    torch.save({
        "format": "prunex-halfkp-v1",
        "model": model.state_dict(),
        "dimensions": {
            "features": FEATURE_COUNT,
            "hidden": model.hidden,
            "dense1": model.dense1_size,
            "dense2": model.dense2_size,
        },
        "score_scale": args.score_scale,
        "seed": args.seed,
        "torch_version": torch.__version__,
    }, checkpoint_path)

    report = {
        "format": "prunex-halfkp-training-report-v1",
        "network": {
            "path": str(output_path),
            "sha256": network_hash,
            "bytes": output_path.stat().st_size,
            "format_version": NETWORK_VERSION,
        },
        "checkpoint": {
            "path": str(checkpoint_path),
            "sha256": sha256_file(checkpoint_path),
            "bytes": checkpoint_path.stat().st_size,
        },
        "data": {
            "train_path": str(train_path),
            "train_sha256": sha256_file(train_path),
            "validation_path": str(validation_path),
            "validation_sha256": sha256_file(validation_path),
            "test_path": str(test_path),
            "test_sha256": sha256_file(test_path),
            "corpus_manifest_sha256": sha256_file(input_dir / "corpus-manifest.json"),
            "corpus_manifest": manifest,

        },
        "settings": {
            "epochs": args.epochs,
            "global_steps": global_step,
            "batch_size": args.batch_size,
            "learning_rate": args.learning_rate,
            "score_scale": args.score_scale,
            "seed": args.seed,
            "device": str(device),
            "torch_version": torch.__version__,
            "dimensions": {
                "features": FEATURE_COUNT,
                "hidden": model.hidden,
                "dense1": model.dense1_size,
                "dense2": model.dense2_size,
            },
        },
        "history": history,
        "held_out_test": test_metrics,
        "elapsed_seconds": round(time.monotonic() - started, 2),
        "limitations": [
            "The model learns Stockfish teacher evaluations from the supplied Lichess corpus.",
            "Held-out evaluation loss is not a playing-strength rating.",
            "The exported network must pass native correctness, performance and paired-game tests before use.",
        ],
    }
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    return report


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input-dir", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path, help="Prunex .nnue network output")
    parser.add_argument("--device", default="cpu", help="cpu or cuda")
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--batch-size", type=int, default=512)
    parser.add_argument("--learning-rate", type=float, default=0.0005)
    parser.add_argument("--score-scale", type=float, default=DEFAULT_SCORE_SCALE)
    parser.add_argument("--hidden", type=int, default=128)
    parser.add_argument("--dense1", type=int, default=32)
    parser.add_argument("--dense2", type=int, default=16)
    parser.add_argument("--train-limit", type=int, default=0, help="0 uses the full training split")
    parser.add_argument("--validation-limit", type=int, default=100_000)
    parser.add_argument("--max-steps", type=int, default=0, help="0 uses all requested epochs")
    parser.add_argument("--seed", type=int, default=20261112)
    parser.add_argument("--overwrite", action="store_true")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    try:
        report = train(args)
    except (OSError, ValueError, RuntimeError, struct.error) as exc:
        raise SystemExit(f"NNUE training failed: {exc}") from exc

    print(json.dumps({
        "network": report["network"],
        "settings": report["settings"],
        "final_validation": report["history"][-1]["validation"],
        "report": str(Path(args.output).with_suffix(Path(args.output).suffix + ".json")),
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
