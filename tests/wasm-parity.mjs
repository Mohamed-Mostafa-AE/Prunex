import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const [wasmModulePath, nativeReferencePath] = process.argv.slice(2);
if (!wasmModulePath || !nativeReferencePath) {
  throw new Error("Usage: node tests/wasm-parity.mjs <prunex-wasm.js> <native-reference-executable>");
}
const fixtures = [
  ["starting-position", "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"],
  ["kiwipete", "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1"],
  ["rook-endgame", "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1"],
  ["mate-in-one", "7k/8/5KQ1/8/8/8/8/8 w - - 0 1"],
  ["closed-center", "r1bq1rk1/pp1n1ppp/2pbpn2/3p4/3P4/2NBPN2/PPQ1BPPP/R1R3K1 w - - 0 1"]
];
const nativeRun = spawnSync(resolve(nativeReferencePath), [], {
  encoding: "utf8", timeout: 120000, maxBuffer: 1024 * 1024
});
if (nativeRun.error) throw nativeRun.error;
assert.equal(nativeRun.status, 0, "Native reference failed: " + nativeRun.stderr);
const nativeResults = new Map();
for (const line of nativeRun.stdout.trim().split(/\r?\n/)) {
  if (!line) continue;
  const [name, scoreText, move, nodesText] = line.split("\t");
  assert.ok(name && scoreText !== undefined && move && nodesText !== undefined, "Malformed native record: " + line);
  nativeResults.set(name, { score: Number(scoreText), move, nodes: Number(nodesText) });
}
const imported = await import(pathToFileURL(resolve(wasmModulePath)).href);
const createModule = imported.default || imported.createPrunexModule;
assert.equal(typeof createModule, "function", "Emscripten module factory must be exported.");
const wasm = await createModule();
const apiVersion = wasm.cwrap("prunex_wasm_api_version", "number", []);
const evaluateFen = wasm.cwrap("prunex_wasm_evaluate_fen", "number", ["number"]);
const searchFen = wasm.cwrap("prunex_wasm_search_fen", "number", ["number", "number", "number", "number"]);
const searchNodes = wasm.cwrap("prunex_wasm_nodes", "number", []);
assert.equal(apiVersion(), 800, "WASM API must identify Prunex 0.8.0.");

function withFenBuffer(fen, callback) {
  const byteLength = wasm.lengthBytesUTF8(fen) + 1;
  const pointer = wasm._malloc(byteLength);
  assert.ok(pointer);
  try {
    wasm.stringToUTF8(fen, pointer, byteLength);
    return callback(pointer);
  } finally {
    wasm._free(pointer);
  }
}
for (const [name, fen] of fixtures) {
  const expected = nativeResults.get(name);
  assert.ok(expected, "Missing native fixture: " + name);
  withFenBuffer(fen, fenPointer => {
    const score = evaluateFen(fenPointer);
    assert.notEqual(score, -2147483648, name + ": invalid WASM evaluation result");
    assert.equal(score, expected.score, name + ": evaluation mismatch");
  });
  withFenBuffer(fen, fenPointer => {
    const movePointer = wasm._malloc(16);
    assert.ok(movePointer);
    try {
      const score = searchFen(fenPointer, 3, movePointer, 16);
      assert.notEqual(score, -2147483648, name + ": invalid WASM search result");
      assert.equal(score, expected.score, name + ": search score mismatch");
      assert.equal(wasm.UTF8ToString(movePointer), expected.move, name + ": best move mismatch");
      assert.equal(searchNodes(), expected.nodes, name + ": node count mismatch");
    } finally {
      wasm._free(movePointer);
    }
  });
}
console.log("Native/WASM parity: 5 positions matched static scores, best moves, and node counts.");
