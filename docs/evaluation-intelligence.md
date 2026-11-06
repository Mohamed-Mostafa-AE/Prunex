# Prunex Evaluation Architecture

## Engine paths

Prunex has two distinct engine paths. Keep their evaluation methods separate in technical documentation and product descriptions.

- **Native Prunex 0.8.0:** an independently implemented C++20 engine. Its current `evaluate()` implementation uses handcrafted piece-square and positional terms with tapered middlegame/endgame blending. It does **not** load an NNUE network.
- **Prunex Play:** a separate browser application that uses NNUE-based position evaluation for browser play and game analysis. It is not the native C++ engine.

The Prunex-owned browser application layer includes:

- Engine-worker integration and orchestration
- Per-position analysis scheduling and review presentation
- Expected-points interpretation and calibration
- Move-quality grading and Prunex Apex criteria
- Game archive integration

NNUE describes the browser engine's evaluation method. It must not be used to imply that the native C++ engine uses NNUE.

The browser engine bundle and the bundled piece artwork retain their separate licenses, attribution, and corresponding-source requirements. See [website/README.md](../website/README.md) and the notices shipped with the website.

## Review time budget

Game Review has a separate analysis budget from opponent-play settings. The default is **15 seconds per non-terminal position**, with 3, 10, 15, 20, and 30 second choices. The UCI worker sends a `go movetime` command for each position and requests MultiPV so the review layer can compare the best and second-best candidates.

A game with 60 analyzed positions can take about 15 minutes at the recommended default or up to approximately 30 minutes at the maximum setting, plus startup and rendering overhead. The actual completed depth depends on device speed, browser scheduling, and position complexity. The selected time is a budget, not a guaranteed depth or accuracy level.

## Prunex-owned evaluation layer

- Expected-points interpretation is separate from the engine's raw centipawn/WDL output.
- Move grades and the Prunex Apex criteria are application-level rules, not engine classifications.
- Accuracy is Prunex's own metric and is not represented as Chess.com's proprietary CAPS2.
- UCI WDL output is preferred when present; calibrated centipawn conversion is the fallback.

## Calibration dataset format

The calibration trainer consumes UTF-8 JSONL, one row per independently labeled position:

```json
{"gameId": "game-001", "scoreCp": 125, "result": 1}
{"gameId": "game-001", "scoreCp": -80, "result": 0}
{"gameId": "game-002", "scoreCp": 12, "result": 0.5}
```

- `scoreCp`: centipawn score from the side-to-move perspective at the sampled position.
- `result`: eventual game score for that same side to move: 1 win, 0.5 draw, 0 loss.
- Exclude terminal positions and invalid games. Avoid duplicate positions and split by game, not by individual position, when preparing production datasets to prevent leakage.
- Use a representative mix of openings, middlegames, endgames, rating levels, and time controls. A small collection of user games is not sufficient training data.

Run from `website/`:

```bash
node scripts/calibrate-evaluation.mjs ./data/evaluation-positions.jsonl
npm run build
```

The script fits a logistic expected-points calibration using a deterministic 80/20 game-level split when `gameId` is present (otherwise a row-level fallback) and writes `src/evaluation-calibration.js`. Compare validation log loss against the default calibration and a held-out game-level test set before accepting generated parameters.

The calibration script changes score interpretation only. It does not change the native engine's search or handcrafted evaluation, and it does not modify the browser engine's NNUE parameters.

## Evaluation-change validation

Before accepting a calibration or evaluation-component update:

1. Run the deterministic review-metrics and calibration tests.
2. Validate calibration log loss and Brier score on held-out games.
3. Run tactical suites and compare best-move stability at 3, 10, 15, and 30 seconds.
4. Run paired-colour matches against the previous build and a fixed baseline.
5. Record hardware, engine build, evaluation-component and network identifiers (where applicable), hash/thread settings, time control, openings, game count, score, confidence interval, and artifact hashes.
6. Reject changes that improve training loss but regress held-out calibration or match strength.

A strength improvement should only be claimed after a reproducible match series with balanced colours, retained game records, fixed conditions, and independently checked results.
