import createPrunexModule from "/engine/prunex.js";

let enginePromise;
let activeRequest = 0;

async function engine() {
  if (!enginePromise) {
    enginePromise = createPrunexModule({
      locateFile: (path) => new URL("/engine/" + path, self.location.origin).toString()
    }).then((module) => {
      module._prunex_init();
      return module;
    });
  }
  return enginePromise;
}

self.addEventListener("message", async (event) => {
  const data = event.data || {};
  if (data.type === "cancel") {
    activeRequest += 1;
    return;
  }
  if (data.type === "init") {
    try {
      await engine();
      self.postMessage({ type: "ready" });
    } catch (error) {
      self.postMessage({ type: "error", message: error instanceof Error ? error.message : String(error) });
    }
    return;
  }
  if (data.type !== "search") return;
  const token = ++activeRequest;
  try {
    const module = await engine();
    if (token !== activeRequest) return;
    const bestMove = module.ccall(
      "prunex_best_move",
      "string",
      ["string", "number", "number"],
      [data.fen, data.nodes, data.depth || 32]
    );
    if (token === activeRequest) {
      self.postMessage({ type: "bestmove", requestId: data.requestId, bestMove });
    }
  } catch (error) {
    self.postMessage({
      type: "error",
      requestId: data.requestId,
      message: error instanceof Error ? error.message : String(error)
    });
  }
});
