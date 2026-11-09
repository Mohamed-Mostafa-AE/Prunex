# Prunex 0.8.0 — LinkedIn announcement

## Post

I'm excited to share **Prunex 0.8.0** — an independently developed chess engine built from scratch in **C++20**.

Prunex has its own board representation, legal move generation, Zobrist hashing, transposition table, iterative-deepening negamax search with alpha–beta pruning and principal-variation search, static-exchange-based capture ordering, late-move reductions, quiescence search, draw detection, null-move pruning, and a handcrafted tapered evaluation function.

The project includes:
- A native UCI command-line engine.
- A Windows desktop interface.
- A browser chess application powered by the same C++ engine compiled to WebAssembly.

I focused heavily on correctness and reproducibility. The 46-case native regression suite and the current validation matrix passed across GCC, Clang, AddressSanitizer/UndefinedBehaviorSanitizer, Windows x64, WebAssembly parity, website/browser checks, and CodeQL.

Prunex is an independent implementation: its engine architecture and source code are its own. The browser build is compiled from the same Prunex C++ source.

**Explore the source:** https://github.com/Mohamed-Mostafa-AE/Prunex

**Latest validation:** [Native compiler and sanitizer checks](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42551830679) · [Windows x64](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42551830774) · [Website and browser](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42551830676) · [WebAssembly parity](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42551830689) · [CodeQL](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42551830677)

I'd welcome feedback from people interested in C++, chess programming, search algorithms, and independent engine development.

#CPlusPlus #ChessProgramming #SoftwareEngineering #ChessEngines

## Image order

1. **Project overview** — use the current 1200 × 675 overview capture.
2. **Engine architecture** — use the current 1200 × 675 architecture capture.

Do not present the browser chessboard as a screenshot of the native Windows application. Do not include an Elo graphic or imply a current playing-strength rating.

## Publication note

This post describes the source-code project and its automated validation. It does not claim that the hosted archive service has completed operational/legal release gates, that the Windows desktop has completed additional manual device acceptance, or that the website's move-review labels reproduce another product's proprietary classification system.
