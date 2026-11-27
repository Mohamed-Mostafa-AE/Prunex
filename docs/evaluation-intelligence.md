# Prunex Evaluation Architecture

## One engine implementation

Prunex 0.8.0 is an independently implemented C++20 chess engine. The native command-line interface, Windows desktop application, and Prunex Play browser application use the same engine source. The browser loads the Emscripten build through a versioned WebAssembly C API.

The native static evaluator is a handcrafted tapered function. It combines material and positional terms with middlegame/endgame phase blending. The search uses iterative deepening, negamax alpha-beta/PVS, transposition-table lookup, SEE-based capture ordering, aspiration windows, late-move reductions, quiescence search, repetition and fifty-move draw handling, insufficient-material detection, and null-move pruning with verification at greater depths.

## Browser search interface

The browser worker initializes the WebAssembly module and verifies API version 800 (Prunex 0.8.0). It calls the native timed-search export with a maximum depth of 12 and a bounded time budget.

Opponent play maps the strength selector to time budgets of 150 ms, 350 ms, 600 ms, 1 second, or 1.8 seconds. Game review uses the selected 3, 10, 15, 20, or 30 seconds per non-terminal position. A time budget is a limit, not a guaranteed depth or playing-strength result.

A search is synchronous inside its dedicated worker. To interrupt it, the page terminates that worker and starts a fresh instance. The current WebAssembly search API returns a centipawn score from the root side-to-move perspective, the selected move, completed iterative-deepening depth, and visited node count. It does not return WDL probabilities or a MultiPV alternative line, so the review layer does not calculate a runner-up uniqueness gap.

A timed search that returns a fallback move without completing depth 1 is not treated as a completed evaluation. The worker reports that state explicitly. Review only grades a move when the before-position search and the after-position search (or a known terminal result) are both available.

## Prunex-owned review layer

- The expected-points layer converts the root side-to-move centipawn score to an estimated game result.
- Move grading compares the expected points before a played move with the mover's expected points after the opponent replies.
- A match with the engine's selected move is recorded separately. It does not erase measured evaluation loss or automatically force the move to a zero-loss grade.
- An incomplete search is marked unrated; it is not silently converted into a zero-loss move.
- The displayed review percentage is Prunex's own expected-points-retention metric. It is not another product's proprietary formula and is not an Elo rating.

The current checked-in calibration artifact is explicitly **provisional** until a dataset from Prunex search scores passes all data and held-out validation gates. The website must not describe the provisional logistic mapping as empirically calibrated.

## Calibration data and labels

The browser review uses the score from a bounded Prunex search, not the UCI `eval` command's static score. Calibration therefore needs positions annotated with the same kind of time-bounded search and fixed budget used by the browser review.

The UTF-8 JSONL rows must include these fields:

- `game_id`: stable ID for the complete source game.
- `split`: `train`, `validation`, or `test`, assigned by complete game (never by individual position).
- `fen`: legal standard-chess position before the recorded move.
- `label_kind`: `observed_game_result_and_played_move`.
- `result_for_side_to_move`: eventual game result for the side to move in the FEN: 1 win, 0.5 draw, 0 loss.
- `prunex_search_score_cp`: completed Prunex WebAssembly search score from the same position.
- `prunex_search_score_pov`: must be `side_to_move`.
- `search_budget_ms`: fixed time budget used for every annotation in the dataset.
- `search_runtime`: must be `webassembly`.
- `prunex_wasm_api_version`: must be `800`.
- `prunex_engine_version` and `prunex_engine_bundle_sha256`: human-readable engine version and SHA-256 of the exact WebAssembly loader/binary pair.
- `search_depth`, `search_nodes`, and `search_best_move`: completed search diagnostics recorded alongside the score.

A PGN's played move and final result are observed game data, not the engine's best move and not a trusted evaluation label for each position. The calibration estimates the relationship between Prunex's own time-bounded search scores and eventual game results; it does not train or alter the C++ evaluator.

## Reproducible calibration workflow

Use a licensed corpus prepared with `tools/training/ingest_pgn.py`. Its default split keeps all positions from one game together. If the source contains reliable tournament/event headers, the event split can further reduce event-level leakage. Never put positions from one game in more than one split.

The browser runs the checked-in Prunex WebAssembly bundle. Calibration annotations must therefore be produced by that **same WebAssembly bundle**, not by the native UCI executable. The annotator below uses the browser C API, records the loader and WASM binary together as one SHA-256 bundle identity, and enforces the same maximum depth and timed-search API used by the website.

