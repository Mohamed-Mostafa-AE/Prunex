# Prunex

Prunex is an independently developed chess-engine project. Its native engine is written in **C++20** and includes its own board representation, position handling, legal move generation, search, evaluation, and UCI interface. The repository also contains a Windows desktop interface, regression tests, and a separate website with a browser chess demo.

> **Important distinction:** The browser demo is not the native C++ engine. It uses `chess.js` for game rules and the Stockfish.js 19 Full multi-threaded browser build for its opponent and analysis. The native engine is a separate C++ implementation.

## Project components

| Path | Description |
| --- | --- |
| `src/main.cpp` | Native C++20 engine and UCI command-line interface |
| `src/gui.cpp` | Windows desktop interface |
| `tests/` | Native engine regression tests |
| `website/` | Vite website and browser chess demo |
| `docs/` | Development notes, recorded test results, and Windows test checklist |
| `.github/workflows/` | Automated build and website checks |

## Native engine

The native engine includes:

- 0x88 board representation and FEN position loading
- Legal move generation, including castling, en passant, and promotion
- Zobrist hashing and a transposition table
- Iterative deepening, negamax alpha-beta search, and principal-variation search
- Aspiration windows, move ordering, late-move reductions, and quiescence search
- Tapered positional evaluation
- UCI command handling and time controls

The native CMake project currently identifies itself as **0.5.1**. This is the native engine's version; it should not be confused with the website's separate browser-demo label.

## Build the native engine

### Windows

Install Visual Studio 2022 with **Desktop development with C++**, and CMake 3.20 or newer.

```powershell
cmake -S . -B build -A x64
cmake --build build --config Release
ctest --test-dir build -C Release --output-on-failure
```

### Linux

Install a C++20 compiler and CMake 3.20 or newer.

```bash
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build --parallel
ctest --test-dir build --output-on-failure
```

## Tests

The CTest suite currently contains 44 cases. Recorded Linux runs passed with GCC Release, Clang Release, and GCC AddressSanitizer/UndefinedBehaviorSanitizer. A GCC static-analysis run completed without diagnostics. These are recorded results, not a claim that every platform or the Windows desktop interface has been fully tested.

See [docs/testing.md](docs/testing.md) for the test coverage, benchmark provenance, and limitations.

## Try the website

**Website:** https://prunex-play.vercel.app/

The browser demo is a separate web experience. It uses Stockfish.js 19 Full (multi-threaded) as its opponent and analysis engine; it does not run the native C++ Prunex engine. The third-party engine and chess-piece artwork retain their own licenses and notices in `website/public/`.

## Browser engine and evaluation

The browser experience is branded **Prunex Play** and uses **Stockfish.js 19 Full (multi-threaded)** as its underlying UCI engine. The Prunex-owned layer handles browser integration, review orchestration, expected-points interpretation, move classifications, and the Prunex Apex criteria. It does not claim the upstream engine or NNUE network as original Prunex code. GPLv3 attribution, license, and corresponding-source information are retained in the website build. The full browser build is approximately 94 MB and uses cross-origin isolation to enable shared-memory multithreading.

Game Review defaults to a 30-second search budget per non-terminal position. This is a time budget, not a guaranteed depth. See [Evaluation Intelligence](docs/evaluation-intelligence.md) for calibration training, validation, benchmarking, and the separate upstream NNUE-training path.

## Known limitations

- The Windows desktop application still needs a complete manual run-through on Windows 10 or 11. See [docs/windows-desktop-checklist.md](docs/windows-desktop-checklist.md).
- The desktop application currently searches on the UI thread, so longer searches can temporarily make the window unresponsive.
- UCI `stop` does not yet cancel a native search asynchronously.
- No independent Elo rating has been established for the native C++ engine.
- The reported 0.8.0 benchmark record is based on a Stockfish 19-derived browser build, not an independent strength result for the native C++ engine. See [docs/testing.md](docs/testing.md).

## Project documentation

- [Development notes](docs/development-notes.md)
- [Test results and benchmark methodology](docs/testing.md)
- [Windows desktop checklist](docs/windows-desktop-checklist.md)
- [Website implementation notes](website/README.md)

## Source and permissions

This repository is published for **inspection and review**. No open-source license has been granted for the original Prunex native-engine source or project materials. Unless a separate license is added, all rights to those original materials are reserved; making the repository publicly visible does not grant permission to copy, modify, redistribute, or use them in another project.

Third-party components and assets are governed by their own licenses and notices. See the relevant files under `website/public/` and the website dependency metadata.
