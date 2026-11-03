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
function positionKey(fen) {
  return String(fen || "").trim().split(/\s+/).slice(0, 4).join(" ");
}

function buildMoveSnapshots() {
  const history = game.history({ verbose: true });
  const replay = new Chess(initialFen);
  const moves = [];
  for (let index = 0; index < history.length; index += 1) {
    const move = history[index];
    const beforeFen = replay.fen();
    const applied = replay.move({
      from: move.from,
      to: move.to,
      promotion: move.promotion
    });
    if (!applied) throw new Error("Could not build the saved move history.");
    moves.push({
      ply: index + 1,
      color: move.color,
      from: move.from,
      to: move.to,
      promotion: move.promotion || null,
      piece: move.piece,
      captured: move.captured || null,
      san: applied.san,
      beforeFen,
      afterFen: replay.fen(),
      moveUci: move.from + move.to + (move.promotion || "")
    });
  }
  return moves;
}

function gameResultCode() {
  if (game.isCheckmate()) return game.turn() === "w" ? "black_win" : "white_win";
  return "draw";
}

async function refreshGameArchive() {
  try {
    const games = await gameArchive.listGames(12);
    archiveCount.textContent = games.length + (games.length === 1 ? " game" : " games");
    archiveList.replaceChildren();
    if (!games.length) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "No completed games saved yet.";
      archiveList.append(empty);
    } else {
      for (const saved of games) {
        const row = document.createElement("div");
        row.className = "archive-game";
        const details = document.createElement("div");
        const title = document.createElement("strong");
        const created = document.createElement("small");
        const result = document.createElement("span");
        const label = saved.result === "draw" ? "DRAW" :
          saved.result === (saved.humanColor === "w" ? "white_win" : "black_win") ? "YOUR WIN" : "YOUR LOSS";
        title.textContent = saved.remoteOnly ? "Shared game" : "Prunex 0.8.0 · " + label;
        created.textContent = new Date(saved.createdAt).toLocaleString();
        details.append(title, created);
        result.className = "archive-result";
        result.textContent = saved.result === "draw" ? "DRAW" : label;
        row.append(details, result);
        if (Array.isArray(saved.moves) && saved.moves.length) {
          row.tabIndex = 0;
          row.setAttribute("role", "button");
          row.setAttribute("aria-label", "Review archived game");
          row.addEventListener("click", () => openArchivedGame(saved));
          row.addEventListener("keydown", event => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              openArchivedGame(saved);
            }
          });
        }
        archiveList.append(row);
      }
    }
    const status = gameArchive.getStatus();
    archiveNote.textContent = status === "connected"
      ? "Completed games are saved on this device and shared with the Prunex experience library."
      : status === "unavailable"
        ? "This device archive is working. Shared database sync is currently unavailable."
        : "Completed games are saved on this device. The shared cross-player library is not connected yet.";
  } catch (error) {
    archiveCount.textContent = "Unavailable";
    archiveList.textContent = "The local game archive could not be opened in this browser.";
    archiveNote.textContent = error instanceof Error ? error.message : "Local game archive unavailable.";
  }
}

async function persistCompletedGame() {
  const finalFen = game.fen();
  if (savedGameFen === finalFen) return;
  savedGameFen = finalFen;
  try {
    const moves = buildMoveSnapshots();
    const record = {
      id: gameArchive.newId(),
      createdAt: new Date().toISOString(),
      result: gameResultCode(),
      humanColor,
      initialFen,
      finalFen,
      pgn: game.pgn(),
      opponentVersion: "Prunex 0.8.0 browser opponent",
      moves,
      analysis: null,
      whiteAccuracy: null,
      blackAccuracy: null
    };
    currentArchiveRecord = record;
    await gameArchive.saveGame(record);
    await refreshGameArchive();
  } catch (error) {
    archiveNote.textContent = "Could not save this game locally: " +
      (error instanceof Error ? error.message : "Unknown archive error.");
  }
}

