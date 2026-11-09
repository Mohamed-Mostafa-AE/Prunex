# Prunex 0.8.0 — LinkedIn announcement

## Post

I've been building **Prunex 0.8.0**, a chess engine written in **C++20**.

Its native core brings together a 0x88 board representation, legal move generation, Zobrist hashing, a transposition table, iterative-deepening negamax with alpha–beta and principal-variation search, move ordering, quiescence search, and a handcrafted tapered evaluation function.

The project includes a UCI command-line engine, a native Windows application, and a browser experience that runs the C++ engine through WebAssembly.

The 47-case regression suite passed under GCC, Clang, and AddressSanitizer/UndefinedBehaviorSanitizer. The Windows x64 CI build also passed all 47 tests and its automated desktop smoke checks.

The name combines two ideas: **PRUN**, from alpha–beta pruning, and **EX**, from competitive execution.

I've enjoyed working across search algorithms, systems programming, and correctness, and I'd welcome feedback from people interested in C++, chess programming, and engine development.

**Repository:** https://github.com/Mohamed-Mostafa-AE/Prunex  
**Engine architecture:** https://github.com/Mohamed-Mostafa-AE/Prunex/blob/main/docs/assets/prunex-search-kernel.svg  
**Windows x64 validation:** https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42686689854  
**Website and browser validation:** https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42686690073  
**CodeQL security analysis:** https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42686689576

#CPlusPlus #ChessProgramming #SoftwareEngineering #ChessEngines

## Image order

1. **Website overview:** attach the current 1200 × 675 homepage screenshot.
2. **Native engine architecture:** attach the current 1200 × 675 architecture-section screenshot.

## Publication gate

The code and automated checks are validated. Publish the launch announcement after the canonical production domain points to the final reviewed main build, archive ownership and recovery are complete, hosted authentication/email is tested, the Privacy Notice and Terms have received qualified review, and manual Windows 10/11 acceptance has passed.

This post makes no unmeasured playing-strength or rating claim.
