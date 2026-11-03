import { Chess } from "chess.js";
import { createGameArchive } from "./game-database.js";
import "./style.css";

const $ = (selector) => document.querySelector(selector);
const boardEl = $("#board");
const statusEl = $("#status");
const stateEl = $("#engine-state");
const turnEl = $("#turn-label");
const moveListEl = $("#move-list");
const moveCountEl = $("#move-count");
const undoButton = $("#undo");
const nodesSelect = $("#nodes");
const sideSelect = $("#side");
const fenInput = $("#fen-input");
const fenFeedback = $("#fen-feedback");
const boardFrame = $(".board-frame");
const boardStage = $(".board-stage");
const boardSizeInput = $("#board-size");
const boardSizeValue = $("#board-size-value");
const pieceStyleSelect = $("#piece-style");
const coordinatesToggle = $("#coordinates");
const legalMovesToggle = $("#legal-moves");
const promotionPicker = $("#promotion-picker");
const gameResultOverlay = $("#game-result-dialog");
const gameResultClose = $("#game-result-close");
const returnLiveButton = $("#return-live");
const soundToggle = $("#defeat-sound");
const evaluationToggle = $("#show-evaluation");
const evaluationColumn = $("#evaluation-column");
const gameReviewPanel = $("#game-review-panel");
const reviewProgress = $("#review-progress");
const reviewProgressFill = $("#review-progress-fill");
const reviewProgressLabel = $("#review-progress-label");
const reviewSummary = $("#review-summary");
const reviewKeyMoments = $("#review-key-moments");
const archiveCount = $("#game-archive-count");
const archiveList = $("#game-archive-list");
const archiveNote = $("#game-archive-note");
const evaluationFill = $("#evaluation-fill");
const evaluationLabel = $("#evaluation-label");
const analysisStatus = $("#analysis-status");
const gameResultTone = $("#game-result-tone");
const gameResultTitle = $("#game-result-title");
const gameResultSubtitle = $("#game-result-subtitle");
const gameResultCopy = $("#game-result-copy");
const siteThemeToggle = $("#site-theme-toggle");
const worker = new Worker(new URL("./engine-worker.js", import.meta.url), { type: "module" });
const game = new Chess();
let initialFen = game.fen();
let reviewMovesSnapshot = null;
let reviewPly = null;
let soundEnabled = true;
let showEvaluation = true;
let audioContext = null;
let evaluating = false;
let analyzingGame = false;
let enginePositionTurn = "w";
let moveAnalysis = [];
let savedGameFen = null;
let currentArchiveRecord = null;
let gameArchiveDbPromise = null;
const REVIEW_DEPTH = 10;
const MAX_REVIEW_PLIES = 200;
const gameArchive = createGameArchive({
  url: import.meta.env.VITE_SUPABASE_URL || "",
  publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || ""
});

const glyph = {
  w: { k: "♔", q: "♕", r: "♖", b: "♗", n: "♘", p: "♙" },
  b: { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" }
};

let selected = null;
let legalTargets = [];
let flipped = false;
let ready = false;
let thinking = false;
let requestId = 0;
let lastMove = null;
let humanColor = "w";
let showCoordinates = true;
let showLegalMoves = true;
let pendingPromotion = null;
let shownResultFen = null;

const squareName = (row, col) => "abcdefgh"[col] + String(8 - row);


function completePromotion(piece) {
  if (!pendingPromotion) return;
  if (evaluating) cancelSearch();
  const move = game.move({ ...pendingPromotion, promotion: piece });
  if (!move) return;
  playMoveSound(move);
  lastMove = { from: move.from, to: move.to };
  pendingPromotion = null;
  promotionPicker.hidden = true;
  selected = null;
  legalTargets = [];
  render();
  search();
}
function savePreference(key, value) {
  try { localStorage.setItem("prunex-" + key, String(value)); } catch {}
}
function loadPreference(key, fallback) {
  try { return localStorage.getItem("prunex-" + key) ?? fallback; } catch { return fallback; }
}

function primeAudio() {
  if (!soundEnabled || audioContext) return audioContext;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  try {
    audioContext = new AudioContextClass();
    if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
  } catch {
    audioContext = null;
  }
  return audioContext;
}

function playTone(context, frequency, duration, options = {}) {
  if (!context) return;
  const start = context.currentTime + (options.delay || 0);
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = options.type || "triangle";
  oscillator.frequency.setValueAtTime(frequency, start);
  if (options.endFrequency) {
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, options.endFrequency), start + duration);
  }
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(options.volume || 0.045, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.025);
}

