const engineFactoryUrl = () => new URL("/engine/prunex.js", self.location.origin).href;

let enginePromise;
let activeRequest = 0;

async function engine() {
  if (!enginePromise) {
    self.postMessage({ type: "debug", message: "importing engine module" });
    enginePromise = import(/* @vite-ignore */ engineFactoryUrl()).then((factory) => {
      self.postMessage({ type: "debug", message: "engine module imported" });
      return factory.default({
        locateFile: (path) => new URL("/engine/" + path, self.location.origin).toString()
      });
    }).then((module) => {
      self.postMessage({ type: "debug", message: "WebAssembly instantiated; initializing C++" });
      module._prunex_init();
      self.postMessage({ type: "debug", message: "C++ engine initialized" });
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
      self.postMessage({ type: "debug", message: "worker received init request" });
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
    const bestMove = module.ccall("prunex_best_move", "string", ["string", "number", "number"], [data.fen, data.nodes, data.depth || 32]);
    if (token === activeRequest) self.postMessage({ type: "bestmove", requestId: data.requestId, bestMove });
  } catch (error) {
    self.postMessage({ type: "error", requestId: data.requestId, message: error instanceof Error ? error.message : String(error) });
  }
});
