# Prunex engine-strength development plan

## Objective

Develop Prunex as an independently implemented C++ chess engine, with a distinct architecture and a measurable playing-strength target. Stockfish 19 may be used as an external opponent and performance reference only. No Stockfish source, patches, implementation fragments, neural-network weights, or other engine code are to be incorporated into Prunex.

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
- Native, Windows, and WebAssembly builds with regression and parity tests.

This is the repository's documented baseline, not a claim of parity with a top-tier engine.

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
- Carefully bounded null-move pruning, futility pruning, razoring, and late-move reductions.
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
- Do not claim Stockfish 19 parity unless a sufficiently large, reproducible match series supports it.

## Code-quality standard

The objective is maintainable and correct software, not a particular stylistic appearance. Code should use consistent project conventions, descriptive names, comments that explain non-obvious invariants, small testable units, explicit error handling, and meaningful regression tests. Do not add artificial irregularities or alter code merely to influence authorship detectors.

Research on source-code authorship detection reports poor generalization across tools and domains. Detector scores are not a reliable substitute for source history, design records, tests, and reproducible development evidence.

## Release gates

A strength-related release is not complete until:

1. Native regression and perft suites pass.
2. Sanitizer and supported compiler builds pass.
3. Native/WebAssembly parity passes.
4. Fixed-position performance reports are attached.
5. Controlled match data and PGNs are retained.
6. Documentation describes only features present in the tested release.
