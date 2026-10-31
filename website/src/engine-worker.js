let engine;
let ready = false;
let awaitingReady = false;
let currentRequestId = null;

function startEngine() {
  if (engine) return;
  engine = new Worker("/engine/stockfish-19-lite-single.js");
  engine.addEventListener("message", (event) => {
    const line = String(event.data ?? "").trim();
    if (!line) return;

    if (line === "uciok") {
      engine.postMessage("setoption name Hash value 64");
      engine.postMessage("isready");
      awaitingReady = true;
      return;
    }

    if (line === "readyok" && awaitingReady) {
      awaitingReady = false;
      ready = true;
      self.postMessage({ type: "ready" });
      return;
    }

    if (line.startsWith("bestmove ")) {
      self.postMessage({ type: "bestmove", requestId: currentRequestId, bestMove: line.split(/\s+/)[1] });
      currentRequestId = null;
      return;
    }

    if (line.startsWith("info ")) {
      const match = line.match(/\bdepth (\d+).*?\bscore (cp|mate) (-?\d+)/);
      if (match) self.postMessage({ type: "info", depth: Number(match[1]), scoreType: match[2], score: Number(match[3]) });
    }
  });
  engine.addEventListener("error", (event) => {
    self.postMessage({ type: "error", message: event.message || "Stockfish worker failed." });
  });
  engine.postMessage("uci");
}

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "init") {
    try {
      startEngine();
    } catch (error) {
      self.postMessage({ type: "error", message: error instanceof Error ? error.message : String(error) });
    }
    return;
  }
  if (data.type === "cancel") {
    if (engine) engine.postMessage("stop");
    currentRequestId = null;
    return;
  }
  if (data.type === "search") {
    if (!ready || !engine) {
      self.postMessage({ type: "error", requestId: data.requestId, message: "Engine is not ready." });
      return;
    }
    currentRequestId = data.requestId;
    engine.postMessage("position fen " + data.fen);
    engine.postMessage("go nodes " + Math.max(10000, Math.min(2000000, Number(data.nodes) || 25000)));
  }
});
