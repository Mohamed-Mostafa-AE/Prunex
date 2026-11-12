# Prunex Engine-Strength Development Plan

## Objective

Develop Prunex through original search, move-generation, and evaluation work. The long-term target is competitiveness with Stockfish 19, with a clear intermediate goal of beating Stockfish 2.0 convincingly. Neither has been demonstrated by the current branch.

All work remains isolated on `engine/stockfish-gap-rebuild-2026-11`. It is not merged into `main` or the frozen 0.8.0 release.

## Diagnostic opponent baseline

The archived 144-game candidate (`129829dd95672e83a347563526ae7b28ccf1ea63`) scored:

- Stockfish 19: 1 win, 5 draws, 66 losses in 72 games (4.86%).
- Triumviratus 8.1: 0 wins, 2 draws, 70 losses in 72 games (1.39%).

This is the result for that exact old candidate. It is not an Elo estimate and says nothing about later code until it is tested. The separate historical Stockfish 2.0 test did not complete 64 games; its latest recorded attempt stopped after nine games when the external engine exceeded the requested node budget by two nodes. It has no valid 64-game score.

## Search and move-generation work on the isolated branch

- Runtime BMI2 PEXT dispatch for slider attack indexing on supported x86 processors, with a portable fallback.
- Fixed-size per-ply move-generation buffers in place of recursive heap-backed move vectors.
- Staged move ordering, with ordering deferred until a phase is reached.
- Capture-only legal move generation in quiescence, with separate terminal-position detection.
- Corrected the LMR history lookup to use the side that made the move.
- Final UCI search telemetry for total nodes, completed depth, elapsed time and TT hits.
- Regression coverage for move generation, terminal positions, staged ordering, telemetry and portability.

The experimental capture/continuation-history additions were removed after the fixed-position ablation showed a loss of equal-node search depth. They are not part of the accepted search path.

## Fixed-position performance evidence

GitHub Actions run [43227602993](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/43227602993), candidate commit `d40529248ddce0075450eadb42934e30fee78182`, compared the archived baseline and the current search on five fixed positions, with three repeated runs per variant:

| Measure | Archived baseline | Candidate |
|---|---:|---:|
| Median NPS, depth 5 | 527,823 | 1,072,842 |
| Median elapsed time, depth 5 | 510 ms | 286 ms |
| Median nodes, depth 5 | 269,190 | 269,164 |
| Median depth at 200,000 nodes | 6 | 6 |
| Median time at 200,000 nodes | 340 ms | 174 ms |

This is a measured throughput result for the search build. It is not a playing-strength result: the workflow explicitly ran no opponent games, the equal-node median depth remained 6, and the optional NNUE file was not loaded. The incremental NNUE cache is therefore not responsible for this benchmark result; its own performance still needs to be measured with a trained model loaded.

An earlier 40-pair / 80-game internal match against the archived Prunex build scored 28 wins, 29 draws and 23 losses (53.12%), with a paired 95% interval of 46.3%–60.0%. That result is inconclusive and is for an earlier candidate commit. A larger 100-pair run is tracked separately; its result must be read from the finished artifact before drawing conclusions.

## Original Prunex HalfKP evaluator: prototype status

The branch now contains an original Prunex network file format, a HalfKP-style feature extractor, a PyTorch trainer and an optional UCI `EvalFile` loader:

- `src/nnue.hpp`: bounded file loader and native inference for the Prunex network format. It is not compatible with Stockfish `.nnue` network files.
- `tools/training/prepare_lichess_eval.py`: streams the Lichess evaluation export, validates positions, excludes mate-only labels, records source hashes and provenance, deduplicates position IDs using a disk-backed SQLite index, and creates hash-based train/validation/test splits.
- `tools/training/train_halfkp.py`: trains an original HalfKP model and exports a Prunex network, checkpoint and report.
- `tests/test_halfkp_training.py`: end-to-end smoke test intended to train a small fixture, export the file, and load it in the native engine.

The Lichess Open Database page reports 417,862,375 evaluated positions as of 2026-11-11, released under CC0. Its evaluations were produced by various Stockfish flavours, not exclusively Stockfish 19: https://database.lichess.org/. The training corpus is teacher data, not ground-truth optimal play.

