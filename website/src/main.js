import { Chess } from "chess.js";
import { createGameArchive } from "./game-database.js";
import { requestTurnstileToken } from "./turnstile.js";
import {
  scoreToCentipawns,
  expectedPointsFromEvaluation,
  expectedPointLoss,
  isPieceSacrifice,
  classifyMove,
  isApexMove,
  reviewAccuracy
} from "./review-metrics.js";
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
const reviewBudgetSelect = $("#review-budget");
const sideSelect = $("#side");
const fenInput = $("#fen-input");
const fenFeedback = $("#fen-feedback");
const boardFrame = $(".board-frame");
const boardStage = $(".board-stage");
const pieceStyleSelect = $("#piece-style");
const coordinatesToggle = $("#coordinates");
const legalMovesToggle = $("#legal-moves");
const moveMethodSelect = $("#move-method");
const bestMoveDisplaySelect = $("#best-move-display");
const soundStyleSelect = $("#sound-style");
const previewSoundButton = $("#preview-move-sound");
const highlightLastMoveToggle = $("#highlight-last-move");
const premovesToggle = $("#enable-premoves");
const annotationsToggle = $("#board-annotations");
const pieceAnimationToggle = $("#piece-animation");
const clearMarksButton = $("#clear-marks");
const promotionPicker = $("#promotion-picker");
const gameResultOverlay = $("#game-result-dialog");
const gameResultClose = $("#game-result-close");
const moveFirstButton = $("#move-first");
const movePrevButton = $("#move-prev");
const moveNextButton = $("#move-next");
const moveLastButton = $("#move-last");
const movePositionLabel = $("#move-position-label");
const moveScrubber = $("#move-scrubber");
const soundToggle = $("#defeat-sound");
const evaluationToggle = $("#show-evaluation");
const evaluationColumn = $("#evaluation-column");
const gameReviewPanel = $("#game-review-panel");
const reviewMethodNote = $("#review-method-note");
const reviewProgress = $("#review-progress");
const reviewProgressFill = $("#review-progress-fill");
const reviewProgressLabel = $("#review-progress-label");
const reviewDepth = $("#review-depth");
const reviewSummary = $("#review-summary");
const reviewKeyMoments = $("#review-key-moments");
const archiveCount = $("#game-archive-count");
const archiveList = $("#game-archive-list");
const archiveNote = $("#game-archive-note");
const linkAccountForm = $("#link-account-form");
const accountRecoveryStatus = $("#account-recovery-status");
const restoreAccountForm = $("#restore-account-form");
const restoreAccountStatus = $("#restore-account-status");
const deleteAccountForm = $("#delete-account-form");
const deleteAccountStatus = $("#delete-account-status");
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
let reviewRequiresFork = false;
let soundEnabled = true;
let showEvaluation = true;
let audioContext = null;
let evaluating = false;
let analyzingGame = false;
let enginePositionTurn = "w";
let moveAnalysis = [];
let reviewAnalysisPositions = [];
let reviewAnalysisResults = [];
let reviewAnalysisIndex = 0;
let reviewBudgetMs = 15000;
let bestMoveHint = null;
let bestMoveDisplay = "piece";
let moveMethod = "both";
let soundStyle = "classic";
let highlightLastMove = true;
let pieceAnimationEnabled = true;
let moveAnimationPending = false;
let premovesEnabled = true;
let showAnnotations = false;
let sharePositionMemory = false;
let annotations = [];
let annotationTapFrom = null;
let queuedPremove = null;
let dragState = null;
let dragGhost = null;
let suppressNextBoardClick = false;
let savedGameFen = null;
let pendingArchiveRecord = null;
let fenDirty = false;
let currentArchiveRecord = null;
let gameArchiveDbPromise = null;
const MAX_REVIEW_PLIES = 200;
const gameArchive = createGameArchive({
  url: import.meta.env.VITE_SUPABASE_URL || "",
  publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
  captchaTokenProvider: () => requestTurnstileToken({
    siteKey: import.meta.env.VITE_TURNSTILE_SITE_KEY || "",
    required: import.meta.env.VITE_REQUIRE_GUEST_TURNSTILE === "true",
    container: $("#turnstile-widget-container")
  })
});
let activeArchiveId = gameArchive.newId();
let activeGameCreatedAt = new Date().toISOString();
let activeGamePersisted = false;
let archiveWriteQueue = Promise.resolve();

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
  moveAnimationPending = true;
  playMoveSound(move);
  pendingPromotion = null;
  promotionPicker.hidden = true;
  selected = null;
  legalTargets = [];
  render();
  void persistGameProgress();search();
}
function savePreference(key, value) {
  try { localStorage.setItem("prunex-" + key, String(value)); } catch {}
}
function loadPreference(key, fallback) {
  try { return localStorage.getItem("prunex-" + key) ?? fallback; } catch { return fallback; }
}

function primeAudio(force = false) {
  if ((!soundEnabled && !force) || audioContext) return audioContext;
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

function playMoveSound(move, preview = false) {
  if ((!soundEnabled && !preview) || !move) return;
  const context = primeAudio(preview);
  if (!context) return;

  // A short, damped note gives a restrained wooden-board tap without noisy static.
  const profiles = {
    classic: { start: 430, end: 255, duration: 0.072, volume: 0.043, type: "triangle" },
    soft:    { start: 560, end: 390, duration: 0.055, volume: 0.030, type: "sine" },
    muted:   { start: 300, end: 195, duration: 0.068, volume: 0.026, type: "sine" }
  };
  const profile = profiles[soundStyle] || profiles.classic;
  const now = context.currentTime;
  const duration = move.captured ? profile.duration * 1.12 : profile.duration;
  const oscillator = context.createOscillator();
  const envelope = context.createGain();

  oscillator.type = profile.type;
  oscillator.frequency.setValueAtTime(profile.start, now);
  oscillator.frequency.exponentialRampToValueAtTime(profile.end, now + duration);
  envelope.gain.setValueAtTime(0.0001, now);
  envelope.gain.exponentialRampToValueAtTime(
    profile.volume * (move.captured ? 1.08 : 1),
    now + 0.004
  );
  envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  oscillator.connect(envelope);
  envelope.connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.01);
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
  if (!game.isGameOver()) return "in_progress";
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
      empty.textContent = "No games saved yet.";
      archiveList.append(empty);
    } else {
      for (const saved of games) {
        const row = document.createElement("div");
        row.className = "archive-game";
        const details = document.createElement("div");
        const title = document.createElement("strong");
        const created = document.createElement("small");
        const result = document.createElement("span");
        const label = saved.result === "in_progress" ? "IN PROGRESS" :
          saved.result === "draw" ? "DRAW" :
          saved.result === (saved.humanColor === "w" ? "white_win" : "black_win") ? "YOUR WIN" : "YOUR LOSS";
        title.textContent = saved.remoteOnly ? "Shared game" : "Prunex 0.8.0 · " + label;
        created.textContent = new Date(saved.createdAt).toLocaleString();
        details.append(title, created);
        result.className = "archive-result";
        result.textContent = label;
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
      ? (sharePositionMemory
        ? "Your games and reviews are saved to your private Neon archive. Selected position samples are stored only for your own future games."
        : "Your games and reviews are saved to your private Neon archive. Private position memory is currently off.")
      : status === "fallback"
        ? "Neon is temporarily unavailable. Existing cloud history is being read from the Supabase fallback; new changes stay on this device until Neon reconnects."
        : status === "owner-only"
          ? "This browser is in local mode. Only the verified owner email can access the cloud archive; other visitors' games stay on this device."
          : status === "unavailable"
            ? "Your games remain saved on this device. Cloud sync is queued and will retry when the private archive is available."
            : "Local game saving is available. Link and verify the owner email to enable the private cloud archive.";
  } catch (error) {
    archiveCount.textContent = "Unavailable";
    archiveList.textContent = "The local game archive could not be opened in this browser.";
    archiveNote.textContent = error instanceof Error ? error.message : "Local game archive unavailable.";
  }
}

