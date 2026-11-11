#!/usr/bin/env python3
"""Build an offline replay viewer from completed PGN games."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import chess
import chess.pgn


def load_games(path: Path, expected: int) -> list[dict[str, Any]]:
    games: list[dict[str, Any]] = []
    with path.open(encoding="utf-8") as source:
        while (game := chess.pgn.read_game(source)) is not None:
            if game.errors:
                raise ValueError(f"PGN game {len(games) + 1} has errors: {game.errors}")
            board = game.board()
            positions = [board.fen()]
            moves = []
            prunex_color = game.headers.get("PrunexColor", "unknown").lower()
            if prunex_color not in {"white", "black"}:
                raise ValueError(f"Game {len(games) + 1} has an invalid PrunexColor header.")
            white = game.headers.get("White", "White")
            black = game.headers.get("Black", "Black")
            opponent = black if prunex_color == "white" else white

            for move in game.mainline_moves():
                if move not in board.legal_moves:
                    raise ValueError(f"Illegal move in game {len(games) + 1}: {move.uci()}")
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
                raise ValueError(f"Game {len(games) + 1} is unfinished (Result={result}).")
            if not moves:
                raise ValueError(f"Game {len(games) + 1} has no moves.")

            games.append({
                "number": len(games) + 1,
                "opening": game.headers.get("OpeningMoves", game.headers.get("Opening", "Recorded position")),
                "repetition": game.headers.get("Repetition", "Paired colour leg"),
                "prunex_color": prunex_color.title(),
                "opponent": opponent,
                "tier": game.headers.get("ResourceTier", game.headers.get("Event", "Recorded match")),
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
    parser.add_argument("--expected-games", type=int, default=24)
    parser.add_argument("--match-label", default="Prunex Strength Ladder")
    args = parser.parse_args()

    games = load_games(Path(args.pgn), args.expected_games)
    first = games[0]
    meta = {
        "match_label": args.match_label,
        "opponent": first["opponent"],
        "tier": first["tier"],
        "games": len(games),
    }
    template_path = Path(__file__).with_name("replay_template.html")
    template = template_path.read_text(encoding="utf-8")
    marker = "/*__PRUNEX_REPLAY_DATA__*/"
    if marker not in template:
        raise RuntimeError("Replay template data marker is missing.")
    payload = json.dumps({"meta": meta, "games": games}, separators=(",", ":"), ensure_ascii=False)
    payload = payload.replace("</", "<\\/")
    output = Path(args.out)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(template.replace(marker, payload), encoding="utf-8")
    print(f"Built replay for {len(games)} validated games: {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
