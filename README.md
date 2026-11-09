# Prunex

<div align="center">
  <img src="website/public/prunex-mark.png" alt="Prunex mark" width="116" />
  <h2>Independent Chess-Engine Engineering</h2>
  <p><strong>Native C++20 engine · UCI · Windows desktop · Browser chess experience</strong></p>
  <p>
    <a href="https://github.com/Mohamed-Mostafa-AE/Prunex/actions/workflows/native-ci.yml"><img src="https://github.com/Mohamed-Mostafa-AE/Prunex/actions/workflows/native-ci.yml/badge.svg" alt="Native CI" /></a>
    <a href="https://github.com/Mohamed-Mostafa-AE/Prunex/actions/workflows/windows-build.yml"><img src="https://github.com/Mohamed-Mostafa-AE/Prunex/actions/workflows/windows-build.yml/badge.svg" alt="Windows CI" /></a>
    <a href="https://github.com/Mohamed-Mostafa-AE/Prunex/actions/workflows/wasm-ci.yml"><img src="https://github.com/Mohamed-Mostafa-AE/Prunex/actions/workflows/wasm-ci.yml/badge.svg" alt="WebAssembly CI" /></a>
    <a href="https://github.com/Mohamed-Mostafa-AE/Prunex/actions/workflows/codeql.yml"><img src="https://github.com/Mohamed-Mostafa-AE/Prunex/actions/workflows/codeql.yml/badge.svg" alt="CodeQL" /></a>
  </p>
</div>

---

Prunex is an original chess-engine project created and independently developed from scratch by **Mohamed Mostafa**. Its native engine is written in **C++20** and implements its own board representation, legal move generation, search, static evaluation, and Universal Chess Interface (UCI). The repository also includes a Windows desktop interface, a separately built WebAssembly target, regression tests, and a browser chess application.

**Current native engine version: 0.8.0.**

## Project components

| Component | Scope |
|---|---|
| **Native engine** | Independent C++20 implementation; 0x88 board, move generation, search, handcrafted tapered evaluation, and UCI |
| **Windows desktop** | Native GUI linked to the engine implementation |
| **WebAssembly target** | The same C++20 engine compiled with Emscripten; versioned evaluation and time-bounded iterative-deepening search API |
| **Prunex Play** | Browser application for playing and reviewing games; runs the native Prunex 0.8.0 engine compiled to WebAssembly |
| **Offline data tools** | Licensed PGN ingestion, deterministic corpus splitting, provenance manifests, static-evaluation annotation, and calibration diagnostics |

## Native engine architecture

### Board and position representation

- 0x88 mailbox board representation with FEN loading
- Legal move generation with castling, en passant, and all four promotion choices
- Make/undo position transitions and king-safety validation
- Deterministic Zobrist position hashing

### Search

The native engine uses iterative-deepening negamax with alpha–beta pruning and principal-variation search.

Implemented search components include:

- Transposition-table lookup and bound storage
- Hash-move, promotion, killer-move, and history-based ordering, with static-exchange evaluation for capture ordering
- Aspiration windows with widening on fail-low/fail-high
- Late-move reductions with re-search when required
- Quiescence search with check evasions
- Repetition and fifty-move draw handling, plus insufficient-material detection
- Null-move pruning with verification at greater depths for suitable non-PV positions
- Check extensions and mate-distance score normalization
- Time-managed search and UCI cancellation

The implementation is deliberately documented as it exists today; no unsupported claims about a full modern engine feature set or measured playing strength are made.

See the [Prunex native search-kernel diagram and implementation walkthrough](docs/search-kernel.md). Run `python3 tools/visualize_search_kernel.py` to regenerate its standalone SVG from the documented source map.

### Static evaluation

The native evaluator is **handcrafted and tapered**. It combines material values and piece-square/positional terms with middlegame/endgame phase blending. Current terms include:

- Piece activity and centralization
- Pawn advancement, doubled and isolated pawn penalties
- Passed-pawn and connected-pawn bonuses
- Bishop-pair bonus
- King shelter
- Rook-file bonuses

Prunex Play runs the same native C++20 engine through its WebAssembly build. The browser application adds worker orchestration, game-review scheduling, expected-points calibration, move-quality grading, archive integration, and presentation.

## Building the native engine

### Requirements

- CMake 3.20 or newer
- A C++20 compiler
- Windows: Visual Studio 2022 with **Desktop development with C++**
- Linux: GCC or Clang with C++20 support

### Windows — Visual Studio

```powershell
cmake -S . -B build -A x64
cmake --build build --config Release
ctest --test-dir build -C Release --output-on-failure
```

### Linux — GCC

```bash
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build --parallel
ctest --test-dir build --output-on-failure
```

### Linux — Clang

```bash
cmake -S . -B build-clang -DCMAKE_BUILD_TYPE=Release -DCMAKE_CXX_COMPILER=clang++
cmake --build build-clang --parallel
ctest --test-dir build-clang --output-on-failure
```

## Using the engine

Prunex speaks UCI and can be loaded by a UCI-compatible chess GUI.

Start the engine from a terminal:

```bash
./build/prunex
```

Example UCI session:

```text
uci
isready
ucinewgame
position startpos moves e2e4 e7e5
go depth 8
stop
quit
```

The engine also exposes diagnostic commands:

```bash
./build/prunex --perft 4
./build/prunex --perft-fen "<FEN>" 4
./build/prunex --bench
./build/prunex --bench 6
```

