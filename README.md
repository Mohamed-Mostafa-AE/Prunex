# Prunex

## Project name

**Prunex** is the project's name; the available source history does not record a verified acronym expansion. The engine implements alpha–beta pruning, but that alone does not establish that `PRUN` is an expansion of the name, and no documented meaning for `EX` was found. The project therefore uses **Prunex** as a proper name rather than publishing an unverified expansion.

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

The CTest suite currently contains 46 cases, including a native benchmark smoke test. The latest Windows x64 run passed all 46 tests. Recorded Linux runs passed with GCC Release, Clang Release, and GCC AddressSanitizer/UndefinedBehaviorSanitizer. A GCC static-analysis run completed without diagnostics. These are recorded results, not a claim that every platform or the Windows desktop interface has been fully tested.

Run `./build/prunex --bench` for the fixed five-position native search benchmark (default depth 5), or pass a depth from 1–10. See [docs/testing.md](docs/testing.md) for benchmark methodology and limitations.

## Try the website

**Website:** https://prunex-play.vercel.app/

The browser demo is a separate web experience. It uses Stockfish.js 19 Full (multi-threaded) as its opponent and analysis engine; it does not run the native C++ Prunex engine. The third-party engine and chess-piece artwork retain their own licenses and notices in `website/public/`.

## Browser engine and evaluation

The browser experience is branded **Prunex Play** and uses **Stockfish.js 19 Full (multi-threaded)** as its underlying UCI engine. The Prunex-owned layer handles browser integration, review orchestration, expected-points interpretation, move classifications, and the Prunex Apex criteria. It does not claim the upstream engine or NNUE network as original Prunex code. GPLv3 attribution, license, and corresponding-source information are retained in the website build. The full browser build is approximately 94 MB and uses cross-origin isolation to enable shared-memory multithreading.

Game Review defaults to a 15-second search budget per non-terminal position. This is a time budget, not a guaranteed depth. See [Evaluation Intelligence](docs/evaluation-intelligence.md) for calibration training, validation, benchmarking, and the separate upstream NNUE-training path.

## Known limitations

- The Windows desktop application still needs a complete manual run-through on Windows 10 or 11. See [docs/windows-desktop-checklist.md](docs/windows-desktop-checklist.md).
- The Windows desktop application runs engine searches on a background thread and applies completed results on the UI thread. Search cancellation and shutdown paths are implemented; interactive Windows 10/11 acceptance is still required for rendering, input, resizing and lifecycle behavior.
- No independent Elo rating has been established for the native C++ engine.
- The archived historical Stockfish 2.0 match belongs to a separately identified Stockfish 19-derived Prunex 0.8.0 test executable, not the independent native C++20 engine: 62 wins, 2 draws and 0 losses in 64 games (98.44%) at 100,000 nodes per move. The raw PGN and run artifact are linked in [the evidence record](docs/stockfish-2-comparison.md). The separate 1M-node 63–1–0 result is owner-reported and not independently audited from raw games. No native C++ Prunex Elo rating is claimed.

## Project documentation

- [Development notes](docs/development-notes.md)
- [Test results and benchmark methodology](docs/testing.md)
- [Windows desktop checklist](docs/windows-desktop-checklist.md)
- [Training-data sourcing and ingestion policy](docs/training-data-ingestion.md)
- [Website implementation notes](website/README.md)
- [Production readiness and release checklist](docs/production-readiness.md)

## Licensing

The original Prunex native C++ implementation and its native regression tests are released under the **Apache License 2.0**, with scope defined in [LICENSE](LICENSE) and [LICENSE-SCOPE.md](LICENSE-SCOPE.md). The license does not relicense third-party dependencies, bundled browser-engine code, or artwork.

The browser demonstration contains separately licensed third-party components. Its browser engine distribution remains under GPLv3, and the Cburnett piece artwork remains under the license identified in `website/public/pieces/`. Their corresponding source links, notices, and license texts must remain with every distributed browser build. See [website/README.md](website/README.md) and the license notice in the site footer.

Other repository materials not listed in the Apache-2.0 scope remain reserved unless an applicable license or notice says otherwise.
