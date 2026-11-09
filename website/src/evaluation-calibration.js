// Prunex expected-points calibration. This calibrates score-to-outcome
// interpretation only; it does not retrain the engine or change its evaluation.
export const evaluationCalibration = Object.freeze({
  model: "logistic-expected-points-v1",
  slope: 1,
  intercept: 0,
  trainingSamples: 0,
  validationSamples: 0,
  validationLogLoss: null,
  trained: false
});