The native benchmark reports search throughput for a fixed set of positions, including node counts, elapsed time, and nodes per second. It is a repeatable performance measurement, not a playing-strength rating. Prunex does not publish an Elo rating.

The fixed benchmark contains five positions (starting position, Kiwipete, a rook endgame, a closed-center position, and an open position). It clears the transposition table and search-ordering state before each position, then reports the best move, node count, elapsed time, and aggregate nodes per second. The default depth is 5; supported depths are 1–10.

Benchmark NPS is a repeatable search-throughput measurement, not a playing-strength rating.

## Validation

The native CTest suite contains **47 regression cases** covering perft, move generation, position handling, search outcomes, draw rules, static-exchange evaluation, UCI behaviour, time controls, invalid inputs, and a fixed-position benchmark smoke test.

The current `main` source commit, `715639559b91d0b8b359a5d3e7a2619075c2f144`, was rebuilt and tested locally on 9 November 2026:

| Configuration | Result |
|---|---:|
| GCC 11.5 Release | 47/47 |
| Clang 15.0.7 Release | 47/47 |
| GCC 11.5 AddressSanitizer + UndefinedBehaviorSanitizer | 47/47 |
| Website production build and bundled checks | Passed |

These are fresh local results for the exact source commit. They do not establish Windows x64 validation or production readiness. The GitHub Actions runs associated with this main commit have not yet produced a fully green cross-platform result: the native, Windows x64, and CodeQL workflow conclusions were unsuccessful. A fresh successful run is required before describing the complete CI matrix as passing.

For historical context, the 6 November 2026 release-candidate commit `4bb43dbacb7a8c567c4a0aa0451f4e8e6a561dd9` passed its then-current 46-case matrix. Those results apply to that earlier revision, not the current 47-case source.

- [Historical native compiler matrix and sanitizers](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42280861589)
- [Historical Windows x64 build and desktop smoke](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42280861974)
- [Historical WebAssembly parity](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42280861737)
- [Historical website and Playwright checks](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42280861610)
- [Historical CodeQL analysis](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42280861678)

The automated results are not a production certification or an independently measured playing-strength rating. Manual acceptance on Windows 10/11 client devices remains outstanding.

See [Testing](docs/testing.md) for coverage and methodology.

## WebAssembly

The repository includes an Emscripten build of the native C++ implementation. Its versioned C API exposes FEN evaluation, fixed-depth parity search, time-bounded iterative-deepening search, completed-depth reporting, and node counts. The WebAssembly workflow compares its output with a native reference implementation. Prunex Play loads the generated WebAssembly module in a dedicated worker, so opponent play and game review use the same Prunex 0.8.0 engine implementation as the native application.

## Offline data and evaluation diagnostics

The offline tools under `tools/training/` can:

1. Ingest a licensed PGN corpus and verify its source archive checksum.
2. Filter invalid, unfinished, duplicate, and unsupported-variant games.
3. Split data deterministically by complete game.
4. Write train, validation, and test JSONL files with a provenance manifest.
5. Annotate positions using the native Prunex static evaluator.
6. Fit and report held-out expected-points calibration diagnostics.

These tools do **not** train or create engine weights, or automatically modify the evaluator. A lower calibration loss is not evidence of stronger play. See [Training-data ingestion](docs/training-data-ingestion.md) and [the tool guide](tools/training/README.md).

## Try Prunex Play

- **Public website:** https://prunex-play.vercel.app/
- **Release-candidate preview:** https://prunex-review.vercel.app/

Prunex Play is a separate browser application for playing and reviewing chess games; it runs the native C++ engine compiled to WebAssembly. Game Review uses a configurable analysis-time budget of 3, 10, 15, 20, or 30 seconds per non-terminal position, with 15 seconds as the default. A time budget does not guarantee a fixed search depth or a specific move-quality outcome.

## Project name

The name **Prunex** combines two ideas:

- **PRUN** comes from alpha–beta **PRUNing**.
- **EX** represents **competitive execution**: carrying out the search while accounting for the opponent's possible replies.

This is the intended naming inspiration, not a formally standardized acronym. See [Project-name origin](docs/project-name.md).

## Documentation

- [System architecture](docs/architecture.md)
- [Evaluation architecture](docs/evaluation-intelligence.md)
- [Testing and benchmark methodology](docs/testing.md)
- [Engineering review](docs/engineering-review.md)
- [Development notes](docs/development-notes.md)
- [Training-data ingestion](docs/training-data-ingestion.md)
- [Windows desktop acceptance checklist](docs/windows-desktop-checklist.md)
- [Finalization and release gates](docs/finalization-gates.md)
- [Independent engine-strength development plan](docs/engine-strength-development-plan.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)

## Licensing and third-party notices

Original Prunex contributions in this repository are released under the **MIT License**. The license scope and separately licensed components are documented in [LICENSE-SCOPE.md](LICENSE-SCOPE.md).

The Python training tools are separately licensed under GPL-3.0-or-later. Chess-piece artwork, dependencies, and datasets also retain their own applicable licenses, attribution, and corresponding-source notices. See [website/README.md](website/README.md), [tools/training/LICENSE](tools/training/LICENSE), and the notices distributed with the site. The root MIT license does not relicense separately licensed material.

---

<div align="center">
  <sub>Build carefully. Measure honestly. Improve continuously.</sub>
</div>
