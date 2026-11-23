# Prunex Engine-Strength Development Plan

## Objective

Develop Prunex through original search, move-generation, and evaluation work. The long-term target is competitiveness with Stockfish 19, with a clear intermediate goal of beating Stockfish 2.0 convincingly. Neither has been demonstrated by the current branch.

All work remains isolated on `engine/stockfish-gap-rebuild-2026-11`. It is not merged into `main` or the frozen 0.8.0 release.

## Diagnostic opponent baseline

The archived 144-game candidate (`129829dd95672e83a347563526ae7b28ccf1ea63`) scored:

- Stockfish 19: 1 win, 5 draws, 66 losses in 72 games (4.86%).
- Triumviratus 8.1: 0 wins, 2 draws, 70 losses in 72 games (1.39%).

This is the result for that exact old candidate. It is not an Elo estimate and says nothing about later code until it is tested. The separate historical Stockfish 2.0 test did not complete 64 games; its latest recorded attempt stopped after nine games when the external engine exceeded the requested node budget by two nodes. It has no valid 64-game score.

### November 13 Stockfish 19 match

Candidate `c19df7176896a32756377309de84af071f8111bd` played 24 games per tier against the official Stockfish 19 release. Both engines played each opening from both sides.

| Search limit | Prunex wins | Draws | Prunex losses | Prunex score |
| --- | ---: | ---: | ---: | ---: |
| 100,000 nodes per move | 2 | 1 | 21 | 10.42% |
| 1,000,000 nodes per move | 0 | 0 | 24 | 0.00% |
| 500 ms per move | 1 | 2 | 21 | 8.33% |

[Match logs, PGNs and telemetry](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/43445326540)

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

GitHub Actions run [43241766591](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/43241766591), candidate commit `ac198de7d34b4957d8f52e46f1b3d5dc342f4b1c`, compared the archived baseline and the current search on five fixed positions, with three repeated runs per variant:

| Measure | Archived baseline | Candidate |
|---|---:|---:|
| Median NPS, depth 5 | 520,676 | 1,036,597 |
| Median elapsed time, depth 5 | 517 ms | 296 ms |
| Median depth at 200,000 nodes | 6 | 6 |
| Median time at 200,000 nodes | 341 ms | 181 ms |

This is a measured throughput result for the search build. It is not a playing-strength result: the workflow explicitly ran no opponent games, the equal-node median depth remained 6, and the optional NNUE file was not loaded. The incremental NNUE cache, AVX2 inference and factorized trainer are therefore not responsible for this benchmark result; their performance still needs to be measured with a trained model loaded.

An earlier 40-pair / 80-game internal match against the archived Prunex build scored 28 wins, 29 draws and 23 losses (53.12%), with a paired 95% interval of 46.3%–60.0%. That result is inconclusive and is for an earlier candidate commit. A larger 100-pair run is tracked separately; its result must be read from the finished artifact before drawing conclusions.

## Original Prunex HalfKP evaluator: prototype status

The branch now contains an original Prunex network file format, a HalfKP-style feature extractor, a PyTorch trainer and an optional UCI `EvalFile` loader:

- `src/nnue.hpp`: bounded file loader and native inference for the Prunex network format. It is not compatible with Stockfish `.nnue` network files.
- `tools/training/prepare_lichess_eval.py`: streams the Lichess evaluation export, validates positions, excludes mate-only labels, records source hashes and provenance, deduplicates position IDs using a disk-backed SQLite index, and creates hash-based train/validation/test splits.
- `tools/training/train_halfkp.py`: trains an original HalfKP model with a virtual P-feature factorizer, coalesces the learned virtual rows into the real HalfKP rows, and exports a Prunex network, checkpoint and report.
- `tests/test_halfkp_training.py`: end-to-end smoke test intended to train a small fixture, export the file, and load it in the native engine.

The Lichess Open Database page reports 417,862,375 evaluated positions as of 2026-11-11, released under CC0. Its evaluations were produced by various Stockfish flavours, not exclusively Stockfish 19: https://database.lichess.org/. The training corpus is teacher data, not ground-truth optimal play.

