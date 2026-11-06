# Prunex 0.8.0 — LinkedIn announcement

## Post

I've been building **Prunex** for a while, and I'm excited to share version **0.8.0**.

The name brings together two ideas: **PRUN**, from alpha–beta *pruning*, and **EX**, representing the execution of adversarial search—exploring candidate moves while anticipating an opponent's replies.

The native engine is written in **C++20** and built from scratch. It includes a 0x88 board representation, legal move generation, Zobrist hashing and a transposition table, iterative-deepening negamax alpha–beta/PVS search, aspiration windows, late-move reductions, quiescence search, and a UCI interface. Its evaluation currently uses handcrafted, tapered middlegame/endgame terms.

There's also an important distinction between the two parts of the project: **the native C++ engine does not currently use NNUE**. The separate **Prunex Play** browser experience uses Stockfish.js 19 Full and Stockfish's upstream NNUE network for playing and analysis. I built the application layer around it—including worker orchestration, game-review flow, expected-points calibration, move-quality grading, and archive integration. The NNUE network itself is upstream; I'm not claiming a custom network trained by Prunex.

On the engineering side, the 46-case native regression suite passed on GCC, Clang, AddressSanitizer/UndefinedBehaviorSanitizer, and Windows x64. The browser/Playwright, WebAssembly parity, backup-tool validation, and both CodeQL analyses also passed in CI.

I'm continuing to work on search quality, evaluation, and reproducible testing. Feedback from people interested in chess programming, C++, and engine development is always welcome.

**Project and source:** https://github.com/Mohamed-Mostafa-AE/Prunex

**Validation evidence:**
- [Native GCC/Clang and sanitizer matrix](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42275303337)
- [Windows x64 build and desktop smoke test](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42275303249)
- [Website and browser tests](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42275303284)
- [WebAssembly parity](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42275303254)
- [CodeQL security analysis](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42275303299)

#Cplusplus #ChessProgramming #SoftwareEngineering #ChessEngines

## Image guidance

Use the two 1200 × 675 product captures prepared with the announcement: the website overview and the engine architecture section. They illustrate the product and technical scope; they are not benchmark results or screenshots of the native Windows application.
