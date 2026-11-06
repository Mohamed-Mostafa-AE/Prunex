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

## Archived benchmark records

A historical match artifact is retained for source provenance, reproducibility and audit. It is not evidence of the native C++20 engine's playing strength and is not used to support a native-engine rating claim. The original records, configuration, checksums and limitations are kept in the [archived benchmark evidence report](stockfish-2-comparison.md).

No independently measured Elo rating has been established for the native C++ Prunex engine.

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
