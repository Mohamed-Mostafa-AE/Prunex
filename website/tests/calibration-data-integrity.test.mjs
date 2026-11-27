import assert from "node:assert/strict";
import { fitCalibration } from "../scripts/calibrate-evaluation.mjs";

function makeDataset() {
  const levels = [-800, -500, -300, -100, 0, 100, 300, 500, 800];
  const games = [];
  for (let game = 0; game < 40; game += 1) {
    const split = game < 30 ? "train" : game < 35 ? "validation" : "test";
    for (let ply = 0; ply < 12; ply += 1) {
      const scoreCp = levels[(ply + game) % levels.length];
      games.push({
        gameId: `game-${String(game).padStart(3, "0")}`,
        split,
        scoreCp,
        result: scoreCp >= 300 ? 1 : scoreCp <= -300 ? 0 : 0.5,
        scorePov: "side_to_move",
        engineVersion: "Prunex synthetic test fixture",
        engineSha256: "b".repeat(64),
        searchBudgetMs: 15000
      });
    }
  }
  return games;
}

// Game-level partitions are explicit, deterministic and disjoint.
const games = makeDataset();
const original = structuredClone(games);
const first = fitCalibration(games);
const second = fitCalibration(games);

assert.deepEqual(games, original, "training must not mutate caller-owned samples");
assert.equal(first.trainingSamples + first.validationSamples + first.testSamples, games.length);
assert.equal(first.trainingGames, 30);
assert.equal(first.validationGames, 5);
assert.equal(first.testGames, 5);
assert.equal(first.slope, second.slope, "the same corpus must produce identical parameters");
assert.equal(first.intercept, second.intercept);
assert.equal(first.validationLogLoss, second.validationLogLoss);
assert.equal(first.testLogLoss, second.testLogLoss);

// A game must never appear in more than one partition.
const leaked = makeDataset();
leaked.find(row => row.gameId === "game-000").split = "validation";
assert.throws(() => fitCalibration(leaked), /Game leakage detected/);

// Every sample needs a side-to-move score and a valid observed result.
const badPerspective = makeDataset();
badPerspective[74].scorePov = "white";
assert.throws(() => fitCalibration(badPerspective), /side-to-move perspective/);

const badLabel = makeDataset();
badLabel[74].result = 0.25;
assert.throws(() => fitCalibration(badLabel), /result 0, 0.5, or 1/);

// All positions in one calibration run must come from the same engine binary
// and the same fixed search budget.
const mixedBudget = makeDataset();
mixedBudget[200].searchBudgetMs = 3000;
assert.throws(() => fitCalibration(mixedBudget), /same engine version, binary, and search budget/);

const undersized = makeDataset().filter(row => row.split !== "test");
assert.throws(() => fitCalibration(undersized), /too small for separate train, validation, and test/);

console.log("Calibration data integrity: disjoint game splits, score perspective, provenance and deterministic fit passed.");
