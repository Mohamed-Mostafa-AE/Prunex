# Stockfish 2.0 comparison record

## Reported result

The project retains a reported 64-game result for the separately identified **Prunex 0.8.0 browser build** against **Stockfish 2.0 64-bit**:

| Wins | Draws | Losses | Points | Score |
|---:|---:|---:|---:|---:|
| 63 | 1 | 0 | 63.5 / 64 | 99.22% |

Reported conditions: 1,000,000 nodes per move, 256 MB hash, one thread, and 16 openings played twice with colors reversed.

## Provenance and interpretation

This record is historical and is not a strength result for the independently implemented native C++ engine. The browser build associated with the record was based on Stockfish 19. The website's current browser opponent also uses the separately licensed Stockfish.js 19 Full build. Do not describe this as native Prunex defeating Stockfish 2.0, and do not use it to assign an Elo rating to the native C++ engine.

The score-derived estimate of approximately +842 Elo (using the inverse expected-score formula) is descriptive only. The frequently quoted ~3,904 estimate uses CCRL's Stockfish 2.0.1 rating as a proxy, not the exact Stockfish 2.0 executable. This is not an official rating and is not directly comparable with CCRL rating lists.

## Evidence required for a reproducible publication

The original raw PGN, engine binary/source identifiers, exact Stockfish 2.0 binary hash, match runner version, opening suite, complete UCI options, per-game logs, and timestamped screenshots were not present in the repository at the time this document was written. Therefore this record is marked **reported / not independently reproducible from repository artifacts**. Do not manufacture screenshots or logs.

To upgrade this record to independently verifiable evidence, add:

- The complete 64-game PGN (with headers identifying both engine builds and settings).
- SHA-256 hashes for both engine executables and the match-runner source revision.
- Raw UCI/game logs showing node limits, hash, thread count, termination reason, and result.
- The opening suite and color-pair schedule.
- Screenshots captured from the actual match runner and final PGN summary, cross-referenced to the PGN game IDs.
- A script that parses the PGN, independently counts W/D/L, validates 64 games, verifies 16 opening pairs with colors reversed, and reproduces 63.5/64.

A new strength claim should use a larger paired-color suite and report confidence intervals or SPRT. For competitive rating claims, submit the native C++ UCI engine to an independent testing pool under its own identity.

## Reproduction checklist

1. Pin source commits and binary hashes.
2. Archive raw PGN, logs, settings, and opening suite.
3. Recount results using an independent parser.
4. Publish the unmodified evidence artifacts alongside the generated summary.
5. Keep the browser-build result and native-engine tests in separate sections.
