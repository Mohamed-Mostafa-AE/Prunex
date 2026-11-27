import { evaluationCalibration } from "./evaluation-calibration.js";

const clamp01 = value => Math.max(0, Math.min(1, value));

export function evaluationCalibrationStatus() {
  const trained = evaluationCalibration.trained === true &&
    Number.isFinite(evaluationCalibration.slope) && evaluationCalibration.slope > 0 &&
    Number.isFinite(evaluationCalibration.intercept) &&
    Number.isInteger(evaluationCalibration.trainingSamples) && evaluationCalibration.trainingSamples >= 100 &&
    Number.isInteger(evaluationCalibration.trainingGames) && evaluationCalibration.trainingGames >= 20 &&
    Number.isInteger(evaluationCalibration.validationSamples) && evaluationCalibration.validationSamples >= 20 &&
    Number.isInteger(evaluationCalibration.validationGames) && evaluationCalibration.validationGames >= 5 &&
    Number.isInteger(evaluationCalibration.testSamples) && evaluationCalibration.testSamples >= 20 &&
    Number.isInteger(evaluationCalibration.testGames) && evaluationCalibration.testGames >= 5 &&
    evaluationCalibration.scorePerspective === "side_to_move";
  return Object.freeze({
    trained,
    status: trained ? "calibrated" : "provisional",
    model: evaluationCalibration.model,
    trainingSamples: trained ? evaluationCalibration.trainingSamples : 0,
    trainingGames: trained ? evaluationCalibration.trainingGames : 0,
    validationSamples: trained ? evaluationCalibration.validationSamples : 0,
    validationGames: trained ? evaluationCalibration.validationGames : 0,
    testSamples: trained ? evaluationCalibration.testSamples : 0,
    testGames: trained ? evaluationCalibration.testGames : 0,
    searchBudgetMs: trained ? evaluationCalibration.searchBudgetMs : null,
    engineVersion: trained ? evaluationCalibration.engineVersion : null
  });
}

export function scoreToCentipawns(result) {
  if (!result || !Number.isFinite(result.score)) return null;
  if (result.scoreType === "mate") {
    const distance = Math.min(900, Math.abs(result.score));
    return Math.sign(result.score || 1) * (10000 - distance);
  }
  return result.score;
}

export function centipawnsToExpectedPoints(scoreCp) {
  if (!Number.isFinite(scoreCp)) return null;
  if (scoreCp >= 10000) return 0.9999;
  if (scoreCp <= -10000) return 0.0001;

  const calibration = evaluationCalibrationStatus();
  const slope = calibration.trained ? evaluationCalibration.slope : 1;
  const intercept = calibration.trained ? evaluationCalibration.intercept : 0;
  const x = Math.max(-10, Math.min(10, scoreCp / 400));
  const z = slope * x + intercept;
  return 1 / (1 + Math.exp(-Math.max(-40, Math.min(40, z))));
}

export function expectedPointsFromEvaluation(result) {
  if (!result) return null;
  const wdl = result.wdl;
  if (wdl && Number.isFinite(wdl.win) && Number.isFinite(wdl.draw) && Number.isFinite(wdl.loss) &&
      wdl.win >= 0 && wdl.draw >= 0 && wdl.loss >= 0) {
    const total = wdl.win + wdl.draw + wdl.loss;
    if (Number.isFinite(total) && total > 0) {
      return clamp01((wdl.win + 0.5 * wdl.draw) / total);
    }
  }
  return centipawnsToExpectedPoints(scoreToCentipawns(result));
}

export function expectedPointLoss(beforeExpectedPoints, afterMoverExpectedPoints) {
  if (!Number.isFinite(beforeExpectedPoints) || !Number.isFinite(afterMoverExpectedPoints)) return null;
  return clamp01(beforeExpectedPoints - afterMoverExpectedPoints);
}

const PIECE_VALUES = { p: 100, n: 320, b: 335, r: 500, q: 900, k: 20000 };

