# Prunex

**An independently developed chess-engine project, built around a native C++20 engine and a separate browser chess experience.**

Prunex focuses on search, evaluation, and the engineering required to make a chess engine testable and usable across different environments.

## Architecture

| Component | Description |
| --- | --- |
| **Native engine** | Independent C++20 implementation with its own board representation, legal move generation, search, evaluation, and UCI interface. |
| **Prunex Play** | Separate browser application for playing and reviewing chess games, with NNUE-based position evaluation. |
| **Desktop interface** | Windows GUI for the native engine. |
| **Engineering infrastructure** | CMake builds, regression tests, GitHub Actions, WebAssembly parity checks, and release documentation. |

The two engine paths are distinct. The native C++ engine currently uses handcrafted tapered evaluation; NNUE is used by the separate browser experience. The browser application adds the Prunex-specific worker orchestration, review pipeline, expected-points calibration, move-quality grading, archive integration, and presentation.

## Native engine

The C++20 engine includes:

- 0x88 board representation and FEN position loading
- Legal move generation, including castling, en passant, and promotion
- Zobrist hashing and a transposition table
- Iterative-deepening negamax alpha–beta search and principal-variation search
- Aspiration windows, move ordering, late-move reductions, and quiescence search
- Handcrafted tapered middlegame/endgame evaluation
- UCI command handling and time controls

The current native engine release is **Prunex 0.8.0**.

## Build

### Windows

Requirements: Visual Studio 2022 with **Desktop development with C++**, and CMake 3.20 or newer.

```powershell
cmake -S . -B build -A x64
cmake --build build --config Release
ctest --test-dir build -C Release --output-on-failure
```

### Linux

Requirements: a C++20 compiler and CMake 3.20 or newer.

```bash
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build --parallel
ctest --test-dir build --output-on-failure
```

## Validation

The 46-case native regression suite passed in each of four CI configurations: GCC Release, Clang Release, GCC AddressSanitizer/UndefinedBehaviorSanitizer, and Windows x64. The Windows workflow also passed its desktop interaction smoke test.

The following results were recorded for release-candidate commit `4bb43dbacb7a8c567c4a0aa0451f4e8e6a561dd9`:

| Workflow | Result |
| --- | --- |
| [Website, Playwright, and training-data checks](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42280861610) | Passed |
| [Native GCC/Clang and sanitizer matrix](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42280861589) | Passed — 46/46 in all four configurations |
| [Windows x64 and desktop smoke test](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42280861974) | Passed |
| [WebAssembly parity](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42280861737) | Passed |
| [Backup-tool validation](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42280861766) | Passed — tooling validation only |
| [CodeQL analysis](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42280861678) | Queued at the time of this update |

These are CI results for the release-candidate branch, not a claim of production certification. In particular, backup-tool validation is not a data-bearing backup-and-restore test, and manual acceptance on Windows 10/11 client devices remains outstanding.

Run `./build/prunex --bench` for the fixed five-position native search benchmark (default depth 5; supported depths 1–10). See [Testing](docs/testing.md) for methodology and limitations.

## Try Prunex Play

- **Public website:** https://prunex-play.vercel.app/
- **Release-candidate preview:** https://prunex-review.vercel.app/

Prunex Play is a separate browser application; it does not execute the native C++ engine. Game Review uses a configurable search-time budget of 3, 10, 15, 20, or 30 seconds per non-terminal position, with 15 seconds as the default. A time budget does not guarantee a fixed search depth or accuracy level.

## Documentation

- [Project-name origin](docs/project-name.md)
- [Evaluation architecture and calibration](docs/evaluation-intelligence.md)
- [Engineering review](docs/engineering-review.md)
- [Test results and benchmark methodology](docs/testing.md)
- [Production readiness and release status](docs/production-readiness.md)
- [Windows desktop acceptance checklist](docs/windows-desktop-checklist.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)
- [Website implementation and third-party notices](website/README.md)

## Licensing

The original native C++ implementation and native regression tests are released under the **Apache License 2.0**, with scope defined in [LICENSE](LICENSE) and [LICENSE-SCOPE.md](LICENSE-SCOPE.md).

The browser application contains separately licensed third-party components and artwork. Their licenses, attribution, and corresponding-source notices remain applicable; see [website/README.md](website/README.md) and the notices distributed with the site. The root Apache-2.0 license does not relicense those components.

