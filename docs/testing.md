# Test results

## Native engine regression tests

The current Prunex 0.8.0 CTest suite contains 46 cases, including the native benchmark smoke test. On 6 November 2026, CI passed all 46 cases in GCC 14.2 Release, Clang 17 Release, GCC AddressSanitizer/UndefinedBehaviorSanitizer, and Windows x64 builds.

| Build | Recorded result |
|---|---:|
| GCC 14.2 Release | 46/46 passed |
| Clang 17 Release | 46/46 passed |
| GCC Debug with AddressSanitizer and UndefinedBehaviorSanitizer | 46/46 passed |
| Windows x64 | 46/46 passed |
| GCC static analysis | Earlier 44-case run completed without diagnostics |

The sanitizer run used leak detection. These results cover the native C++ engine; they do not replace a manual run of the Windows desktop application.

## Test coverage

- Start-position perft and standard reference positions, including Kiwipete and endgame cases.
- Checkmate, stalemate, quiet check evasions, and search regression positions.
- Legal en-passant captures and rejection of pinned en-passant captures for both sides.
- UCI startup, `isready`, ordinary search, `go movetime`, and clock-based time allocation.
- Rejection of malformed FEN input, invalid counters, invalid en-passant states, and invalid perft arguments.
- Website Playwright checks for desktop/mobile layout, account recovery placement, password visibility, and Chromium's actual address-autofill state through the DevTools Autofill protocol.

## Historical native-engine match records

The supplied fixed-move-time records for the native **Prunex 0.5.1** engine show these results at 100 ms per move:

| Opponent | Wins | Draws | Losses |
|---|---:|---:|---:|
| Stockfish 4 | 0 | 0 | 64 |
| Stockfish 6 | 0 | 0 | 64 |

These were small match runs, not an Elo test or a controlled SPRT. They should not be used as a general rating estimate.

## Historical Stockfish 2.0 comparison — separate Stockfish-derived test build

A historical test executable labelled **Prunex 0.8.0 (Stockfish 19-derived)** completed an archived 64-game GitHub Actions match against Stockfish 2.0 built from the official `sf_2.0` source tag:

| Wins | Draws | Losses | Points | Score |
|---:|---:|---:|---:|---:|
| 62 | 2 | 0 | 63 / 64 | 98.44% |

The archived run used 100,000 nodes per move, 128 MB hash per engine, one thread per engine, 16 openings played twice with colours reversed, and 32 games per colour. The complete PGN and JSON summary are in the [successful GitHub Actions run and retained artifact](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/41253517143). See the [full evidence record](stockfish-2-comparison.md) for build lineage, exact configuration, two draw games, artifact/file SHA-256 checksums, and limitations.

**This was a Stockfish 19-derived test executable, not the independently implemented native C++20 Prunex engine.** It does not establish a native-engine Elo rating. The current website browser engine is a separately packaged Stockfish.js build; it is not claimed to be byte-identical to the historical test executable.

A separate owner-reported 1,000,000-nodes-per-move run is documented as 63 wins, 1 draw and 0 losses (99.22%), but its raw PGN/JSONL was not in the archived Actions artifact and it has not been independently recounted. It is not combined with the verified 62–2–0 score above.

## Still to test

- Run the Windows desktop application on Windows 10/11 and complete the [desktop checklist](windows-desktop-checklist.md).
- Check responsiveness during longer searches.
- Add an explicit UCI `stop`-command cancellation regression case; the command is implemented, but the current timed-search tests do not exercise an interrupted search.
- Run a larger, controlled match before making any strength or rating claims.

No independent Elo rating has been established for the native C++ Prunex engine.


## Native search benchmark

Run the fixed five-position native benchmark from a Release build:

```bash
./build/prunex --bench
./build/prunex --bench 6
```

The default depth is 5; accepted depths are 1–10. The suite clears the transposition table and search-ordering state before each position, then reports each best move and node count plus aggregate elapsed time and nodes per second. Use the same compiler, build mode, hardware, and depth when comparing revisions. This is a repeatable search-throughput/regression instrument, not an Elo estimate or proof of playing-strength improvement. It intentionally reports raw measurements rather than claiming a rating.
