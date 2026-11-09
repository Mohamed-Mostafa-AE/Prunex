# Prunex Evaluation Architecture

## One engine implementation

Prunex 0.8.0 is an independently implemented C++20 chess engine. The native command-line interface, Windows desktop application, and Prunex Play browser application use the same engine source. The browser loads the Emscripten build through a versioned WebAssembly C API.

The engine's static evaluation is a handcrafted tapered function. It combines material and positional terms with middlegame/endgame phase blending. The search uses iterative deepening, negamax alpha–beta/PVS, transposition-table lookup, move ordering, aspiration windows, late-move reductions, quiescence search, repetition and fifty-move draw handling, insufficient-material detection, and null-move pruning with verification at greater depths.

## Browser search interface

The browser worker initializes the WebAssembly module and verifies API version 800 (Prunex 0.8.0). It calls the native timed-search export with a maximum depth of 12 and a bounded time budget.

Opponent play maps the existing strength selector to its intended time budgets: 150 ms, 350 ms, 600 ms, 1 second, or 1.8 seconds. Game review uses the selected 3, 10, 15, 20, or 30 seconds per non-terminal position. A time budget is a limit, not a guaranteed depth or playing-strength result.

A search is synchronous inside its dedicated worker. To interrupt it immediately, the page terminates that worker and starts a fresh instance. This keeps a stale position from continuing to consume time after a new move, review, or game reset.

The current WebAssembly search API returns a centipawn score from the root side-to-move perspective, the selected move, completed iterative-deepening depth, and visited node count. It does not return WDL probabilities or a MultiPV alternative line. The review layer therefore does not infer a second-best score or a uniqueness gap.

## Prunex-owned review layer

- Expected-points interpretation maps the engine's centipawn score to an estimated game result using the calibration parameters in `evaluation-calibration.js`.
- Move grades compare the position evaluations before and after a played move.
- The review accuracy metric is Prunex's own expected-points-retention metric; it is not presented as another product's proprietary formula.
- Archive integration, review scheduling, presentation, and user preferences belong to the browser application, not to the engine search core.

## Calibration dataset format

The calibration trainer consumes UTF-8 JSONL, one row per independently labeled position:

```json
{"gameId":"game-001","scoreCp":125,"result":1}
{"gameId":"game-001","scoreCp":-80,"result":0}
{"gameId":"game-002","scoreCp":12,"result":0.5}
```

- `scoreCp`: centipawn score from the side-to-move perspective.
- `result`: eventual game score for that same side to move: 1 win, 0.5 draw, 0 loss.
- Exclude terminal positions and invalid games. Avoid duplicate positions and split by game, not by individual position, when preparing evaluation data to prevent leakage.
- Use a representative mix of openings, middlegames, endgames, rating levels, and time controls. A small collection of user games is not sufficient for a reliable calibration dataset.

Run from `website/`:

```bash
node scripts/calibrate-evaluation.mjs ./data/evaluation-positions.jsonl
npm run build
```

The script fits an expected-points calibration using a deterministic 80/20 game-level split when `gameId` is present (otherwise a row-level fallback) and writes `src/evaluation-calibration.js`. Compare validation log loss against the default calibration and a held-out game-level test set before accepting generated parameters.

Calibration changes score interpretation only. It does not modify the engine's search or static evaluation.

## Evaluation and strength validation

Before accepting a calibration or search update:

1. Run the deterministic review-metrics and calibration tests.
2. Validate calibration log loss and Brier score on held-out games.
3. Run tactical suites and compare best-move stability at 3, 10, 15, and 30 seconds.
4. Run paired-colour matches against the previous build and a fixed baseline.
5. Record engine version, source commit, hardware, time control, openings, game count, score, confidence interval, and artifact hashes.
6. Reject changes that improve training-data fit but regress held-out calibration or match results.

A playing-strength claim should only be made after a reproducible match series with balanced colours, retained game records, fixed conditions, adequate sample size, and independently checked results.
