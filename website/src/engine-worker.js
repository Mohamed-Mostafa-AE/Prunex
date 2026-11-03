let engine;
let ready = false;
let awaitingReady = false;
let currentRequestId = null;
let currentRequestType = null;
let latestScore = null;

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
      if (currentRequestId === null) return;
      const requestId = currentRequestId;
      if (currentRequestType === "evaluate") {
        self.postMessage({
          type: "evaluation-complete",
          requestId,
          scoreType: latestScore?.scoreType,
          score: latestScore?.score,
          depth: latestScore?.depth
        });
      } else {
        self.postMessage({ type: "bestmove", requestId, bestMove: line.split(/\s+/)[1] });
      }
      currentRequestId = null;
      currentRequestType = null;
      latestScore = null;
      return;
    }

    if (line.startsWith("info ")) {
      const match = line.match(/\bdepth (\d+).*?\bscore (cp|mate) (-?\d+)/);
      if (match && currentRequestId !== null) {
        latestScore = {
          depth: Number(match[1]),
          scoreType: match[2],
          score: Number(match[3])
        };
        self.postMessage({
          type: "info",
          requestId: currentRequestId,
          jobType: currentRequestType,
          depth: latestScore.depth,
          scoreType: latestScore.scoreType,
          score: latestScore.score
        });
      }
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
    if (engine && currentRequestId !== null) engine.postMessage("stop");
    currentRequestId = null;
    currentRequestType = null;
    latestScore = null;
    return;
  }
  if (data.type === "search" || data.type === "evaluate") {
    if (!ready || !engine) {
      self.postMessage({ type: "error", requestId: data.requestId, message: "Engine is not ready." });
      return;
    }
    currentRequestId = data.requestId;
    currentRequestType = data.type;
    latestScore = null;
    engine.postMessage("position fen " + data.fen);
    if (data.type === "search") {
      engine.postMessage("go nodes " + Math.max(10000, Math.min(2000000, Number(data.nodes) || 25000)));
    } else {
      engine.postMessage("go depth " + Math.max(8, Math.min(20, Number(data.depth) || 12)));
    }
  }
});