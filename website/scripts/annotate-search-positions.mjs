#!/usr/bin/env node
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdtempSync, rmSync, mkdirSync, renameSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const API_ERROR = -2147483648;
const DEFAULT_ENGINE_JS = fileURLToPath(new URL("../public/engine/prunex-wasm.js", import.meta.url));
const DEFAULT_ENGINE_WASM = fileURLToPath(new URL("../public/engine/prunex-wasm.wasm", import.meta.url));
const UCI_MOVE = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

function sha256Bundle(engineJsPath, engineWasmPath) {
  const hash = createHash("sha256");
  hash.update(readFileSync(engineJsPath));
  hash.update(Buffer.from([0]));
  hash.update(readFileSync(engineWasmPath));
  return hash.digest("hex");
}

function readJsonl(path) {
  return readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean).map((line, index) => {
    try {
      return JSON.parse(line);
    } catch {
      throw new Error("Invalid JSON on input line " + (index + 1) + ".");
    }
  });
}

function validateRow(row, index) {
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    throw new Error("Expected a JSON object on input line " + (index + 1) + ".");
  }
  if (typeof row.game_id !== "string" || !row.game_id.trim()) {
    throw new Error("Missing game_id on input line " + (index + 1) + ".");
  }
  if (!["train", "validation", "test"].includes(row.split)) {
    throw new Error("Missing or invalid game-level split on input line " + (index + 1) + ".");
  }
  if (row.label_kind !== "observed_game_result_and_played_move") {
    throw new Error("Unsupported or missing outcome label on input line " + (index + 1) + ".");
  }
  if (![0, 0.5, 1].includes(row.result_for_side_to_move)) {
    throw new Error("Invalid side-to-move result on input line " + (index + 1) + ".");
  }
  if (typeof row.fen !== "string" || !row.fen.trim()) {
    throw new Error("Missing FEN on input line " + (index + 1) + ".");
  }
}

export async function createWasmAnnotator({
  engineJsPath = DEFAULT_ENGINE_JS,
  engineWasmPath = DEFAULT_ENGINE_WASM
} = {}) {
  const jsPath = resolve(engineJsPath);
  const wasmPath = resolve(engineWasmPath);
  const require = createRequire(import.meta.url);
  const createPrunexModule = require(jsPath);
  if (typeof createPrunexModule !== "function") {
    throw new Error("The checked-in Prunex WebAssembly module did not export its factory.");
  }
  const wasm = await createPrunexModule({
    locateFile: path => path.endsWith(".wasm") ? wasmPath : path
  });
  const api = {
    version: wasm.cwrap("prunex_wasm_api_version", "number", []),
    search: wasm.cwrap("prunex_wasm_search_fen_timed", "number",
      ["number", "number", "number", "number", "number"]),
    depth: wasm.cwrap("prunex_wasm_search_depth", "number", []),
    nodes: wasm.cwrap("prunex_wasm_nodes", "number", [])
  };
  if (api.version() !== 800) {
    throw new Error("Expected Prunex WebAssembly API 800, received " + api.version() + ".");
  }

  const bundleSha256 = sha256Bundle(jsPath, wasmPath);

  function annotateFen(fen, searchBudgetMs) {
    if (typeof fen !== "string" || !fen.trim()) throw new Error("A legal FEN string is required.");
    if (!Number.isInteger(searchBudgetMs) || searchBudgetMs < 1 || searchBudgetMs > 30000) {
      throw new Error("Search budget must be between 1 and 30000 milliseconds.");
    }

    const fenBytes = wasm.lengthBytesUTF8(fen) + 1;
    const fenPointer = wasm._malloc(fenBytes);
    if (!fenPointer) throw new Error("Unable to allocate WebAssembly memory for the FEN.");
    const movePointer = wasm._malloc(16);
    if (!movePointer) {
      wasm._free(fenPointer);
      throw new Error("Unable to allocate WebAssembly memory for the selected move.");
    }

    try {
      wasm.stringToUTF8(fen, fenPointer, fenBytes);
      const scoreCp = api.search(fenPointer, 12, searchBudgetMs, movePointer, 16);
      if (scoreCp === API_ERROR) throw new Error("Prunex rejected the FEN or search budget.");
      const depth = api.depth();
      const nodes = api.nodes();
      const bestMove = wasm.UTF8ToString(movePointer);
      if (!UCI_MOVE.test(bestMove)) {
        throw new Error("Prunex did not return a valid legal-move coordinate.");
      }
      if (!Number.isInteger(depth) || depth < 1) {
        throw new Error("No iterative-deepening iteration completed within the search budget.");
      }
      return { scoreCp, depth, nodes, bestMove };
    } finally {
      wasm._free(movePointer);
      wasm._free(fenPointer);
    }
  }

  return Object.freeze({
    apiVersion: api.version(),
    engineBundleSha256: bundleSha256,
    annotateFen
  });
}

