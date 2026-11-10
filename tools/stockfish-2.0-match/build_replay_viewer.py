#!/usr/bin/env python3
"""Build a self-contained offline replay from legal PGN records."""
from __future__ import annotations
import argparse
import json
from pathlib import Path
import chess
import chess.pgn


def load_games(path: Path, expected: int = 64) -> list[dict]:
    games = []
    with path.open(encoding="utf-8") as source:
        while (game := chess.pgn.read_game(source)) is not None:
            if game.errors:
                raise ValueError(f"PGN game {len(games)+1} has errors: {game.errors}")
            board = game.board()
            positions = [board.fen()]
            moves = []
            for move in game.mainline_moves():
                if move not in board.legal_moves:
                    raise ValueError(f"Illegal move in game {len(games)+1}: {move.uci()}")
                moves.append({
                    "uci": move.uci(),
                    "san": board.san(move),
                    "side": "white" if board.turn == chess.WHITE else "black",
                    "move_number": board.fullmove_number,
                    "capture": board.is_capture(move),
                })
                board.push(move)
                positions.append(board.fen())
            result = game.headers.get("Result", "*")
            if result not in {"1-0", "0-1", "1/2-1/2"}:
                raise ValueError(f"Game {len(games)+1} is unfinished (Result={result}).")
            games.append({
                "number": len(games)+1,
                "opening": game.headers.get("Opening", "Unknown opening"),
                "repetition": game.headers.get("Repetition", "—"),
                "prunex_color": game.headers.get("PrunexColor", "unknown").title(),
                "result": result,
                "termination": game.headers.get("Termination", "Finished"),
                "positions": positions,
                "moves": moves,
            })
    if len(games) != expected:
        raise ValueError(f"Expected {expected} completed PGN games; found {len(games)}.")
    return games


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pgn", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--expected-games", type=int, default=64)
    args = parser.parse_args()
    games = load_games(Path(args.pgn), args.expected_games)
    template_path = Path(__file__).with_name("replay_template.html")
    template = template_path.read_text(encoding="utf-8")
    marker = "/*__PRUNEX_REPLAY_DATA__*/"
    if marker not in template:
        raise RuntimeError("Replay template data marker is missing.")
    payload = json.dumps({"games": games}, separators=(",", ":"), ensure_ascii=False).replace("</", "<\\/")
    output = Path(args.out)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(template.replace(marker, payload), encoding="utf-8")
    print(f"Built offline replay viewer for {len(games)} validated PGN games: {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
