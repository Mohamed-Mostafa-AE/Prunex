import assert from "node:assert/strict";
import { isUsableMemory, rankSamples } from "../src/game-database.js";

function sample(moveUci, resultForMover, evalLossCp = 0, grade = "BEST") {
  return { moveUci, resultForMover, evalLossCp, grade };
}

const preferred = rankSamples([
  sample("e2e4", 1),
  sample("e2e4", 1),
  sample("d2d4", -1),
  sample("d2d4", -1)
]);
assert.equal(preferred?.moveUci, "e2e4", "losses must not be counted as draws");

const drawOnly = rankSamples([
  sample("g1f3", 0),
  sample("g1f3", 0)
]);
assert.equal(drawOnly?.draws, 2, "draws must be counted separately");

const rejected = rankSamples([
  sample("a2a3", 1, 31, "BEST"),
  sample("h2h3", 1, 0, "BLUNDER")
]);
assert.equal(rejected, null, "poor-quality samples must not influence experience selection");

const evaluationBreaksTie = rankSamples([
  sample("c2c4", 1, 24),
  sample("c2c4", 0, 22),
  sample("e2e4", 1, 2),
  sample("e2e4", 0, 2)
]);
assert.equal(evaluationBreaksTie?.moveUci, "e2e4", "lower evaluation loss should improve ranking");

assert.equal(isUsableMemory(sample("e2e4", 1)), true);
assert.equal(isUsableMemory(sample("e2e4", 1, -1)), false, "negative loss is invalid");
assert.equal(isUsableMemory(sample("e2e4", 1, 31)), false, "loss above 30 cp is invalid");
assert.equal(isUsableMemory(sample("e2e4", 0.5)), false, "result must be an integer label");
assert.equal(isUsableMemory(sample("e2e4", 2)), false, "result must be -1, 0, or 1");
assert.equal(isUsableMemory(sample("z9e4", 1)), false, "UCI coordinates must be valid");
assert.equal(isUsableMemory(sample("e2e4", 1, 0, "APEX")), false, "grade must be allowlisted");
assert.equal(isUsableMemory({ moveUci: "e2e4", resultForMover: 1, evalLossCp: 0, grade: "BEST" }), true);

console.log("Game database: ranking and shared-memory validation checks passed.");