function playGameEndSound(result) {
  // Keep the approved defeat cue only; all move, victory, and draw sounds stay silent.
  if (!soundEnabled || result !== "loss") return;
  const context = primeAudio();
  if (!context) return;
  [440, 370, 311, 220].forEach((frequency, index) =>
    playTone(context, frequency, 0.2, { delay: index * 0.12, volume: 0.045, type: "sine" }));
}

function applyEvaluation(scoreType, score, sideToMove, depth) {
  const whiteScore = sideToMove === "w" ? score : -score;
  let label;
  let whitePercent;
  if (scoreType === "mate") {
    label = (whiteScore < 0 ? "−" : "") + "M" + Math.abs(whiteScore);
    whitePercent = whiteScore > 0 ? 100 : whiteScore < 0 ? 0 : 50;
  } else {
    const pawns = Math.abs(whiteScore) / 100;
    label = (whiteScore > 0 ? "+" : whiteScore < 0 ? "−" : "") + pawns.toFixed(2);
    whitePercent = 50 + Math.tanh(whiteScore / 500) * 50;
  }
  evaluationLabel.textContent = label;
  evaluationLabel.setAttribute("aria-label",
    scoreType === "mate" ? (whiteScore > 0 ? "White has a forced mate" : "Black has a forced mate") :
      (whiteScore > 0 ? "White advantage " : whiteScore < 0 ? "Black advantage " : "Equal position ") + Math.abs(whiteScore / 100).toFixed(2) + " pawns");
  evaluationFill.style.height = Math.max(0, Math.min(100, whitePercent)) + "%";
  evaluationFill.dataset.advantage = whiteScore > 0 ? "white" : whiteScore < 0 ? "black" : "equal";
  analysisStatus.textContent = "DEPTH " + (depth || "—");
}

function syncTerminalEvaluation() {
  if (game.isCheckmate()) {
    const whiteWon = game.turn() === "b";
    evaluationLabel.textContent = whiteWon ? "MATE" : "−MATE";
    evaluationLabel.setAttribute("aria-label", whiteWon ? "White wins by checkmate" : "Black wins by checkmate");
    evaluationFill.style.height = whiteWon ? "100%" : "0%";
    evaluationFill.dataset.advantage = whiteWon ? "white" : "black";
    analysisStatus.textContent = "CHECKMATE";
  } else if (game.isGameOver()) {
    evaluationLabel.textContent = "0.00";
    evaluationLabel.setAttribute("aria-label", "Drawn position");
    evaluationFill.style.height = "50%";
    evaluationFill.dataset.advantage = "equal";
    analysisStatus.textContent = "DRAW";
  }
}

function syncEvaluationVisibility() {
  boardStage.dataset.evaluation = showEvaluation ? "visible" : "hidden";
  evaluationToggle.checked = showEvaluation;
}

