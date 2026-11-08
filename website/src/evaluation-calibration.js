// Prunex expected-points calibration. This calibrates score-to-outcome
// interpretation; it does NOT retrain or modify Stockfish's NNUE network.
export const evaluationCalibration = Object.freeze({
  model: "logistic-expected-points-v1",
  slope: 1,
  intercept: 0,
  trainingSamples: 0,
  validationSamples: 0,
  validationLogLoss: null,
  trained: false
});
