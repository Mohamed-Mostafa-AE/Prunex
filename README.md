# Prunex

## Project name

The name **Prunex** brings together two ideas from the project's naming origin: **PRUN**, referring to alpha–beta pruning, and **EX**, referring to competitive execution. This records the intended inspiration behind the name; it is not a formal acronym or a separate technical specification.

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

The current native engine release is **Prunex 0.8.0**. The CMake project version, UCI identification string, and Windows validation manifest are aligned to this release.

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

The CTest suite currently contains 46 cases, including a native benchmark smoke test. On 6 November 2026, GCC Release, Clang Release, GCC AddressSanitizer/UndefinedBehaviorSanitizer, and Windows x64 CI each passed all 46 tests. An earlier GCC static-analysis run completed without diagnostics. These are recorded results, not a claim that every platform or the Windows desktop interface has been fully tested.

Run `./build/prunex --bench` for the fixed five-position native search benchmark (default depth 5), or pass a depth from 1–10. See [docs/testing.md](docs/testing.md) for benchmark methodology and limitations.

## Try the website

**Website:** https://prunex-play.vercel.app/

**Prunex Play** is a separate browser application; it does not execute the native C++ engine. Its opponent and review pipeline use the Stockfish.js 19 Full multi-threaded browser build. The site uses `chess.js` for browser game rules. Third-party browser components retain their own licenses and corresponding-source notices in `website/public/`. Cross-origin isolation enables shared-memory multithreading.

Game Review uses a 15-second search budget per non-terminal position. This is a time budget, not a guaranteed search depth. See [Evaluation Intelligence](docs/evaluation-intelligence.md) for calibration, validation and benchmarking details.

## Known limitations

- The Windows desktop application still needs a complete manual run-through on Windows 10 or 11. See [docs/windows-desktop-checklist.md](docs/windows-desktop-checklist.md).
- The Windows desktop application runs engine searches on a background thread and applies completed results on the UI thread. Search cancellation and shutdown paths are implemented; interactive Windows 10/11 acceptance is still required for rendering, input, resizing and lifecycle behavior.
- No independently measured Elo rating has been established for the native C++20 engine. Strength claims require a separate, reproducible match series with balanced colours, fixed conditions, retained game records and independently checked results.

## Project documentation

- [Development notes](docs/development-notes.md)
- [Project-name origin](docs/project-name.md)
- [Test results and benchmark methodology](docs/testing.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)
- [Windows desktop checklist](docs/windows-desktop-checklist.md)
- [Training-data sourcing and ingestion policy](docs/training-data-ingestion.md)
- [Website implementation notes](website/README.md)
- [Production readiness and release checklist](docs/production-readiness.md)

## Licensing

The original Prunex native C++ implementation and its native regression tests are released under the **Apache License 2.0**, with scope defined in [LICENSE](LICENSE) and [LICENSE-SCOPE.md](LICENSE-SCOPE.md). The license does not relicense third-party dependencies, bundled browser-engine code, or artwork.

The browser demonstration contains separately licensed third-party components. Its browser engine distribution remains under GPLv3, and the Cburnett piece artwork remains under the license identified in `website/public/pieces/`. Their corresponding source links, notices, and license texts must remain with every distributed browser build. See [website/README.md](website/README.md) and the license notice in the site footer.

Other repository materials not listed in the Apache-2.0 scope remain reserved unless an applicable license or notice says otherwise.