async function persistGameProgress() {
  const moves = buildMoveSnapshots();
  if (!moves.length && !activeGamePersisted) return;
  activeGamePersisted = true;
  const record = {
    id: activeArchiveId,
    createdAt: activeGameCreatedAt,
    result: gameResultCode(),
    humanColor,
    initialFen,
    finalFen: game.fen(),
    pgn: game.pgn(),
    opponentVersion: "Prunex 0.8.0 · browser game",
    moves,
    analysis: null,
    whiteAccuracy: null,
    blackAccuracy: null
  };
  currentArchiveRecord = record;
  const task = archiveWriteQueue.catch(() => {}).then(async () => {
    await gameArchive.saveGame(record);
    savedGameFen = record.finalFen;
    await refreshGameArchive();
  });
  archiveWriteQueue = task.catch(error => {
    archiveNote.textContent = "This game is saved locally; cloud sync will retry: " +
      (error instanceof Error ? error.message : "Unknown archive error.");
  });
  return task;
}

async function persistCompletedGame() {
  return persistGameProgress();
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
  reviewRequiresFork = true;
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
    await gameArchive.saveReview(record, samples, { shareTrainingData: sharePositionMemory });
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
  if (persist) savePreference("board-size", size);
}

function setAnalysisPanelOpen(open, persist = true) {
  const panel = $("#analysis-panel");
  const toggle = $("#toggle-analysis-panel");
  const workspace = panel.closest(".workspace");
  panel.hidden = !open;
  workspace.dataset.analysisPanel = open ? "open" : "closed";
  toggle.textContent = open ? "Hide side panel" : "Show side panel";
  toggle.setAttribute("aria-expanded", String(open));
  toggle.setAttribute("aria-label", open ? "Hide game side panel" : "Show game side panel");
  if (persist) savePreference("analysis-panel-open", open);
}
function applyPreferences() {
  applySiteTheme(loadPreference("site-theme", "light"));
  const savedTheme = loadPreference("theme", "blue");
  const theme = ["blue", "ice"].includes(savedTheme) ? savedTheme : "blue";
  const storedPieces = loadPreference("pieces", "cburnett");
  const pieces = ["cburnett", "letters"].includes(storedPieces) ? storedPieces : "cburnett";
  if (storedPieces !== pieces) savePreference("pieces", pieces);
  showCoordinates = loadPreference("coordinates", "true") !== "false";
  showLegalMoves = loadPreference("legal-moves", "true") !== "false";
  soundEnabled = loadPreference("defeat-sound", "true") !== "false";
  showEvaluation = loadPreference("show-evaluation", "true") !== "false";
  moveMethod = ["both","drag","click"].includes(loadPreference("move-method","both")) ? loadPreference("move-method","both") : "both";
  bestMoveDisplay = ["off","piece","highlight","arrow"].includes(loadPreference("best-move-display-v2","piece")) ? loadPreference("best-move-display-v2","piece") : "piece";
  soundStyle = ["classic","soft","muted"].includes(loadPreference("sound-style","classic")) ? loadPreference("sound-style","classic") : "classic";
  highlightLastMove = loadPreference("highlight-last-move","true") !== "false";
  pieceAnimationEnabled = loadPreference("piece-animation","true") !== "false";
  premovesEnabled = loadPreference("premoves","true") !== "false";
  showAnnotations = loadPreference("board-annotations","false") === "true";
  sharePositionMemory = loadPreference("share-position-memory", "false") === "true";
  $("#share-position-memory").checked = sharePositionMemory;
  setAnalysisPanelOpen(loadPreference("analysis-panel-open", "true") !== "false", false);
  $("#theme").value = theme;
  pieceStyleSelect.value = pieces;
  coordinatesToggle.checked = showCoordinates;
  legalMovesToggle.checked = showLegalMoves;
  soundToggle.checked = soundEnabled;
  evaluationToggle.checked = showEvaluation;
  moveMethodSelect.value=moveMethod;
  bestMoveDisplaySelect.value=bestMoveDisplay;
  soundStyleSelect.value=soundStyle;
  highlightLastMoveToggle.checked=highlightLastMove;
  pieceAnimationToggle.checked=pieceAnimationEnabled;
  premovesToggle.checked=premovesEnabled;
  annotationsToggle.checked=showAnnotations;
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
  if (fenDirty) return;
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
      if (highlightLastMove && lastMove && (lastMove.from === square || lastMove.to === square)) {
        button.classList.add("last-move");
        if (lastMove.from === square) button.classList.add("last-move-from");
        if (lastMove.to === square) button.classList.add("last-move-to");
      }
      if (showLegalMoves && legalTargets.includes(square)) button.classList.add(piece ? "capture-target" : "move-target");
      if (["highlight","arrow"].includes(bestMoveDisplay) && bestMoveHint?.from === square) button.classList.add("best-move-from");
      if (["highlight","arrow"].includes(bestMoveDisplay) && bestMoveHint?.to === square) button.classList.add("best-move-to");
      if (queuedPremove && (queuedPremove.from === square || queuedPremove.to === square)) button.classList.add("premove-square");
      if (showAnnotations && annotations.some(item => item.square === square)) button.classList.add("user-marked-square");
      if (piece) {
        const span = document.createElement("span");
        span.className = "piece " + (piece.color === "w" ? "white-piece" : "black-piece");
        if (pieceAnimationEnabled && moveAnimationPending && lastMove?.to === square) span.classList.add("piece-arrive");
        const pieceSet = boardEl.dataset.pieces || "cburnett";
        if (pieceSet === "letters") {
          span.classList.add("piece-letters");
          span.textContent = piece.type.toUpperCase();
        } else {
          const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
          svg.classList.add("piece-svg");
          svg.setAttribute("viewBox", "0 0 45 45");
          svg.setAttribute("aria-hidden", "true");
          const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
          use.setAttribute("href", "/pieces/cburnett.svg#" + piece.color + piece.type.toUpperCase());
          svg.append(use);
          span.append(svg);
        }
        button.append(span);
      }
      const reviewedMove = reviewMovesSnapshot && reviewPly > 0
        ? reviewMovesSnapshot[reviewPly - 1] : null;
      const reviewedGradeRaw = reviewPly > 0 ? moveAnalysis[reviewPly - 1]?.grade : null;
      const reviewedGrade = reviewedGradeRaw === "MISSED_WIN" ? "MISS" : reviewedGradeRaw;
      const reviewBadge = reviewedMove?.to === square && !!reviewedGrade &&
        ["APEX","BRILLIANT","GREAT","BEST","EXCELLENT","GOOD","INACCURACY","MISTAKE","BLUNDER","MISS"].includes(reviewedGrade);
      const gradeGlyph = {
        APEX:"✧", BRILLIANT:"✦", GREAT:"◆", BEST:"★", EXCELLENT:"✓", GOOD:"✓",
        INACCURACY:"!", MISTAKE:"!", BLUNDER:"×", MISS:"↘"
      };
      // Move-quality markers belong exclusively to game-review mode.
      if (reviewBadge) {
        const marker = document.createElement("span");
        marker.className = "piece-quality-marker";
        marker.dataset.grade = reviewedGrade;
        marker.textContent = gradeGlyph[reviewedGrade] || "•";
        marker.title = reviewedGrade + " move";
        marker.setAttribute("aria-label", marker.title);
        button.append(marker);
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
      button.addEventListener("click", event => {
        if (suppressNextBoardClick) return;
        const coarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches;
        if (showAnnotations && (event.pointerType === "touch" || (coarsePointer && event.detail > 0))) {
          handleTouchAnnotationTap(square);
          return;
        }
        onSquare(square);
      });
      boardEl.append(button);
    }
  }
  if (bestMoveDisplay === "arrow" && bestMoveHint) {
    const arrow = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    arrow.setAttribute("class", "best-move-arrow"); arrow.setAttribute("viewBox", "0 0 800 800");
    arrow.setAttribute("aria-hidden", "true");
    const point = name => { let x = "abcdefgh".indexOf(name[0]), y = 8 - Number(name[1]); if (flipped) { x=7-x; y=7-y; } return {x:(x+.5)*100,y:(y+.5)*100}; };
    const from=point(bestMoveHint.from), to=point(bestMoveHint.to);
    const defs=document.createElementNS("http://www.w3.org/2000/svg","defs");
    const marker=document.createElementNS("http://www.w3.org/2000/svg","marker");
    marker.setAttribute("id","best-move-head"); marker.setAttribute("markerWidth","7"); marker.setAttribute("markerHeight","7"); marker.setAttribute("refX","5"); marker.setAttribute("refY","3"); marker.setAttribute("orient","auto");
    const head=document.createElementNS("http://www.w3.org/2000/svg","path"); head.setAttribute("d","M0,0 L6,3 L0,6 Z"); marker.append(head); defs.append(marker);
    const line=document.createElementNS("http://www.w3.org/2000/svg","line");
    line.setAttribute("x1",from.x); line.setAttribute("y1",from.y); line.setAttribute("x2",to.x); line.setAttribute("y2",to.y); line.setAttribute("marker-end","url(#best-move-head)");
    arrow.append(defs,line); boardEl.append(arrow);
  }
  if (showAnnotations && annotations.some(item => item.from && item.to)) {
    const layer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    layer.setAttribute("class", "annotation-layer");
    layer.setAttribute("viewBox", "0 0 800 800");
    const center = name => { let x="abcdefgh".indexOf(name[0]), y=8-Number(name[1]); if(flipped){x=7-x;y=7-y;} return {x:(x+.5)*100,y:(y+.5)*100}; };
    const defs=document.createElementNS("http://www.w3.org/2000/svg","defs");
    const marker=document.createElementNS("http://www.w3.org/2000/svg","marker");
    marker.setAttribute("id","annotation-head");marker.setAttribute("markerWidth","8");marker.setAttribute("markerHeight","8");
    marker.setAttribute("refX","6");marker.setAttribute("refY","3");marker.setAttribute("orient","auto");
    const head=document.createElementNS("http://www.w3.org/2000/svg","path");head.setAttribute("d","M0,0 L6,3 L0,6 Z");marker.append(head);defs.append(marker);layer.append(defs);
    for (const item of annotations.filter(item => item.from && item.to)) {
      const from=center(item.from),to=center(item.to),line=document.createElementNS("http://www.w3.org/2000/svg","line");
      line.setAttribute("x1",from.x);line.setAttribute("y1",from.y);line.setAttribute("x2",to.x);line.setAttribute("y2",to.y);
      line.setAttribute("class","annotation-arrow");line.setAttribute("marker-end","url(#annotation-head)");layer.append(line);
    }
    boardEl.append(layer);
  }
}

