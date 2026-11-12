#!/usr/bin/env python3
"""Unit tests for the internal paired-Prunex regression harness."""

import importlib.util
import io
from pathlib import Path

import chess
import chess.pgn

SCRIPT = Path(__file__).resolve().parents[1] / "tools" / "strength-match" / "internal_selfplay.py"
SPEC = importlib.util.spec_from_file_location("internal_selfplay", SCRIPT)
assert SPEC is not None and SPEC.loader is not None
module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(module)


def main() -> None:
    first = module.opening_positions(8, 20261112)
    second = module.opening_positions(8, 20261112)
    assert [board.fen() for board, _ in first] == [board.fen() for board, _ in second]
    assert [san for _, san in first] == [san for _, san in second]
    assert len({board.fen() for board, _ in first}) == 8
    assert all(board.turn for board, _ in first)

    mean, low, high = module.paired_confidence_interval([0.5, 0.5, 0.5, 0.5])
    assert mean == low == high == 0.5

    final = module.search_stats(
        {"string": "search-final nodes=99876 depth=12 elapsed_ms=103 tthits=500 node_limit=100000"},
        100000,
    )
    assert final["nodes"] == 99876
    assert final["depth"] == 12
    assert final["source"] == "final-search-info"

    legacy = module.search_stats(
        {"string": "node-limit 99900/100000", "depth": 10}, 100000
    )
    assert legacy["nodes"] == 99900
    assert legacy["source"] == "node-limit-info"

    # The PGN tree must preserve all moves in order, not replace the root move.
    game = chess.pgn.Game()
    board = chess.Board()
    node = game
    for uci in ("e2e4", "e7e5", "g1f3", "b8c6"):
        move = chess.Move.from_uci(uci)
        assert move in board.legal_moves
        node = node.add_variation(move)
        board.push(move)
    exported = game.accept(chess.pgn.StringExporter(headers=True, variations=True))
    parsed = chess.pgn.read_game(io.StringIO(exported))
    assert parsed is not None
    replayed = list(parsed.mainline_moves())
    assert [move.uci() for move in replayed] == ["e2e4", "e7e5", "g1f3", "b8c6"]

    print("Internal paired self-play harness: 4 groups of checks passed")


if __name__ == "__main__":
    main()
