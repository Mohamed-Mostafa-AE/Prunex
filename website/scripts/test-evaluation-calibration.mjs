import assert from "node:assert/strict";
import { fitCalibration, sigmoid } from "../scripts/calibrate-evaluation.mjs";
import { evaluationCalibration } from "../src/evaluation-calibration.js";
import {
  centipawnsToExpectedPoints,
  evaluationCalibrationStatus
} from "../src/review-metrics.js";

assert.ok(Math.abs(sigmoid(0) - 0.5) < 1e-12);
assert.ok(centipawnsToExpectedPoints(250) > 0.5);
assert.ok(centipawnsToExpectedPoints(-250) < 0.5);
assert.equal(evaluationCalibration.model, "logistic-expected-points-v2");
assert.equal(evaluationCalibration.trained, false);
assert.equal(evaluationCalibrationStatus().status, "provisional");

const levels = [-800, -500, -300, -100, 0, 100, 300, 500, 800];
const synthetic = [];
for (let game = 0; game < 40; game += 1) {
  const split = game < 30 ? "train" : game < 35 ? "validation" : "test";
  for (let ply = 0; ply < 12; ply += 1) {
    const scoreCp = levels[(ply + game) % levels.length];
    const result = scoreCp >= 300 ? 1 : scoreCp <= -300 ? 0 : 0.5;
    synthetic.push({
      gameId: `game-${String(game).padStart(3, "0")}`,
      split,
      scoreCp,
      result,
      scorePov: "side_to_move",
      label_kind: "observed_game_result_and_played_move",
      engineVersion: "Prunex synthetic test fixture",
      engineSha256: "a".repeat(64),
      searchBudgetMs: 15000,
      search_runtime: "webassembly",
      prunex_wasm_api_version: 800
    });
  }
}
const fitted = fitCalibration(synthetic);
assert.equal(fitted.trained, true);
assert.ok(fitted.slope > 0);
assert.ok(Number.isFinite(fitted.validationLogLoss));
assert.ok(Number.isFinite(fitted.validationBrierScore));
assert.ok(Number.isFinite(fitted.testLogLoss));
assert.ok(Number.isFinite(fitted.testBrierScore));
assert.equal(fitted.trainingSamples, 360);
assert.equal(fitted.validationSamples, 60);
assert.equal(fitted.testSamples, 60);
assert.equal(fitted.trainingGames, 30);
assert.equal(fitted.validationGames, 5);
assert.equal(fitted.testGames, 5);
assert.equal(fitted.searchBudgetMs, 15000);
assert.equal(fitted.scorePerspective, "side_to_move");
assert.equal(fitted.engineRuntime, "webassembly");
assert.equal(fitted.wasmApiVersion, 800);
console.log("Evaluation calibration: game-disjoint fit, baseline comparison, log-loss and Brier checks passed.");
