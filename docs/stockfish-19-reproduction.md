# Prunex vs Stockfish 19: reproducible strength benchmark

## Purpose

This workflow measures the native Prunex build against the pinned official Stockfish 19 release. It does not claim that Prunex is already at Stockfish 19 strength. The benchmark is a controlled diagnostic and its result is limited to the recorded configuration.

## Engine identities and provenance

- Prunex is built from the repository commit tested by the workflow.
- Stockfish is cloned from the official `sf_19` tag at commit `edb0d9db6731067ec50ce619ff372b463bc4dd5d`.
- The build downloads the Stockfish 19 NNUE network declared in `src/evaluate.h`; the build script validates the file against its SHA-256-derived filename.
- The exact opponent executable, neural-network file, upstream source commit, and local patch are recorded in the verification evidence.
- The local Stockfish patch adds periodic node-limit polling to quiescence search, which otherwise can continue past a UCI node stop. It does not change evaluation, move generation, move ordering, or search scores.

## Match protocol

- 16 fixed opening positions, each played twice.
- Prunex plays both White and Black in each repetition: 32 games per color, 64 total.
- Each engine is asked to search 1,000,000 nodes per move by default.
- Prunex uses a native transposition table with `PRUNEX_TT_BITS=22` (4,194,304 entries). Stockfish 19 uses a 160 MiB Hash setting. The table layouts are different; the configured budgets are close in memory, not byte-for-byte identical.
- Both engines use one thread.
- The Stockfish 19 node polling interval is at most 512 nodes; observed node counts and the bounded allowance are retained for every move.
- Every game is saved to PGN and JSONL, including move coordinates, FEN before each move, nodes, depth, score telemetry where available, result, and termination reason.

The score is not an Elo estimate. Sixty-four games from a fixed opening suite are useful diagnostic evidence, not proof that one engine is generally stronger. Stronger claims require larger paired-color match series, varied openings, fixed hardware, and statistical uncertainty.

## Evidence

After the 64 games complete, the workflow creates:

- `all-games.pgn`: all 64 completed games.
- `games.jsonl`: per-move FEN and search telemetry.
- `summary.json`: engine identities, executable hashes, source/network/patch provenance, configuration, and aggregate result.
- `evidence/replay.html`: offline move-by-move viewer.
- `evidence/64-game-replay.mp4`: rendered replay with move sounds.
- `evidence/64-game-final-positions.png`: final-position contact sheet.
- `evidence/stockfish-19-*.txt`: raw opponent verification output.
- `SHA256SUMS.txt`: checksums of generated artifacts.

No replay is rendered until the match runner has produced and validated all 64 games. A partial or cancelled run is not a completed match.

## Workflow behavior

Pull requests run compilation, regressions, Stockfish 19 source/network verification, and a two-color node-limit integration probe; they do not run the full match. A merge to `main` starts the 64-game run. A new run on the same branch cancels a superseded run.
