import argparse
import csv
import json
import os
import pathlib
import time

import chess
import chess.engine
import chess.pgn

OPENINGS = [
    ("Ruy Lopez", ["e2e4", "e7e5", "g1f3", "b8c6", "f1b5", "a7a6"]),
    ("Italian Game", ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "f8c5"]),
    ("Scotch Game", ["e2e4", "e7e5", "g1f3", "b8c6", "d2d4", "e5d4"]),
    ("Sicilian Defense", ["e2e4", "c7c5", "g1f3", "d7d6", "d2d4", "c5d4", "f3d4"]),
    ("French Defense", ["e2e4", "e7e6", "d2d4", "d7d5", "b1c3", "g8f6"]),
    ("Caro-Kann Defense", ["e2e4", "c7c6", "d2d4", "d7d5", "b1c3", "d5e4"]),
    ("Queen's Gambit Declined", ["d2d4", "d7d5", "c2c4", "e7e6", "b1c3", "g8f6"]),
    ("Slav Defense", ["d2d4", "d7d5", "c2c4", "c7c6", "g1f3", "g8f6"]),
    ("Nimzo-Indian Defense", ["d2d4", "g8f6", "c2c4", "e7e6", "b1c3", "f8b4"]),
    ("King's Indian Defense", ["d2d4", "g8f6", "c2c4", "g7g6", "b1c3", "f8g7"]),
    ("English Opening", ["c2c4", "e7e5", "b1c3", "g8f6", "g2g3", "d7d5"]),
    ("Réti Opening", ["g1f3", "d7d5", "g2g3", "g8f6", "f1g2", "c7c6"]),
    ("Pirc Defense", ["e2e4", "d7d6", "d2d4", "g8f6", "b1c3", "g7g6"]),
    ("Scandinavian Defense", ["e2e4", "d7d5", "e4d5", "d8d5", "b1c3", "d5a5"]),
    ("Dutch Defense", ["d2d4", "f7f5", "c2c4", "g8f6", "g1f3", "e7e6"]),
    ("Grünfeld Defense", ["d2d4", "g8f6", "c2c4", "g7g6", "b1c3", "d7d5"]),
]

def create_opening(name, moves):
    board = chess.Board()
    for move in moves:
        parsed = chess.Move.from_uci(move)
        if parsed not in board.legal_moves:
            raise ValueError(f"Illegal opening move {move} in {name}")
        board.push(parsed)
    return name, board

def play_game(prunex, opponent, prunex_white, opening, depth, game_number):
    name, initial = opening
    board = initial.copy()
    game_token = object()
    white = prunex if prunex_white else opponent
    black = opponent if prunex_white else prunex
    started = time.monotonic()
    while not board.is_game_over(claim_draw=True) and board.ply() < 240:
        engine = white if board.turn == chess.WHITE else black
        result = engine.play(board, chess.engine.Limit(depth=depth), game=game_token)
        if result.move is None or result.move not in board.legal_moves:
            raise RuntimeError(f"Illegal or missing move from {engine.id}: {result.move}")
        board.push(result.move)
    outcome = board.outcome(claim_draw=True)
    if outcome is None:
        result_text = "1/2-1/2"
        termination = "ply-cap"
    else:
        result_text = outcome.result()
        termination = outcome.termination.name
    if result_text == "1-0":
        score = 1.0 if prunex_white else 0.0
    elif result_text == "0-1":
        score = 0.0 if prunex_white else 1.0
    else:
        score = 0.5
    game = chess.pgn.Game.from_board(board)
    game.headers["Event"] = "Prunex 0.5.0 engine benchmark"
    game.headers["Site"] = "GitHub Actions"
    game.headers["Round"] = str(game_number)
    game.headers["White"] = prunex.id.get("name", "Prunex") if prunex_white else opponent.id.get("name", "Opponent")
    game.headers["Black"] = opponent.id.get("name", "Opponent") if prunex_white else prunex.id.get("name", "Prunex")
    game.headers["Result"] = result_text
    game.headers["Opening"] = name
    game.headers["PlyCap"] = "240"
    game.headers["Termination"] = termination
    game.headers["Depth"] = str(depth)
    game.headers["PrunexColor"] = "White" if prunex_white else "Black"
    return {
        "game": game,
        "opening": name,
        "prunex_color": "White" if prunex_white else "Black",
        "result": result_text,
        "termination": termination,
        "score": score,
        "plies": board.ply(),
        "seconds": round(time.monotonic() - started, 3),
    }

