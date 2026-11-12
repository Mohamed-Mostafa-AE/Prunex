# Prunex Engine-Strength Development Plan

## Objective

Develop Prunex through independently implemented search, move-generation, and evaluation improvements. Stockfish 19 parity is the long-term target, not a present claim or rating estimate.

This work is isolated on `engine/stockfish-gap-rebuild-2026-11`, separate from `main` and the frozen 0.8.0 release.

## Diagnostic baseline

The archived 144-game run tested candidate commit `129829dd95672e83a347563526ae7b28ccf1ea63`:

- Stockfish 19: 1 win, 5 draws, 66 losses in 72 games.
- Triumviratus 8.1: 0 wins, 2 draws, 70 losses in 72 games.

This is a diagnostic result for that exact candidate, not an Elo estimate and not evidence about this development branch. It remains the baseline. No further opponent tournament is being run during this phase.

## Audit findings

The engine already has iterative deepening, alpha-beta/PVS, aspiration windows, Zobrist hashing, a transposition table, SEE capture ordering, killer/history/counter moves, null-move pruning, late-move reductions and quiescence.

The major limitations are:
- A hybrid 0x88 mailbox/bitboard position representation.
- No runtime BMI2 path in the original slider-occupancy indexing.
- Heap-backed recursive move lists and eager full-list sorting.
- A handcrafted tapered evaluator, with no trained neural evaluator or NNUE inference path.
- Single-threaded search.

## Changes on the isolated branch

- Runtime BMI2 PEXT dispatch for supported x86 CPUs, with a portable fallback.
- Accurate final UCI search counters (nodes, completed depth, elapsed time, TT hits).
- Telemetry now distinguishes final counters from the previous completed-iteration snapshot.
- Fixed per-ply pseudo-legal/legal move buffers; no recursive heap move vectors.
- Quiescence no longer allocates a separate capture list.
- Staged move selection: TT move, profitable captures/promotions, killer/counter quiets, other quiets, losing captures.
- Fixed the LMR history lookup to use the side that made the candidate move.
- Added telemetry-parser and staged-picker regression tests.

These are foundations, not a demonstrated Elo gain. The exact candidate must pass correctness and performance checks.

## Search work still required

- Profile staged selection against the previous Prunex commit on fixed positions.
- Revisit TT layout, replacement policy and hash usage.
- Add capture and continuation/correction histories with regression coverage.
- Tune LMR, null-move pruning, aspiration windows and quiescence only from reproducible profiling, tactical tests and paired self-play.
- Profile completed depth, nodes, NPS and elapsed time on fixed test positions.

No Stockfish or other engine source should be copied into Prunex. Public algorithms may be studied and independently implemented.

## Original NNUE-style evaluator

The handcrafted evaluator is a major ceiling against modern engines. Prunex needs its own feature design, trainer, inference implementation and weights.

The official NNUE documentation explains three key principles: sparse active features, incremental updates when only a few inputs change, and low-precision integer inference. A suitable first Prunex design should include:

1. A versioned king-conditioned piece-square feature map.
2. Two perspective accumulators, with explicit refresh rules when either perspective's king moves.
3. Correct incremental make/undo deltas for captures, promotions, en-passant and castling.
4. A portable scalar integer inference path first; SIMD only after exact equivalence tests.
5. A bounded, versioned model format with checksums and deterministic loader tests.
6. A reproducible trainer with fixed seeds, dataset manifests, train/validation splits, WDL/score calibration, checkpoints and export tests.
7. Prunex self-play positions and search labels, with provenance and license records for every external data source.

An untrained or randomly initialized network is not an improvement. The handcrafted evaluator must not be replaced until a trained checkpoint improves paired self-play at equal resources.

## Internal qualification gates

Before another external-engine match:

- All legal-move/perft, make/undo, hash, tactical, search-state and UCI tests pass.
- GCC, Clang, sanitizers, Windows and WebAssembly checks pass on the exact commit.
- No unresolved tactical or state-restoration regression remains.
- Fixed-position benchmarks report final nodes, NPS, completed depth, elapsed time and TT usage.
- Paired equal-resource self-play shows statistically meaningful improvement over the archived Prunex baseline.
- Network checkpoint, build flags and SHA-256 checksums are frozen and recorded.

These are prequalification gates, not proof of Stockfish 19 parity. Only controlled external matches can establish relative strength.

## Research references

For study and independent implementation, not copying:

- [Stockfish NNUE documentation](https://official-stockfish.github.io/docs/nnue-pytorch-wiki/docs/nnue.html) — sparse features, accumulators, quantization, inference and training.
- [Stockfish NNUE architecture history](https://official-stockfish.github.io/docs/nnue-pytorch-wiki/docs/nnue_architecture_history.html) — examples of architecture evolution.
- [Stockfish sf_19 search](https://github.com/official-stockfish/Stockfish/blob/sf_19/src/search.cpp) — search organization and history mechanisms.
- [PlentyChess](https://github.com/Yoshie2000/PlentyChess) — a public example of modern NNUE and large-scale self-play.
- [Improving](https://www.chessprogramming.org/Improving) and [Late Move Reductions](https://www.chessprogramming.org/Late_Move_Reduction) — heuristic background.

The reference projects and models have their own licenses. Prunex is MIT-licensed; no GPL-licensed source or weights may be silently absorbed. Record provenance for all Prunex source, training data and model weights.

## Match policy

No Stockfish 2.0, Stockfish 19, Triumviratus or other opponent tournament is triggered from this branch. The 144-game run remains the diagnostic baseline. Another ladder stage requires a separately reviewed candidate, passing internal qualification evidence and an explicit go-ahead.
