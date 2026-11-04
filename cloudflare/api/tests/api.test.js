import test from "node:test";
import assert from "node:assert/strict";
import { validateGameRecord, validateMemorySamples } from "../src/index.js";

function validGame(overrides = {}) {
  return {
    id: "7ca3ec87-6404-47d7-a1cc-986d2c5e9c73",
    createdAt: "2026-11-04T00:00:00.000Z",
    result: "in_progress",
    humanColor: "w",
    initialFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    finalFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    pgn: "",
    moves: [],
    opponentVersion: "Prunex 0.8.0 browser opponent",
    ...overrides
  };
}

function validSample(overrides = {}) {
  return {
    id: "test-game:1",
    positionKey: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w",
    sideToMove: "w",
    moveUci: "e2e4",
    san: "e4",
    resultForMover: 1,
    evalLossCp: 0,
    grade: "BEST",
    ...overrides
  };
}

test("accepts valid game records", () => {
  assert.equal(validateGameRecord(validGame()), null);
});

test("rejects malformed game records", () => {
  assert.ok(validateGameRecord(validGame({ result: "unexpected" })));
  assert.ok(validateGameRecord(validGame({ humanColor: "white" })));
  assert.ok(validateGameRecord(validGame({ id: "" })));
  assert.ok(validateGameRecord(validGame({ moves: Array(601).fill({}) })));
});

test("accepts valid shared samples", () => {
  assert.equal(validateMemorySamples([validSample()]), null);
  assert.equal(validateMemorySamples([]), null);
});

test("rejects malformed samples before D1 inserts", () => {
  assert.ok(validateMemorySamples([validSample({ moveUci: "z9e4" })]));
  assert.ok(validateMemorySamples([validSample({ sideToMove: "white" })]));
  assert.ok(validateMemorySamples([validSample({ evalLossCp: 31 })]));
  assert.ok(validateMemorySamples([validSample({ resultForMover: 2 })]));
  assert.ok(validateMemorySamples([validSample({ grade: "BLUNDER" })]));
  assert.ok(validateMemorySamples([validSample({ positionKey: "short" })]));
  assert.ok(validateMemorySamples(Array(2049).fill(validSample())));
});