export function annotateDataset(rows, annotator, {
  searchBudgetMs,
  engineVersion = "Prunex 0.8.0",
  maxPositions = 0
} = {}) {
  if (!Array.isArray(rows) || rows.length === 0) throw new Error("The input dataset is empty.");
  if (!Number.isInteger(searchBudgetMs) || searchBudgetMs < 1 || searchBudgetMs > 30000) {
    throw new Error("--movetime-ms must be between 1 and 30000.");
  }
  if (typeof engineVersion !== "string" || !engineVersion.trim()) {
    throw new Error("--engine-version must be a non-empty string.");
  }
  if (!Number.isInteger(maxPositions) || maxPositions < 0) {
    throw new Error("--max-positions must be a non-negative integer.");
  }

  const limit = maxPositions > 0 ? Math.min(rows.length, maxPositions) : rows.length;
  const annotated = [];
  for (let index = 0; index < limit; index += 1) {
    const row = rows[index];
    validateRow(row, index);
    const result = annotator.annotateFen(row.fen, searchBudgetMs);
    annotated.push({
      ...row,
      prunex_search_score_cp: result.scoreCp,
      prunex_search_score_pov: "side_to_move",
      search_budget_ms: searchBudgetMs,
      search_depth: result.depth,
      search_nodes: result.nodes,
      search_best_move: result.bestMove,
      search_runtime: "webassembly",
      prunex_wasm_api_version: annotator.apiVersion,
      prunex_engine_version: engineVersion,
      prunex_engine_bundle_sha256: annotator.engineBundleSha256
    });
  }
  return annotated;
}

function parseArgs(argv) {
  const options = {
    input: null,
    output: null,
    engineJs: DEFAULT_ENGINE_JS,
    engineWasm: DEFAULT_ENGINE_WASM,
    searchBudgetMs: 15000,
    engineVersion: "Prunex 0.8.0",
    maxPositions: 0,
    overwrite: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const next = argv[index + 1];
    if (flag === "--input" && next) { options.input = resolve(next); index += 1; }
    else if (flag === "--output" && next) { options.output = resolve(next); index += 1; }
    else if (flag === "--engine-js" && next) { options.engineJs = resolve(next); index += 1; }
    else if (flag === "--engine-wasm" && next) { options.engineWasm = resolve(next); index += 1; }
    else if (flag === "--movetime-ms" && next) { options.searchBudgetMs = Number(next); index += 1; }
    else if (flag === "--engine-version" && next) { options.engineVersion = next; index += 1; }
    else if (flag === "--max-positions" && next) { options.maxPositions = Number(next); index += 1; }
    else if (flag === "--overwrite") options.overwrite = true;
    else if (flag === "--help" || flag === "-h") options.help = true;
    else throw new Error("Unknown or incomplete option: " + flag);
  }
  return options;
}

export async function runAnnotation(options) {
  if (!options.input || !options.output) {
    throw new Error("--input and --output are required.");
  }
  if (!options.overwrite) {
    try {
      readFileSync(options.output);
      throw new Error("Output already exists; choose another path or pass --overwrite.");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  const rows = readJsonl(options.input);
  const annotator = await createWasmAnnotator({
    engineJsPath: options.engineJs,
    engineWasmPath: options.engineWasm
  });
  const result = annotateDataset(rows, annotator, {
    searchBudgetMs: options.searchBudgetMs,
    engineVersion: options.engineVersion,
    maxPositions: options.maxPositions
  });
  const directory = dirname(options.output);
  mkdirSync(directory, { recursive: true });
  const tempDirectory = mkdtempSync(resolve(directory, ".prunex-annotation-"));
  const tempPath = resolve(tempDirectory, "annotated.jsonl");
  try {
    writeFileSync(tempPath, result.map(row => JSON.stringify(row)).join("\n") + "\n", { encoding: "utf8" });
    renameSync(tempPath, options.output);
  } finally {
    rmSync(tempDirectory, { recursive: true, force: true });
  }
  return {
    input: options.input,
    output: options.output,
    annotatedPositions: result.length,
    searchBudgetMs: options.searchBudgetMs,
    engineVersion: options.engineVersion,
    engineBundleSha256: annotator.engineBundleSha256,
    wasmApiVersion: annotator.apiVersion
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      console.log([
        "Usage: node scripts/annotate-search-positions.mjs --input <positions.jsonl> --output <annotated.jsonl> [options]",
        "  --movetime-ms <1..30000>  Fixed budget per position (default 15000)",
        "  --engine-version <name>   Human-readable engine revision",
        "  --engine-js <path>        Prunex WASM JavaScript loader",
        "  --engine-wasm <path>      Prunex WASM binary",
        "  --max-positions <count>   Optional diagnostic sample cap",
        "  --overwrite               Replace an existing output file"
      ].join("\n"));
    } else {
      console.log(JSON.stringify(await runAnnotation(options), null, 2));
    }
  } catch (error) {
    console.error("Prunex WebAssembly search annotation failed: " +
      (error instanceof Error ? error.message : String(error)));
    process.exitCode = 1;
  }
}