def benchmark(prunex_path, opponent_path, opponent_label, outdir, depth, repeats):
    prunex = chess.engine.SimpleEngine.popen_uci(prunex_path, timeout=120)
    opponent = chess.engine.SimpleEngine.popen_uci(opponent_path, timeout=120)
    results = []
    pgn_path = outdir / f"{opponent_label.lower().replace(' ', '-')}.pgn"
    try:
        prunex.ping()
        opponent.ping()
        for opening_index, opening_data in enumerate(OPENINGS):
            opening = create_opening(*opening_data)
            for repeat in range(repeats):
                for prunex_white in (True, False):
                    number = len(results) + 1
                    result = play_game(prunex, opponent, prunex_white, opening, depth, number)
                    result["opponent"] = opponent_label
                    result["repeat"] = repeat + 1
                    results.append(result)
                    with pgn_path.open("a", encoding="utf-8") as handle:
                        print(result["game"], file=handle, end="\n\n")
                    print(json.dumps({k: v for k, v in result.items() if k != "game"}, ensure_ascii=False), flush=True)
    finally:
        prunex.quit()
        opponent.quit()
    wins = sum(x["score"] == 1.0 for x in results)
    draws = sum(x["score"] == 0.5 for x in results)
    losses = sum(x["score"] == 0.0 for x in results)
    points = sum(x["score"] for x in results)
    summary = {
        "opponent": opponent_label,
        "games": len(results),
        "wins": wins,
        "draws": draws,
        "losses": losses,
        "points": points,
        "score_percent": round(points * 100 / len(results), 2),
        "depth": depth,
        "color_balance": {
            "prunex_white": sum(x["prunex_color"] == "White" for x in results),
            "prunex_black": sum(x["prunex_color"] == "Black" for x in results),
        },
        "mean_plies": round(sum(x["plies"] for x in results) / len(results), 2),
        "mean_game_seconds": round(sum(x["seconds"] for x in results) / len(results), 3),
    }
    print(json.dumps(summary, indent=2), flush=True)
    with (outdir / f"{opponent_label.lower().replace(' ', '-')}.json").open("w", encoding="utf-8") as handle:
        json.dump(summary, handle, indent=2)
    return summary

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--prunex", required=True)
    parser.add_argument("--stockfish4", required=True)
    parser.add_argument("--stockfish6", required=True)
    parser.add_argument("--output", default="benchmark-results")
    parser.add_argument("--depth", type=int, default=6)
    parser.add_argument("--repeats", type=int, default=2)
    args = parser.parse_args()
    if not 1 <= args.depth <= 12:
        raise SystemExit("Depth must be between 1 and 12")
    if not 1 <= args.repeats <= 10:
        raise SystemExit("Repeats must be between 1 and 10")
    outdir = pathlib.Path(args.output)
    outdir.mkdir(parents=True, exist_ok=True)
    summaries = [
        benchmark(args.prunex, args.stockfish4, "Stockfish 4", outdir, args.depth, args.repeats),
        benchmark(args.prunex, args.stockfish6, "Stockfish 6", outdir, args.depth, args.repeats),
    ]
    with (outdir / "summary.json").open("w", encoding="utf-8") as handle:
        json.dump(summaries, handle, indent=2)

if __name__ == "__main__":
    main()
