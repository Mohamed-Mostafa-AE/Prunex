# Prunex

Prunex is a chess engine developed from the ground up in C++20. The project includes a native engine, a Windows desktop interface, a command-line interface, tests, and a small website where you can try a game.

## The engine

The engine has its own board representation, position handling, legal move generation, search, evaluation, and UCI interface. The search uses Zobrist hashing, a transposition table, iterative deepening, aspiration windows, principal-variation search, move ordering, late-move reductions, and quiescence search. Position evaluation uses a tapered positional model.

## Project folders

- `src/` — engine and Windows desktop source
- `tests/` — engine regression tests
- `website/` — website and browser chess demo
- `docs/` — development notes, test results, and the Windows checklist
- `.github/workflows/` — automated build and website checks
- `CMakeLists.txt` — native build configuration

## Build on Windows

Install Visual Studio 2022 with **Desktop development with C++**, along with CMake 3.20 or newer. Run these commands from the project folder:

```powershell
cmake -S . -B build -A x64
cmake --build build --config Release
ctest --test-dir build -C Release --output-on-failure
```

## Build on Linux

Install a C++20 compiler and CMake 3.20 or newer. Then run:

```bash
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build --parallel
ctest --test-dir build --output-on-failure
```

## Tests

The current regression suite contains 44 tests. Recorded Linux runs passed with GCC Release, Clang Release, and GCC AddressSanitizer/UndefinedBehaviorSanitizer. The GCC static-analysis build completed without diagnostics. Test coverage and the recorded results are in [docs/testing.md](docs/testing.md).

## Try it online

The website includes a browser chessboard so visitors can try a game. The browser demo uses Stockfish.js Lite as its opponent. That opponent is only part of the website demonstration; it is separate from the native C++ Prunex engine.

**Website:** https://prunex-play.vercel.app/

## Current limitations

- The Windows desktop application still needs a full manual run-through on Windows 10 or 11. The checklist is in [docs/windows-desktop-checklist.md](docs/windows-desktop-checklist.md).
- The desktop application searches on the UI thread, so a long search can temporarily make the window unresponsive.
- UCI `stop` does not yet cancel a search asynchronously.
- No independent Elo rating has been established for the native engine.
- The native engine's source package does not currently include a standalone project license. Choose and add one before public redistribution.

## Further reading

- [Development notes](docs/development-notes.md)
- [Test results](docs/testing.md)
- [Windows desktop checklist](docs/windows-desktop-checklist.md)
- [Source code](https://github.com/Mohamed-Mostafa-GT/Prunex)