function setEvaluationPending() {
  evaluationLabel.textContent = "…";
  evaluationLabel.setAttribute("aria-label", "Engine is evaluating the position");
  evaluationFill.style.height = "50%";
  evaluationFill.dataset.advantage = "equal";
  analysisStatus.textContent = "EVALUATING";
}
function applySiteTheme(theme) {
  const selected = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.siteTheme = selected;
  document.documentElement.style.colorScheme = selected;
  const dark = selected === "dark";
  siteThemeToggle.setAttribute("aria-pressed", String(dark));
  siteThemeToggle.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
  $("#theme-toggle-icon").textContent = dark ? "☀" : "☾";
  $("#theme-toggle-label").textContent = dark ? "Light mode" : "Dark mode";
}
function setBoardSize(value, persist = true) {
  const size = Math.max(320, Math.min(640, Number(value) || 520));
  boardFrame.style.setProperty("--board-size", size + "px");
  boardStage.style.setProperty("--board-size", size + "px");
  boardSizeInput.value = String(size);
  boardSizeValue.value = size + " px";
  boardSizeValue.textContent = size + " px";
  if (persist) savePreference("board-size", size);
}
function applyPreferences() {
  applySiteTheme(loadPreference("site-theme", "light"));
  const savedTheme = loadPreference("theme", "blue");
  const theme = ["blue", "ice"].includes(savedTheme) ? savedTheme : "blue";
  const storedPieces = loadPreference("pieces", "cburnett");
  const pieces = ["cburnett", "unicode", "letters"].includes(storedPieces) ? storedPieces : "cburnett";
  showCoordinates = loadPreference("coordinates", "true") !== "false";
  showLegalMoves = loadPreference("legal-moves", "true") !== "false";
  soundEnabled = loadPreference("defeat-sound", "true") !== "false";
  showEvaluation = loadPreference("show-evaluation", "true") !== "false";
  $("#theme").value = theme;
  pieceStyleSelect.value = pieces;
  coordinatesToggle.checked = showCoordinates;
  legalMovesToggle.checked = showLegalMoves;
  soundToggle.checked = soundEnabled;
  evaluationToggle.checked = showEvaluation;
  syncEvaluationVisibility();
  boardEl.dataset.theme = theme;
  boardEl.dataset.pieces = pieces;
  setBoardSize(loadPreference("board-size", "520"), false);
}

function statusText() {
  if (reviewMovesSnapshot && !game.isGameOver()) return "Review mode · " + (game.turn() === "w" ? "White" : "Black") + " to move";
  if (game.isCheckmate()) return game.turn() === humanColor ? "Checkmate · Engine wins" : "Checkmate · You win";
  if (game.isStalemate()) return "Draw · Stalemate";
  if (game.isThreefoldRepetition()) return "Draw · Threefold repetition";
  if (game.isInsufficientMaterial()) return "Draw · Insufficient material";
  if (game.isDraw()) return "Draw";
  if (game.isCheck()) return (game.turn() === humanColor ? "Your move" : "Engine to move") + " · Check";
  return game.turn() === humanColor ? "Your move" : "Engine to move";
}


function dismissGameResult(restoreBoardFocus = true) {
  gameResultOverlay.hidden = true;
  if (restoreBoardFocus) boardEl.focus({ preventScroll: true });
}

function syncGameResult() {
  if (!game.isGameOver()) {
    shownResultFen = null;
    if (!gameResultOverlay.hidden) dismissGameResult(false);
    return;
  }

  const resultFen = game.fen();
  if (shownResultFen === resultFen) return;

  let result;
  if (game.isCheckmate() && game.turn() !== humanColor) {
    result = {
      kind: "win",
      label: "VICTORY",
      title: "Well, well, well.",
      subtitle: "The engine has been humbled.",
      copy: "A strong move, a stronger finish. Prunex will be reviewing this game in its next performance evaluation."
    };
  } else if (game.isCheckmate()) {
    result = {
      kind: "loss",
      label: "DEFEAT",
      title: "That's unfortunate.",
      subtitle: "Prunex takes this one.",
      copy: "Looks like the engine had the better day. Bad news: Prunex is still improving, so this might not be your last defeat."
    };
  } else {
    result = {
      kind: "draw",
      label: "DRAW",
      title: "A diplomatic solution.",
      subtitle: "Nobody gets to brag today.",
      copy: "A hard-fought game, and a mutually agreed refusal to lose."
    };
  }

  gameResultOverlay.dataset.result = result.kind;
  gameResultTone.textContent = result.label;
  gameResultTitle.textContent = result.title;
  gameResultSubtitle.textContent = result.subtitle;
  gameResultCopy.textContent = result.copy;
  shownResultFen = resultFen;
  playGameEndSound(result.kind);

  if (gameResultOverlay.hidden) {
    gameResultOverlay.hidden = false;
    gameResultClose.focus({ preventScroll: true });
  }
}

function syncFen() {
  fenInput.value = game.fen();
}

