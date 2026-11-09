let wasm = null;
let api = null;
let initializing = false;

const API_ERROR = -2147483648;
// The exported Prunex 0.8.0 WebAssembly search API is capped at depth 12.
const MAX_DEPTH = 12;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || min));
}

function opponentBudget(nodes) {
  const requested = Number(nodes) || 25000;
  if (requested <= 10000) return 150;
  if (requested <= 25000) return 350;
  if (requested <= 50000) return 600;
  if (requested <= 100000) return 1000;
  return 1800;
}

async function initialize() {
  if (wasm) {
    self.postMessage({ type: "ready", apiVersion: api.version });
    return;
  }
  if (initializing) return;
  initializing = true;
  try {
    importScripts("/engine/prunex-wasm.js");
    if (typeof self.createPrunexModule !== "function") {
      throw new Error("The Prunex WebAssembly module factory was not exported.");
    }
    wasm = await self.createPrunexModule({
      locateFile: path => path.endsWith(".wasm")
        ? new URL("/engine/prunex-wasm.wasm", self.location.origin).href
        : path
    });
    api = {
      version: wasm.cwrap("prunex_wasm_api_version", "number", []),
      search: wasm.cwrap("prunex_wasm_search_fen_timed", "number",
        ["number", "number", "number", "number", "number"]),
      depth: wasm.cwrap("prunex_wasm_search_depth", "number", []),
      nodes: wasm.cwrap("prunex_wasm_nodes", "number", [])
    };
    if (api.version() !== 800) {
      throw new Error("The loaded WebAssembly binary is not Prunex 0.8.0.");
    }
    self.postMessage({ type: "ready", apiVersion: api.version() });
  } catch (error) {
    wasm = null;
    api = null;
    self.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : String(error)
    });
  } finally {
    initializing = false;
  }
}

function withFen(fen, callback) {
  if (!wasm || !api) throw new Error("The Prunex engine is not initialized.");
  const byteLength = wasm.lengthBytesUTF8(fen) + 1;
  const fenPointer = wasm._malloc(byteLength);
  if (!fenPointer) throw new Error("Unable to allocate WebAssembly memory for the position.");
  try {
    wasm.stringToUTF8(fen, fenPointer, byteLength);
    return callback(fenPointer);
  } finally {
    wasm._free(fenPointer);
  }
}

function searchPosition(fen, timeLimitMs) {
  return withFen(fen, fenPointer => {
    const movePointer = wasm._malloc(16);
    if (!movePointer) throw new Error("Unable to allocate WebAssembly memory for the selected move.");
    try {
      const score = api.search(fenPointer, MAX_DEPTH, timeLimitMs, movePointer, 16);
      if (score === API_ERROR) throw new Error("Prunex rejected the supplied position or search settings.");
      const bestMove = wasm.UTF8ToString(movePointer);
      if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(bestMove)) {
        throw new Error("Prunex did not return a valid legal-move coordinate.");
      }
      return {
        scoreType: "cp",
        score,
        depth: api.depth(),
        selDepth: api.depth(),
        nodes: api.nodes(),
        bestMove,
        secondBest: null,
        wdl: null
      };
    } finally {
      wasm._free(movePointer);
    }
  });
}

function handleJob(job) {
  const fen = job.fen;
  if (typeof fen !== "string" || !fen.trim()) {
    throw new Error("A valid FEN position is required.");
  }
  const timeLimitMs = job.type === "search"
    ? opponentBudget(job.nodes)
    : clamp(job.movetime, 400, 30000);
  const result = searchPosition(fen, timeLimitMs);

  if (job.type === "search") {
    self.postMessage({ type: "bestmove", requestId: job.requestId, bestMove: result.bestMove });
    return;
  }
  self.postMessage({ type: "evaluation-complete", requestId: job.requestId, ...result });
}

self.addEventListener("message", event => {
  const data = event.data || {};
  if (data.type === "init") {
    void initialize();
    return;
  }
  if (data.type === "cancel") {
    // Searches are synchronous inside this worker. The UI interrupts one by
    // terminating and recreating this worker, so it cannot block cancellation.
    return;
  }
  if (data.type !== "search" && data.type !== "evaluate") return;
  if (!wasm || !api) {
    self.postMessage({
      type: "error",
      requestId: data.requestId,
      message: "The Prunex 0.8.0 engine is not ready."
    });
    return;
  }
  try {
    handleJob(data);
  } catch (error) {
    self.postMessage({
      type: "error",
      requestId: data.requestId,
      message: error instanceof Error ? error.message : String(error)
    });
  }
});
