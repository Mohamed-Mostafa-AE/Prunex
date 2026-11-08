import assert from "node:assert/strict";
import { fitCalibration, sigmoid } from "../scripts/calibrate-evaluation.mjs";
import { evaluationCalibration } from "../src/evaluation-calibration.js";
import { centipawnsToExpectedPoints } from "../src/review-metrics.js";

assert.ok(Math.abs(sigmoid(0) - 0.5) < 1e-12);
assert.ok(centipawnsToExpectedPoints(250) > 0.5);
assert.ok(centipawnsToExpectedPoints(-250) < 0.5);
assert.equal(evaluationCalibration.model, "logistic-expected-points-v1");

const synthetic = [];
for (let i = -50; i <= 50; i += 1) {
  const scoreCp = i * 20;
  const result = scoreCp > 150 ? 1 : scoreCp < -150 ? 0 : 0.5;
  for (let repeat = 0; repeat < 3; repeat += 1) synthetic.push({ scoreCp, result });
}
const fitted = fitCalibration(synthetic);
assert.equal(fitted.trained, true);
assert.ok(fitted.slope > 0);
assert.ok(Number.isFinite(fitted.validationLogLoss));
assert.ok(fitted.validationSamples > 0);
assert.ok(fitted.trainingSamples > fitted.validationSamples);
console.log("Evaluation calibration: deterministic training and validation checks passed.");