**Important limitations:** no full Lichess corpus has been imported for this project, no production-scale Prunex network has been trained, and no trained network has been shown to improve playing strength. The native inference path uses quantized integer weights and activations with a final centipawn scaling step. Each position now carries 32-bit HalfKP feature accumulators: ordinary piece moves update only the affected rows, while king moves rebuild the moved side's perspective. The cache is restored through undo and rebuilt when it is invalid or belongs to another loaded network. The implementation is correctness-tested, but it is still a prototype: SIMD kernels and a strength-qualified trained model are not present. The UCI option continues to use the handcrafted evaluator until a model is explicitly loaded.

The initial training smoke test exposed a missing NumPy dependency in the export path; NumPy is now pinned. The corrected end-to-end CI run passed on the current candidate, including export, native loading, search startup, and Python/native evaluation parity on 16 synthetic held-out fixture positions. This validates the training/export/inference pipeline, not the quality of a production model.

## Remaining evaluation work

To make the network competitive rather than merely loadable:

1. Import a recorded, appropriately sized CC0 teacher corpus and retain the archive hash and corpus manifest.
2. Train on the full intended training split, use validation only for model selection, and report test metrics once on the untouched test split.
3. Add quantization-aware training, integer inference, range checks and scalar/SIMD equivalence tests.
4. Add SIMD inference kernels and compare them against the scalar implementation with exact integer-equivalence tests.
5. Benchmark inference NPS and full-engine node throughput against the handcrafted evaluator.
6. Run equal-resource, paired-colour self-play across multiple seeds. Keep the evaluator disabled by default until the network improves playing strength, not just teacher-score loss.

Stockfish's NNUE documentation explains the importance of sparse features, incremental accumulators and low-precision integer inference: https://official-stockfish.github.io/docs/nnue-pytorch-wiki/docs/nnue.html. Its Stockfish 19 release notes describe QAT and training on hundreds of billions of positions: https://github.com/official-stockfish/Stockfish/releases/tag/sf_19. These are research references, not source code or weights to copy.

## Further search work

The search is still single-threaded and uses a hybrid mailbox/bitboard position representation. Further work should profile transposition-table layout/replacement, LMR/null-move/aspiration conditions, tactical stability, and move-ordering quality. Each change needs a fixed-position ablation and paired self-play evidence. Do not keep heuristics merely because they are common in other engines.

## Internal qualification before an external match

Before another Stockfish or Triumviratus match:

- GCC, Clang, ASan/UBSan, Windows x64 and WebAssembly gates pass on the exact candidate commit.
- Legal move/perft, make/undo, hashing, tactical, search-state and UCI regressions pass.
- The actual evaluator file, if used, is trained, checked, hashed and recorded with its corpus manifest.
- Fixed-position profiling reports final node counts, NPS, completed depth, time and TT usage.
- Paired, equal-resource self-play against the archived Prunex baseline gives a repeatable improvement with a confidence interval that excludes no change.
- The candidate and test protocol are frozen before any external match starts.

These are prequalification gates, not proof of Stockfish 19 parity. Only a controlled external match can establish relative strength.

## Provenance and licensing

Prunex engine source and network format are original project work. The offline tools that use GPL-licensed python-chess are separately marked under GPL-3.0-or-later. The Lichess evaluation archive is CC0. Record every dataset source and license. Do not copy GPL-licensed source or pretrained Stockfish/PlentyChess weights into the MIT-licensed native engine.

## Match policy

No further opponent tournament is automatically triggered by this branch. The existing 144-game Stockfish 19/Triumviratus run stays archived as the diagnostic baseline. A new Stockfish 2.0 test must be a complete, reproducible paired-colour match with correct node accounting; Stockfish 19 parity needs its own separate and much larger evaluation.

## NNUE inference capacity and SIMD work

The current HalfKP runtime now supports hidden widths up to 512 while keeping the existing default trainer width unchanged. Dense-layer integer dot products use runtime AVX2 dispatch on supported GCC/Clang x86 builds and retain an exact scalar fallback for other CPUs, MSVC and WebAssembly. The AVX2 kernel uses unsigned 8-bit activations and signed 8-bit weights; its pairwise products fit the signed 16-bit intermediate range, and the final accumulation remains 64-bit. Regression tests compare the dispatched result with the scalar reference across vector-aligned widths and tail lengths up to 1,025 elements.

This is infrastructure for larger original Prunex networks, not a trained evaluator or a strength result. No 512-wide network has been trained or qualified, and the current CI fixture remains synthetic. The new kernel still needs a loaded-network benchmark on representative positions before its practical speedup can be reported. The existing handcrafted evaluator remains the default unless a Prunex network is explicitly loaded.