function renderBoard() {
  boardEl.replaceChildren();
  boardEl.classList.toggle("no-coordinates", !showCoordinates);
  const rows = game.board();
  for (let vr = 0; vr < 8; vr += 1) {
    for (let vc = 0; vc < 8; vc += 1) {
      const row = flipped ? 7 - vr : vr;
      const col = flipped ? 7 - vc : vc;
      const square = squareName(row, col);
      const piece = rows[row][col];
      const button = document.createElement("button");
      button.type = "button";
      button.className = "square " + ((row + col) % 2 ? "dark" : "light");
      button.dataset.square = square;
      button.setAttribute("aria-label", piece ? square + " " + (piece.color === "w" ? "white " : "black ") + piece.type : square);
      if (selected === square) button.classList.add("selected");
      if (lastMove && (lastMove.from === square || lastMove.to === square)) button.classList.add("last-move");
      if (showLegalMoves && legalTargets.includes(square)) button.classList.add(piece ? "capture-target" : "move-target");
      if (piece) {
        const span = document.createElement("span");
        span.className = "piece " + (piece.color === "w" ? "white-piece" : "black-piece");
        const pieceSet = boardEl.dataset.pieces || "cburnett";
        if (pieceSet === "cburnett") {
          const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
          svg.classList.add("piece-svg");
          svg.setAttribute("viewBox", "0 0 45 45");
          svg.setAttribute("aria-hidden", "true");
          const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
          use.setAttribute("href", "/pieces/cburnett.svg#" + piece.color + piece.type.toUpperCase());
          svg.append(use);
          span.append(svg);
        } else if (pieceSet === "letters") {
          span.classList.add("piece-letters");
          span.textContent = piece.type.toUpperCase();
        } else {
          span.classList.add("piece-unicode");
          span.textContent = glyph[piece.color][piece.type];
        }
        button.append(span);
      }
      if (vc === 0) {
        const rank = document.createElement("span");
        rank.className = "coord rank";
        rank.textContent = String(flipped ? vr + 1 : 8 - vr);
        button.append(rank);
      }
      if (vr === 7) {
        const file = document.createElement("span");
        file.className = "coord file";
        file.textContent = "abcdefgh"[col];
        button.append(file);
      }
      button.addEventListener("click", () => onSquare(square));
      boardEl.append(button);
    }
  }
}

function buildMoveButton(move, ply, currentPly) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "move-notation";
  button.textContent = move.san;
  button.dataset.ply = String(ply);
  button.setAttribute("aria-label", "Go to position after " + move.san);
  if (ply === currentPly) {
    button.classList.add("is-current");
    button.setAttribute("aria-current", "step");
  }
  button.addEventListener("click", () => goToPly(ply));
  return button;
}

function renderMoves() {
  const history = reviewMovesSnapshot || game.history({ verbose: true });
  const currentPly = reviewMovesSnapshot ? reviewPly : history.length;
  moveListEl.replaceChildren();

  if (history.length) {
    const startButton = document.createElement("button");
    startButton.type = "button";
    startButton.className = "move-start";
    startButton.textContent = "Starting position";
    startButton.dataset.ply = "0";
    if (currentPly === 0) {
      startButton.classList.add("is-current");
      startButton.setAttribute("aria-current", "step");
    }
    startButton.addEventListener("click", () => goToPly(0));
    moveListEl.append(startButton);
  } else {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "Your game will appear here.";
    moveListEl.append(empty);
  }

  for (let i = 0; i < history.length; i += 2) {
    const row = document.createElement("div");
    row.className = "move-row";
    const number = document.createElement("span");
    number.className = "move-number";
    number.textContent = String(Math.floor(i / 2) + 1) + ".";
    const white = buildMoveButton(history[i], i + 1, currentPly);
    const black = history[i + 1]
      ? buildMoveButton(history[i + 1], i + 2, currentPly)
      : document.createElement("span");
    if (!history[i + 1]) black.className = "move-blank";
    row.append(number, white, black);
    moveListEl.append(row);
  }

  const active = moveListEl.querySelector(".move-notation.is-current, .move-start.is-current");
  if (active) active.scrollIntoView({ block: "nearest" });
  else if (!reviewMovesSnapshot) moveListEl.scrollTop = moveListEl.scrollHeight;
  moveCountEl.textContent = reviewMovesSnapshot
    ? "Viewing " + currentPly + " / " + history.length + " plies"
    : history.length + " plies";
}