function openArchivedGame(record) {
  if (!Array.isArray(record.moves) || !record.initialFen) return;
  cancelSearch();
  initialFen = record.initialFen;
  game.load(initialFen);
  for (const saved of record.moves) {
    const move = game.move({
      from: saved.from,
      to: saved.to,
      promotion: saved.promotion || undefined
    });
    if (!move) {
      fenFeedback.textContent = "This archived game could not be restored.";
      fenFeedback.dataset.kind = "error";
      return;
    }
  }
  currentArchiveRecord = record;
  reviewMovesSnapshot = record.moves;
  reviewPly = record.moves.length;
  moveAnalysis = Array.isArray(record.analysis) ? record.analysis : [];
  lastMove = record.moves.length
    ? { from: record.moves[record.moves.length - 1].from, to: record.moves[record.moves.length - 1].to }
    : null;
  selected = null;
  legalTargets = [];
  gameReviewPanel.hidden = false;
  if (moveAnalysis.length) renderReviewSummary(moveAnalysis, record.whiteAccuracy, record.blackAccuracy);
  else {
    reviewSummary.textContent = "This archived game has not been analyzed yet.";
    reviewKeyMoments.replaceChildren();
  }
  render();
}

async function saveReviewedGame() {
  if (!currentArchiveRecord || !moveAnalysis.length) return;
  const record = {
    ...currentArchiveRecord,
    analysis: moveAnalysis,
    whiteAccuracy: reviewAccuracy("w", moveAnalysis),
    blackAccuracy: reviewAccuracy("b", moveAnalysis)
  };
  const samples = record.moves.map((move, index) => {
    const analysis = moveAnalysis[index];
    if (!analysis) return null;
    const winner = record.result === "white_win" ? "w" : record.result === "black_win" ? "b" : null;
    return {
      id: record.id + ":" + move.ply,
      gameId: record.id,
      createdAt: record.createdAt,
      positionKey: positionKey(move.beforeFen),
      sideToMove: move.color,
      moveUci: move.moveUci,
      san: move.san,
      resultForMover: winner ? (winner === move.color ? 1 : -1) : 0,
      evalLossCp: analysis.lossCp,
      grade: analysis.grade
    };
  }).filter(Boolean);
  currentArchiveRecord = record;
  try {
    await gameArchive.saveReview(record, samples);
    await refreshGameArchive();
  } catch (error) {
    archiveNote.textContent = "Review saved in memory for this session, but archive sync failed: " +
      (error instanceof Error ? error.message : "Unknown error.");
  }
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
  void persistCompletedGame();

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

function buildMoveButton(move, ply, currentPly) {
  const cell = document.createElement("div");
  cell.className = "move-cell";
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
  cell.append(button);
  const grade = moveAnalysis[ply - 1];
  if (grade?.grade) {
    const badge = document.createElement("span");
    badge.className = "move-grade";
    badge.dataset.grade = grade.grade;
    badge.textContent = grade.grade === "MISSED_WIN" ? "MISSED" : grade.grade;
    badge.title = grade.description || grade.grade.replaceAll("_", " ").toLowerCase();
    cell.append(badge);
  }
  return cell;
}

function scoreToCentipawns(result) {
  if (!result || !Number.isFinite(result.score)) return null;
  if (result.scoreType === "mate") {
    const distance = Math.min(900, Math.abs(result.score));
    return Math.sign(result.score || 1) * (10000 - distance);
  }
  return result.score;
}

const PIECE_VALUES = { p: 100, n: 320, b: 335, r: 500, q: 900, k: 20000 };

function classifyMove(move, nextMove, beforeScore, afterScore, lossCp, ply) {
  if (!Number.isFinite(lossCp)) return { grade: "UNRATED", lossCp: null, description: "Engine score unavailable" };
  const nextTakesMovedPiece = nextMove &&
    nextMove.to === move.to &&
    nextMove.captured === move.piece &&
    (PIECE_VALUES[move.piece] || 0) >= 320;
  if (nextTakesMovedPiece && lossCp <= 20) {
    return { grade: "BRILLIANT", lossCp, description: "A sound piece sacrifice confirmed by engine analysis" };
  }
  if (beforeScore >= 300 && afterScore < 0) {
    return { grade: "MISSED_WIN", lossCp, description: "A winning advantage slipped away" };
  }
  if (lossCp <= 8 && (move.san.includes("+") || move.san.includes("#"))) {
    return { grade: "GREAT", lossCp, description: "A precise forcing move" };
  }
  if (lossCp <= 8) return { grade: "BEST", lossCp, description: "Matches the engine's top-quality continuation" };
  if (lossCp <= 20) return { grade: "EXCELLENT", lossCp, description: "Very close to the engine's preferred move" };
  if (lossCp <= 50) return { grade: "GOOD", lossCp, description: "A sound move" };
  if (lossCp <= 100) return { grade: "INACCURACY", lossCp, description: "A small but measurable evaluation drop" };
  if (lossCp <= 200) return { grade: "MISTAKE", lossCp, description: "A meaningful evaluation drop" };
  return { grade: "BLUNDER", lossCp, description: "A large evaluation drop" };
}

function reviewAccuracy(color, analysis = moveAnalysis) {
  const played = analysis.filter(move => move.color === color && Number.isFinite(move.lossCp));
  if (!played.length) return null;
  const averageLoss = played.reduce((total, move) => total + move.lossCp, 0) / played.length;
  // Prunex's review metric is an estimate, not Chess.com's proprietary accuracy formula.
  return Math.round(1000 * Math.max(0, Math.min(100, 100 * Math.exp(-averageLoss / 180)))) / 10;
}

function renderReviewSummary(analysis, whiteAccuracy = reviewAccuracy("w", analysis), blackAccuracy = reviewAccuracy("b", analysis)) {
  reviewSummary.replaceChildren();
  const playerCard = (color, accuracy) => {
    const card = document.createElement("div");
    card.className = "review-player";
    const label = document.createElement("small");
    label.textContent = color === humanColor ? "YOU · " + (color === "w" ? "WHITE" : "BLACK") :
      "PRUNEX · " + (color === "w" ? "WHITE" : "BLACK");
    const score = document.createElement("strong");
    score.textContent = accuracy === null ? "—" : accuracy.toFixed(1) + "%";
    const grade = document.createElement("span");
    const count = analysis.filter(item => item.color === color).length;
    grade.textContent = count + " moves reviewed";
    card.append(label, score, grade);
    return card;
  };
  reviewSummary.append(playerCard("w", whiteAccuracy), playerCard("b", blackAccuracy));

  reviewKeyMoments.replaceChildren();
  const moments = [...analysis]
    .filter(item => item.grade === "BRILLIANT" || item.grade === "BLUNDER" || item.grade === "MISSED_WIN" || item.grade === "MISTAKE")
    .sort((a, b) => (b.lossCp || 0) - (a.lossCp || 0))
    .slice(0, 4);
  for (const moment of moments) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "review-moment";
    const label = document.createElement("span");
    label.textContent = (moment.color === "w" ? "White " : "Black ") + moment.san + " · " + moment.grade.replaceAll("_", " ");
    const score = document.createElement("small");
    score.textContent = moment.grade === "BRILLIANT" ? "SACRIFICE" : Math.round(moment.lossCp) + " cp lost";
    button.append(label, score);
    button.addEventListener("click", () => goToPly(moment.ply));
    reviewKeyMoments.append(button);
  }
}

