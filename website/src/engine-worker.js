let engine;
let ready = false;
let awaitingReady = false;
let activeJob = null;
let pendingJob = null;
let stopping = false;
let latestScore = null;

function startJob(job) {
  activeJob = { ...job, cancelled: false };
  latestScore = null;
  engine.postMessage("position fen " + job.fen);
  if (job.type === "search") {
    engine.postMessage("go nodes " + Math.max(10000, Math.min(2000000, Number(job.nodes) || 25000)));
  } else {
    engine.postMessage("go depth " + Math.max(8, Math.min(20, Number(job.depth) || 12)));
  }
}

function stopActiveJob() {
  if (!activeJob || stopping) return;
  activeJob.cancelled = true;
  stopping = true;
  engine.postMessage("stop");
}

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
      const finishedJob = activeJob;
      if (finishedJob && !finishedJob.cancelled) {
        if (finishedJob.type === "evaluate") {
          self.postMessage({
            type: "evaluation-complete",
            requestId: finishedJob.requestId,
            scoreType: latestScore?.scoreType,
            score: latestScore?.score,
            depth: latestScore?.depth
          });
        } else {
          self.postMessage({
            type: "bestmove",
            requestId: finishedJob.requestId,
            bestMove: line.split(/\s+/)[1]
          });
        }
      }

      activeJob = null;
      latestScore = null;
      stopping = false;
      if (pendingJob) {
        const nextJob = pendingJob;
        pendingJob = null;
        startJob(nextJob);
      }
      return;
    }

    if (line.startsWith("info ")) {
      const match = line.match(/\bdepth (\d+).*?\bscore (cp|mate) (-?\d+)/);
      if (match && activeJob && !activeJob.cancelled) {
        latestScore = {
          depth: Number(match[1]),
          scoreType: match[2],
          score: Number(match[3])
        };
        self.postMessage({
          type: "info",
          requestId: activeJob.requestId,
          jobType: activeJob.type,
          depth: latestScore.depth,
          scoreType: latestScore.scoreType,
          score: latestScore.score
        });
      }
    }
  });
  engine.addEventListener("error", (event) => {
    activeJob = null;
    pendingJob = null;
    stopping = false;
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
    pendingJob = null;
    stopActiveJob();
    return;
  }
  if (data.type === "search" || data.type === "evaluate") {
    if (!ready || !engine) {
      self.postMessage({ type: "error", requestId: data.requestId, message: "Engine is not ready." });
      return;
    }
    if (activeJob) {
      pendingJob = data;
      stopActiveJob();
    } else {
      startJob(data);
    }
  }
});