function goToPly(ply) {
  const sourceMoves = reviewMovesSnapshot || game.history({ verbose: true }).map(move => ({
    from: move.from, to: move.to, promotion: move.promotion, san: move.san
  }));
  if (!reviewMovesSnapshot) reviewMovesSnapshot = sourceMoves;
  const targetPly = Math.max(0, Math.min(sourceMoves.length, Number(ply) || 0));

  cancelSearch();
  game.load(initialFen);
  for (let i = 0; i < targetPly; i += 1) {
    const saved = sourceMoves[i];
    const applied = game.move({ from: saved.from, to: saved.to, promotion: saved.promotion });
    if (!applied) {
      reviewMovesSnapshot = null;
      reviewPly = null;
      throw new Error("Could not restore the selected move-history position.");
    }
  }

  reviewPly = targetPly;
  const previous = targetPly ? sourceMoves[targetPly - 1] : null;
  lastMove = previous ? { from: previous.from, to: previous.to } : null;
  selected = null;
  legalTargets = [];
  pendingPromotion = null;
  promotionPicker.hidden = true;
  render();
  if (!game.isGameOver()) evaluatePosition();
}

function returnToLive() {
  if (!reviewMovesSnapshot) return;
  const savedMoves = reviewMovesSnapshot;
  cancelSearch();
  game.load(initialFen);
  for (const saved of savedMoves) {
    const applied = game.move({ from: saved.from, to: saved.to, promotion: saved.promotion });
    if (!applied) throw new Error("Could not restore the live game position.");
  }
  reviewMovesSnapshot = null;
  reviewPly = null;
  const previous = savedMoves[savedMoves.length - 1];
  lastMove = previous ? { from: previous.from, to: previous.to } : null;
  selected = null;
  legalTargets = [];
  render();
  search();
}


function render() {
  renderBoard();
  renderMoves();
  syncFen();

  const gameOver = game.isGameOver();
  statusEl.textContent = statusText();
  statusEl.dataset.kind = gameOver ? "finished" : game.isCheck() ? "check" : thinking ? "thinking" : evaluating ? "evaluating" : "";
  stateEl.textContent = !ready ? "Starting engine" : thinking ? "Calculating a reply…" : evaluating ? "Evaluating position…" : "Engine ready";
  stateEl.dataset.busy = String(thinking || evaluating);

  if (game.isCheckmate()) {
    turnEl.textContent = game.turn() === humanColor ? "CHECKMATE · YOU LOST" : "CHECKMATE · YOU WON";
    turnEl.dataset.state = game.turn() === humanColor ? "loss" : "win";
  } else if (game.isDraw()) {
    turnEl.textContent = "DRAW · GAME OVER";
    turnEl.dataset.state = "draw";
  } else if (reviewMovesSnapshot) {
    turnEl.textContent = "REVIEW · " + (game.turn() === "w" ? "WHITE" : "BLACK") + " TO MOVE";
    turnEl.dataset.state = "review";
  } else {
    turnEl.textContent = game.turn() === humanColor
      ? "YOUR TURN · " + (humanColor === "w" ? "WHITE" : "BLACK")
      : "ENGINE · " + (humanColor === "w" ? "BLACK" : "WHITE");
    turnEl.dataset.state = "";
  }

  returnLiveButton.hidden = !reviewMovesSnapshot;
  undoButton.disabled = thinking || !!reviewMovesSnapshot || game.history().length === 0;
  if (gameOver) syncTerminalEvaluation();
  syncGameResult();
}

function evaluatePosition() {
  if (!ready || thinking || game.isGameOver()) {
    if (game.isGameOver()) syncTerminalEvaluation();
    return;
  }
  if (evaluating) cancelSearch();
  requestId += 1;
  evaluating = true;
  enginePositionTurn = game.turn();
  setEvaluationPending();
  stateEl.textContent = "Evaluating position…";
  stateEl.dataset.busy = "true";
  worker.postMessage({
    type: "evaluate",
    requestId,
    fen: game.fen(),
    depth: 12
  });
}

function search() {
  if (!ready || thinking || game.isGameOver() || reviewMovesSnapshot) {
    if (game.isGameOver()) syncTerminalEvaluation();
    return;
  }
  if (evaluating) cancelSearch();
  if (game.turn() === humanColor) {
    evaluatePosition();
    return;
  }

  thinking = true;
  selected = null;
  legalTargets = [];
  enginePositionTurn = game.turn();
  requestId += 1;
  render();
  worker.postMessage({
    type: "search",
    requestId,
    fen: game.fen(),
    nodes: Number(nodesSelect.value),
    depth: 32
  });
}


