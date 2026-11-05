#!/usr/bin/env python3
"""Independently recount the archived Stockfish 2.0 match PGN.

This checks PGN headers and summary consistency. It does not replay moves;
the original tournament runner separately rejected illegal engine moves.
"""
from __future__ import annotations

import argparse
import collections
import json
import re
import sys
from pathlib import Path

HEADER = re.compile(r'^\[(\w+) "(.*)"\]$')
EXPECTED_ENGINE = "Prunex 0.8.0 (Stockfish 19-derived)"
EXPECTED_OPPONENT = "Stockfish 2.0"


def load_games(path: Path) -> list[dict[str, str]]:
    games: list[dict[str, str]] = []
    current: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        match = HEADER.match(line)
        if not match:
            continue
        key, value = match.groups()
        if key == "Event" and current:
            games.append(current)
            current = {}
        current[key] = value
    if current:
        games.append(current)
    return games


def verify(pgn_path: Path, summary_path: Path) -> dict:
    games = load_games(pgn_path)
    summary = json.loads(summary_path.read_text(encoding="utf-8"))
    errors: list[str] = []

    if len(games) != 64:
        errors.append(f"Expected 64 games, found {len(games)}")

    rounds = [int(g["Round"]) for g in games if g.get("Round", "").isdigit()]
    if len(rounds) != 64 or sorted(rounds) != list(range(1, 65)):
        errors.append("Round headers must contain each round 1 through 64 exactly once")

    wins = draws = losses = 0
    colors: collections.Counter[str] = collections.Counter()
    openings: collections.Counter[str] = collections.Counter()
    for number, game in enumerate(games, 1):
        required = ("Event", "Round", "White", "Black", "Result", "Opening",
                    "Termination", "NodeControl", "PrunexContempt", "PrunexColor")
        missing = [key for key in required if key not in game]
        if missing:
            errors.append(f"Game {number} missing headers: {', '.join(missing)}")
            continue
        color = game["PrunexColor"]
        if color not in ("White", "Black"):
            errors.append(f"Game {number} has invalid PrunexColor={color!r}")
            continue
        colors[color] += 1
        openings[game["Opening"]] += 1

        expected_white = EXPECTED_ENGINE if color == "White" else EXPECTED_OPPONENT
        expected_black = EXPECTED_ENGINE if color == "Black" else EXPECTED_OPPONENT
        if game["White"] != expected_white or game["Black"] != expected_black:
            errors.append(f"Game {number} player names disagree with PrunexColor")
        if game["NodeControl"] != "100000 nodes/move":
            errors.append(f"Game {number} has unexpected node control")
        if game["PrunexContempt"] != "0":
            errors.append(f"Game {number} has unexpected Prunex contempt")

        result = game["Result"]
        if result == "1/2-1/2":
            draws += 1
        elif (result == "1-0" and color == "White") or (result == "0-1" and color == "Black"):
            wins += 1
        elif result in ("1-0", "0-1"):
            losses += 1
        else:
            errors.append(f"Game {number} has invalid result={result!r}")

    points = wins + draws / 2
    if colors != {"White": 32, "Black": 32}:
        errors.append(f"Expected 32 games per colour, found {dict(colors)}")
    if len(openings) != 16 or any(count != 4 for count in openings.values()):
        errors.append("Expected 16 openings with four games each")
    expected = {
        "games": 64, "wins": 62, "draws": 2, "losses": 0,
        "points": 63, "score_percent": 98.44,
        "nodes_per_move": 100000, "prunex_hash_mb": 128,
        "opponent_hash_mb": 128, "openings": 16,
        "prunex_white": 32, "prunex_black": 32,
    }
    actual = {
        "games": len(games), "wins": wins, "draws": draws, "losses": losses,
        "points": points, "score_percent": round(points * 100 / len(games), 2) if games else 0,
        "nodes_per_move": 100000, "prunex_hash_mb": 128,
        "opponent_hash_mb": 128, "openings": len(openings),
        "prunex_white": colors["White"], "prunex_black": colors["Black"],
    }
    for key, value in expected.items():
        if actual[key] != value:
            errors.append(f"{key}: expected {value!r}, found {actual[key]!r}")
        if summary.get(key) != value:
            errors.append(f"summary.json {key}: expected {value!r}, found {summary.get(key)!r}")

    if summary.get("test_engine") != EXPECTED_ENGINE:
        errors.append("summary.json test_engine identity mismatch")
    if summary.get("opponent") != EXPECTED_OPPONENT:
        errors.append("summary.json opponent identity mismatch")

    result = {
        **actual,
        "openings": dict(sorted(openings.items())),
        "result": "PASS" if not errors else "FAIL",
        "errors": errors,
    }
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pgn", required=True, type=Path)
    parser.add_argument("--summary", required=True, type=Path)
    args = parser.parse_args()
    result = verify(args.pgn, args.summary)
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0 if result["result"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
