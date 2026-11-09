# Verified Stockfish 2.0 match — 64-game protocol

This protocol creates a reproducible public record for the **current independent Prunex 0.8.0 C++20 source** against the historical Stockfish 2.0 engine.

## What the workflow verifies

1. Checks out the Prunex commit that launched the workflow and builds its native executable from source.
2. Checks out the official Stockfish repository at tag `sf_2.0`, pinned to commit `aa2de53a83ca5423c8c8007abf71f9afdf589d93`.
3. Builds that historical source at the pinned commit and verifies three independent fingerprints:
   - the resolved Git source commit equals `aa2de53a83ca5423c8c8007abf71f9afdf589d93`;
   - the UCI handshake reports a `Stockfish 2.0` engine identity;
   - the historical `bench` suite writes exactly 16 per-position `Nodes:` records to its search log, and their sum is exactly **7,224,363 nodes**. The console aggregate, when present, must agree with that sum.
4. Records the executable SHA-256, UCI output, raw benchmark output, and original per-position `bench.txt` search log. The verifier reads Stockfish 2.0's own search log rather than relying on a modern console-output format.
5. Checks Prunex's UCI identity and uses `go nodes N` support to enforce a maximum node budget per move.
6. Runs **64 games**: 16 fixed opening positions × 2 repetitions × both Prunex color assignments. This produces 32 games with Prunex White and 32 with Prunex Black.
7. Saves a PGN and a per-game JSONL record containing every move, FEN before the move, UCI/SAN move, and available engine search telemetry.
8. Renders the actual PGNs into a move-by-move MP4 replay and an 8×8 final-position poster.

The Stockfish 2.0 source release and its 7,224,363-node signature are documented by the [official Stockfish 2.0 announcement](https://stockfishchess.org/blog/2011/stockfish-2/).

## Run it

Open the repository's **Actions** tab and run **Verified Prunex vs Stockfish 2.0 — 64 games** using `workflow_dispatch`. The workflow also runs automatically when its own workflow definition is merged to `main`.

Defaults:

- 1,000,000 maximum nodes per move for each engine
- Stockfish 2.0 Hash: 256 MiB
- one thread per engine
- fixed 16-opening schedule, two repetitions, both colors

The historical Stockfish identity check uses its own benchmark defaults (Hash 128 MiB, one thread, depth 12, default 16 FEN suite). This is separate from the match configuration. Prunex currently has a fixed 262,144-entry transposition table and no UCI `Hash` option. The workflow records this difference; it does **not** pretend both engines use identical hash allocations. Node budgets are caps, not guaranteed per-move consumption.

## Evidence artifact

The workflow uploads an artifact containing:

| File | What it proves / contains |
|---|---|
| `stockfish-verification.json` | Pinned source commit, Stockfish 2.0 UCI ID, 16-position bench signature, and executable SHA-256 |
| `stockfish-2.0-uci-output.txt` | Raw UCI handshake output used for engine identity verification |
| `stockfish-2.0-bench-output.txt` | Raw console output from the historical `bench` command |
| `stockfish-2.0-bench-search.log` | Original per-position Stockfish 2.0 search log; its 16 `Nodes:` entries are summed to verify the signature |
| `summary.json` | Source commit, both executable hashes, settings, color balance, score, and elapsed time |
| `all-games.pgn` | Full replayable move record for all completed games |
| `games.jsonl` | Per-game moves, FENs, search telemetry, result, and termination |
| `evidence/64-game-replay.mp4` | Video rendered from actual PGN moves |
| `evidence/64-game-final-positions.png` | Contact sheet of all 64 actual final board positions and results |

The video and poster are renderings of the PGN, not fabricated game footage. The PGN and JSONL remain the authoritative move-by-move records.

## Interpretation and limitations

- A 64-game score is a match result, **not an Elo rating** or proof of general superiority.
- The Stockfish 2.0 check is a practical source/build fingerprint: pinned official source commit + UCI identity + the 16-position historical bench signature + executable SHA-256. It is not a cryptographic publisher signature.
- The historical 1 November 2026 owner-supplied 63–1–0 report is separate. Its archived metadata identifies the tested Prunex 0.8.0 binary as **Stockfish 19-derived**, says the raw PGN and JSONL were not in the repository, and records no verified Stockfish 2.0 executable identity or SHA-256. It must not be presented as evidence for the independent native engine.
- The browser site's footer previously credited Stockfish.js 19 for browser analysis. A screenshot of the web board documents the interface only; it is not evidence of this native Prunex-versus-Stockfish 2.0 match.

## Source files

- `tools/stockfish-2.0-match/verify_stockfish_2.py`
- `tests/test_stockfish_2_verifier.py`
- `tools/stockfish-2.0-match/run_match.py`
- `tools/stockfish-2.0-match/render_evidence.py`
- `.github/workflows/stockfish-2.0-64.yml`
