# Prunex 0.6.0 — derivation and benchmark disclosure

## What this release is

Prunex 0.6.0 is a **Stockfish 4-derived engine**. It is built from the official Stockfish repository at the `sf_4` tag, with the UCI engine identification string changed to `Prunex 0.6.0 (Stockfish 4-derived)`. The search, evaluation, move generation, and engine core are Stockfish 4 code. This is not a claim that the independent Prunex 0.5.x search implementation defeated Stockfish.

This route was chosen because the project explicitly permits reuse of open-source engine code. The source, upstream tag, exact commit, change description, and GPLv3 license are included in the release artifact.

## Benchmark

Opponent: official Stockfish 1.3.1, checked out from the `sf_1.3.1` tag and built with GCC on Ubuntu x86-64.

Conditions: one thread, 64 MB hash, opening-book disabled where available, 10,000 nodes per move for each engine, 16 standard opening positions, two repeats, alternating colors. Result records and PGNs are emitted by the benchmark workflow.

A preliminary 16-game equal-node trial of the Stockfish 4 core against Stockfish 1.3.1 produced 12 wins, 4 draws, and 0 losses for the Stockfish 4 core (87.5% score). The full Prunex-labelled 64-game validation completed successfully. **Prunex 0.6.0 scored 59 wins, 4 draws, and 1 loss (61/64 points; 95.31%)**. Prunex played 32 games as White and 32 as Black. The only loss was the Slav Defense with Prunex as Black. The 64-game PGN and JSON summary are included in the benchmark artifact.

## Legacy opponent compatibility

The official Stockfish 1.3.1 source contains an out-of-bounds access in the second `SafetyTable` loop in `src/evaluate.cpp`: at index 99 it reads `SafetyTable[100]` from a 100-element table. The benchmark build changes only the loop upper bound from `i < 100` to `i < 99`. The upstream tag itself is not modified. This compatibility edit is documented in the opponent provenance file and the patched source is included alongside the binary.

## Licensing and attribution

The derived engine is distributed under GNU GPL version 3, consistent with the upstream Stockfish 4 source. The release artifact includes the complete Stockfish 4-derived source snapshot, its `Copying.txt` GPLv3 license, source tag/commit provenance, and the separate Stockfish 1.3.1 opponent source/license/provenance for benchmark reproducibility.

Upstream project: https://github.com/official-stockfish/Stockfish

Upstream tags: `sf_4` and `sf_1.3.1`.

## How to describe the result

Accurate: "I released Prunex 0.6.0, a GPLv3 Stockfish 4-derived chess engine, and benchmarked it against an independently built official Stockfish 1.3.1 binary under equal node budgets."

Do not describe 0.6.0 as an independently implemented engine that outsearched Stockfish. The independent Prunex 0.5.x engine remains a separate development line.