function renderBoardHighlights() {
  boardEl.querySelectorAll(".square").forEach(button => {
    const square=button.dataset.square,piece=game.get(square);
    button.classList.toggle("selected",selected===square);
    const isLastFrom = highlightLastMove && lastMove?.from === square;
    const isLastTo = highlightLastMove && lastMove?.to === square;
    button.classList.toggle("last-move", isLastFrom || isLastTo);
    button.classList.toggle("last-move-from", isLastFrom);
    button.classList.toggle("last-move-to", isLastTo);
    button.classList.toggle("move-target",showLegalMoves&&legalTargets.includes(square)&&!piece);
    button.classList.toggle("capture-target",showLegalMoves&&legalTargets.includes(square)&&!!piece);
    button.classList.toggle("best-move-from",["highlight","arrow"].includes(bestMoveDisplay)&&bestMoveHint?.from===square);
    button.classList.toggle("best-move-to",["highlight","arrow"].includes(bestMoveDisplay)&&bestMoveHint?.to===square);
    button.classList.toggle("premove-square",!!queuedPremove&&(queuedPremove.from===square||queuedPremove.to===square));
    button.classList.toggle("user-marked-square",showAnnotations&&annotations.some(item=>item.square===square));
  });
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
    if (Number.isFinite(grade.expectedPointLoss)) badge.dataset.expectedPointLoss = grade.expectedPointLoss.toFixed(4);
    if (Number.isFinite(grade.depth)) badge.dataset.reviewDepth = String(grade.depth);
    if (Number.isFinite(grade.uniqueMoveGap)) badge.dataset.uniqueMoveGap = grade.uniqueMoveGap.toFixed(4);
    if (grade.evaluationSource) badge.dataset.evaluationSource = grade.evaluationSource;
    badge.textContent = grade.grade === "MISSED_WIN" ? "MISS" : grade.grade;
    badge.title = grade.description || grade.grade.replaceAll("_", " ").toLowerCase();
    cell.append(badge);
  }
  return cell;
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
    .filter(item => ["APEX","BRILLIANT","GREAT","BLUNDER","MISS","MISSED_WIN","MISTAKE","INACCURACY"].includes(item.grade))
    .sort((a, b) => (b.lossCp || 0) - (a.lossCp || 0))
    .slice(0, 4);
  for (const moment of moments) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "review-moment";
    const label = document.createElement("span");
    label.textContent = (moment.color === "w" ? "White " : "Black ") + moment.san + " · " + (moment.grade === "MISSED_WIN" ? "MISS" : moment.grade.replaceAll("_", " "));
    const score = document.createElement("small");
    score.textContent = moment.grade === "APEX" ? "UNIQUE BEST LINE" :
      moment.grade === "BRILLIANT" ? "SACRIFICE" :
      Number.isFinite(moment.expectedPointLoss) ? (moment.expectedPointLoss * 100).toFixed(1) + " expected points lost" :
      Math.round(moment.lossCp) + " cp lost";
    button.append(label, score);
    button.addEventListener("click", () => goToPly(moment.ply));
    reviewKeyMoments.append(button);
  }
}

