# Prunex 0.8.0 — Stockfish 2.0 benchmark post-mortem

This report analyzes the two drawn games from the completed 64-game benchmark. It does not reinterpret either draw as a win.

## Evidence

The primary evidence is the archived artifact attached to GitHub Actions run [41253517143](https://github.com/Mohamed-Mostafa-GT/Prunex/actions/runs/41253517143), which contains the PGN and JSON result summary.

The benchmark was 64 games across 16 openings, each repeated twice with colors balanced. Each engine received one thread, 128 MB hash, and 100,000 nodes per move. The result was 62 Prunex wins, 2 draws, and 0 losses (63/64 points, 98.44%).

## Draw 1 — Round 36, Nimzo-Indian Defense

- Prunex played Black.
- Game termination: threefold repetition.
- Result: draw.

A repetition draw is a game-theoretic outcome under the played move sequence, not evidence that either engine was winning. The fact that Prunex was Black is a useful lead for follow-up testing, but does not by itself establish a systematic Black-side defect.

## Draw 2 — Round 62, Grünfeld Defense

- Prunex played Black.
- Game termination: threefold repetition.
- Result: draw.

As with round 36, threefold repetition ended the game. The opening label alone is not sufficient to diagnose the underlying cause; the full move sequence and engine evaluations are needed to identify the point at which the position repeated and whether a winning continuation was available.

## What can be concluded

Both draws happened with Prunex playing Black and both were adjudicated by threefold repetition. This supports prioritizing Black-side opening and repetition analysis in subsequent experiments.

It does **not** prove that:
- Prunex had a forced win in either game;
- a single evaluation or search parameter caused the repetition;
- more nodes necessarily convert either draw into a win.

## Recommended next experiments

1. Replay each PGN and annotate every repeated position, including whose move it is and the half-move clock.
2. Re-run the two exact positions with deterministic search settings at 100k, 250k, 500k, and 1M nodes per move.
3. Record principal variations and scores at each repetition cycle; compare best moves with the played moves.
4. Test both colors in each opening using paired games and a larger sample.
5. Only change search/evaluation parameters when the replay demonstrates a specific missed continuation. Re-run the same opening set after every change.

## Lineage disclosure

The tested Prunex 0.8.0 binary is derived from official Stockfish 19 (tag `sf_19`); the benchmark workflow's source edit changes UCI engine identification. Its search, evaluation, and move-generation implementation remain Stockfish 19's. The independently authored Prunex 0.5.x line is separate and did not produce this benchmark result.

The browser site uses a separate Stockfish.js 19.0.1 lite single-threaded WebAssembly package; it is not the tournament executable.

## Suggested wording

> In a 64-game, color-balanced benchmark against an official Stockfish 2.0 source build, Prunex 0.8.0 (derived from Stockfish 19) scored 98.44% with 62 wins, 2 draws, and no losses. Both draws ended by threefold repetition with Prunex playing Black. Full PGN and build provenance are preserved in the linked GitHub Actions artifact.
