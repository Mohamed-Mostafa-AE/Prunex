import assert from "node:assert/strict";
import { annotateDataset, createWasmAnnotator } from "./annotate-search-positions.mjs";

const annotator = await createWasmAnnotator();
assert.equal(annotator.apiVersion, 800);
assert.match(annotator.engineBundleSha256, /^[0-9a-f]{64}$/);

const rows = annotateDataset([{
  game_id: "wasm-annotation-smoke",
  split: "train",
  label_kind: "observed_game_result_and_played_move",
  fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  result_for_side_to_move: 0.5
}], annotator, {
  searchBudgetMs: 1000,
  engineVersion: "Prunex 0.8.0 · CI WebAssembly smoke",
  maxPositions: 1
});

assert.equal(rows.length, 1);
assert.equal(rows[0].prunex_search_score_pov, "side_to_move");
assert.equal(rows[0].search_runtime, "webassembly");
assert.equal(rows[0].prunex_wasm_api_version, 800);
assert.equal(rows[0].search_budget_ms, 1000);
assert.ok(Number.isInteger(rows[0].search_depth) && rows[0].search_depth >= 1);
assert.ok(Number.isFinite(rows[0].search_nodes) && rows[0].search_nodes > 0);
assert.match(rows[0].search_best_move, /^[a-h][1-8][a-h][1-8][qrbn]?$/);
assert.match(rows[0].prunex_engine_bundle_sha256, /^[0-9a-f]{64}$/);
assert.ok(Number.isInteger(rows[0].prunex_search_score_cp));

assert.throws(() => annotateDataset([{
  game_id: "bad-label",
  split: "train",
  label_kind: "observed_game_result_and_played_move",
  fen: "invalid",
  result_for_side_to_move: 2
}], annotator, { searchBudgetMs: 1000 }), /Invalid side-to-move result/);

console.log("Browser WASM search annotation: API, score perspective, completed depth, nodes and bundle provenance passed.");