function requestNextReviewPosition() {
  if (!analyzingGame || reviewAnalysisIndex >= reviewAnalysisPositions.length) return;
  const fen = reviewAnalysisPositions[reviewAnalysisIndex];
  enginePositionTurn = new Chess(fen).turn();
  // Each position receives the full selected time budget, so longer games
  // receive more total analysis instead of making every search shallower.
  const perPositionMs = reviewBudgetMs;
  requestId += 1;
  evaluating = true;
  setEvaluationPending();
  stateEl.textContent = "Analyzing game…";
  stateEl.dataset.busy = "true";
  reviewProgressLabel.textContent = "Analyzing " + reviewAnalysisIndex + " / " + reviewAnalysisPositions.length +
    " positions · " + reviewBudgetMs + "ms each";
  worker.postMessage({
    type: "evaluate",
    requestId,
    fen,
    movetime: perPositionMs
  });
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
  for (let index = 0; index < analyzedMoves.length; index += 1) {
    const move = analyzedMoves[index];
    const applied = replay.move({
      from: move.from, to: move.to, promotion: move.promotion || undefined
    });
    if (!applied) {
      reviewSummary.textContent = "Could not reconstruct this game's move history.";
      return;
    }
    // Terminal positions are known from the game rules; do not search a
    // board where no legal move exists.
    if (!replay.isGameOver()) positions.push(replay.fen());
  }

  cancelSearch();
  analyzingGame = true;
  evaluating = false;
  thinking = false;
  moveAnalysis = [];
  reviewAnalysisPositions = positions;
  reviewAnalysisResults = [];
  reviewAnalysisIndex = 0;
  reviewBudgetMs = Number(reviewBudgetSelect.value) || 30000;
  reviewSummary.textContent = "Prunex is analyzing every position at the selected analysis budget.";
  reviewKeyMoments.replaceChildren();
  reviewProgress.hidden = false;
  reviewProgressFill.style.width = "0%";
  reviewProgressLabel.textContent = "Analyzing 0 / " + positions.length + " positions";
  reviewDepth.textContent = "PRUNEX ANALYSIS · " + Math.round(reviewBudgetMs / 1000) + "S / POSITION";
  statusEl.textContent = "Reviewing " + positions.length + " engine positions…";
  stateEl.textContent = "Analyzing game…";
  stateEl.dataset.busy = "true";
  requestNextReviewPosition();
}

function startGameReview() {
  dismissGameResult(false);
  if (!currentArchiveRecord && game.isGameOver()) void persistCompletedGame();
  reviewRequiresFork = game.isGameOver();
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
  const count = Math.min(moves.length, results.length);
  for (let index = 0; index < count; index += 1) {
    const beforeResult = results[index];
    const afterResult = results[index + 1] || null;
    const before = scoreToCentipawns(beforeResult);
    const afterRaw = scoreToCentipawns(afterResult);
    const terminalLastMove = index === moves.length - 1 && (game.isGameOver() || game.isCheckmate());
    const afterFromMoverPerspective = Number.isFinite(afterRaw) ? -afterRaw :
      terminalLastMove && game.isCheckmate() ? 100000 :
      terminalLastMove && game.isDraw() ? 0 : null;
    const lossCp = Number.isFinite(before) && Number.isFinite(afterFromMoverPerspective)
      ? Math.max(0, before - afterFromMoverPerspective) : null;

    const beforeExpectedPoints = expectedPointsFromEvaluation(beforeResult);
    const opponentExpectedPoints = expectedPointsFromEvaluation(afterResult);
    const afterMoverExpectedPoints = Number.isFinite(opponentExpectedPoints) ? 1 - opponentExpectedPoints :
      terminalLastMove && game.isCheckmate() ? 1 :
      terminalLastMove && game.isDraw() ? 0.5 : null;
    const pointLoss = expectedPointLoss(beforeExpectedPoints, afterMoverExpectedPoints);

    const classification = classifyMove(
      moves[index], moves[index + 1], before, afterFromMoverPerspective,
      lossCp, index + 1, pointLoss, beforeExpectedPoints, afterMoverExpectedPoints
    );
    const engineBest = beforeResult?.bestMove;
    const engineBestMatches = !!engineBest && engineBest !== "(none)" &&
      engineBest === moves[index].from + moves[index].to + (moves[index].promotion || "");
    const secondBest = beforeResult?.secondBest;
    const secondBestExpectedPoints = expectedPointsFromEvaluation(secondBest);
    const uniqueMoveGap = Number.isFinite(beforeExpectedPoints) && Number.isFinite(secondBestExpectedPoints)
      ? Math.max(0, beforeExpectedPoints - secondBestExpectedPoints) : null;
    const sacrifice = isPieceSacrifice(moves[index], moves[index + 1]);

    // Apex is deliberately rare: an exact engine-top sacrifice with a large
    // same-depth expected-points gap over the runner-up.
    const isApex = isApexMove({
      engineBestMatches,
      sacrifice,
      pointLoss,
      uniqueMoveGap,
      beforeExpectedPoints
    });
    if (isApex) {
      classification.grade = "APEX";
      classification.expectedPointLoss = pointLoss;
      classification.description = "A rare engine-confirmed sacrifice with a decisive same-depth advantage over the runner-up";
    } else if (engineBestMatches && classification.grade === "BRILLIANT") {
      // Preserve Brilliant when the stricter Apex uniqueness test is not met.
    } else if (engineBestMatches && Number.isFinite(uniqueMoveGap) && uniqueMoveGap >= 0.08 &&
        Number.isFinite(pointLoss) && pointLoss <= 0.02) {
      classification.grade = "GREAT";
      classification.expectedPointLoss = pointLoss;
      classification.description = "The engine's best move by a clear margin in a critical position";
    } else if (engineBestMatches && classification.grade !== "MISS") {
      classification.grade = "BEST";
      classification.lossCp = 0;
      classification.expectedPointLoss = 0;
      classification.description = "Matches Prunex's top move at the selected analysis budget";
    }

    scored.push({
      ply: index + 1,
      color: moves[index].color,
      san: moves[index].san,
      beforeScore: before,
      afterScore: afterFromMoverPerspective,
      beforeExpectedPoints,
      afterExpectedPoints: afterMoverExpectedPoints,
      expectedPointLoss: classification.expectedPointLoss ?? pointLoss,
      uniqueMoveGap,
      lossCp: classification.lossCp,
      grade: classification.grade,
      depth: beforeResult?.depth || 0,
      selDepth: beforeResult?.selDepth || 0,
      nodes: beforeResult?.nodes || 0,
      evaluationSource: beforeResult?.wdl ? "stockfish-wdl" : "cp-fallback",
      description: classification.description
    });
  }
  moveAnalysis = scored;
  analyzingGame = false;
  reviewProgress.hidden = false;
  reviewProgressFill.style.width = "100%";
  const depths = results.map(item => item.depth || 0).filter(value => value > 0);
  const averageDepth = depths.length ? Math.round(depths.reduce((sum, value) => sum + value, 0) / depths.length) : 0;
  const deepestDepth = depths.length ? Math.max(...depths) : 0;
  reviewDepth.textContent = "PRUNEX ANALYSIS · " + Math.round(reviewBudgetMs / 1000) + "S / POSITION · AVG DEPTH " + averageDepth;
  const wdlPositionCount = results.filter(item => item.wdl &&
    Number.isFinite(item.wdl.win) && Number.isFinite(item.wdl.draw) && Number.isFinite(item.wdl.loss)).length;
  reviewMethodNote.textContent = wdlPositionCount
    ? "Prunex compares expected points before and after each move, then applies its own move grading, Apex checks, and accuracy metric. This is not Chess.com's proprietary CAPS2 formula."
    : "Prunex converts position evaluations into expected points before applying its move-grading and accuracy model.";
  reviewProgressLabel.textContent = "Analysis complete · " + scored.length +
    " moves graded · deepest depth " + deepestDepth;
  renderReviewSummary(scored);
  render();
  await saveReviewedGame();
  stateEl.textContent = "Review complete";
  stateEl.dataset.busy = "false";
}
function renderMoves() {
  const pageScroller = document.scrollingElement;
  const pageScrollTop = pageScroller?.scrollTop ?? window.scrollY;
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
  if (active) {
    // Keep the active move visible inside its own scroll container. The browser's
    // native into-view helper may scroll the document and pull the board off-screen.
    const listRect = moveListEl.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    if (listRect.height > 0 && activeRect.top < listRect.top) {
      moveListEl.scrollTop -= listRect.top - activeRect.top;
    } else if (listRect.height > 0 && activeRect.bottom > listRect.bottom) {
      moveListEl.scrollTop += activeRect.bottom - listRect.bottom;
    }
  } else if (!reviewMovesSnapshot) {
    moveListEl.scrollTop = moveListEl.scrollHeight;
  }
  moveCountEl.textContent = reviewMovesSnapshot
    ? "Viewing " + currentPly + " / " + history.length + " plies"
    : history.length + " plies";
  syncMoveNavigation(currentPly, history.length);

  // Browser scroll anchoring can move the document when a complete list is rebuilt.
  // Preserve the viewport; moveListEl remains the only element allowed to scroll.
  const restorePageScroll = () => {
    if (pageScroller && Math.abs(pageScroller.scrollTop - pageScrollTop) > 1) {
      pageScroller.scrollTop = pageScrollTop;
    }
  };
  restorePageScroll();
  requestAnimationFrame(restorePageScroll);
}

