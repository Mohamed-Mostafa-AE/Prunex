import assert from "node:assert/strict";
import {
  centipawnsToExpectedPoints,
  expectedPointsFromEvaluation,
  expectedPointLoss,
  classifyMove,
  isApexMove,
  reviewAccuracy
} from "../src/review-metrics.js";

const wdlPosition = { scoreType: "cp", score: 80, wdl: { win: 600, draw: 200, loss: 200 } };
assert.equal(expectedPointsFromEvaluation(wdlPosition), 0.7);
assert.equal(expectedPointsFromEvaluation({ scoreType: "cp", score: 0, wdl: null }), 0.5);
assert.ok(centipawnsToExpectedPoints(250) > 0.5);
assert.ok(centipawnsToExpectedPoints(-250) < 0.5);
assert.ok(Math.abs(expectedPointLoss(0.7, 0.45) - 0.25) < 1e-9);
assert.equal(expectedPointLoss(0.4, 0.6), 0);

const quietMove = { san: "e4", piece: "p", to: "e4" };
const nextQuiet = { san: "Nf6" };
const grade = (loss) => classifyMove(quietMove, nextQuiet, 0, 0, 0, 1, loss, 0.5, 0.5).grade;
assert.equal(grade(0.002), "BEST");
assert.equal(grade(0.015), "EXCELLENT");
assert.equal(grade(0.04), "GOOD");
assert.equal(grade(0.08), "INACCURACY");
assert.equal(grade(0.15), "MISTAKE");
assert.equal(grade(0.30), "BLUNDER");

const missed = classifyMove(quietMove, nextQuiet, 350, -120, 470, 1, 0.30, 0.82, 0.48);
assert.equal(missed.grade, "MISS");

const sacrifice = { san: "Bxh7+", piece: "b", to: "h7" };
const recapture = { san: "Kxh7", to: "h7", captured: "b" };
const brilliant = classifyMove(sacrifice, recapture, 80, 70, 10, 1, 0.01, 0.60, 0.59);
assert.equal(brilliant.grade, "BRILLIANT");
assert.equal(isApexMove({ engineBestMatches:true, sacrifice:true, pointLoss:0.001, uniqueMoveGap:0.20, beforeExpectedPoints:0.55 }), true);
assert.equal(isApexMove({ engineBestMatches:true, sacrifice:true, pointLoss:0.001, uniqueMoveGap:0.10, beforeExpectedPoints:0.55 }), false);
assert.equal(isApexMove({ engineBestMatches:false, sacrifice:true, pointLoss:0.001, uniqueMoveGap:0.50, beforeExpectedPoints:0.55 }), false);

const metric = reviewAccuracy("w", [
  { color:"w", expectedPointLoss:0.10 },
  { color:"w", expectedPointLoss:0.20 },
  { color:"b", expectedPointLoss:0.70 }
]);
assert.equal(metric, 85);
assert.equal(reviewAccuracy("b", [{ color:"b", expectedPointLoss:0.70 }]), 30);
assert.equal(reviewAccuracy("w", []), null);

console.log("Review metrics: 20 deterministic assertions passed.");
