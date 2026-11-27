#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const MODEL = "logistic-expected-points-v2";
const EPSILON = 1e-12;
const MINIMUMS = Object.freeze({
  trainPositions: 100,
  validationPositions: 20,
  testPositions: 20,
  trainGames: 20,
  validationGames: 5,
  testGames: 5
});

export function sigmoid(value) {
  if (value >= 0) return 1 / (1 + Math.exp(-Math.min(value, 40)));
  const exp = Math.exp(Math.max(value, -40));
  return exp / (1 + exp);
}

function getField(sample, camelName, snakeName) {
  return sample[camelName] ?? sample[snakeName];
}

function normalizeSamples(samples) {
  if (!Array.isArray(samples) || samples.length < MINIMUMS.trainPositions +
      MINIMUMS.validationPositions + MINIMUMS.testPositions) {
    throw new Error("The dataset is too small for separate train, validation, and test splits.");
  }

  return samples.map((sample, index) => {
    const scoreCp = Number(getField(sample, "scoreCp", "prunex_search_score_cp"));
    const result = Number(getField(sample, "result", "result_for_side_to_move"));
    const gameId = getField(sample, "gameId", "game_id");
    const split = sample.split;
    const scorePov = getField(sample, "scorePov", "prunex_search_score_pov");
    const engineVersion = sample.prunex_engine_version ?? sample.native_engine_version ?? sample.engineVersion ?? null;
    const engineSha256 = sample.prunex_engine_bundle_sha256 ?? sample.native_engine_sha256 ?? sample.engineSha256 ?? null;
    const searchBudgetMs = getField(sample, "searchBudgetMs", "search_budget_ms") ?? null;
    const searchRuntime = sample.search_runtime ?? null;
    const wasmApiVersion = sample.prunex_wasm_api_version ?? sample.wasmApiVersion ?? null;

    if (!Number.isFinite(scoreCp) || !Number.isFinite(result) ||
        ![0, 0.5, 1].includes(result)) {
      throw new Error("Invalid sample at row " + (index + 1) +
        ": expected finite search score and result 0, 0.5, or 1.");
    }
    if (typeof gameId !== "string" || !gameId.trim()) {
      throw new Error("Missing game_id at row " + (index + 1) + ".");
    }
    if (!["train", "validation", "test"].includes(split)) {
      throw new Error("Invalid split at row " + (index + 1) +
        ": expected train, validation, or test.");
    }
    if (scorePov !== "side_to_move") {
      throw new Error("Search scores must use the side-to-move perspective at row " + (index + 1) + ".");
    }
    if (sample.label_kind !== "observed_game_result_and_played_move") {
      throw new Error("Expected an observed game-result label at row " + (index + 1) + ".");
    }
    if (typeof engineVersion !== "string" || !engineVersion.trim()) {
      throw new Error("Missing Prunex engine version at row " + (index + 1) + ".");
    }
    if (typeof engineSha256 !== "string" || !/^[0-9a-f]{64}$/i.test(engineSha256)) {
      throw new Error("Missing or invalid Prunex WebAssembly bundle SHA-256 at row " + (index + 1) + ".");
    }
    if (searchRuntime !== "webassembly" || Number(wasmApiVersion) !== 800) {
      throw new Error("Only Prunex WebAssembly API 800 search scores are accepted for browser calibration at row " + (index + 1) + ".");
    }
    if (!Number.isInteger(Number(searchBudgetMs)) || Number(searchBudgetMs) < 1) {
      throw new Error("Missing or invalid fixed search budget at row " + (index + 1) + ".");
    }
    if (searchBudgetMs != null && (!Number.isInteger(Number(searchBudgetMs)) || Number(searchBudgetMs) < 1)) {
      throw new Error("Invalid search budget at row " + (index + 1) + ".");
    }
    if (engineSha256 != null && !/^[0-9a-f]{64}$/i.test(engineSha256)) {
      throw new Error("Invalid native engine SHA-256 at row " + (index + 1) + ".");
    }

    return {
      x: Math.max(-10, Math.min(10, scoreCp / 400)),
      scoreCp,
      y: result,
      gameId: gameId.trim(),
      split,
      engineVersion: engineVersion == null ? null : String(engineVersion),
      engineSha256: String(engineSha256).toLowerCase(),
      searchBudgetMs: Number(searchBudgetMs),
      searchRuntime,
      wasmApiVersion: Number(wasmApiVersion)
    };
  });
}

