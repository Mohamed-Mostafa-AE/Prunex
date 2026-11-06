let engine;
let ready = false;
let awaitingReady = false;
let activeJob = null;
let pendingJob = null;
let stopping = false;
let latestScore = null;
let latestScoresByPv = Object.create(null);
let multiPvByDepth = new Map();
let availableOptions = new Set();

function runCurrentPosition(job) {
  const fen = job.type === "analyze-game" ? job.positions[job.index] : job.fen;
  engine.postMessage("position fen " + fen);
  if (job.type === "search") {
    engine.postMessage("go nodes " + Math.max(10000, Math.min(2000000, Number(job.nodes) || 25000)));
  } else if (job.type === "evaluate" && Number.isFinite(job.movetime)) {
    // Honor the selected time budget instead of silently capping searches at 5s.
    engine.postMessage("go movetime " + Math.max(50, Math.min(30000, Number(job.movetime))));
  } else {
    engine.postMessage("go depth " + Math.max(8, Math.min(16, Number(job.depth) || 10)));
  }
}

function startJob(job) {
  activeJob = { ...job, cancelled: false };
  latestScore = null;
  latestBestMove = null;
  latestScoresByPv = Object.create(null);
  multiPvByDepth = new Map();
  if (availableOptions.has("MultiPV")) {
    engine.postMessage("setoption name MultiPV value " + (job.type === "evaluate" ? 2 : 1));
  }
  if (job.type === "analyze-game") {
    activeJob.index = 0;
    activeJob.results = [];
    runCurrentPosition(activeJob);
    return;
  }
  runCurrentPosition(activeJob);
}

function startPendingJob() {
  stopping = false;
  if (pendingJob) {
    const nextJob = pendingJob;
    pendingJob = null;
    startJob(nextJob);
  }
}

function stopActiveJob() {
  if (!activeJob || stopping) return;
  activeJob.cancelled = true;
  stopping = true;
  engine.postMessage("stop");
}

function finishActiveJob() {
  activeJob = null;
  latestScore = null;
  startPendingJob();
}

function handleBestMove() {
  const job = activeJob;
  if (!job) {
    startPendingJob();
    return;
  }
  if (job.cancelled) {
    finishActiveJob();
    return;
  }

  if (job.type === "analyze-game") {
    job.results.push({
      scoreType: latestScore?.scoreType || null,
      score: latestScore?.score ?? null,
      wdl: latestScore?.wdl || null,
      depth: latestScore?.depth ?? 0,
      bestMove: latestBestMove || null,
      secondBest: multiPvByDepth.get(latestScore?.depth)?.[2] || null
    });
    self.postMessage({
      type: "analysis-progress",
      requestId: job.requestId,
      completed: job.index + 1,
      total: job.positions.length
    });
    job.index += 1;
    latestScore = null;
    if (job.index < job.positions.length) {
      runCurrentPosition(job);
    } else {
      self.postMessage({
        type: "analysis-complete",
        requestId: job.requestId,
        results: job.results
      });
      finishActiveJob();
    }
    return;
  }

  if (job.type === "evaluate") {
    self.postMessage({
      type: "evaluation-complete",
      requestId: job.requestId,
      scoreType: latestScore?.scoreType,
      score: latestScore?.score,
      wdl: latestScore?.wdl || null,
      depth: latestScore?.depth,
      selDepth: latestScore?.selDepth,
      nodes: latestScore?.nodes,
      bestMove: latestBestMove,
      secondBest: multiPvByDepth.get(latestScore?.depth)?.[2] || null
    });
  } else if (job.type === "search") {
    self.postMessage({
      type: "bestmove",
      requestId: job.requestId,
      bestMove: latestBestMove
    });
  }
  finishActiveJob();
}

let latestBestMove = null;

function restartEngineForJob(job) {
  pendingJob = job;
  try {
    engine?.terminate();
  } catch {
    // The child worker may already have terminated.
  }
  engine = null;
  activeJob = null;
  latestScore = null;
  latestBestMove = null;
  latestScoresByPv = Object.create(null);
  multiPvByDepth = new Map();
  stopping = false;
  ready = false;
  awaitingReady = false;
  startEngine();
}

