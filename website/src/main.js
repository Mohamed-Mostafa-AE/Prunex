import { Chess } from "chess.js";
import "./style.css";

const boardEl = document.querySelector("#board");
const statusEl = document.querySelector("#status");
const stateEl = document.querySelector("#engine-state");
const turnEl = document.querySelector("#turn-label");
const moveListEl = document.querySelector("#move-list");
const moveCountEl = document.querySelector("#move-count");
const undoButton = document.querySelector("#undo");
const nodesSelect = document.querySelector("#nodes");
const worker = new Worker(new URL("./engine-worker.js", import.meta.url), { type: "module" });
const game = new Chess();

const glyph = {
  w: { k: "♔", q: "♕", r: "♖", b: "♗", n: "♘", p: "♙" },
  b: { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟︎" }
};

let selected = null;
let legalTargets = [];
let flipped = false;
let ready = false;
let thinking = false;
let requestId = 0;
let lastMove = null;

const squareName = (row, col) => "abcdefgh"[col] + String(8 - row);

function statusText() {
  if (game.isCheckmate()) return game.turn() === "w" ? "Checkmate · Prunex wins" : "Checkmate · You win";
  if (game.isStalemate()) return "Draw · Stalemate";
  if (game.isThreefoldRepetition()) return "Draw · Threefold repetition";
  if (game.isInsufficientMaterial()) return "Draw · Insufficient material";
  if (game.isDraw()) return "Draw";
  if (game.isCheck()) return (game.turn() === "w" ? "Your move" : "Prunex to move") + " · Check";
  return game.turn() === "w" ? "Your move" : "Prunex to move";
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
      button.setAttribute("aria-label", piece ? square + " " + piece.color + " " + piece.type : square);
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
    empty.textContent = "The game hasn't started.";
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
  moveCountEl.textContent = Math.ceil(history.length / 2) + " moves";
}

function render() {
  renderBoard();
  renderMoves();
  statusEl.textContent = statusText();
  statusEl.dataset.kind = game.isGameOver() ? "finished" : game.isCheck() ? "check" : thinking ? "thinking" : "";
  stateEl.textContent = !ready ? "Starting engine" : thinking ? "Prunex is thinking" : "Engine ready";
  stateEl.dataset.busy = String(thinking);
  turnEl.textContent = game.turn() === "w" ? "YOU · WHITE" : "PRUNEX · BLACK";
  undoButton.disabled = thinking || game.history().length === 0;
}

function search() {
  if (!ready || thinking || game.isGameOver() || game.turn() !== "b") return;
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
  if (!ready || thinking || game.isGameOver() || game.turn() !== "w") return;
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
  if (piece?.color === "w") {
    selected = square;
    legalTargets = game.moves({ square, verbose: true }).map(move => move.to);
  } else {
    selected = null;
    legalTargets = [];
  }
  renderBoard();
}

worker.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "debug") {
    stateEl.textContent = "Loading engine";
    statusEl.textContent = "DEBUG: " + data.message;
    return;
  }
  if (data.type === "ready") {
    ready = true;
    render();
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

document.querySelector("#new-game").addEventListener("click", () => {
  requestId += 1;
  worker.postMessage({ type: "cancel" });
  game.reset();
  thinking = false;
  selected = null;
  legalTargets = [];
  lastMove = null;
  render();
});

undoButton.addEventListener("click", () => {
  if (thinking) return;
  game.undo();
  if (game.turn() === "b") game.undo();
  const h = game.history({ verbose: true });
  const prior = h[h.length - 1];
  lastMove = prior ? { from: prior.from, to: prior.to } : null;
  selected = null;
  legalTargets = [];
  render();
});

document.querySelector("#flip").addEventListener("click", () => {
  flipped = !flipped;
  renderBoard();
});

document.querySelector("#year").textContent = String(new Date().getFullYear());
worker.postMessage({ type: "init" });
render();