function syncMoveNavigation(currentPly, totalPlies) {
  const reviewing = Boolean(reviewMovesSnapshot);
  moveFirstButton.disabled = !reviewing || totalPlies === 0 || currentPly <= 0;
  movePrevButton.disabled = totalPlies === 0 || currentPly <= 0;
  moveNextButton.disabled = !reviewing || currentPly >= totalPlies;
  moveLastButton.disabled = !reviewing || totalPlies === 0 || currentPly >= totalPlies;
  movePositionLabel.textContent = currentPly + " / " + totalPlies;
  moveScrubber.max = String(totalPlies);
  moveScrubber.value = String(Math.max(0, Math.min(totalPlies, currentPly)));
  moveScrubber.disabled = !reviewing || totalPlies === 0;
}

function stepMoveHistory(direction) {
  const sourceMoves = reviewMovesSnapshot || game.history({ verbose: true });
  if (!sourceMoves.length) return;
  const currentPly = reviewMovesSnapshot ? reviewPly : sourceMoves.length;
  const targetPly = Math.max(0, Math.min(sourceMoves.length, currentPly + direction));
  if (targetPly === currentPly) return;
  goToPly(targetPly);
}

function goToPly(ply) {
  const sourceMoves = reviewMovesSnapshot || game.history({ verbose: true }).map(move => ({
    from: move.from, to: move.to, promotion: move.promotion, san: move.san
  }));
  if (!reviewMovesSnapshot) {
    reviewRequiresFork = game.isGameOver();
    reviewMovesSnapshot = sourceMoves;
  }
  const targetPly = Math.max(0, Math.min(sourceMoves.length, Number(ply) || 0));

  cancelSearch();
  game.load(initialFen);
  bestMoveHint = null;
  for (let i = 0; i < targetPly; i += 1) {
    const saved = sourceMoves[i];
    const applied = game.move({ from: saved.from, to: saved.to, promotion: saved.promotion });
    if (!applied) {
      reviewMovesSnapshot = null;
      reviewPly = null;
      reviewRequiresFork = false;
      throw new Error("Could not restore the selected move-history position.");
    }
  }

  reviewPly = targetPly;
  const previous = targetPly ? sourceMoves[targetPly - 1] : null;
  lastMove = previous ? { from: previous.from, to: previous.to } : null;
  const reviewBest = reviewAnalysisResults[targetPly - 1]?.bestMove;
  bestMoveHint = reviewBest && reviewBest !== "(none)"
    ? { from: reviewBest.slice(0, 2), to: reviewBest.slice(2, 4) } : null;
  selected = null;
  legalTargets = [];
  pendingPromotion = null;
  promotionPicker.hidden = true;
  render();
  if (!game.isGameOver()) evaluatePosition();
}

function resumeFromReview() {
  if (!reviewMovesSnapshot || game.isGameOver()) return false;
  cancelSearch();

  // The game object already contains the selected position and only its
  // preceding moves. Keep that exact state and let the next move branch here.
  if (reviewRequiresFork) {
    activeArchiveId = gameArchive.newId();
    activeGameCreatedAt = new Date().toISOString();
    activeGamePersisted = false;
    pendingArchiveRecord = null;
    currentArchiveRecord = null;
    savedGameFen = null;
  }

  reviewMovesSnapshot = null;
  reviewPly = null;
  reviewRequiresFork = false;
  moveAnalysis = [];
  reviewAnalysisPositions = [];
  reviewAnalysisResults = [];
  reviewAnalysisIndex = 0;
  gameReviewPanel.hidden = true;
  reviewProgress.hidden = true;
  reviewProgressFill.style.width = "0%";
  reviewSummary.replaceChildren();
  reviewKeyMoments.replaceChildren();
  bestMoveHint = null;
  selected = null;
  legalTargets = [];
  pendingPromotion = null;
  promotionPicker.hidden = true;
  queuedPremove = null;
  render();

  // If the selected position belongs to the engine, let it make the next move.
  if (!game.isGameOver() && game.turn() !== humanColor) search();
  return true;
}