function validatePartitions(clean) {
  const partitions = Object.fromEntries(
    ["train", "validation", "test"].map(split => [split, clean.filter(row => row.split === split)])
  );
  const gameSets = Object.fromEntries(
    Object.entries(partitions).map(([split, rows]) => [split, new Set(rows.map(row => row.gameId))])
  );

  for (const [split, rows] of Object.entries(partitions)) {
    const positionsMinimum = MINIMUMS[split + "Positions"];
    const gamesMinimum = MINIMUMS[split + "Games"];
    const gameCount = gameSets[split].size;
    if (rows.length < positionsMinimum || gameCount < gamesMinimum) {
      throw new Error(split + " split has " + rows.length + " positions across " + gameCount +
        " games; requires at least " + positionsMinimum + " positions and " + gamesMinimum + " games.");
    }
  }

  for (const [left, right] of [["train", "validation"], ["train", "test"], ["validation", "test"]]) {
    for (const gameId of gameSets[left]) {
      if (gameSets[right].has(gameId)) {
        throw new Error("Game leakage detected: " + gameId + " appears in " + left + " and " + right + ".");
      }
    }
  }

  const versions = new Set(clean.map(row => row.engineVersion).filter(Boolean));
  const hashes = new Set(clean.map(row => row.engineSha256).filter(Boolean));
  const budgets = new Set(clean.map(row => row.searchBudgetMs));
  const runtimes = new Set(clean.map(row => row.searchRuntime));
  const apiVersions = new Set(clean.map(row => row.wasmApiVersion));
  if (versions.size > 1 || hashes.size > 1 || budgets.size > 1 ||
      runtimes.size > 1 || apiVersions.size > 1) {
    throw new Error("All calibration splits must use the same WebAssembly bundle, API version, and search budget.");
  }
  if (versions.size !== 1 || hashes.size !== 1 || budgets.size !== 1 ||
      runtimes.size !== 1 || apiVersions.size !== 1) {
    throw new Error("Every calibration row must identify one Prunex WebAssembly bundle and fixed search budget.");
  }

  return {
    partitions,
    metadata: {
      engineVersion: versions.size ? [...versions][0] : null,
      engineSha256: hashes.size ? [...hashes][0] : null,
      searchBudgetMs: budgets.size ? [...budgets][0] : null,
      engineRuntime: runtimes.size ? [...runtimes][0] : null,
      wasmApiVersion: apiVersions.size ? [...apiVersions][0] : null
    }
  };
}

function gameWeights(rows) {
  const counts = new Map();
  for (const row of rows) counts.set(row.gameId, (counts.get(row.gameId) || 0) + 1);
  return rows.map(row => 1 / counts.get(row.gameId));
}

function weightedMean(values, weights) {
  let numerator = 0;
  let denominator = 0;
  for (let index = 0; index < values.length; index += 1) {
    numerator += values[index] * weights[index];
    denominator += weights[index];
  }
  if (denominator <= 0) throw new Error("Cannot calculate a weighted mean for an empty split.");
  return numerator / denominator;
}

export function fitParameters(rows, { epochs = 4000, learningRate = 0.015, l2 = 0.0001 } = {}) {
  if (!Number.isInteger(epochs) || epochs < 1 ||
      !Number.isFinite(learningRate) || learningRate <= 0 ||
      !Number.isFinite(l2) || l2 < 0) {
    throw new Error("Invalid optimiser settings.");
  }
  const weights = gameWeights(rows);
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let slope = 1;
  let intercept = 0;

  for (let epoch = 0; epoch < epochs; epoch += 1) {
    let slopeGradient = 0;
    let interceptGradient = 0;
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const error = sigmoid(slope * row.x + intercept) - row.y;
      slopeGradient += weights[index] * error * row.x;
      interceptGradient += weights[index] * error;
    }
    slopeGradient = slopeGradient / totalWeight + l2 * (slope - 1);
    interceptGradient /= totalWeight;
    const rate = learningRate / Math.sqrt(1 + epoch / 250);
    slope = Math.max(0.05, Math.min(5, slope - rate * slopeGradient));
    intercept = Math.max(-2, Math.min(2, intercept - rate * interceptGradient));
  }

  return { slope, intercept };
}

