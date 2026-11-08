# Prunex

Prunex is an independently developed chess-engine project. Its native engine is written in **C++20** and includes its own board representation, position handling, legal move generation, search, evaluation, and UCI interface. The repository also contains a Windows desktop interface, regression tests, and a separate website with a browser chess demo.

**Current version: 0.8.0**

## Project components

| Path | Description |
| --- | --- |
| `src/main.cpp` | Native C++20 engine and UCI command-line interface |
| `src/gui.cpp` | Windows desktop interface |
| `tests/` | Native engine regression tests |
| `website/` | Vite website and browser chess demo powered by Prunex |
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

The current project version is **0.8.0**.

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

The CTest suite currently contains 44 cases. Recorded Linux runs passed with GCC Release, Clang Release, and GCC AddressSanitizer/UndefinedBehaviorSanitizer. A GCC static-analysis run completed without diagnostics.

Prunex also underwent a historical competitive test against **Stockfish 2.0**, recording a result of **63.5–1–0** in Prunex's favour. This result is retained as a historical benchmark and should not be interpreted as an independently established Elo rating for the current native C++ engine.

These are recorded results, not a claim that every platform or the Windows desktop interface has been fully tested.

See [docs/testing.md](docs/testing.md) for the test coverage, benchmark provenance, and limitations.

## Try the website

**Website:** [https://prunex-play.vercel.app/](https://prunex-play.vercel.app/)

The website includes a browser-based chess demo powered by Prunex 0.8.0. It provides an interactive chess experience through the browser, alongside the native C++ implementation.

## Known limitations

- The Windows desktop application still needs a complete manual run-through on Windows 10 or 11. See [docs/windows-desktop-checklist.md](docs/windows-desktop-checklist.md).
- The desktop application currently searches on the UI thread, so longer searches can temporarily make the window unresponsive.
- UCI `stop` does not yet cancel a native search asynchronously.
- No independent Elo rating has been established for the native C++ engine.

## Project documentation

- [Development notes](docs/development-notes.md)
- [Test results and benchmark methodology](docs/testing.md)
- [Windows desktop checklist](docs/windows-desktop-checklist.md)
- [Website implementation notes](website/README.md)

## Source and permissions

This repository is published for **inspection and review**. No open-source license has been granted for the original Prunex native-engine source or project materials. Unless a separate license is added, all rights to those original materials are reserved; making the repository publicly visible does not grant permission to copy, modify, redistribute, or use them in another project.

Third-party components and assets are governed by their own licenses and notices. See the relevant files under `website/public/` and the website dependency metadata.

### Development Status

Prunex is currently in an active development and improvement phase. Its implementation, testing, and documentation are still evolving. Public availability for modification, contribution, or redistribution is not currently authorized. Licensing and contribution arrangements may be revised when the project reaches a more mature stage.
