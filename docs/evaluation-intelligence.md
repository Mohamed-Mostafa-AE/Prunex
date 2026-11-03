# Prunex Evaluation Intelligence

## Engine identity and scope

The browser product is branded **Prunex Play**. Its third-party chess engine is **Stockfish.js 19 Lite**. The Prunex-owned code is the application, UCI worker orchestration, analysis scheduling, expected-points interpretation, move-quality grading, Apex checks, archive integration, and presentation. The interface must not imply that the Stockfish engine binary or its NNUE network was independently authored by Prunex.

Stockfish is GPL-3.0. Keep its license, source/corresponding-source access, and attribution intact for every distributed build. Any modifications to Stockfish itself must be published under GPL-3.0 with the corresponding source. See the upstream [Stockfish repository and terms](https://github.com/official-stockfish/Stockfish).

## Maximum review budget

Game Review has a separate analysis budget from opponent playing strength. The default is **30 seconds per non-terminal position**, with 3, 10, 15, 20, and 30 second choices. The UCI worker sends `go movetime` for each position and requests MultiPV so the review layer can compare the best and second-best candidates. A game with 60 analyzed positions can therefore take up to approximately 30 minutes, plus startup and rendering overhead. The actual completed depth depends on device speed, browser scheduling, and position complexity; 30 seconds is a time budget, not a guaranteed depth or accuracy level.

## Prunex-owned evaluation layer

- Expected-points interpretation is separate from Stockfish's raw centipawn/WDL output.
- Move grades and the Prunex Apex criteria are application-level rules, not Stockfish classifications.
- Accuracy is Prunex's own metric and is not represented as Chess.com's proprietary CAPS2.
- WDL from Stockfish is preferred when present; calibrated centipawn conversion is the fallback.

## Calibration dataset format

The calibration trainer consumes UTF-8 JSONL, one row per independently labeled position:

```json
{"scoreCp": 125, "result": 1}
{"scoreCp": -80, "result": 0}
{"scoreCp": 12, "result": 0.5}
```

- `scoreCp`: Stockfish centipawn score from the side-to-move perspective at the sampled position.
- `result`: eventual game score for that same side to move: 1 win, 0.5 draw, 0 loss.
- Exclude terminal positions and invalid games. Avoid duplicate positions and split by game, not by individual position, when preparing production datasets to prevent leakage.
- Use a representative mix of openings, middlegames, endgames, rating levels, and time controls. Prefer a large, clean corpus of completed games; do not treat a few user games as sufficient training data.

Run from `website/`:

```bash
node scripts/calibrate-evaluation.mjs ./data/evaluation-positions.jsonl
npm run build
```

The script fits a logistic expected-points calibration using a deterministic 80/20 row split and writes `src/evaluation-calibration.js`. The validation log loss must be compared against the default calibration and a held-out game-level test set before accepting generated parameters. The script calibrates score interpretation; it does **not** change Stockfish's search or NNUE weights.

## Actual Stockfish NNUE training

Training a new Stockfish evaluation network requires the upstream Stockfish NNUE trainer and compatible engine source, curated training/validation data, and substantial compute/storage. Follow the official [Stockfish NNUE training documentation](https://official-stockfish.github.io/docs/nnue-pytorch-wiki/docs/training.html). The documented full threats recipe requires over 800 GB of storage; GPU training recommends at least 8 GB VRAM and 16 GB system RAM. A small binpack can be used for experiments but does not establish stronger playing strength.

No new NNUE network is claimed to have been trained or deployed by this project. A trained network should only be adopted after compatibility checks and statistically significant engine matches (fixed openings, paired colors, sufficient games, SPRT or confidence intervals), plus tactical and regression suites.

## Benchmark gates

Before accepting a new calibration or network:

1. Run the deterministic review-metrics and calibration tests.
2. Validate calibration log loss/Brier score on held-out games.
3. Run tactical suites and compare best-move stability at 3/10/15/30 seconds.
4. Run paired-color self-play against the previous build and a fixed Stockfish baseline.
5. Record hardware, engine build, network identifier, hash/thread settings, time control, openings, game count, score, confidence interval, and artifact hashes.
6. Reject changes that improve training loss but regress held-out calibration or match strength.