function analyzeCurrentGame() {
  const moves = reviewMovesSnapshot || game.history({ verbose: true });
  if (!moves.length) {
    reviewSummary.textContent = "There are no played moves to analyze yet.";
    reviewProgress.hidden = true;
    return;
  }
  if (moves.length > MAX_REVIEW_PLIES) {
    reviewProgressLabel.textContent = "Reviewing the first " + MAX_REVIEW_PLIES + " plies. Longer games are capped for browser performance.";
  }

  cancelSearch();
  const replay = new Chess(initialFen);
  const positions = [replay.fen()];
  const analyzedMoves = moves.slice(0, MAX_REVIEW_PLIES);
  for (const move of analyzedMoves) {
    const applied = replay.move({
      from: move.from, to: move.to, promotion: move.promotion || undefined
    });
    if (!applied) {
      reviewSummary.textContent = "Could not reconstruct this game's move history.";
      return;
    }
    positions.push(replay.fen());
  }

  requestId += 1;
  analyzingGame = true;
  evaluating = false;
  thinking = false;
  moveAnalysis = [];
  reviewSummary.textContent = "Prunex is checking every position and grading each move.";
  reviewKeyMoments.replaceChildren();
  reviewProgress.hidden = false;
  reviewProgressFill.style.width = "0%";
  reviewProgressLabel.textContent = "Analyzing 0 / " + positions.length + " positions";
  reviewDepth.textContent = "ENGINE DEPTH " + REVIEW_DEPTH;
  statusEl.textContent = "Reviewing " + positions.length + " engine positions…";
  stateEl.textContent = "Analyzing game…";
  stateEl.dataset.busy = "true";
  worker.postMessage({
    type: "analyze-game",
    requestId,
    positions,
    depth: REVIEW_DEPTH
  });
}

