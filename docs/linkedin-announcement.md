# Prunex 0.8.0 — LinkedIn announcement

## Post

I've been building **Prunex 0.8.0**, a chess engine written in **C++20**.

Its native core brings together a 0x88 board representation, legal move generation, Zobrist hashing, a transposition table, iterative-deepening negamax with alpha–beta and principal-variation search, move ordering, quiescence search, and a handcrafted tapered evaluation function.

The project includes a UCI command-line engine, a native Windows application, and a browser experience that runs the same C++ engine through WebAssembly.

The name combines two ideas from the engine's design: **PRUN**, from alpha–beta pruning, and **EX**, from the execution of adversarial search.

I've enjoyed working across search algorithms, systems programming, and correctness, and I'd welcome feedback from people interested in C++, chess programming, and engine development.

**Source code:** https://github.com/Mohamed-Mostafa-AE/Prunex  
**Engine architecture:** https://github.com/Mohamed-Mostafa-AE/Prunex/blob/main/docs/assets/prunex-search-kernel.svg

#CPlusPlus #ChessProgramming #SoftwareEngineering #ChessEngines

## Image order

1. **Website overview:** capture the final production website after the current main build has been deployed and visually accepted.
2. **Native engine architecture:** export docs/assets/prunex-search-kernel.svg to a 1200 × 675 PNG. Keep the original diagram legible and do not add claims that are not represented in the source.

## Publication gate

Publish after the current GitHub workflow matrix is green, the production domain points to the final main build, the archive/authentication and recovery requirements are complete, the Privacy Notice and Terms have received qualified review, and manual Windows 10/11 acceptance has passed.

This post intentionally makes no unmeasured playing-strength or rating claim.