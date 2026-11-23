#!/usr/bin/env python3
"""Validate the reference network through native UCI."""

import re
import subprocess
import sys

import chess
from pathlib import Path


engine, weights = map(lambda value: Path(value).resolve(), sys.argv[1:])
# Keep both armies on the board while giving White a clear material advantage.
# Very sparse mating positions can produce different raw scores across networks.
queen_advantage = "rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR"
commands = [
    "uci",
    f"setoption name HalfKpFile value {weights}",
    "isready",
    f"position fen {queen_advantage} w - - 0 1",
    "eval",
    f"position fen {queen_advantage} b - - 0 1",
    "eval",
    f"position fen {queen_advantage} w - - 0 1",
    "eval",
    "quit",
]
finished = subprocess.run([str(engine)], input="\n".join(commands) + "\n",
                          capture_output=True, text=True, check=True, timeout=30)
output = finished.stdout
if "info string loaded reference HalfKP network" not in output:
    raise RuntimeError(output)
scores = [int(score) for score in re.findall(r"static evaluation cp (-?\d+)", output)]
if len(scores) != 3 or scores[0] <= 200 or scores[1] >= -200 or scores[0] != scores[2]:
    raise RuntimeError(f"Unexpected HalfKP evaluation: {scores}\n{output}")
print(f"Reference HalfKP scores: {scores}")

fixtures = [
    (chess.STARTING_FEN, "e2e4"),
    ("4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1", "e4d5"),
    ("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1", "e5d6"),
    ("4k3/8/8/8/8/8/8/4K2R w K - 0 1", "e1g1"),
    ("r3k3/pp6/8/8/8/8/8/4K3 b q - 0 1", "e8c8"),
    ("1r2k3/P7/8/8/8/8/8/4K3 w - - 0 1", "a7b8q"),
    ("4k3/7p/8/8/8/8/8/3K4 w - - 0 1", "d1e1"),
    ("4k3/3P4/8/8/8/8/1P6/4K3 b - - 0 1", "e8d7"),
]
commands = ["uci"]
for fen, move in fixtures:
    board = chess.Board(fen)
    board.push_uci(move)
    commands.extend([
        f"setoption name HalfKpFile value {weights}",
        f"position fen {fen}",
        "eval",
        f"position fen {fen} moves {move}",
        "eval",
        f"setoption name HalfKpFile value {weights}",
        f"position fen {board.fen(en_passant='fen')}",
        "eval",
    ])
commands.append("quit")
finished = subprocess.run([str(engine)], input="\n".join(commands) + "\n",
                          capture_output=True, text=True, check=True, timeout=60)
scores = [int(score) for score in re.findall(r"static evaluation cp (-?\d+)", finished.stdout)]
counts = [int(count) for count in re.findall(r"incremental evaluations (\d+)", finished.stdout)]
if len(scores) != 3 * len(fixtures) or len(counts) != len(scores):
    raise RuntimeError(f"Missing reference evaluation results: {finished.stdout}")

for index, (_, move) in enumerate(fixtures):
    root = index * 3
    if scores[root + 1] != scores[root + 2] or counts[root:root + 3] != [0, 1, 0]:
        raise RuntimeError(f"Incremental and fresh scores differ after {move}: {finished.stdout}")
print(f"Incremental updates matched fresh evaluation on {len(fixtures)} move types")

# Keep revisiting the same king squares after changing the piece layout.
# The final castling and king-capture fixtures reuse previously seeded buckets.
refresh_positions = [
    (chess.STARTING_FEN, None),
    ("4k3/pp6/8/8/4P3/8/8/4K2R w K - 0 1", None),
    ("4k3/pp6/8/4P3/8/8/8/5RK1 b - - 0 1", None),
    ("4k3/pp6/8/8/4P3/8/8/4K2R w K - 0 1", "e1g1"),
    ("r3k3/pp6/8/8/4P3/8/8/4K3 b q - 0 1", None),
    ("2kr4/1p6/p7/8/4P3/8/8/4K3 w - - 0 1", None),
    ("r3k3/pp6/8/8/4P3/8/8/4K3 b q - 0 1", "e8c8"),
    ("4k3/8/8/8/8/4p3/4K3/8 w - - 0 1", None),
    ("4k3/8/8/8/8/4K2P/8/8 b - - 0 1", None),
    ("4k3/8/8/8/8/4p3/4K3/8 w - - 0 1", "e2e3"),
]
load = f"setoption name HalfKpFile value {weights}"
commands = [load]
expected_positions = []
for fen, move in refresh_positions:
    board = chess.Board(fen)
    if move:
        board.push_uci(move)
    expected_positions.append(board.fen(en_passant="fen"))
    position = f"position fen {fen}"
    if move:
        position += f" moves {move}"
    commands.extend([position, "eval"])
for fen in expected_positions:
    commands.extend([load, f"position fen {fen}", "eval"])
commands.append("quit")
finished = subprocess.run([str(engine)], input="\n".join(commands) + "\n",
                          capture_output=True, text=True, check=True, timeout=60)
scores = [int(score) for score in re.findall(r"static evaluation cp (-?\d+)", finished.stdout)]
count = len(expected_positions)
if len(scores) != 2 * count or scores[:count] != scores[count:]:
    raise RuntimeError(f"Cached and fresh king refresh scores differ: {scores}")
print(f"King refresh cache matched cold evaluation on {count} positions")