export function isPieceSacrifice(move, nextMove) {
  return !!move && !!nextMove &&
    nextMove.to === move.to &&
    nextMove.captured === move.piece &&
    (PIECE_VALUES[move.piece] || 0) >= 320;
}

export function classifyMove(move, nextMove, beforeScore, afterScore, lossCp, ply,
  pointLoss, beforeExpectedPoints, afterMoverExpectedPoints) {
  if (move?.san?.includes("#")) {
    return { grade: "BEST", lossCp: 0, expectedPointLoss: 0, description: "Checkmate delivered" };
  }
  const loss = Number.isFinite(pointLoss) ? clamp01(pointLoss) :
    Number.isFinite(lossCp) && Number.isFinite(beforeScore)
      ? expectedPointLoss(centipawnsToExpectedPoints(beforeScore), centipawnsToExpectedPoints(beforeScore - lossCp))
      : null;
  if (!Number.isFinite(loss)) {
    return { grade: "UNRATED", lossCp: null, expectedPointLoss: null, description: "A completed search score was unavailable" };
  }
  if (Number.isFinite(beforeExpectedPoints) && beforeExpectedPoints >= 0.78 &&
      Number.isFinite(afterMoverExpectedPoints) && afterMoverExpectedPoints <= 0.50) {
    return { grade: "MISS", lossCp, expectedPointLoss: loss, description: "A winning continuation was missed and the advantage disappeared" };
  }
  if (isPieceSacrifice(move, nextMove) && loss <= 0.02 &&
      Number.isFinite(beforeExpectedPoints) && beforeExpectedPoints <= 0.78 &&
      Number.isFinite(afterMoverExpectedPoints) && afterMoverExpectedPoints >= 0.20) {
    return { grade: "BRILLIANT", lossCp, expectedPointLoss: loss, description: "A sound piece sacrifice confirmed by engine analysis" };
  }
  if (loss <= 0.005) return { grade: "BEST", lossCp, expectedPointLoss: loss, description: "Near-zero expected-points loss" };
  if (loss <= 0.02) return { grade: "EXCELLENT", lossCp, expectedPointLoss: loss, description: "Almost preserves the engine's expected result" };
  if (loss <= 0.05) return { grade: "GOOD", lossCp, expectedPointLoss: loss, description: "A sound move with a small expected-result loss" };
  if (loss <= 0.10) return { grade: "INACCURACY", lossCp, expectedPointLoss: loss, description: "A measurable expected-result loss" };
  if (loss <= 0.20) return { grade: "MISTAKE", lossCp, expectedPointLoss: loss, description: "A significant expected-result loss" };
  return { grade: "BLUNDER", lossCp, expectedPointLoss: loss, description: "A major expected-result loss" };
}

export function isApexMove({ engineBestMatches, sacrifice, pointLoss, uniqueMoveGap, beforeExpectedPoints }) {
  return !!engineBestMatches && !!sacrifice &&
    Number.isFinite(pointLoss) && pointLoss <= 0.005 &&
    Number.isFinite(uniqueMoveGap) && uniqueMoveGap >= 0.16 &&
    Number.isFinite(beforeExpectedPoints) && beforeExpectedPoints >= 0.20 && beforeExpectedPoints <= 0.80;
}

export function expectedPointsRetained(color, analysis = []) {
  const played = analysis.filter(move => move.color === color &&
    Number.isFinite(move.expectedPointLoss));
  if (!played.length) return null;
  const losses = played.map(move => clamp01(move.expectedPointLoss));
  const averageExpectedPointLoss = losses.reduce((total, value) => total + value, 0) / losses.length;
  return Math.round(clamp01(1 - averageExpectedPointLoss) * 1000) / 10;
}

// Keep the legacy name because archived game records store these values under
// whiteAccuracy/blackAccuracy. The displayed metric is explicitly renamed in UI.
export const reviewAccuracy = expectedPointsRetained;
