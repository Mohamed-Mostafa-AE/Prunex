# Prunex

**An independently developed chess engine, built from scratch in C++20.**

The repository root is the main project folder. It contains the complete C++ engine source, Windows GUI, CMake build files, tests, website, and documentation. No ZIP archives are needed.

## Project layout

- `src/` — C++ engine and GUI source
- `tests/` — C++ regression tests
- `CMakeLists.txt` — native build configuration
- `website/` — project website and separate browser demo
- `.github/workflows/` — website and Windows CI

## Build on Windows

Install Visual Studio 2022 with **Desktop development with C++** and CMake 3.20 or newer. From the repository root:

```powershell
cmake -S . -B build -A x64
cmake --build build --config Release
ctest --test-dir build -C Release --output-on-failure
```

## Build on Linux

```bash
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build --parallel
ctest --test-dir build --output-on-failure
```

## Engine architecture

The independent Prunex core implements its own board representation, position handling, legal move generation, search, evaluation, and UCI interface. It does not use Stockfish engine source code or Stockfish NNUE weights.

The 0.5.x search includes Zobrist position hashing, a transposition table, iterative deepening, aspiration windows, principal-variation search, move ordering, late-move reductions, quiescence search, and tapered positional evaluation.

## Verification

The 44-case regression suite passed in recorded local runs with GCC Release, Clang Release, and GCC AddressSanitizer/UndefinedBehaviorSanitizer. GCC static analysis completed without diagnostics. See [TEST_REPORT.md](TEST_REPORT.md).

Historical 64-game, 100 ms/move matches against Stockfish 4 and Stockfish 6 ended 0 wins, 0 draws, 64 losses for Prunex against each opponent. These results are not an Elo rating or evidence of competitive superiority.

## Website and browser demo

Live site: https://prunex-play.vercel.app/

The browser demo is a separate application. Its opponent is Stockfish.js 19 Lite running locally in a Web Worker; it is not the independent Prunex native C++ search engine.

## Known limitations

- Native Windows GUI runtime testing should be completed on Windows 10/11.
- The desktop GUI currently performs search on the UI thread and can temporarily become unresponsive during longer searches.
- UCI `stop` is not asynchronous cancellation.
- No independent Elo rating or large-scale SPRT result is claimed.
- The supplied source did not include a standalone license for the independent engine; add a license before public redistribution.

## Mentor review

See [MENTOR_REVIEW_NOTES.md](MENTOR_REVIEW_NOTES.md), [TEST_REPORT.md](TEST_REPORT.md), and [WINDOWS_GUI_CHECKLIST.md](WINDOWS_GUI_CHECKLIST.md).
