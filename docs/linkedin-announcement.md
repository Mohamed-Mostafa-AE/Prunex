# Prunex 0.8.0 — LinkedIn announcement

## Post

I've been building **Prunex 0.8.0**, a chess engine written in **C++20**.

The native engine implements a 0x88 board representation, legal move generation, Zobrist hashing, a transposition table, iterative-deepening negamax with alpha–beta/PVS search, move-ordering heuristics, quiescence search, draw detection, and a handcrafted tapered evaluation function.

The project includes a UCI command-line engine, a native Windows desktop application, and a browser chess application running the same C++ implementation through WebAssembly.

The 46-case native regression suite passed across GCC Release, Clang Release, sanitizers, and Windows x64. The browser, WebAssembly parity, and CodeQL checks have also passed in CI.

The name reflects two ideas from the engine's design: **PRUN** from alpha–beta pruning, and **EX** from the execution of adversarial search.

**Source code:** https://github.com/Mohamed-Mostafa-AE/Prunex  
**Browser demo:** https://prunex-play.vercel.app/  
**Architecture:** https://github.com/Mohamed-Mostafa-AE/Prunex/blob/main/docs/assets/prunex-search-kernel.svg  
**Validation:** [Native and sanitizer checks](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/workflows/native-ci.yml) · [Windows x64](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/workflows/windows-build.yml) · [Browser checks](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/workflows/website-ci.yml) · [WebAssembly parity](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/workflows/wasm-ci.yml) · [CodeQL](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/workflows/codeql.yml)

I'd welcome feedback from people interested in C++, chess programming, search algorithms, and software engineering.

#CPlusPlus #ChessProgramming #SoftwareEngineering #ChessEngines

## Image order

1. **Project overview** — attach a current screenshot of the production website after the final production deployment.
2. **Engine architecture** — attach a PNG export of `docs/assets/prunex-search-kernel.svg`.

Do not imply a measured playing-strength rating. The native fixed-position benchmark measures search throughput only.

## Publication note

This copy describes the source-code project and its automated validation. Publish it after the production deployment, account/archive recovery, backup, authentication, legal, and manual device-acceptance gates have been completed.