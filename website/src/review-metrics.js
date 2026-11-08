import { evaluationCalibration } from "./evaluation-calibration.js";

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
  // Prunex calibration maps native-engine centipawn scores to expected points.
  const x = Math.max(-10, Math.min(10, scoreCp / 400));
  const z = evaluationCalibration.slope * x + evaluationCalibration.intercept;
  return 1 / (1 + Math.exp(-Math.max(-40, Math.min(40, z))));
}

export function expectedPointsFromEvaluation(result) {
  if (!result) return null;
  const wdl = result.wdl;
  if (wdl && Number.isFinite(wdl.win) && Number.isFinite(wdl.draw) && Number.isFinite(wdl.loss)) {
    const total = wdl.win + wdl.draw + wdl.loss;
    if (total > 0) return Math.max(0, Math.min(1, (wdl.win + 0.5 * wdl.draw) / total));
  }
  return centipawnsToExpectedPoints(scoreToCentipawns(result));
}

export function expectedPointLoss(beforeExpectedPoints, afterMoverExpectedPoints) {
  if (!Number.isFinite(beforeExpectedPoints) || !Number.isFinite(afterMoverExpectedPoints)) return null;
  return Math.max(0, Math.min(1, beforeExpectedPoints - afterMoverExpectedPoints));
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
  const loss = Number.isFinite(pointLoss) ? Math.max(0, Math.min(1, pointLoss)) :
    Number.isFinite(lossCp) && Number.isFinite(beforeScore)
      ? expectedPointLoss(centipawnsToExpectedPoints(beforeScore), centipawnsToExpectedPoints(beforeScore - lossCp))
      : null;
  if (!Number.isFinite(loss)) {
    return { grade: "UNRATED", lossCp: null, expectedPointLoss: null, description: "Engine score unavailable" };
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

export function reviewAccuracy(color, analysis = []) {
  const played = analysis.filter(move => move.color === color &&
    (Number.isFinite(move.expectedPointLoss) || Number.isFinite(move.lossCp)));
  if (!played.length) return null;
  const losses = played.map(move => {
    if (Number.isFinite(move.expectedPointLoss)) return Math.max(0, Math.min(1, move.expectedPointLoss));
    if (Number.isFinite(move.lossCp) && Number.isFinite(move.beforeScore)) {
      return expectedPointLoss(
        centipawnsToExpectedPoints(move.beforeScore),
        centipawnsToExpectedPoints(move.beforeScore - move.lossCp)
      ) ?? 0;
    }
    return 0;
  });
  const averageExpectedPointLoss = losses.reduce((total, value) => total + value, 0) / losses.length;
  // Prunex Accuracy v2: average expected points retained, not a copy of CAPS2.
  return Math.round(Math.max(0, Math.min(100, 100 * (1 - averageExpectedPointLoss))) * 10) / 10;
}