function startEngine() {
  if (engine) return;
  // The upstream UCI worker remains unmodified. Prunex owns this worker's
  // request scheduling, review orchestration, WDL interpretation, and grading.
  if (!self.crossOriginIsolated || typeof SharedArrayBuffer === "undefined") {
    self.postMessage({
      type: "error",
      message: "This browser session cannot start multi-threaded analysis. Open Prunex in a browser that supports cross-origin isolation."
    });
    return;
  }
  engine = new Worker("/engine/stockfish-19.js");
  engine.addEventListener("message", (event) => {
    const line = String(event.data ?? "").trim();
    if (!line) return;

    if (line.startsWith("option name ")) {
      const optionName = line.slice("option name ".length).split(/\s+type\s+/)[0];
      availableOptions.add(optionName);
      return;
    }

    if (line === "uciok") {
      engine.postMessage("setoption name Hash value 256");
      if (availableOptions.has("Threads")) {
        const hardwareThreads = Math.max(1, Number(self.navigator?.hardwareConcurrency) || 4);
        const searchThreads = Math.max(1, Math.min(8, hardwareThreads));
        engine.postMessage("setoption name Threads value " + searchThreads);
      }
      if (availableOptions.has("UCI_ShowWDL")) engine.postMessage("setoption name UCI_ShowWDL value true");
      engine.postMessage("isready");
      awaitingReady = true;
      return;
    }

    if (line === "readyok" && awaitingReady) {
      awaitingReady = false;
      ready = true;
      if (pendingJob) {
        const nextJob = pendingJob;
        pendingJob = null;
        startJob(nextJob);
      } else {
        self.postMessage({ type: "ready" });
      }
      return;
    }

    if (line.startsWith("bestmove ")) {
      latestBestMove = line.split(/\s+/)[1];
      handleBestMove();
      return;
    }

    if (line.startsWith("info ")) {
      const scoreMatch = line.match(/\bscore (cp|mate) (-?\d+)/);
      const depth = Number(line.match(/\bdepth (\d+)/)?.[1] || 0);
      const selDepth = Number(line.match(/\bseldepth (\d+)/)?.[1] || 0);
      const nodes = Number(line.match(/\bnodes (\d+)/)?.[1] || 0);
      const rank = Number(line.match(/\bmultipv (\d+)/)?.[1] || 1);
      const wdlMatch = line.match(/\bwdl (\d+) (\d+) (\d+)/);
      const pvMatch = line.match(/\bpv\s+(.+)$/);
      const isBound = /\b(?:lowerbound|upperbound)\b/.test(line);
      if (scoreMatch && depth > 0 && !isBound && activeJob && !activeJob.cancelled) {
        const candidate = {
          depth, selDepth, nodes, rank,
          scoreType: scoreMatch[1],
          score: Number(scoreMatch[2]),
          wdl: wdlMatch ? { win:Number(wdlMatch[1]), draw:Number(wdlMatch[2]), loss:Number(wdlMatch[3]) } : null,
          pvMove: pvMatch ? pvMatch[1].trim().split(/\s+/)[0] : null
        };
        const previous = latestScoresByPv[rank];
        if (!previous || candidate.depth > previous.depth ||
            (candidate.depth === previous.depth && candidate.nodes >= previous.nodes)) {
          latestScoresByPv[rank] = candidate;
        }
        if (rank === 1) latestScore = latestScoresByPv[1];

        // Keep only same-depth MultiPV pairs. Apex is never inferred by
        // comparing a deep principal line with a shallower alternative.
        const atDepth = multiPvByDepth.get(depth) || {};
        atDepth[rank] = candidate;
        multiPvByDepth.set(depth, atDepth);

        if (rank === 1 && activeJob.type !== "analyze-game") {
          self.postMessage({
            type: "info",
            requestId: activeJob.requestId,
            jobType: activeJob.type,
            depth: latestScore.depth,
            selDepth: latestScore.selDepth,
            nodes: latestScore.nodes,
            scoreType: latestScore.scoreType,
            score: latestScore.score,
            wdl: latestScore.wdl
          });
        }
      }
    }
  });
  engine.addEventListener("error", (event) => {
    activeJob = null;
    pendingJob = null;
    stopping = false;
    self.postMessage({ type: "error", message: event.message || "Prunex analysis worker failed." });
  });
  engine.postMessage("uci");
}

self.addEventListener("message", (event) => {
  if (event.origin && event.origin !== self.origin) return;
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
  if (data.type === "search" || data.type === "evaluate" || data.type === "analyze-game") {
    if (!ready || !engine) {
      self.postMessage({ type: "error", requestId: data.requestId, message: "Engine is not ready." });
      return;
    }
    if (data.type === "analyze-game" && (!Array.isArray(data.positions) || !data.positions.length || data.positions.length > 401)) {
      self.postMessage({ type: "error", requestId: data.requestId, message: "The game review position list is invalid." });
      return;
    }
    if (activeJob || stopping) {
      // Replace stale/in-flight work. A review or fresh position must never
      // be held behind an old search that has not returned bestmove.
      restartEngineForJob(data);
    } else {
      startJob(data);
    }
  }
});