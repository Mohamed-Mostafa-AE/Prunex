import { Chess } from "chess.js";
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
const worker = new Worker(new URL("./engine-worker.js", import.meta.url), { type: "module" });
const game = new Chess();

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

const squareName = (row, col) => "abcdefgh"[col] + String(8 - row);

function statusText() {
  if (game.isCheckmate()) return game.turn() === humanColor ? "Checkmate · Engine wins" : "Checkmate · You win";
  if (game.isStalemate()) return "Draw · Stalemate";
  if (game.isThreefoldRepetition()) return "Draw · Threefold repetition";
  if (game.isInsufficientMaterial()) return "Draw · Insufficient material";
  if (game.isDraw()) return "Draw";
  if (game.isCheck()) return (game.turn() === humanColor ? "Your move" : "Engine to move") + " · Check";
  return game.turn() === humanColor ? "Your move" : "Engine to move";
}

function syncFen() {
  fenInput.value = game.fen();
}

function renderBoard() {
  boardEl.replaceChildren();
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
      if (legalTargets.includes(square)) button.classList.add(piece ? "capture-target" : "move-target");
      if (piece) {
        const span = document.createElement("span");
        span.className = "piece " + (piece.color === "w" ? "white-piece" : "black-piece");
        span.textContent = glyph[piece.color][piece.type];
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

function renderMoves() {
  const history = game.history({ verbose: true });
  moveListEl.replaceChildren();
  if (!history.length) {
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
    const white = document.createElement("span");
    white.textContent = history[i]?.san || "";
    const black = document.createElement("span");
    black.textContent = history[i + 1]?.san || "";
    row.append(number, white, black);
    moveListEl.append(row);
  }
  moveListEl.scrollTop = moveListEl.scrollHeight;
  moveCountEl.textContent = history.length + " plies";
}

function render() {
  renderBoard();
  renderMoves();
  syncFen();
  statusEl.textContent = statusText();
  statusEl.dataset.kind = game.isGameOver() ? "finished" : game.isCheck() ? "check" : thinking ? "thinking" : "";
  stateEl.textContent = !ready ? "Starting engine" : thinking ? "Calculating a reply…" : "Engine ready";
  stateEl.dataset.busy = String(thinking);
  turnEl.textContent = game.turn() === humanColor ? "YOUR TURN · " + (humanColor === "w" ? "WHITE" : "BLACK") : "ENGINE · " + (humanColor === "w" ? "BLACK" : "WHITE");
  undoButton.disabled = thinking || game.history().length === 0;
}

function search() {
  if (!ready || thinking || game.isGameOver() || game.turn() === humanColor) return;
  thinking = true;
  selected = null;
  legalTargets = [];
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
  if (!ready || thinking || game.isGameOver() || game.turn() !== humanColor) return;
  const piece = game.get(square);
  if (selected) {
    if (legalTargets.includes(square)) {
      try {
        const move = game.move({ from: selected, to: square, promotion: "q" });
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
  worker.postMessage({ type: "cancel" });
  thinking = false;
}

function startNewGame() {
  cancelSearch();
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
    render();
    statusEl.textContent = "Engine failed to load: " + data.message;
    statusEl.dataset.kind = "error";
    return;
  }
  if (data.requestId !== requestId) return;
  thinking = false;
  if (data.type === "error") {
    render();
    statusEl.textContent = "Engine error: " + data.message;
    statusEl.dataset.kind = "error";
    return;
  }
  if (data.type === "bestmove") {
    try {
      const move = game.move(data.bestMove);
      if (!move) throw new Error("Illegal engine move: " + data.bestMove);
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

$("#new-game").addEventListener("click", startNewGame);
undoButton.addEventListener("click", () => {
  if (thinking) return;
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
  humanColor = sideSelect.value;
  startNewGame();
});
$("#theme").addEventListener("change", (event) => {
  boardEl.dataset.theme = event.target.value;
});
$("#load-fen").addEventListener("click", () => {
  try {
    const next = new Chess(fenInput.value.trim());
    cancelSearch();
    game.load(next.fen());
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
boardEl.dataset.theme = "sage";
worker.postMessage({ type: "init" });
render();