function startGameReview() {
  dismissGameResult(false);
  if (!currentArchiveRecord && game.isGameOver()) void persistCompletedGame();
  const history = game.history({ verbose: true });
  reviewMovesSnapshot = history.map(move => ({
    color: move.color,
    from: move.from,
    to: move.to,
    promotion: move.promotion || null,
    piece: move.piece,
    captured: move.captured || null,
    san: move.san
  }));
  reviewPly = history.length;
  gameReviewPanel.hidden = false;
  if (moveAnalysis.length && moveAnalysis.length === history.length) {
    renderReviewSummary(moveAnalysis);
    render();
    return;
  }
  render();
  analyzeCurrentGame();
}

async function completeGameReview(results) {
  const moves = reviewMovesSnapshot || game.history({ verbose: true });
  const scored = [];
  const count = Math.min(moves.length, Math.max(0, results.length - 1));
  for (let index = 0; index < count; index += 1) {
    const before = scoreToCentipawns(results[index]);
    const afterFromMoverPerspective = -scoreToCentipawns(results[index + 1]);
    const lossCp = Number.isFinite(before) && Number.isFinite(afterFromMoverPerspective)
      ? Math.max(0, before - afterFromMoverPerspective)
      : null;
    const classification = classifyMove(moves[index], moves[index + 1], before, afterFromMoverPerspective, lossCp, index + 1);
    scored.push({
      ply: index + 1,
      color: moves[index].color,
      san: moves[index].san,
      beforeScore: before,
      afterScore: afterFromMoverPerspective,
      lossCp: classification.lossCp,
      grade: classification.grade,
      description: classification.description
    });
  }
  moveAnalysis = scored;
  analyzingGame = false;
  reviewProgress.hidden = false;
  reviewProgressFill.style.width = "100%";
  reviewProgressLabel.textContent = "Analysis complete · " + scored.length + " moves graded";
  renderReviewSummary(scored);
  render();
  await saveReviewedGame();
  stateEl.textContent = "Review complete";
  stateEl.dataset.busy = "false";
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
  statusEl.dataset.kind = gameOver ? "finished" : game.isCheck() ? "check" : thinking ? "thinking" : evaluating || analyzingGame ? "evaluating" : "";
  stateEl.textContent = !ready ? "Starting engine" : thinking ? "Calculating a reply…" : analyzingGame ? "Analyzing game…" : evaluating ? "Evaluating position…" : "Engine ready";
  stateEl.dataset.busy = String(thinking || evaluating || analyzingGame);

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
  undoButton.disabled = thinking || analyzingGame || !!reviewMovesSnapshot || game.history().length === 0;
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
  if (thinking || evaluating || analyzingGame) worker.postMessage({ type: "cancel" });
  thinking = false;
  evaluating = false;
  analyzingGame = false;
}