function onSquare(square) {
  primeAudio();
  if (!ready || thinking || reviewMovesSnapshot || game.isGameOver() || game.turn() !== humanColor) return;
  const piece = game.get(square);
  if (selected) {
    if (legalTargets.includes(square)) {
      try {
        const candidateMoves = game.moves({ square: selected, verbose: true }).filter(move => move.to === square);
        if (candidateMoves.some(move => move.promotion)) {
          pendingPromotion = { from: selected, to: square };
          promotionPicker.hidden = false;
          return;
        }
        if (evaluating) cancelSearch();
        const move = game.move({ from: selected, to: square });
        playMoveSound(move);
        lastMove = { from: move.from, to: move.to };
        selected = null;
        legalTargets = [];
        render();
        search();
        return;
      } catch {
        selected = null;
        legalTargets = [];
      }
    }
  }
  if (piece?.color === humanColor) {
    selected = square;
    legalTargets = game.moves({ square, verbose: true }).map(move => move.to);
  } else {
    selected = null;
    legalTargets = [];
  }
  renderBoard();
}


function cancelSearch() {
  requestId += 1;
  if (thinking || evaluating) worker.postMessage({ type: "cancel" });
  thinking = false;
  evaluating = false;
}

function startNewGame() {
  cancelSearch();
  initialFen = new Chess().fen();
  reviewMovesSnapshot = null;
  reviewPly = null;
  game.reset();
  selected = null;
  legalTargets = [];
  lastMove = null;
  render();
  search();
}


worker.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "debug") return;
  if (data.type === "ready") {
    ready = true;
    render();
    search();
    return;
  }
  if (data.type === "error" && data.requestId === undefined) {
    ready = false;
    thinking = false;
    evaluating = false;
    render();
    statusEl.textContent = "Engine failed to load: " + data.message;
    statusEl.dataset.kind = "error";
    return;
  }
  if (data.requestId !== requestId) return;

  if (data.type === "info") {
    if (data.scoreType !== undefined) applyEvaluation(data.scoreType, data.score, enginePositionTurn, data.depth);
    return;
  }
  if (data.type === "evaluation-complete") {
    evaluating = false;
    if (data.scoreType !== undefined) applyEvaluation(data.scoreType, data.score, enginePositionTurn, data.depth);
    else {
      evaluationLabel.textContent = "—";
      analysisStatus.textContent = "EVALUATION UNAVAILABLE";
    }
    stateEl.textContent = "Engine ready";
    stateEl.dataset.busy = "false";
    return;
  }
  if (data.type === "error") {
    if (evaluating) {
      evaluating = false;
      evaluationLabel.textContent = "—";
      analysisStatus.textContent = "EVALUATION UNAVAILABLE";
      stateEl.textContent = "Engine ready";
      stateEl.dataset.busy = "false";
      return;
    }
    thinking = false;
    render();
    statusEl.textContent = "Engine error: " + data.message;
    statusEl.dataset.kind = "error";
    return;
  }
  if (data.type === "bestmove") {
    thinking = false;
    try {
      const move = game.move(data.bestMove);
      if (!move) throw new Error("Illegal engine move: " + data.bestMove);
      playMoveSound(move);
      lastMove = { from: move.from, to: move.to };
      render();
      search();
    } catch (error) {
      render();
      statusEl.textContent = error instanceof Error ? error.message : "Could not apply engine move.";
      statusEl.dataset.kind = "error";
    }
  }
});


worker.addEventListener("error", (event) => {
  ready = false;
  thinking = false;
  render();
  statusEl.textContent = "Engine worker failed: " + event.message;
  statusEl.dataset.kind = "error";
});

