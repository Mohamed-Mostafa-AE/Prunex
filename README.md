# Prunex 0.5.1

**An independently developed chess engine, written from scratch in C++20.**

Prunex is a personal chess-engine project. The independent engine core implements its own board representation, position handling, legal move generation, search, evaluation, and UCI interface. It does not use Stockfish engine source code or Stockfish NNUE weights.

The source package is `Prunex-0.5.1.zip`. It contains the C++ source, Windows GUI, CMake build, and regression tests.

## Build

Requirements: CMake 3.20 or newer and a C++20 compiler. On Windows, use Visual Studio 2022 with **Desktop development with C++** installed.

Extract the source archive, then run these commands from the extracted `Prunex` directory.

Windows:

```powershell
cmake -S . -B build -A x64
cmake --build build --config Release
ctest --test-dir build -C Release --output-on-failure
```

Linux:

```bash
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build --parallel
ctest --test-dir build --output-on-failure
```

## Search and evaluation

The 0.5.x engine includes Zobrist position hashing, a transposition table, iterative deepening, aspiration windows, principal-variation search, move ordering, late-move reductions, quiescence search, and tapered positional evaluation. Version 0.5.1 adds move-time and clock-based UCI time allocation.

## Tests and benchmark results

The regression suite contains 44 CTest cases. The cleaned source has been verified locally with GCC Release (44/44), Clang Release (44/44), and GCC AddressSanitizer/UndefinedBehaviorSanitizer (44/44). GCC static analysis completed without diagnostics. See [TEST_REPORT.md](TEST_REPORT.md) for coverage and limitations.

The recorded 64-game fixed-move-time matches against Stockfish 4 and Stockfish 6 ended 0 wins, 0 draws, and 64 losses for Prunex against each opponent. These are historical results, not an Elo rating or evidence of competitive superiority.

## Browser demo

**Live website:** https://prunex-play.vercel.app/

The browser workspace is a separate demo. Its current opponent is Stockfish.js 19 Lite running locally in a Web Worker. It is not the independent Prunex 0.5.1 search core. The website identifies this distinction.

## Current limitations

- The Windows GUI performs search on the UI thread, so longer searches can temporarily block interaction.
- UCI `stop` is not implemented as asynchronous cancellation.
- Native Windows GUI runtime testing is not included in the Linux test results.
- The independent engine has no independently established Elo rating.
- No large-scale SPRT or long-run self-play result is available.

## Licensing

The supplied project source did not include a standalone license for the independent engine. The repository remains private; choose and add a license before public redistribution. The browser demo uses Stockfish.js 19, a separately licensed third-party component, with its notices and source archive retained in the website deployment.
