import argparse
import json
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

def make_opening(name, tokens):
    board = chess.Board()
    for token in tokens:
        move = chess.Move.from_uci(token)
        if move not in board.legal_moves:
            raise ValueError(f"Illegal opening move {token} in {name}")
        board.push(move)
    return name, board

def configure(engine, hash_size=64, contempt=None):
    settings = {}
    for name, value in (("Threads", 1), ("Hash", hash_size), ("Minimum Thinking Time", 0)):
        if name in engine.options:
            settings[name] = value
    for name, value in (("OwnBook", False),):
        if name in engine.options:
            settings[name] = value
    if contempt is not None and "Contempt Factor" in engine.options:
        settings["Contempt Factor"] = contempt
    if settings:
        engine.configure(settings)

def play_game(prunex, stockfish, prunex_name, opponent_name, opening, prunex_white, nodes_per_move, prunex_contempt, number):
    name, initial = opening
    board = initial.copy()
    game_token = object()
    white = prunex if prunex_white else stockfish
    black = stockfish if prunex_white else prunex
    limit = chess.engine.Limit(nodes=nodes_per_move)
    start = time.monotonic()
    while not board.is_game_over(claim_draw=True) and board.ply() < 240:
        engine = white if board.turn == chess.WHITE else black
        result = engine.play(board, limit, game=game_token)
        if result.move is None or result.move not in board.legal_moves:
            raise RuntimeError(f"Illegal or missing move from {engine.id}: {result.move}")
        board.push(result.move)
    outcome = board.outcome(claim_draw=True)
    result_text = outcome.result() if outcome else "1/2-1/2"
    termination = outcome.termination.name if outcome else "ply-cap"
    if result_text == "1-0":
        score = 1.0 if prunex_white else 0.0
    elif result_text == "0-1":
        score = 0.0 if prunex_white else 1.0
    else:
        score = 0.5
    game = chess.pgn.Game.from_board(board)
    game.headers["Event"] = prunex_name + " vs official " + opponent_name
    game.headers["Site"] = "GitHub Actions"
    game.headers["Round"] = str(number)
    game.headers["White"] = prunex_name if prunex_white else opponent_name
    game.headers["Black"] = opponent_name if prunex_white else prunex_name
    game.headers["Result"] = result_text
    game.headers["Opening"] = name
    game.headers["Termination"] = termination
    game.headers["NodeControl"] = f"{nodes_per_move} nodes/move"
    game.headers["PrunexContempt"] = str(prunex_contempt)
    game.headers["PrunexColor"] = "White" if prunex_white else "Black"
    return {
        "game": game, "opening": name,
        "prunex_color": "White" if prunex_white else "Black",
        "result": result_text, "termination": termination,
        "score": score, "plies": board.ply(),
        "seconds": round(time.monotonic() - start, 3),
    }

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--prunex", required=True)
    parser.add_argument("--stockfish", required=True)
    parser.add_argument("--opponent-name", default="Stockfish 1.3.1")
    parser.add_argument("--prunex-name", default="Prunex 0.6.0 (Stockfish 4-derived)")
    parser.add_argument("--output", default="benchmark-results")
    parser.add_argument("--nodes-per-move", type=int, default=10000)
    parser.add_argument("--opening-count", type=int, default=8)
    parser.add_argument("--prunex-contempt", type=int, default=0, choices=range(-50, 51))
    parser.add_argument("--prunex-hash", type=int, default=64)
    parser.add_argument("--opponent-hash", type=int, default=64)
    parser.add_argument("--repeats", type=int, default=1)
    args = parser.parse_args()
    if not 1000 <= args.nodes_per_move <= 1000000:
        raise SystemExit("Node count must be between 1000 and 1000000")
    if not 1 <= args.repeats <= 10:
        raise SystemExit("Repeats must be between 1 and 10")
    if not 1 <= args.opening_count <= len(OPENINGS):
        raise SystemExit(f"Opening count must be between 1 and {len(OPENINGS)}")
    selected_openings = OPENINGS[:args.opening_count]
    outdir = pathlib.Path(args.output)
    outdir.mkdir(parents=True, exist_ok=True)
    prunex = chess.engine.SimpleEngine.popen_uci(args.prunex, timeout=120)
    stockfish = chess.engine.SimpleEngine.popen_uci(args.stockfish, timeout=120)
    results = []
    pgn_path = outdir / ("prunex-vs-" + args.opponent_name.lower().replace(" ", "-") + ".pgn")
    try:
        configure(prunex, args.prunex_hash, args.prunex_contempt)
        configure(stockfish, args.opponent_hash, 0)
        prunex.ping()
        stockfish.ping()
        for index, opening_data in enumerate(selected_openings):
            opening = make_opening(*opening_data)
            for repeat in range(args.repeats):
                for prunex_white in (True, False):
                    number = len(results) + 1
                    result = play_game(prunex, stockfish, args.prunex_name, args.opponent_name, opening, prunex_white, args.nodes_per_move, args.prunex_contempt, number)
                    result["repeat"] = repeat + 1
                    results.append(result)
                    with pgn_path.open("a", encoding="utf-8") as handle:
                        print(result["game"], file=handle, end="\n\n")
                    print(json.dumps({key: value for key, value in result.items() if key != "game"}), flush=True)
    finally:
        prunex.quit()
        stockfish.quit()
    wins = sum(item["score"] == 1.0 for item in results)
    draws = sum(item["score"] == 0.5 for item in results)
    losses = sum(item["score"] == 0.0 for item in results)
    points = sum(item["score"] for item in results)
    summary = {
        "prunex": args.prunex_name,
        "opponent": args.opponent_name + " (official source tag)",
        "games": len(results),
        "wins": wins, "draws": draws, "losses": losses,
        "points": points,
        "score_percent": round(points * 100 / len(results), 2),
        "nodes_per_move": args.nodes_per_move,
        "prunex_contempt": args.prunex_contempt,
        "prunex_hash_mb": args.prunex_hash,
        "opponent_hash_mb": args.opponent_hash,
        "repeats": args.repeats,
        "openings": len(selected_openings),
        "color_balance": {
            "prunex_white": sum(item["prunex_color"] == "White" for item in results),
            "prunex_black": sum(item["prunex_color"] == "Black" for item in results),
        },
        "mean_plies": round(sum(item["plies"] for item in results) / len(results), 2),
        "mean_game_seconds": round(sum(item["seconds"] for item in results) / len(results), 3),
    }
    (outdir / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(json.dumps(summary, indent=2), flush=True)

if __name__ == "__main__":
    main()
