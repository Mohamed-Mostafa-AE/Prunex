import { Chess } from "https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm";

const boardElement = document.querySelector("#board");
const statusElement = document.querySelector("#status");
const moveList = document.querySelector("#move-list");
const engineState = document.querySelector("#engine-state");
const timeSelect = document.querySelector("#move-time");
const depthSelect = document.querySelector("#search-depth");
const undoButton = document.querySelector("#undo");
const newGameButton = document.querySelector("#new-game");
const flipButton = document.querySelector("#flip");
const promotionSelect = document.querySelector("#promotion");
const worker = new Worker("./engine-worker.js");
const game = new Chess();

const pieces = {
    w: { k: "♔", q: "♕", r: "♖", b: "♗", n: "♘", p: "♙" },
    b: { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟︎" }
};

let selectedSquare = null;
let legalTargets = [];
let engineBusy = false;
let boardFlipped = false;
let requestId = 0;
let lastMove = null;
let ready = false;

function squareName(row, column) {
    return "abcdefgh"[column] + String(8 - row);
}

function getLegalMoves(square) {
    return game.moves({ square, verbose: true });
}

function setStatus(message, kind = "") {
    statusElement.textContent = message;
    statusElement.dataset.kind = kind;
}

function moveHistory() {
    return game.history({ verbose: true });
}

function describePosition() {
    if (game.isCheckmate()) return game.turn() === "w" ? "Checkmate. Black wins." : "Checkmate. You win.";
    if (game.isStalemate()) return "Draw by stalemate.";
    if (game.isThreefoldRepetition()) return "Draw by threefold repetition.";
    if (game.isInsufficientMaterial()) return "Draw by insufficient material.";
    if (game.isDraw()) return "Draw.";
    if (game.isCheck()) return (game.turn() === "w" ? "Your move" : "Prunex to move") + " · Check";
    return game.turn() === "w" ? "Your move" : "Prunex to move";
}

function renderBoard() {
    boardElement.replaceChildren();
    const rows = game.board();
    for (let visualRow = 0; visualRow < 8; visualRow += 1) {
        for (let visualColumn = 0; visualColumn < 8; visualColumn += 1) {
            const row = boardFlipped ? 7 - visualRow : visualRow;
            const column = boardFlipped ? 7 - visualColumn : visualColumn;
            const square = squareName(row, column);
            const piece = rows[row][column];
            const button = document.createElement("button");
            button.type = "button";
            button.className = "square " + (((row + column) % 2 === 0) ? "light" : "dark");
            button.dataset.square = square;
            button.setAttribute("aria-label", square);
            if (selectedSquare === square) button.classList.add("selected");
            if (lastMove && (lastMove.from === square || lastMove.to === square)) button.classList.add("last-move");
            if (legalTargets.includes(square)) button.classList.add(piece ? "capture-target" : "move-target");
            if (piece) {
                const glyph = document.createElement("span");
                glyph.className = "piece " + (piece.color === "w" ? "white-piece" : "black-piece");
                glyph.textContent = pieces[piece.color][piece.type];
                button.append(glyph);
            }
            if (visualColumn === 0) {
                const rank = document.createElement("span");
                rank.className = "coordinate rank";
                rank.textContent = String(boardFlipped ? visualRow + 1 : 8 - visualRow);
                button.append(rank);
            }
            if (visualRow === 7) {
                const file = document.createElement("span");
                file.className = "coordinate file";
                file.textContent = "abcdefgh"[column];
                button.append(file);
            }
            button.addEventListener("click", () => onSquareClick(square));
            boardElement.append(button);
        }
    }
}

function renderMoves() {
    const history = moveHistory();
    moveList.replaceChildren();
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
        moveList.append(row);
    }
    moveList.scrollTop = moveList.scrollHeight;
}

function render() {
    renderBoard();
    renderMoves();
    setStatus(describePosition(), game.isGameOver() ? "finished" : game.isCheck() ? "check" : "");
    undoButton.disabled = engineBusy || game.history().length === 0;
    newGameButton.disabled = false;
    engineState.textContent = !ready ? "Loading WebAssembly engine" : engineBusy ? "Searching" : "Engine ready";
    engineState.dataset.busy = String(engineBusy);
}

function requestEngineMove() {
    if (!ready || engineBusy || game.isGameOver() || game.turn() !== "b") return;
    engineBusy = true;
    selectedSquare = null;
    legalTargets = [];
    render();
    setStatus("Prunex is calculating…", "thinking");
    requestId += 1;
    worker.postMessage({
        type: "search",
        requestId,
        fen: game.fen(),
        moveTimeMs: Number(timeSelect.value),
        depth: Number(depthSelect.value)
    });
}

function onSquareClick(square) {
    if (engineBusy || !ready || game.isGameOver() || game.turn() !== "w") return;
    const piece = game.get(square);
    if (selectedSquare) {
        const move = legalTargets.includes(square);
        if (move) {
            try {
                const result = game.move({
                    from: selectedSquare,
                    to: square,
                    promotion: promotionSelect.value
                });
                lastMove = { from: result.from, to: result.to };
                selectedSquare = null;
                legalTargets = [];
                render();
                requestEngineMove();
                return;
            } catch (error) {
                setStatus(error instanceof Error ? error.message : "That move is not legal.", "error");
            }
        }
    }
    if (piece && piece.color === "w") {
        selectedSquare = square;
        legalTargets = getLegalMoves(square).map(move => move.to);
    } else {
        selectedSquare = null;
        legalTargets = [];
    }
    renderBoard();
}

worker.addEventListener("message", (event) => {
    const data = event.data || {};
    if (data.type === "ready") {
        ready = true;
        render();
        return;
    }
    if (data.type === "error" && data.requestId === undefined) {
        engineBusy = false;
        ready = false;
        render();
        setStatus("Engine startup failed: " + data.message, "error");
        return;
    }
    if (data.requestId !== requestId) return;
    engineBusy = false;
    if (data.type === "error") {
        render();
        setStatus("Engine error: " + data.message, "error");
        return;
    }
    if (data.type === "bestmove") {
        try {
            const move = game.move(data.bestMove);
            if (!move) throw new Error("The engine returned an invalid move: " + data.bestMove);
            lastMove = { from: move.from, to: move.to };
            selectedSquare = null;
            legalTargets = [];
            render();
        } catch (error) {
            render();
            setStatus(error instanceof Error ? error.message : "The engine move could not be applied.", "error");
        }
    }
});

worker.addEventListener("error", (event) => {
    engineBusy = false;
    ready = false;
    render();
    setStatus("Could not start the engine worker: " + event.message, "error");
});

newGameButton.addEventListener("click", () => {
    requestId += 1;
    worker.postMessage({ type: "cancel" });
    game.reset();
    engineBusy = false;
    selectedSquare = null;
    legalTargets = [];
    lastMove = null;
    render();
});

undoButton.addEventListener("click", () => {
    if (engineBusy) return;
    game.undo();
    if (game.turn() === "b") game.undo();
    const history = moveHistory();
    const prior = history[history.length - 1];
    lastMove = prior ? { from: prior.from, to: prior.to } : null;
    selectedSquare = null;
    legalTargets = [];
    render();
});

flipButton.addEventListener("click", () => {
    boardFlipped = !boardFlipped;
    renderBoard();
});

worker.postMessage({ type: "init" });
render();
