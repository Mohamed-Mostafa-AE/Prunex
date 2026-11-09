# Verified Stockfish 2.0 match — 64-game protocol

This protocol is designed to create a reproducible public record for the **current independent Prunex 0.8.0 C++20 source** against the historical Stockfish 2.0 engine.

## What the workflow verifies

1. Checks out the Prunex commit that launched the workflow and builds its native executable from source.
2. Checks out the official Stockfish repository at tag `sf_2.0`, pinned to commit `aa2de53a83ca5423c8c8007abf71f9afdf589d93).
3. Builds that historical source and verifies:
   - UCI identity contains `Stockfish 2.0`;
   - the official 2011 benchmark signature is exactly **7,224,363 nodes**;
   - the exact executable SHA-256 is recorded.
4. Checks Prunex's UCI identity and uses the new `go nodes N` support to enforce a maximum node budget per move.
5. Runs **64 games**: 16 fixed opening positions × 2 repetitions × both Prunex color assignments. This produces 32 games with Prunex White and 32 with Prunex Black.
6. Saves a PGN and a per-game JSONL record containing every move, FEN before the move, UCI/SAN move, and available engine search telemetry.
7. Renders the actual PGNs into a move-by-move MP4 replay and an 8×8 final-position poster.

The Stockfish 2.0 source release and its 7,224,363-node signature are documented by the [official Stockfish 2.0 announcement](https://stockfishchess.org/blog/2011/stockfish-2/).

## Run it

After this pull request is merged, open the repository's **Actions** tab and run **Verified Prunex vs Stockfish 2.0 — 64 games** using `workflow_dispatch`.

Defaults:
- 1,000,000 maximum nodes per move for each engine
- Stockfish 2.0 Hash: 256 MiB
- one thread per engine
- fixed 16-opening schedule, two repetitions, both colors

Prunex currently has a fixed 262,144-entry transposition table and no UCI `Hash` option. The workflow records this difference; it does **not** pretend both engines use identical hash allocations. Node budgets are capped at the requested number, not guaranteed to consume every node on every move.

## Evidence artifact

The workflow uploads one artifact containing:

| File | What it proves / contains |
|---|---|
| `stockfish-verification.json` | Stockfish 2.0 UCI ID, official bench signature, and executable SHA-256 |
| `summary.json` | Source commit, both executable hashes, settings, color balance, score, elapsed time |
| `all-games.pgn` | Full replayable move record for all completed games |
| `games.jsonl` | Per-game moves, FENs, search telemetry, result and termination |
| `evidence/64-game-replay.mp4` | Video rendered from the actual PGN moves |
| `evidence/64-game-final-positions.png` | Contact sheet of all 64 actual final board positions and results |

The video and poster are renderings of the PGN, not fabricated game footage. The PGN and JSONL remain the authoritative move-by-move records.

## Interpretation and limitations

- A 64-game score is a match result, **not an Elo rating** or proof of general superiority.
- The Stockfish 2.0 bench signature is a practical source/build fingerprint, not a cryptographic publisher signature. The official source tag and commit are pinned, and the built executable hash is retained.
- The historical 1 November 2026 owner-supplied 63–1–0 report is separate. Its archived metadata identifies the tested Prunex 0.8.0 binary as **Stockfish 19-derived**, says the raw PGN and JSONL were not in the repository, and records no verified Stockfish 2.0 executable identity or SHA-256. It must not be presented as evidence for the independent native engine.
- The browser site's footer currently credits Stockfish.js 19 for browser analysis. A screenshot of the web board documents the interface only; it is not evidence of the native Prunex-versus-Stockfish 2.0 match.

## Source files

- `tools/stockfish-2.0-match/verify_stockfish_2.py`
- `tools/stockfish-2.0-match/run_match.py`
- `tools/stockfish-2.0-match/render_evidence.py`
- `.github/workflows/stockfish-2.0-64.yml`
- `tests/uci_nodes_limit.py`