function render() {
  renderBoard();
  moveAnimationPending = false;
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


function premovePosition() {
  const fields=game.fen().split(" ");fields[1]=humanColor;return new Chess(fields.join(" "));
}
function queuePremove(from,to) {
  const pg=premovePosition();
  const candidates=pg.moves({square:from,verbose:true}).filter(move=>move.to===to);
  if(!candidates.length){selected=null;legalTargets=[];renderBoardHighlights();return;}
  const chosen=candidates.find(move=>move.promotion==="q")||candidates[0];
  queuedPremove={from,to,promotion:chosen.promotion||undefined};
  selected=null;legalTargets=[];statusEl.textContent="Premove queued · "+from+"–"+to;renderBoardHighlights();
}
function handlePremoveSquare(square) {
  if(!premovesEnabled||!thinking||game.isGameOver())return;
  const pg=premovePosition(),piece=pg.get(square);
  const targets=selected?pg.moves({square:selected,verbose:true}).map(move=>move.to):[];
  if(selected&&targets.includes(square)){queuePremove(selected,square);return;}
  if(piece?.color===humanColor){selected=square;legalTargets=pg.moves({square,verbose:true}).map(move=>move.to);}
  else{selected=null;legalTargets=[];}
  renderBoardHighlights();
}
function executeQueuedPremove() {
  if(!queuedPremove||game.turn()!==humanColor||game.isGameOver())return false;
  const move=game.move(queuedPremove);queuedPremove=null;
  if(!move){statusEl.textContent="Premove cancelled · no longer legal";renderBoardHighlights();return false;}
  lastMove={from:move.from,to:move.to};moveAnimationPending=true;playMoveSound(move);selected=null;legalTargets=[];render();void persistGameProgress();search();return true;
}
function clearDragGhost() {
  if(dragGhost)dragGhost.remove();
  dragGhost=null;boardEl.classList.remove("is-dragging");
  boardEl.querySelectorAll(".drag-origin").forEach(el=>el.classList.remove("drag-origin"));
}
function onBoardPointerDown(event) {
  if (showAnnotations && event.pointerType === "touch") return;
  const squareEl=event.target.closest?.(".square[data-square]");
  if(!squareEl||event.button!==0||moveMethod==="click"||game.isGameOver())return;
  event.preventDefault();
  try { squareEl.setPointerCapture(event.pointerId); } catch {}
  const from=squareEl.dataset.square,mayQueue=thinking&&premovesEnabled&&game.turn()!==humanColor;
  if(thinking&&!mayQueue)return;
  if(!thinking&&game.turn()!==humanColor)return;
  const piece=thinking?premovePosition().get(from):game.get(from);
  if(!piece||piece.color!==humanColor)return;
  dragState={pointerId:event.pointerId,from,startX:event.clientX,startY:event.clientY,dragging:false,mayQueue};
}
function onBoardPointerMove(event) {
  if(!dragState||dragState.pointerId!==event.pointerId||dragState.annotation)return;
  if(!dragState.dragging&&Math.hypot(event.clientX-dragState.startX,event.clientY-dragState.startY)<5)return;
  if(!dragState.dragging){
    dragState.dragging=true;
    const source=boardEl.querySelector('[data-square="'+dragState.from+'"]'),piece=source?.querySelector(".piece");
    if(piece){
      dragGhost=piece.cloneNode(true);const rect=source.getBoundingClientRect();
      Object.assign(dragGhost.style,{position:"fixed",left:(event.clientX-rect.width/2)+"px",top:(event.clientY-rect.height/2)+"px",width:rect.width+"px",height:rect.height+"px",zIndex:"99999",pointerEvents:"none",opacity:".94",filter:"drop-shadow(0 5px 8px rgba(0,0,0,.25))"});
      dragGhost.classList.add("drag-ghost");document.body.append(dragGhost);
    }
    source?.classList.add("drag-origin");boardEl.classList.add("is-dragging");
  }
  if(dragGhost){dragGhost.style.left=(event.clientX-dragGhost.offsetWidth/2)+"px";dragGhost.style.top=(event.clientY-dragGhost.offsetHeight/2)+"px";}
  event.preventDefault();
}
function onBoardPointerUp(event) {
  if(!dragState||dragState.pointerId!==event.pointerId)return;
  const state=dragState;dragState=null;
  if(state.annotation){
    const destination=document.elementFromPoint(event.clientX,event.clientY)?.closest?.(".square[data-square]")?.dataset.square||state.from;
    const idx=annotations.findIndex(item=>state.from===destination?item.square===state.from:item.from===state.from&&item.to===destination);
    if(idx>=0)annotations.splice(idx,1);else annotations.push(state.from===destination?{square:state.from}:{from:state.from,to:destination});
    renderBoard();return;
  }
  if(!state.dragging)return;
  const destination=document.elementFromPoint(event.clientX,event.clientY)?.closest?.(".square[data-square]")?.dataset.square;
  clearDragGhost();suppressNextBoardClick=true;setTimeout(()=>{suppressNextBoardClick=false;},0);
  if(!destination||destination===state.from)return;
  if(state.mayQueue){queuePremove(state.from,destination);return;}
  commitMove(state.from,destination);
}

function commitMove(from,to) {
  if (reviewMovesSnapshot && !resumeFromReview()) return false;
  const candidates=game.moves({square:from,verbose:true}).filter(move=>move.to===to);
  if(!candidates.length)return false;
  if(candidates.some(move=>move.promotion)){pendingPromotion={from,to};promotionPicker.hidden=false;selected=null;legalTargets=[];renderBoardHighlights();return true;}
  if(evaluating)cancelSearch();
  const move=game.move({from,to});if(!move)return false;
  queuedPremove=null;bestMoveHint=null;lastMove={from:move.from,to:move.to};moveAnimationPending=true;playMoveSound(move);
  selected=null;legalTargets=[];render();void persistGameProgress();search();return true;
}

function handleTouchAnnotationTap(square) {
  if (!showAnnotations) return;
  if (!annotationTapFrom) {
    annotationTapFrom = square;
    selected = square;
    legalTargets = [];
    statusEl.textContent = "Annotation start · tap a destination or tap this square again to mark it";
    statusEl.dataset.kind = "";
    renderBoardHighlights();
    return;
  }
  const from = annotationTapFrom;
  annotationTapFrom = null;
  selected = null;
  legalTargets = [];
  if (from === square) {
    const existing = annotations.findIndex(item => item.square === square);
    if (existing >= 0) annotations.splice(existing, 1);
    else annotations.push({ square });
    statusEl.textContent = existing >= 0 ? "Square mark removed" : "Square marked · " + square;
  } else {
    const existing = annotations.findIndex(item => item.from === from && item.to === square);
    if (existing >= 0) annotations.splice(existing, 1);
    else annotations.push({ from, to: square });
    statusEl.textContent = existing >= 0 ? "Arrow removed · " + from + " → " + square : "Arrow added · " + from + " → " + square;
  }
  statusEl.dataset.kind = "";
  renderBoard();
}

function onSquare(square) {
  primeAudio();
  if (reviewMovesSnapshot && !resumeFromReview()) return;
  if(game.isGameOver())return;
  if(moveMethod==="drag")return;
  if(thinking&&premovesEnabled){handlePremoveSquare(square);return;}
  if(thinking||game.turn()!==humanColor)return;
  const piece=game.get(square);
  if(selected&&legalTargets.includes(square)){commitMove(selected,square);return;}
  if(piece?.color===humanColor){
    if(selected===square){selected=null;legalTargets=[];}
    else{selected=square;legalTargets=game.moves({square,verbose:true}).map(move=>move.to);}
  } else {selected=null;legalTargets=[];}
  renderBoardHighlights();
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
  fenDirty = false;
  initialFen = new Chess().fen();
  reviewMovesSnapshot = null;
  reviewPly = null;
  reviewRequiresFork = false;
  moveAnalysis = [];
  reviewAnalysisPositions = [];
  reviewAnalysisResults = [];
  reviewAnalysisIndex = 0;
  savedGameFen = null;
   activeArchiveId = gameArchive.newId();
   activeGameCreatedAt = new Date().toISOString();
   activeGamePersisted = false;
  pendingArchiveRecord = null;
  currentArchiveRecord = null;
  gameReviewPanel.hidden = true;
  reviewProgress.hidden = true;
  reviewSummary.replaceChildren();
  reviewKeyMoments.replaceChildren();
  game.reset();
  bestMoveHint = null;
  moveAnimationPending = false;
  selected = null;
  legalTargets = [];
  lastMove = null;
  queuedPremove = null;
  annotations = [];
  annotationTapFrom = null;
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
    moveAnimationPending = true;
    playMoveSound(move);
    render();
    if (queuedPremove) executeQueuedPremove();
    if (remembered && selectedMove !== bestMove) {
      stateEl.textContent = "Experience memory · proven move";
      stateEl.dataset.busy = "false";
    }
    void persistGameProgress();search();
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

  if (data.type === "info") {
    if (data.scoreType !== undefined) applyEvaluation(data.scoreType, data.score, enginePositionTurn, data.depth);
    return;
  }
  if (data.type === "evaluation-complete") {
    evaluating = false;
    if (analyzingGame) {
      reviewAnalysisResults.push({
        scoreType: data.scoreType || null,
        score: Number.isFinite(data.score) ? data.score : null,
        depth: data.depth || 0,
        selDepth: data.selDepth || 0,
        nodes: data.nodes || 0,
        wdl: data.wdl || null,
        bestMove: data.bestMove || null,
        secondBest: data.secondBest || null
      });

      reviewAnalysisIndex += 1;
      const completed = reviewAnalysisResults.length;
      const total = reviewAnalysisPositions.length;
      const achievedDepths = reviewAnalysisResults.map(item => item.depth).filter(Number.isFinite);
      const deepestCompleted = achievedDepths.length ? Math.max(...achievedDepths) : 0;
      reviewProgressFill.style.width = Math.round((completed / total) * 100) + "%";
      reviewProgressLabel.textContent = "Analyzing " + completed + " / " + total +
        " positions · deepest completed depth " + deepestCompleted;
      if (reviewAnalysisIndex < total) {
        requestNextReviewPosition();
      } else {
        analyzingGame = false;
        await completeGameReview(reviewAnalysisResults);
      }
      return;
    }
    if (data.scoreType !== undefined) {
      applyEvaluation(data.scoreType, data.score, enginePositionTurn, data.depth);
      bestMoveHint = data.bestMove && data.bestMove !== "(none)" ? { from: data.bestMove.slice(0, 2), to: data.bestMove.slice(2, 4) } : null;
      renderBoard();
    } else {
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
      evaluating = false;
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
moveFirstButton.addEventListener("click", () => goToPly(0));
movePrevButton.addEventListener("click", () => stepMoveHistory(-1));
moveNextButton.addEventListener("click", () => stepMoveHistory(1));
moveLastButton.addEventListener("click", () => goToPly(reviewMovesSnapshot?.length || game.history().length));
moveScrubber.addEventListener("input", event => goToPly(Number(event.target.value)));
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
    return;
  }
  const editing = event.target instanceof HTMLElement &&
    (event.target.isContentEditable || ["INPUT","TEXTAREA","SELECT"].includes(event.target.tagName));
  if (reviewMovesSnapshot && !editing && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
    event.preventDefault();
    stepMoveHistory(event.key === "ArrowLeft" ? -1 : 1);
  }
});
undoButton.addEventListener("click", () => {
  if (thinking || reviewMovesSnapshot) return;
  if (game.history().length) game.undo();
  if (game.history().length) game.undo();
  if (activeGamePersisted) void persistGameProgress();
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
clearMarksButton.addEventListener("click",()=>{annotations=[];annotationTapFrom=null;bestMoveHint=null;selected=null;renderBoard();});
boardEl.addEventListener("contextmenu",event=>{if(showAnnotations)event.preventDefault();});
boardEl.addEventListener("pointerdown",event=>{
  if(event.button===2&&showAnnotations){
    const square=event.target.closest?.(".square[data-square]")?.dataset.square;
    if(square){event.preventDefault();dragState={pointerId:event.pointerId,from:square,dragging:true,annotation:true};}
    return;
  }
  onBoardPointerDown(event);
});
document.addEventListener("pointermove",onBoardPointerMove,{passive:false});
document.addEventListener("pointerup",onBoardPointerUp);
document.addEventListener("pointercancel",event=>{if(dragState?.pointerId===event.pointerId){dragState=null;clearDragGhost();}});
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
  renderBoardHighlights();
});
moveMethodSelect.addEventListener("change",event=>{moveMethod=event.target.value;savePreference("move-method",moveMethod);selected=null;legalTargets=[];renderBoardHighlights();});
bestMoveDisplaySelect.addEventListener("change",event=>{bestMoveDisplay=event.target.value;savePreference("best-move-display-v2",bestMoveDisplay);renderBoard();});
soundStyleSelect.addEventListener("change",event=>{soundStyle=event.target.value;savePreference("sound-style",soundStyle);});
previewSoundButton.addEventListener("click",()=>{primeAudio(true);playMoveSound({captured:false,promotion:false},true);});
highlightLastMoveToggle.addEventListener("change",event=>{highlightLastMove=event.target.checked;savePreference("highlight-last-move",highlightLastMove);renderBoardHighlights();});
pieceAnimationToggle.addEventListener("change",event=>{pieceAnimationEnabled=event.target.checked;savePreference("piece-animation",pieceAnimationEnabled);});
premovesToggle.addEventListener("change",event=>{premovesEnabled=event.target.checked;savePreference("premoves",premovesEnabled);if(!premovesEnabled)queuedPremove=null;renderBoardHighlights();});
annotationsToggle.addEventListener("change",event=>{
  showAnnotations=event.target.checked;
  savePreference("board-annotations",showAnnotations);
  annotationTapFrom=null;
  selected=null;
  legalTargets=[];
  if(!showAnnotations)annotations=[];
  statusEl.textContent = showAnnotations
    ? (window.matchMedia?.("(pointer: coarse)")?.matches
      ? "Annotations on · tap a start square, then a destination"
      : "Annotations on · right-drag to draw arrows")
    : "Annotations off";
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
$("#toggle-analysis-panel").addEventListener("click", () => {
  setAnalysisPanelOpen($("#analysis-panel").hidden);
});
$("#share-position-memory").addEventListener("change", event => {
  sharePositionMemory = event.target.checked;
  savePreference("share-position-memory", sharePositionMemory);
  void refreshGameArchive();
});
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
    savePreference("board-size", boardFrame.style.getPropertyValue("--board-size").replace("px", ""));
  });
  resizeGrip.addEventListener("pointercancel", () =>
    savePreference("board-size", boardFrame.style.getPropertyValue("--board-size").replace("px", ""))
  );
}
promotionPicker.querySelectorAll("[data-promotion]").forEach(button => {
  button.addEventListener("click", () => completePromotion(button.dataset.promotion));
});
$("#cancel-promotion").addEventListener("click", () => {
  pendingPromotion = null;
  promotionPicker.hidden = true;
});
fenInput.addEventListener("input", () => {
  fenDirty = true;
  fenFeedback.textContent = "";
  fenFeedback.dataset.kind = "";
});
$("#load-fen").addEventListener("click", () => {
  try {
    primeAudio();
    const next = new Chess(fenInput.value.trim());
    cancelSearch();
    fenDirty = false;
    initialFen = next.fen();
    reviewMovesSnapshot = null;
    reviewPly = null;
    reviewRequiresFork = false;
    moveAnalysis = [];
    reviewAnalysisPositions = [];
    reviewAnalysisResults = [];
    reviewAnalysisIndex = 0;
    queuedPremove = null;
    annotations = [];
  annotationTapFrom = null;
    bestMoveHint = null;
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
    fenDirty = false;
    fenInput.value = game.fen();
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
  fenDirty = false;
  initialFen = new Chess().fen();
  reviewMovesSnapshot = null;
  reviewPly = null;
  reviewRequiresFork = false;
  moveAnalysis = [];
  reviewAnalysisPositions = [];
  reviewAnalysisResults = [];
  reviewAnalysisIndex = 0;
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

function setMoveHistoryHeight(value, persist = true) {
  const height = Math.max(120, Math.min(560, Number(value) || 220));
  const list = $("#move-list");
  const panel = $(".analysis-panel");
  list.style.height = height + "px";
  list.style.flex = "0 0 " + height + "px";
  panel.style.setProperty("--move-history-height", height + "px");
  if (persist) savePreference("move-history-height", height);
}

function enableMoveHistoryResize() {
  const list = $("#move-list");
  const handle = $("#resize-move-history");
  const panel = $(".analysis-panel");
  setMoveHistoryHeight(loadPreference("move-history-height", "220"), false);
  let pointerStart = null;
  handle.addEventListener("pointerdown", event => {
    if (event.button !== 0) return;
    event.preventDefault();
    pointerStart = { id:event.pointerId, y:event.clientY, height:list.getBoundingClientRect().height };
    handle.setPointerCapture(event.pointerId);
    panel.classList.add("is-resizing-history");
  });
  handle.addEventListener("pointermove", event => {
    if (!pointerStart || event.pointerId !== pointerStart.id) return;
    setMoveHistoryHeight(pointerStart.height + event.clientY - pointerStart.y, false);
  });
  const finish = event => {
    if (!pointerStart || (event && event.pointerId !== pointerStart.id)) return;
    pointerStart = null;
    panel.classList.remove("is-resizing-history");
    savePreference("move-history-height", Math.round(list.getBoundingClientRect().height));
  };
  handle.addEventListener("pointerup", finish);
  handle.addEventListener("pointercancel", finish);
  handle.addEventListener("lostpointercapture", finish);
}

function enableSectionReveals() {
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  if (reducedMotion || !("IntersectionObserver" in window)) return;

  const targets = document.querySelectorAll(
    ".principles article, .hero-copy .eyebrow, .hero-copy h1, .hero-copy .hero-lede, " +
    ".hero-copy .hero-description, .hero-copy .hero-actions, .hero-copy .hero-meta, " +
    ".section-heading h2, .section-heading > p, .architecture-card, .about-copy, " +
    ".benchmark-copy, .benchmark-card, .editor-panel"
  );
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    }
  }, { threshold: 0.12, rootMargin: "0px 0px -24px 0px" });

  targets.forEach(target => {
    target.classList.add("reveal-on-scroll");
    observer.observe(target);
  });
}

