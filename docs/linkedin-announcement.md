# Prunex 0.8.0 — LinkedIn announcement

## Post

I've been building **Prunex**, an independently implemented chess-engine project written in **C++20**.

The native engine has its own 0x88 board representation, legal move generation, Zobrist hashing, a transposition table, iterative-deepening negamax with alpha–beta pruning and principal-variation search, move ordering, late-move reductions, and quiescence search. It also includes a UCI interface and a handcrafted tapered evaluation function.

The project includes a native command-line engine, a Windows desktop interface, and a standalone WebAssembly build with native parity checks.

**Prunex Play** is a separate browser application for playing and reviewing chess. Its browser opponent and analysis path use the third-party Stockfish.js 19 engine; the native C++ engine is not currently running inside the browser application.

I have put a strong emphasis on correctness and repeatable validation. The 46-case native regression suite passed in GCC Release, Clang Release, GCC AddressSanitizer/UndefinedBehaviorSanitizer, and Windows x64 CI. The website build and Playwright checks, WebAssembly parity checks, and CodeQL analysis also passed.

I am continuing to work on engine strength, desktop acceptance, and the hosted-service release process. I would welcome feedback from people interested in chess programming, C++, search algorithms, or engine development.

**Explore Prunex:** https://github.com/Mohamed-Mostafa-AE/Prunex

#CPlusPlus #ChessProgramming #SoftwareEngineering #ChessEngines

## Image guidance

Attach the two 1200 × 675 screenshots prepared for this post:
1. Website overview — use as the first image.
2. Native engine architecture section — use as the second image.

These are authentic website captures illustrating the project and technical architecture. They are not screenshots of the native Windows desktop application, benchmark results, or Elo evidence.

## Publication gate

This copy is suitable for publication only after the final manual Windows 10/11 desktop acceptance and the remaining hosted-service/legal gates documented in `docs/finalization-gates.md` are closed. Do not describe Prunex as having an independently measured Elo rating or a native NNUE evaluator.
