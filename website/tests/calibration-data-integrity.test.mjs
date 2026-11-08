import assert from "node:assert/strict";
import { fitCalibration } from "../scripts/calibrate-evaluation.mjs";

// Game-level partitioning must be deterministic and retain every row.
const games = [];
for (let game = 0; game < 40; game += 1) {
  for (let ply = 0; ply < 12; ply += 1) {
    games.push({
      gameId: `game-${String(game).padStart(3, "0")}`,
      scoreCp: (game - 20) * 35 + (ply % 5) * 18,
      result: game < 17 ? 0 : game > 22 ? 1 : 0.5
    });
  }
}
const original = structuredClone(games);
const first = fitCalibration(games);
const second = fitCalibration(games);

assert.deepEqual(games, original, "training must not mutate caller-owned samples");
assert.equal(first.trainingSamples + first.validationSamples, games.length);
assert.ok(first.trainingSamples > 0 && first.validationSamples > 0);
assert.equal(first.trainingSamples, second.trainingSamples);
assert.equal(first.validationSamples, second.validationSamples);
assert.equal(first.slope, second.slope, "the same corpus must produce identical parameters");
assert.equal(first.intercept, second.intercept);
assert.equal(first.validationLogLoss, second.validationLogLoss);

// A single game cannot form both partitions; reject rather than silently leak
// positions from the same game across training and validation.
const oneGame = Array.from({ length: 120 }, (_, index) => ({
  gameId: "only-game",
  scoreCp: index * 4 - 240,
  result: index < 60 ? 0 : 1
}));
assert.throws(() => fitCalibration(oneGame), /Dataset split is too small/);

// Invalid and undersized datasets should fail loudly.
assert.throws(() => fitCalibration([{ scoreCp: 0, result: 0.5 }]), /At least 100/);
const invalid = Array.from({ length: 100 }, () => ({ scoreCp: 0, result: 0.5 }));
invalid[73] = { scoreCp: Number.NaN, result: 0.5 };
assert.throws(() => fitCalibration(invalid), /Invalid sample at row 74/);

console.log("Calibration data integrity: deterministic game-level split, immutability, and validation checks passed.");
