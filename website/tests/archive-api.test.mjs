import assert from "node:assert/strict";
import { validateGameRecord, validateMemorySamples } from "../api/archive.js";

const gameId = "7ca3ec87-6404-47d7-a1cc-986d2c5e9c73";
const validGame = {
  id: gameId,
  createdAt: "2026-11-04T00:00:00.000Z",
  result: "in_progress",
  humanColor: "w",
  initialFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  finalFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  pgn: "",
  moves: [],
  opponentVersion: "Prunex 0.8.0 browser opponent"
};
const validSample = {
  id: gameId + ":1",
  gameId,
  positionKey: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w",
  sideToMove: "w",
  moveUci: "e2e4",
  san: "e4",
  resultForMover: 1,
  evalLossCp: 0,
  grade: "BEST"
};

assert.equal(validateGameRecord(validGame), null);
assert.match(validateGameRecord({ ...validGame, humanColor: "white" }), /color/);
assert.match(validateGameRecord({ ...validGame, id: "not-a-uuid" }), /identifier/);
assert.match(validateGameRecord({ ...validGame, moves: Array(601).fill({}) }), /move list/);
assert.equal(validateMemorySamples([validSample], gameId), null);
assert.equal(validateMemorySamples([], gameId), null);
assert.match(validateMemorySamples([{ ...validSample, gameId: "another-game" }], gameId), /failed validation/);
assert.match(validateMemorySamples([{ ...validSample, moveUci: "z9e4" }], gameId), /failed validation/);
assert.match(validateMemorySamples([{ ...validSample, evalLossCp: 31 }], gameId), /failed validation/);
assert.match(validateMemorySamples(Array(2049).fill(validSample), gameId), /list is invalid/);

console.log("Archive API: input validation and owner-data shape checks passed.");
