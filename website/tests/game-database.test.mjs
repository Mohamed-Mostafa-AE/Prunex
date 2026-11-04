import assert from "node:assert/strict";
import { isUsableMemory, rankSamples } from "../src/game-database.js";

function sample(moveUci, resultForMover, evalLossCp = 0, grade = "BEST", overrides = {}) {
  return {
    id: "test-game:1",
    positionKey: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w",
    sideToMove: "w",
    moveUci,
    san: "e4",
    resultForMover,
    evalLossCp,
    grade,
    createdAt: "2026-11-04T00:00:00.000Z",
    ...overrides
  };
}

const preferred = rankSamples([
  sample("e2e4", 1), sample("e2e4", 1),
  sample("d2d4", -1), sample("d2d4", -1)
]);
assert.equal(preferred?.moveUci, "e2e4", "losses must not be counted as draws");

const drawOnly = rankSamples([sample("g1f3", 0), sample("g1f3", 0)]);
assert.equal(drawOnly?.draws, 2, "draws must be counted separately");

const rejected = rankSamples([
  sample("a2a3", 1, 31, "BEST"),
  sample("h2h3", 1, 0, "BLUNDER")
]);
assert.equal(rejected, null, "poor-quality samples must not influence experience selection");

const evaluationBreaksTie = rankSamples([
  sample("c2c4", 1, 24), sample("c2c4", 0, 22),
  sample("e2e4", 1, 2), sample("e2e4", 0, 2)
]);
assert.equal(evaluationBreaksTie?.moveUci, "e2e4", "lower evaluation loss should improve ranking");

assert.equal(isUsableMemory(sample("e2e4", 1)), true);
assert.equal(isUsableMemory(sample("e2e4", 1, -1)), false);
assert.equal(isUsableMemory(sample("e2e4", 1, 31)), false);
assert.equal(isUsableMemory(sample("e2e4", 0.5)), false);
assert.equal(isUsableMemory(sample("e2e4", 2)), false);
assert.equal(isUsableMemory(sample("z9e4", 1)), false);
assert.equal(isUsableMemory(sample("e2e4", 1, 0, "APEX")), false);
assert.equal(isUsableMemory(sample("e2e4", 1, 0, "BEST", { sideToMove: "x" })), false);
assert.equal(isUsableMemory(sample("e2e4", 1, 0, "BEST", { positionKey: "short" })), false);
assert.equal(isUsableMemory(sample("e2e4", 1, 0, "BEST", { san: "" })), false);
assert.equal(isUsableMemory(sample("e2e4", 1, 0, "BEST", { id: "" })), false);

console.log("Game database: ranking and strict shared-memory validation checks passed.");