function startNewGame() {
  cancelSearch();
  initialFen = new Chess().fen();
  reviewMovesSnapshot = null;
  reviewPly = null;
  moveAnalysis = [];
  savedGameFen = null;
  currentArchiveRecord = null;
  gameReviewPanel.hidden = true;
  reviewProgress.hidden = true;
  reviewSummary.replaceChildren();
  reviewKeyMoments.replaceChildren();
  game.reset();
  selected = null;
  legalTargets = [];
  lastMove = null;
  render();
  search();
}


async function applyEngineReply(bestMove, expectedRequestId, fenAtSearch, turnAtSearch) {
  let selectedMove = bestMove;
  let remembered = false;
  try {
    const experienceMove = await gameArchive.findExperiencedMove(positionKey(fenAtSearch), turnAtSearch);
    if (experienceMove) {
      selectedMove = experienceMove;
      remembered = true;
    }
  } catch {
    // Local or shared experience memory is optional; always retain the engine move fallback.
  }

  if (requestId !== expectedRequestId || game.fen() !== fenAtSearch || game.turn() !== turnAtSearch) return;
  thinking = false;
  try {
    let move = null;
    if (remembered) {
      const uci = String(selectedMove);
      const candidate = game.moves({ verbose: true }).find(item =>
        item.from === uci.slice(0, 2) &&
        item.to === uci.slice(2, 4) &&
        (item.promotion || "") === uci.slice(4)
      );
      if (candidate) move = game.move({
        from: candidate.from, to: candidate.to, promotion: candidate.promotion
      });
    }
    if (!move) move = game.move(bestMove);
    if (!move) throw new Error("Illegal engine move: " + bestMove);
    lastMove = { from: move.from, to: move.to };
    render();
    if (remembered && selectedMove !== bestMove) {
      stateEl.textContent = "Experience memory · proven move";
      stateEl.dataset.busy = "false";
    }
    search();
  } catch (error) {
    render();
    statusEl.textContent = error instanceof Error ? error.message : "Could not apply engine move.";
    statusEl.dataset.kind = "error";
  }
}

worker.addEventListener("message", async (event) => {
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

  if (data.type === "analysis-progress") {
    const percent = data.total ? Math.round((data.completed / data.total) * 100) : 0;
    reviewProgressFill.style.width = percent + "%";
    reviewProgressLabel.textContent = "Analyzing " + data.completed + " / " + data.total + " positions";
    return;
  }
  if (data.type === "analysis-complete") {
    analyzingGame = false;
    await completeGameReview(data.results || []);
    return;
  }
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
    if (analyzingGame) {
      analyzingGame = false;
      reviewProgressLabel.textContent = "Game analysis failed: " + data.message;
      reviewSummary.textContent = "The engine could not finish this review. You can try again.";
      stateEl.textContent = "Engine ready";
      stateEl.dataset.busy = "false";
      return;
    }
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
    const fenAtSearch = game.fen();
    const turnAtSearch = game.turn();
    await applyEngineReply(data.bestMove, data.requestId, fenAtSearch, turnAtSearch);
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
$("#game-result-review").addEventListener("click", startGameReview);
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
  savePreference("defeat-sound", soundEnabled);
  if (soundEnabled) primeAudio();
});
evaluationToggle.addEventListener("change", event => {
  showEvaluation = event.target.checked;
  savePreference("show-evaluation", showEvaluation);
  syncEvaluationVisibility();
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
    primeAudio();
    const next = new Chess(fenInput.value.trim());
    cancelSearch();
    initialFen = next.fen();
    reviewMovesSnapshot = null;
    reviewPly = null;
    moveAnalysis = [];
    savedGameFen = null;
    currentArchiveRecord = null;
    gameReviewPanel.hidden = true;
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
  moveAnalysis = [];
  savedGameFen = null;
  currentArchiveRecord = null;
  gameReviewPanel.hidden = true;
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
void refreshGameArchive();
worker.postMessage({ type: "init" });
render();