From the repository root, annotate every split with the exact same fixed budget and WebAssembly bundle:

```bash
node website/scripts/annotate-search-positions.mjs \
  --input /data/prunex-corpus/positions-train.jsonl \
  --output /data/prunex-corpus/positions-train-search-15000ms.jsonl \
  --engine-version "Prunex 0.8.0" \
  --movetime-ms 15000

node website/scripts/annotate-search-positions.mjs \
  --input /data/prunex-corpus/positions-validation.jsonl \
  --output /data/prunex-corpus/positions-validation-search-15000ms.jsonl \
  --engine-version "Prunex 0.8.0" \
  --movetime-ms 15000

node website/scripts/annotate-search-positions.mjs \
  --input /data/prunex-corpus/positions-test.jsonl \
  --output /data/prunex-corpus/positions-test-search-15000ms.jsonl \
  --engine-version "Prunex 0.8.0" \
  --movetime-ms 15000
```

The annotator stores the latest completed iterative-deepening search score, best move, depth, node count, fixed time budget, side-to-move score perspective, WebAssembly API version, engine version, and SHA-256 of the exact `prunex-wasm.js` + `prunex-wasm.wasm` bundle. If no search iteration completes, it rejects that position rather than recording the fallback static score as a search result.

Combine the three annotated files without changing their `split` fields. For example, on Linux:

```bash
cat /data/prunex-corpus/positions-train-search-15000ms.jsonl \
    /data/prunex-corpus/positions-validation-search-15000ms.jsonl \
    /data/prunex-corpus/positions-test-search-15000ms.jsonl \
    > /data/prunex-corpus/all-search-positions-15000ms.jsonl
```

From the `website/` directory, fit and validate the expected-points mapping:

```bash
node scripts/calibrate-evaluation.mjs /data/prunex-corpus/all-search-positions-15000ms.jsonl
npm run build
```

The trainer requires at least 100 training positions across 20 games, 20 validation positions across 5 games, and 20 test positions across 5 games. It rejects overlapping game IDs, invalid result labels, inconsistent score perspective, native rather than WebAssembly annotations, a different WebAssembly API version, mixed bundle hashes, and mixed search budgets. Each game receives equal total weight so one unusually long game does not dominate the fit.

The trainer compares the fitted logistic mapping with the provisional baseline on both validation and test splits. It only writes a production calibration module when both log loss and Brier score improve on both held-out splits. The test split must not be used to repeatedly tune parameters; it is a final confirmation set. The generated module records the side-to-move perspective, WebAssembly API version, engine version, bundle hash, fixed search budget, sample counts, game counts, and held-out metrics.

At runtime, Prunex Play uses the fitted mapping only when the review search budget exactly matches the calibrated budget. Other review budgets remain provisional until they have their own independent calibration evidence. The same source code compiled for WebAssembly can search different node counts on different devices during a fixed time budget; the calibration therefore estimates outcomes for the measured bundle and sampled device/runtime population, not a universal objective chess value. Calibration is a predictive interpretation of observed game outcomes, not ground-truth position evaluation.

A failed calibration leaves the existing provisional module untouched. A successful calibration changes score interpretation only; it does not modify the native C++ evaluator or prove an Elo improvement.

## Static evaluator diagnostics are a separate experiment

The `tools/training/annotate_native.py` and `calibrate_native_eval.py` commands inspect the static `eval` score. They are useful for studying the handcrafted evaluator, but their output must not be substituted into the browser search-score calibration. Static evaluation and time-bounded search scores are different measurements.

A better calibration score is not evidence of stronger play. Changing the C++ evaluation terms requires separate controlled match testing.

## Evaluation and strength validation

Before accepting a calibration or search update:

1. Run the deterministic review-metrics and calibration tests.
2. Validate log loss and Brier score on game-disjoint validation and test sets.
3. Run tactical suites and compare best-move stability at 3, 10, 15, and 30 seconds.
4. Run paired-colour matches against the previous build and a fixed baseline.
5. Record engine version, source commit, executable SHA-256, hardware, time control, openings, game count, score, confidence interval, and retained PGNs.
6. Reject changes that improve training fit but regress held-out calibration or match results.

A playing-strength claim should only be made after a reproducible match series with balanced colours, retained game records, fixed conditions, adequate sample size, and independently checked results.