linkAccountForm.addEventListener("submit", async event => {
  event.preventDefault();
  const submit = linkAccountForm.querySelector('button[type="submit"]');
  const email = $("#account-recovery-email").value;
  accountRecoveryStatus.textContent = "Sending a verification link…";
  accountRecoveryStatus.dataset.kind = "";
  submit.disabled = true;
  try {
    const result = await gameArchive.linkGuestEmail(email);
    accountRecoveryStatus.textContent =
      "Verification sent to " + result.email +
      ". Open the message and confirm this address. Your existing game history stays attached to this account.";
    accountRecoveryStatus.dataset.kind = "success";
  } catch (error) {
    accountRecoveryStatus.textContent = error instanceof Error ? error.message : "Could not send the verification email.";
    accountRecoveryStatus.dataset.kind = "error";
  } finally {
    submit.disabled = false;
  }
});


restoreAccountForm.addEventListener("submit", async event => {
  event.preventDefault();
  const submit = restoreAccountForm.querySelector('button[type="submit"]');
  const email = $("#restore-account-email").value;
  restoreAccountStatus.textContent = "Requesting a sign-in link…";
  restoreAccountStatus.dataset.kind = "";
  submit.disabled = true;
  try {
    const result = await gameArchive.sendRecoveryLink(email);
    restoreAccountStatus.textContent =
      "Sign-in link requested for " + result.email +
      ". Open it on this device to load the archive linked to that address. No new account will be created.";
    restoreAccountStatus.dataset.kind = "success";
  } catch (error) {
    restoreAccountStatus.textContent = error instanceof Error
      ? error.message
      : "Could not request the sign-in link.";
    restoreAccountStatus.dataset.kind = "error";
  } finally {
    submit.disabled = false;
  }
});