export function scoreMetrics(rows, slope, intercept) {
  const weights = gameWeights(rows);
  const predictions = rows.map(row => sigmoid(slope * row.x + intercept));
  const logLoss = weightedMean(predictions.map((probability, index) => {
    const y = rows[index].y;
    const p = Math.max(EPSILON, Math.min(1 - EPSILON, probability));
    return -(y * Math.log(p) + (1 - y) * Math.log(1 - p));
  }), weights);
  const brierScore = weightedMean(predictions.map((probability, index) =>
    (probability - rows[index].y) ** 2), weights);
  return { logLoss, brierScore };
}

export function fitCalibration(samples, options = {}) {
  const clean = normalizeSamples(samples);
  const { partitions, metadata } = validatePartitions(clean);
  const train = partitions.train;
  const validation = partitions.validation;
  const test = partitions.test;
  const { slope, intercept } = fitParameters(train, options);
  const baseline = { slope: 1, intercept: 0 };
  const baselineValidation = scoreMetrics(validation, baseline.slope, baseline.intercept);
  const fittedValidation = scoreMetrics(validation, slope, intercept);
  const baselineTest = scoreMetrics(test, baseline.slope, baseline.intercept);
  const fittedTest = scoreMetrics(test, slope, intercept);
  const validationImproved = fittedValidation.logLoss < baselineValidation.logLoss &&
    fittedValidation.brierScore < baselineValidation.brierScore;
  const testImproved = fittedTest.logLoss < baselineTest.logLoss &&
    fittedTest.brierScore < baselineTest.brierScore;
  const accepted = validationImproved && testImproved;

  return {
    model: MODEL,
    slope,
    intercept,
    trained: accepted,
    accepted,
    scorePerspective: "side_to_move",
    trainingSamples: train.length,
    trainingGames: new Set(train.map(row => row.gameId)).size,
    validationSamples: validation.length,
    validationGames: new Set(validation.map(row => row.gameId)).size,
    testSamples: test.length,
    testGames: new Set(test.map(row => row.gameId)).size,
    validationLogLoss: fittedValidation.logLoss,
    validationBrierScore: fittedValidation.brierScore,
    testLogLoss: fittedTest.logLoss,
    testBrierScore: fittedTest.brierScore,
    baselineValidation,
    fittedValidation,
    baselineTest,
    fittedTest,
    validationImproved,
    testImproved,
    trainingWeighting: "equal_total_weight_per_game",
    ...metadata
  };
}

function readJsonl(path) {
  return readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean).map((line, index) => {
    try { return JSON.parse(line); }
    catch { throw new Error("Invalid JSON on dataset line " + (index + 1)); }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const input = process.argv[2];
  if (!input) {
    console.error("Usage: node scripts/calibrate-evaluation.mjs <annotated-search-positions.jsonl> [output-module.js]");
    process.exitCode = 2;
  } else {
    try {
      const output = resolve(process.argv[3] || "src/evaluation-calibration.js");
      const result = fitCalibration(readJsonl(resolve(input)));
      if (!result.accepted) {
        throw new Error("The fitted curve did not improve both validation log loss and Brier score over the provisional baseline. No production module was written.");
      }
      const { baselineValidation, fittedValidation, baselineTest, fittedTest, validationImproved, testImproved, accepted, ...moduleData } = result;
      const source = "// Generated by scripts/calibrate-evaluation.mjs from independently split Prunex search data.\n" +
        "export const evaluationCalibration = Object.freeze(" +
        JSON.stringify(moduleData, null, 2) + ");\n";
      writeFileSync(output, source);
      console.log(JSON.stringify({
        output,
        validation: { baseline: baselineValidation, calibrated: fittedValidation },
        test: { baseline: baselineTest, calibrated: fittedTest },
        ...moduleData,
        accepted
      }, null, 2));
    } catch (error) {
      console.error("Evaluation calibration rejected: " +
        (error instanceof Error ? error.message : String(error)));
      process.exitCode = 1;
    }
  }
}