$("#new-game").addEventListener("click", () => { primeAudio(); startNewGame(); });
returnLiveButton.addEventListener("click", returnToLive);
gameResultClose.addEventListener("click", () => dismissGameResult());
$("#game-result-review").addEventListener("click", () => dismissGameResult());
$("#game-result-new-game").addEventListener("click", () => {
  dismissGameResult();
  startNewGame();
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !gameResultOverlay.hidden) {
    event.preventDefault();
    dismissGameResult();
  }
});
undoButton.addEventListener("click", () => {
  if (thinking || reviewMovesSnapshot) return;
  if (game.history().length) game.undo();
  if (game.history().length) game.undo();
  const h = game.history({ verbose: true });
  const prior = h[h.length - 1];
  lastMove = prior ? { from: prior.from, to: prior.to } : null;
  selected = null;
  legalTargets = [];
  render();
  search();
});
$("#flip").addEventListener("click", () => {
  flipped = !flipped;
  boardEl.classList.toggle("board-flipped", flipped);
  renderBoard();
});
sideSelect.addEventListener("change", () => {
  primeAudio();
  humanColor = sideSelect.value;
  startNewGame();
});
siteThemeToggle.addEventListener("click", () => {
  const next = document.documentElement.dataset.siteTheme === "dark" ? "light" : "dark";
  applySiteTheme(next);
  savePreference("site-theme", next);
});
$("#theme").addEventListener("change", (event) => {
  boardEl.dataset.theme = event.target.value;
  savePreference("theme", event.target.value);
});
pieceStyleSelect.addEventListener("change", event => {
  boardEl.dataset.pieces = event.target.value;
  savePreference("pieces", event.target.value);
  renderBoard();
});
coordinatesToggle.addEventListener("change", event => {
  showCoordinates = event.target.checked;
  savePreference("coordinates", showCoordinates);
  renderBoard();
});
legalMovesToggle.addEventListener("change", event => {
  showLegalMoves = event.target.checked;
  savePreference("legal-moves", showLegalMoves);
  renderBoard();
});
soundToggle.addEventListener("change", event => {
  soundEnabled = event.target.checked;
  savePreference("move-sounds", soundEnabled);
  if (soundEnabled) primeAudio();
});
boardSizeInput.addEventListener("input", event => setBoardSize(event.target.value));
const resizeGrip = $("#resize-board");
if (resizeGrip) {
  resizeGrip.addEventListener("pointerdown", event => {
    event.preventDefault();
    resizeGrip.setPointerCapture(event.pointerId);
  });
  resizeGrip.addEventListener("pointermove", event => {
    if (!resizeGrip.hasPointerCapture(event.pointerId)) return;
    const rect = boardFrame.getBoundingClientRect();
    setBoardSize(Math.round((event.clientX - rect.left) / 10) * 10);
  });
  resizeGrip.addEventListener("pointerup", event => {
    if (resizeGrip.hasPointerCapture(event.pointerId)) resizeGrip.releasePointerCapture(event.pointerId);
    savePreference("board-size", boardSizeInput.value);
  });
  resizeGrip.addEventListener("pointercancel", () => savePreference("board-size", boardSizeInput.value));
}
promotionPicker.querySelectorAll("[data-promotion]").forEach(button => {
  button.addEventListener("click", () => completePromotion(button.dataset.promotion));
});
$("#cancel-promotion").addEventListener("click", () => {
  pendingPromotion = null;
  promotionPicker.hidden = true;
});
$("#load-fen").addEventListener("click", () => {
  try {
    const next = new Chess(fenInput.value.trim());
    cancelSearch();
    initialFen = next.fen();
    reviewMovesSnapshot = null;
    reviewPly = null;
    game.load(initialFen);
    lastMove = null;
    selected = null;
    legalTargets = [];
    fenFeedback.textContent = "Position loaded";
    fenFeedback.dataset.kind = "success";
    render();
    search();
  } catch (error) {
    fenFeedback.textContent = error instanceof Error ? error.message : "Invalid FEN position";
    fenFeedback.dataset.kind = "error";
  }
});
$("#copy-fen").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(game.fen());
    fenFeedback.textContent = "FEN copied";
    fenFeedback.dataset.kind = "success";
  } catch {
    fenInput.focus();
    fenInput.select();
    fenFeedback.textContent = "Select the text and copy it";
    fenFeedback.dataset.kind = "error";
  }
});
$("#reset-position").addEventListener("click", () => {
  cancelSearch();
  initialFen = new Chess().fen();
  reviewMovesSnapshot = null;
  reviewPly = null;
  game.reset();
  lastMove = null;
  selected = null;
  legalTargets = [];
  fenFeedback.textContent = "Starting position restored";
  fenFeedback.dataset.kind = "success";
  render();
  search();
});

$("#year").textContent = String(new Date().getFullYear());
applyPreferences();
worker.postMessage({ type: "init" });
render();