deleteAccountForm.addEventListener("submit", async event => {
  event.preventDefault();
  const confirmation = $("#delete-account-confirmation").value.trim();
  if (confirmation !== "DELETE") {
    deleteAccountStatus.textContent = 'Type DELETE exactly to confirm permanent account deletion.';
    deleteAccountStatus.dataset.kind = "error";
    return;
  }
  const submit = deleteAccountForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  deleteAccountStatus.textContent = "Revoking sessions and deleting your account data…";
  deleteAccountStatus.dataset.kind = "";
  try {
    await gameArchive.deleteAccount();
    deleteAccountStatus.textContent =
      "Your account and cloud game history have been deleted. This browser's local archive was cleared. Close this tab to finish.";
    deleteAccountStatus.dataset.kind = "success";
    linkAccountForm.querySelectorAll("input,button").forEach(control => { control.disabled = true; });
    deleteAccountForm.querySelectorAll("input,button").forEach(control => { control.disabled = true; });
    archiveCount.textContent = "0 games";
    archiveList.replaceChildren();
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "Account deleted. No games remain in this local archive.";
    archiveList.append(empty);
    archiveNote.textContent = "The account and associated cloud records were deleted.";
  } catch (error) {
    deleteAccountStatus.textContent = error instanceof Error ? error.message : "Account deletion failed.";
    deleteAccountStatus.dataset.kind = "error";
    submit.disabled = false;
  }
});

$("#year").textContent = String(new Date().getFullYear());
applyPreferences();
enableMoveHistoryResize();
enableSectionReveals();
void refreshGameArchive();
window.addEventListener("online", () => { void refreshGameArchive(); });
worker.postMessage({ type: "init" });
render();