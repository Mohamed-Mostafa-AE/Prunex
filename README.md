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

## Historical Stockfish 2.0 comparison

A 64-game local run reported on 2026-11-01 recorded **Prunex 0.8.0 (Stockfish 19-derived)** at 63 wins, 1 draw, and 0 losses against a Stockfish 2.0 64-bit opponent (63.5/64 points; 99.22%). The run used 1,000,000 nodes per move, 256 MB hash per engine, one thread per engine, 16 openings, two repetitions, and 32 games with each colour.

The opponent executable's local UCI identification was `Stockfish 2.0 64bit`, with authors Tord Romstad, Marco Costalba, and Joona Kiiski. Its `bench` command returned **7,224,363 nodes**, matching the signature documented in the [Stockfish 2.0 release announcement](https://stockfishchess.org/blog/2011/stockfish-2/). Its locally measured SHA-256 was `760f9c7435b4f498d0188b9ae5b81d6a92636328a932c020fb338a93195bcff2`. These checks give a strong practical version/build fingerprint, not cryptographic publisher authentication or independent proof of download provenance.

### Indicative Elo translation — not an official rating

The closest published CCRL reference identified for this historical release family is **Stockfish 2.0.1 at 3,062 ±19 Elo** on the CCRL 40/15 list. This is a nearby patch release and a reference point, not a published rating for the exact Stockfish 2.0 binary used in the match. See the [CCRL engine entry](https://www.computerchess.org/cgi/engine_details.cgi?engine=Stockfish+2.0.1+64-bit).

Using the reported score of 63.5/64 (99.21875%), the standard Elo score conversion gives an indicative rating difference of approximately **+842 Elo**:

`400 × log10((63.5 / 64) / (0.5 / 64)) ≈ 841.5`

Adding that difference to the 3,062 reference gives a match-implied figure of approximately **3,904**. This is a mathematical projection from one 64-game result, **not an official Prunex Elo rating**. The CCRL reference uses a different time control, hardware and opponent pool from this 1,000,000-nodes-per-move match; rating values from different pools are not directly interchangeable. The [Stockfish FAQ](https://official-stockfish.github.io/docs/stockfish-wiki/Stockfish-FAQ.html#the-elo-rating-of-stockfish) explains why engine Elo requires controlled conditions and substantial game samples.

**Important:** This comparison tests the reported **Prunex 0.8.0 Stockfish 19-derived build**. It is **not** a result for the independently implemented Prunex 0.5.1 C++20 source described above. The 99.22% result and 3,904 projection must not be attributed to the independent 0.5.1 engine.

See the [benchmark report](benchmarks/stockfish-2.0/README.md) and the [verification record](benchmarks/stockfish-2.0/verification.json). The original PGN and JSONL game records remain on the project owner's computer and have not been added to this repository, so the 64 individual games have not been independently audited here.

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
