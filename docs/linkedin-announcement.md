# Prunex 0.8.0 — LinkedIn announcement

## Post

I'm excited to share **Prunex 0.8.0**, a chess-engine project centred on an independently implemented **C++20** engine.

The native engine brings together a 0x88 board representation, legal move generation, Zobrist hashing, a transposition table, iterative-deepening negamax with alpha–beta pruning and principal-variation search, SEE-based capture ordering, late-move reductions, quiescence search, draw detection, null-move pruning, and a handcrafted tapered evaluator.

The release includes a command-line engine, a native Windows desktop interface, and a standalone WebAssembly build checked against native reference results.

Correctness has been a major focus: the 46-case native regression suite passed under GCC Release, Clang Release, AddressSanitizer/UndefinedBehaviorSanitizer, and Windows x64 CI.

**Explore Prunex:** https://github.com/Mohamed-Mostafa-AE/Prunex

**Validation records:** [Native 46-case test matrix](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42280861589) · [Windows x64 build and GUI smoke test](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42280861974) · [WebAssembly parity](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42280861737)

I'd welcome feedback from people interested in C++, chess programming, search algorithms, and engine development.

#CPlusPlus #ChessProgramming #SoftwareEngineering #ChessEngines

## Image order

1. **Website overview** — use the 1200 × 675 overview capture as the first image.
2. **Native engine architecture** — use the 1200 × 675 architecture capture as the second image.

Use the current captures from the release candidate. Do not present the browser chessboard as a screenshot of the native Windows application, and do not use benchmark or Elo graphics.

## Publication gate

The browser application now runs the Prunex 0.8.0 C++20 engine through WebAssembly. Publish only after the current source-validation workflows pass, the final manual Windows 10/11 acceptance is complete, and the required release gates in [finalization-gates.md](finalization-gates.md) are closed. Do not present a historical benchmark as a current independent Elo rating.