**Important limitations:** no full Lichess corpus has been imported for this project, no production-scale Prunex network has been trained, and no trained network has been shown to improve playing strength. The native inference path uses quantized integer weights and activations with a final centipawn scaling step. Both dense-layer dot products and incremental feature-row updates now have runtime-dispatched AVX2 implementations with exact scalar fallbacks. Each position now carries 32-bit HalfKP feature accumulators: ordinary piece moves update only the affected rows, while king moves rebuild the moved side's perspective. The cache is restored through undo and rebuilt when it is invalid or belongs to another loaded network. The trainer now uses a virtual P factorizer to share early learning across the 64 king-square buckets; the P weights are coalesced into the HalfKP rows during export, so the runtime format and inference feature count remain unchanged. The implementation is correctness-tested, but it is still a prototype without a strength-qualified trained model or the broader feature sets used by modern Stockfish. The UCI option continues to use the handcrafted evaluator until a model is explicitly loaded.

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

## Quiet-move history experiment

Stockfish and Ethereal keep move-ordering scores responsive by reducing the effect of repeated outcomes as the score approaches its limit. This is commonly called [history gravity](https://www.chessprogramming.org/History_Heuristic#History_Bonuses). Prunex keeps its own history table, cutoff rules, and depth weights. Its update moves each score a fraction of the way toward the positive or negative limit. No engine source files or weights are imported.

The branch compares this single change against the preceding Prunex build and official Stockfish 19. The runs record the exact commits, both colours for each opening, resource limits, PGNs, per-move counters, and paired scores.

[Stockfish 19 history implementation](https://github.com/official-stockfish/Stockfish/blob/sf_19/src/history.h) · [Ethereal history implementation](https://github.com/AndyGrant/Ethereal/blob/master/src/history.c)

Results for candidate `1d15a2ca838c75ad8a643ca3bfbcf4782d049157`:

| Opponent and limit | Games | Wins | Draws | Losses | Prunex score |
| --- | ---: | ---: | ---: | ---: | ---: |
| Previous Prunex, 25,000 nodes per move | 48 | 18 | 15 | 15 | 53.12% |
| Stockfish 19, 100,000 nodes per move | 24 | 1 | 1 | 22 | 6.25% |
| Stockfish 19, 100 ms per move | 24 | 1 | 3 | 20 | 10.42% |

The internal paired 95% confidence interval was 46.33%–59.92%. The sample leaves the change's effect on Prunex's strength uncertain. Both external tests used one thread and 128 MiB of hash per engine. The candidate remains well below Stockfish 19 at these limits.

[Match logs and downloadable evidence](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/45042096669)

## Threat evaluation

Prunex already builds attack sets for mobility and king safety. The evaluator now also uses them to score attacked pieces with no defender, attacks by pawns, and attacks by minor pieces on rooks and queens. Each threatened piece is counted once. The middle-game and endgame weights are kept separate.

The match campaign compares this candidate with the official Stockfish 19 release at 100, 250, 500, and 1,000 ms per move. Both engines get the same time, thread and hash settings. Each opening is replayed with colours reversed. Stockfish uses its default network with skill limits disabled.

[Attack and defend maps](https://www.chessprogramming.org/Attack_and_Defend_Maps) · [Stockfish 19 release](https://stockfishchess.org/blog/2026/stockfish-19/)

## Reference HalfKP evaluator

The experimental native build runs the official Stockfish 12 network through Daniel Shawul's nnue-probe, which was adapted from Cfish. Prunex still generates moves, runs the search, and speaks UCI. The adapter maps Prunex's piece codes and squares to the probe and caches completed evaluations by position key.

Configure with `-DPRUNEX_REFERENCE_NNUE=ON` and set the native UCI option `HalfKpFile` to the downloaded `nn-82215d0fd0df.nnue`. The test workflow checks the file's published hash prefix, verifies that its scores change with material and the side to move, then compares the candidate with Stockfish 19 Full. See the [license scope](../LICENSE-SCOPE.md) for distribution terms.

[Probe source at the pinned revision](https://github.com/dshawul/nnue-probe/tree/edcd97e998b0299f952786c68fe37f04a7ed7f0d) · [Official network archive](https://github.com/official-stockfish/networks)

### Incremental feature updates

When the parent position's accumulator is available, Prunex derives the changed pieces from the two boards and passes them to the probe. It keeps the full refresh path for cache misses. UCI tests check that a fresh evaluation agrees after an ordinary move, a capture, en passant, castling, a capture-promotion, and a king move.

### Reference evaluator results

Candidate `f5e99d0281030998437643922b69bc36bdd0e8b4` recomputed the feature transformer for new positions. Candidate `49ccb7c06d094033b705c753a5be0d571646f7bf` reused available accumulators. Each candidate played Stockfish 19 Full from the same six openings with colours reversed. The opponent used the official release binary, maximum skill, and its default network.

| Time per move | Games per candidate | Direct HalfKP | Incremental HalfKP |
| --- | ---: | ---: | ---: |
| 100 ms | 12 | 8.33% | 12.50% |
| 250 ms | 12 | 8.33% | 20.83% |
| 500 ms | 12 | 12.50% | 8.33% |
| 1,000 ms | 12 | 25.00% | 20.83% |

Both candidates scored below 50% in every group. The small paired sample is useful for finding large changes in playing strength. It leaves the relative merits of the two evaluator implementations uncertain.

[Direct evaluation match](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/45059918835) · [Incremental evaluation match](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/45060239942)

### Sparse inputs for incremental HalfKP evaluation

When a cached parent accumulator is available and both kings stayed in place, Prunex passes the king squares and changed pieces to the probe. It assembles the full piece list on cache misses and when a king moves. The probe and its network stay the same.

The screening campaign pairs six openings at 100, 250, 500, and 1,000 ms per move. Within each shard, both engines use the same logical CPU, one thread, and 128 MiB of hash. The campaign archives the PGNs, opening positions, engine checksums, UCI defaults, configured options, and match rules.

Candidate `a4992e11b2a07481a53b058bca25a3806227789a` completed the 48-game screen on November 23, 2026. Stockfish 19 Full used its default network, `nn-1a298aa575a0.nnue`, with maximum skill and strength limiting disabled.

| Time per move | Games | Prunex wins | Draws | Prunex losses | Prunex score |
| --- | ---: | ---: | ---: | ---: | ---: |
| 100 ms | 12 | 0 | 3 | 9 | 12.50% |
| 250 ms | 12 | 1 | 2 | 9 | 16.67% |
| 500 ms | 12 | 0 | 4 | 8 | 16.67% |
| 1,000 ms | 12 | 0 | 5 | 7 | 20.83% |

Stockfish led at all four limits. [GitHub Actions match artifacts](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/45082249110)

### Static evaluation gate for null-move probes

An instrumented build sampled 34 Prunex positions from the 100 ms games, with a 75,000-node budget per position. There were 66,612 probes below beta out of 129,522 total probes. Those probes produced 640 cutoffs, including verified cutoffs at deeper nodes.

The experiment requires the static score to reach beta before trying a null move and uses the same non-mate window as the other forward-pruning checks. It reuses the static score at shallow nodes. The match keeps the sparse HalfKP evaluator and repeats the four paired time limits against Stockfish 19 Full.

Candidate `4b7c5451b9f589e42a230c446085661a29274386` completed 48 games on November 23, 2026. Each limit used the same six openings with colours reversed. Both engines used one thread, 128 MiB of hash, and the same logical CPU within each match shard. Stockfish used its official release binary, default network, and maximum skill.

| Time per move | Games | Prunex wins | Draws | Prunex losses | Prunex score |
| --- | ---: | ---: | ---: | ---: | ---: |
| 100 ms | 12 | 0 | 4 | 8 | 16.67% |
| 250 ms | 12 | 0 | 3 | 9 | 12.50% |
| 500 ms | 12 | 0 | 3 | 9 | 12.50% |
| 1,000 ms | 12 | 1 | 2 | 9 | 16.67% |

Stockfish finished ahead at every limit. [GitHub Actions match artifacts](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/45088131817)

### Earlier stand-pat cutoffs in quiescence

An instrumented build sampled 32 positions from the preceding campaign's 100 ms games at 75,000 nodes per position. It found 479,512 quiescence nodes that generated captures or promotions before a stand-pat cutoff. In 426,085 of those nodes, an available pawn push off the king's rays already proved there was a legal move.

This experiment applies that existing pawn-push test before generating tactics when the stand-pat score reaches beta. Other positions still generate tactics and check for stalemate. The screening campaign uses the same four time limits and paired openings against Stockfish 19 Full.

All 32 fixed-node searches matched the previous search's completed moves, scores, node counts, and transposition-table counters. On November 23, 2026, candidate `df5246cd3cfd251c39c61ad637d80b921ebbdc56` completed 48 games against the official Stockfish 19 Full release. Both engines used one thread, 128 MiB of hash, and the same logical CPU within each match shard. Stockfish used its default network and maximum skill.

| Time per move | Games | Prunex wins | Draws | Prunex losses | Prunex score |
| --- | ---: | ---: | ---: | ---: | ---: |
| 100 ms | 12 | 1 | 4 | 7 | 25.00% |
| 250 ms | 12 | 0 | 5 | 7 | 20.83% |
| 500 ms | 12 | 0 | 2 | 10 | 8.33% |
| 1,000 ms | 12 | 0 | 3 | 9 | 12.50% |

The verified PGNs put Stockfish ahead at all four limits. [GitHub Actions match artifacts](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/45093508584)

### One-ply reduction at non-PV nodes without a cached move

In 34 positions from the early-quiescence campaign, an instrumented Prunex build searched 150,000 nodes per position. Of 57,158 non-PV nodes at depth 5 or more that reached move generation outside check, 9,947 lacked a cached move. The search examined 103,899 moves at those nodes.

This experiment reduces eligible narrow-window nodes by one ply when they have no move from the transposition table. It applies the reduction after null-move pruning and records the reduced depth in the table. The campaign repeats the four paired limits against Stockfish 19 Full.

On November 23, 2026, candidate `29bd091b3244b6d239ec4d4d54b7c7f4fe1b3466` played 48 games against Stockfish 19 Full. Each limit used six openings with colours reversed. The engines used one thread, 128 MiB of hash, and the same logical CPU within each shard. Stockfish used its official release binary, default network, and maximum skill.

| Time per move | Games | Prunex wins | Draws | Prunex losses | Prunex score |
| --- | ---: | ---: | ---: | ---: | ---: |
| 100 ms | 12 | 0 | 3 | 9 | 12.50% |
| 250 ms | 12 | 1 | 0 | 11 | 8.33% |
| 500 ms | 12 | 1 | 2 | 9 | 16.67% |
| 1,000 ms | 12 | 0 | 4 | 8 | 16.67% |

Stockfish led at all four limits. [GitHub Actions match artifacts](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/45099280296)

### Stockfish 13 reference weights

This experiment loads the CC0 `nn-62ef826d1a6d.nnue` weights through Prunex's existing HalfKP backend. The official Stockfish 13 release retrained its network on billions of positions. The test pins the full SHA-256 and checks score direction with a material imbalance, as well as incremental and fresh evaluation parity. Prunex supplies the search, UCI, and move generation. The sole match opponent is Stockfish 19 Full with its own default network and maximum skill.

[Stockfish 13 release](https://github.com/official-stockfish/Stockfish/releases/tag/sf_13) · [Default network in the Stockfish 13 source](https://github.com/official-stockfish/Stockfish/blob/sf_13/src/evaluate.h) · [CC0 network archive](https://github.com/official-stockfish/networks)

Candidate `997961d181c587fd972ac9991fcae048c06f5ea8` played 48 games on November 23, 2026. Six openings were played from both sides at each limit. Both engines used one thread, 128 MiB of hash, and the same logical CPU within each shard. The official Stockfish 19 Full binary used its default network and maximum skill.

| Time per move | Games | Prunex wins | Draws | Prunex losses | Prunex score |
| --- | ---: | ---: | ---: | ---: | ---: |
| 100 ms | 12 | 0 | 3 | 9 | 12.50% |
| 250 ms | 12 | 0 | 2 | 10 | 8.33% |
| 500 ms | 12 | 0 | 5 | 7 | 20.83% |
| 1,000 ms | 12 | 0 | 3 | 9 | 12.50% |

Stockfish 19 Full finished ahead at all four limits. [GitHub Actions match artifacts](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/45104944120)

### HalfKP score calibration

The calibration uses raw evaluations from the existing Prunex HalfKP backend and Stockfish 19's recorded scores for the same side to move. The sample comes from the preceding 1,000 ms games. It uses Stockfish turns through ply 80 with a completed depth of at least 16 and an ordinary numeric score. It excludes positions in check and turns where Stockfish played a capture or promotion. Repeated positions were deduplicated by the first four FEN fields.

The scale fitted by absolute error on 145 positions from four openings was approximately 0.399, rounded to 2/5. On 95 positions from the two held-out openings, with overlapping positions excluded, the mean absolute error against the logged scores fell from 293.34 to 231.44 centipawns. The logged search scores are estimates. The paired games measure playing strength.

The candidate enables `PRUNEX_REFERENCE_SCORE_CALIBRATION` when building the reference HalfKP evaluator. This scales its scores before storing them in the evaluation cache. The experiment uses the same `nn-62ef826d1a6d.nnue` weights and the same four-speed Stockfish 19 Full protocol.

On November 23, 2026, candidate `39b9115ecb362182b8be2ddf09d23d7a1177ef29` completed 48 games. Each limit used six openings played from both sides. The engines used one thread, 128 MiB of hash, and the same logical CPU within each shard. The official Stockfish 19 Full binary used its default network and maximum skill.

| Time per move | Games | Prunex wins | Draws | Prunex losses | Prunex score |
| --- | ---: | ---: | ---: | ---: | ---: |
| 100 ms | 12 | 0 | 3 | 9 | 12.50% |
| 250 ms | 12 | 0 | 2 | 10 | 8.33% |
| 500 ms | 12 | 0 | 2 | 10 | 8.33% |
| 1,000 ms | 12 | 1 | 2 | 9 | 16.67% |

Stockfish 19 Full led at all four limits. [GitHub Actions match artifacts](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/45110723785)

### Checking captures at quiescence entry

An instrumented build searched 32 positions from the score-calibration campaign at 75,000 nodes per position. At the first quiescence ply outside check, it encountered 739,982 ordinary captures. The exchange filter skipped 395,218, including 76,537 checks. A regression position exposes the tactical cost when the exchange estimate counts a pinned rook as a defender and discards a legal mate-in-one capture.

The candidate examines checking captures that fail the exchange test at the first quiescence ply. It retains the exchange filter for captures without check and at later plies. The test keeps the calibrated HalfKP weights and repeats the four paired time limits against Stockfish 19 Full.

On November 23, 2026, candidate `8ab89a254c1b7370bfd78233c3084d2c663bafd0` completed 48 games. Each limit used six openings played from both sides. The engines used one thread, 128 MiB of hash, and the same logical CPU within each shard. The official Stockfish 19 Full binary used its default network and maximum skill.

| Time per move | Games | Prunex wins | Draws | Prunex losses | Prunex score |
| --- | ---: | ---: | ---: | ---: | ---: |
| 100 ms | 12 | 0 | 3 | 9 | 12.50% |
| 250 ms | 12 | 0 | 2 | 10 | 8.33% |
| 500 ms | 12 | 0 | 4 | 8 | 16.67% |
| 1,000 ms | 12 | 1 | 3 | 8 | 20.83% |

Stockfish 19 Full led at all four limits. [GitHub Actions match artifacts](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/45116394216)

### Pinned recaptures in static exchange evaluation

The checking-capture regression from the preceding campaign scored `Qxg7#` at −675 because exchange scoring counted a rook recapture that exposed Black's king. The new estimator tests each recapture against the current exchange position. A recapture remains eligible if its destination keeps the king shielded or it captures the pinning piece. This applies to exchange scores used in move ordering and pruning.

Regression cases cover a pinned defender, a legal recapture along the pin ray, and quiescence handling of a genuine checking sacrifice. The candidate keeps the calibrated HalfKP weights and repeats the same six paired openings at all four limits against Stockfish 19 Full.

On November 23, 2026, candidate `272c99aa5f914d29f2e0d348c6addeb392e2c861` completed 48 games. Each limit used six openings played from both sides. The engines used one thread, 128 MiB of hash, and the same logical CPU within each shard. The official Stockfish 19 Full binary used its default network and maximum skill.

| Time per move | Games | Prunex wins | Draws | Prunex losses | Prunex score |
| --- | ---: | ---: | ---: | ---: | ---: |
| 100 ms | 12 | 1 | 3 | 8 | 20.83% |
| 250 ms | 12 | 1 | 1 | 10 | 12.50% |
| 500 ms | 12 | 0 | 4 | 8 | 16.67% |
| 1,000 ms | 12 | 0 | 6 | 6 | 25.00% |

Stockfish 19 Full led at all four limits. [GitHub Actions match artifacts](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/45123113730)

## Provenance and licensing

Prunex engine source and network format are original project work. The offline tools that use GPL-licensed python-chess are separately marked under GPL-3.0-or-later. The Lichess evaluation archive is CC0. Record every dataset source and license. Do not copy GPL-licensed source or pretrained Stockfish/PlentyChess weights into the MIT-licensed native engine.

## Match policy

No further opponent tournament is automatically triggered by this branch. The existing 144-game Stockfish 19/Triumviratus run stays archived as the diagnostic baseline. A new Stockfish 2.0 test must be a complete, reproducible paired-colour match with correct node accounting; Stockfish 19 parity needs its own separate and much larger evaluation.

## NNUE inference capacity and SIMD work

The current HalfKP runtime now supports hidden widths up to 512 while keeping the existing default trainer width unchanged. Dense-layer integer dot products use runtime AVX2 dispatch on supported GCC/Clang x86 builds and retain an exact scalar fallback for other CPUs, MSVC and WebAssembly. The AVX2 kernel uses unsigned 8-bit activations and signed 8-bit weights; its pairwise products fit the signed 16-bit intermediate range, and the final accumulation remains 64-bit. Regression tests compare the dispatched result with the scalar reference across vector-aligned widths and tail lengths up to 1,025 elements.

This is infrastructure for larger original Prunex networks, not a trained evaluator or a strength result. No 512-wide network has been trained or qualified, and the current CI fixture remains synthetic. The new kernel still needs a loaded-network benchmark on representative positions before its practical speedup can be reported. The existing handcrafted evaluator remains the default unless a Prunex network is explicitly loaded.

## Training-pipeline audit corrections

The original corpus split key used the first four FEN fields. The current HalfKP model consumes piece placement and side to move, but not castling rights or en-passant state. Treating those unused fields as part of the split key could place feature-identical positions in different splits. The importer and trainer now hash only piece placement plus active colour and deduplicate on that same identity.

The trainer previously fake-quantized both complete embedding matrices and clipped both full matrices after every minibatch. That defeated much of the benefit of sparse embeddings. It now gathers the feature rows touched by a batch, quantizes those rows, sums them by bag, and clips only the unique feature rows updated by the sparse optimizers. Dense-layer clipping remains unchanged.

Checkpoint selection now uses validation log loss. The best validation checkpoint is restored before the untouched test split is evaluated once and the selected model is exported. The CI test remains a deliberately tiny synthetic integration fixture; it verifies split identity, sparse-row clipping, training/export, native loading and numerical parity, not the quality of a production model.

## Preparing a separate engine repository

Create the separate repository after the Stockfish 19 match campaign. Freeze the candidate, record the Stockfish build, and test both colours from each opening. Use several opening sets and time controls. Keep the PGNs, exact engine settings, draw rules, paired confidence intervals, and links to the completed runs with the release.

The public repository should make the engine easy to build and inspect. Include the C++ source, UCI instructions, CMake build, regression tests, match recipes, and a short explanation of the search and evaluation. Keep the README focused on the measured results and the contributions that can be traced to the project history.

The current MIT license covers original Prunex engine files. Keep the notices for any included third-party code, datasets, or assets. Stockfish is built separately as a benchmark opponent. Its source and network are outside the standalone Prunex release. If the release contents change, check the license of each included component against [the current license scope](../LICENSE-SCOPE.md).
