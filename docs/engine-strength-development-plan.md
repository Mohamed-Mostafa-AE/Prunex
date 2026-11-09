# Prunex engine-strength development plan

## Objective

Develop Prunex as Mohamed Mostafa's original, independently implemented C++ chess engine, built from scratch with its own architecture and implementation. The objective is to reach top-tier competitive playing strength through measurable, original engineering work. No external engine source, patches, implementation fragments, or weights are to be incorporated into Prunex.

The initial design constraint for this programme is a deterministic, handcrafted evaluation function rather than a neural-network evaluator. Search and evaluation improvements must be implemented as original Prunex code and validated through tests and controlled matches.

## Current baseline

The current native engine is C++20 and includes:

- 0x88 mailbox position representation.
- Pseudo-legal move generation with king-safety filtering.
- FEN and UCI handling, castling, en passant, and promotions.
- Zobrist position keys and a transposition table.
- Iterative-deepening negamax with alpha-beta and principal-variation search.
- Aspiration windows, late-move reductions, move ordering, killer/history heuristics, and quiescence search.
- A handcrafted tapered middlegame/endgame evaluator.
- Search-path repetition detection and fifty-move draw handling.
- Insufficient-material detection and null-move pruning with verification at greater depths.
- Native, Windows, and WebAssembly builds with regression and parity tests.

This is the repository's documented baseline. Strength remains a measured engineering objective, not an assumed result.

## Engineering sequence

### 1. Establish a trustworthy baseline

- Preserve a reproducible release build and record its source commit and executable SHA-256.
- Run perft suites and add edge-case positions for legality, castling, en passant, promotions, repetition, and fifty-move handling.
- Add tactical, quiet-position, endgame, and mate-search suites.
- Record fixed-hardware nodes-per-second and fixed-time search results.
- Create a match harness that retains PGNs, engine identities, options, seeds, time controls, and result summaries.

### 2. Improve the search core

Evaluate and implement independently, with an isolated test for each change:

- A cache-friendly clustered transposition table with depth/age-aware replacement.
- Incremental position hashing and carefully validated make/unmake state.
- More selective move ordering, including static exchange evaluation and staged move generation.
- Refined history, continuation-history, killer, and countermove scoring.
- Further tune null-move pruning; evaluate futility pruning, razoring, and refined late-move reductions.
- Better aspiration-window management and principal-variation stability.
- Search instrumentation for node types, cutoffs, reductions, re-searches, and transposition-table quality.

Selective pruning must be tested for tactical blind spots; more pruning is not automatically stronger.

### 3. Improve the evaluation function

Keep the evaluator interpretable and handcrafted. Develop and test terms for:

- Piece mobility and safe mobility.
- King safety, attack units, and open-file pressure.
- Pawn structure, backward and isolated pawns, passed pawns, and pawn races.
- Outposts, bishop pair, rook activity, seventh-rank pressure, and coordination.
- Threats, hanging pieces, trapped pieces, and space.
- Phase-aware king activity and specialized endgame knowledge.

Use held-out positions and controlled matches when tuning parameters. Do not tune on the final test set.

### 4. Improve throughput and scalability

- Profile before optimizing; retain reproducible benchmark inputs.
- Reduce allocation and copying in hot paths.
- Evaluate compact move encoding and cache locality.
- Add optional multi-threaded search only after single-thread correctness is stable.
- Keep native and WebAssembly behaviour consistent, with explicit platform-specific limits.

### 5. Validate playing strength

- Use balanced-color match pairs, randomized opening suites, fixed hardware, and fixed time controls.
- Retain every PGN and machine-readable result.
- Report sample size, score, confidence interval, opponent build identity, and exact Prunex commit.
- Separate search throughput, tactical-suite results, and Elo estimates; none is a substitute for the others.
- Set strength claims only from sufficiently large, reproducible match series with retained game records.

## Code-quality standard

Keep the implementation readable, maintainable, and consistent with the existing C++20 codebase. Use descriptive names, explain non-obvious invariants, keep search heuristics bounded, and add focused regression tests for every behavior change. Prefer measured improvements over speculative complexity.

## Release gates

A strength-related release is not complete until:

1. Native regression and perft suites pass.
2. Sanitizer and supported compiler builds pass.
3. Native/WebAssembly parity passes.
4. Fixed-position performance reports are attached.
5. Controlled match data and PGNs are retained.
6. Documentation describes only features present in the tested release.
