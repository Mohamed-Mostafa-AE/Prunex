# Test results

## Native engine regression tests

The current CTest suite contains 44 cases. The following results are recorded Linux runs:

| Build | Recorded result |
|---|---:|
| GCC 14.2.0 Release | 44/44 passed |
| Clang 17 Release | 44/44 passed |
| GCC Debug with AddressSanitizer and UndefinedBehaviorSanitizer | 44/44 passed |
| GCC static analysis | Completed without diagnostics |

The sanitizer run used leak detection. These results cover the native C++ engine; they do not replace a manual run of the Windows desktop application.

## Test coverage

- Start-position perft and standard reference positions, including Kiwipete and endgame cases.
- Checkmate, stalemate, quiet check evasions, and search regression positions.
- Legal en-passant captures and rejection of pinned en-passant captures for both sides.
- UCI startup, `isready`, ordinary search, `go movetime`, and clock-based time allocation.
- Rejection of malformed FEN input, invalid counters, invalid en-passant states, and invalid perft arguments.

## Historical native-engine match records

The supplied fixed-move-time records for the native **Prunex 0.5.1** engine show these results at 100 ms per move:

| Opponent | Wins | Draws | Losses |
|---|---:|---:|---:|
| Stockfish 4 | 0 | 0 | 64 |
| Stockfish 6 | 0 | 0 | 64 |

These were small match runs, not an Elo test or a controlled SPRT. They should not be used as a general rating estimate.

## Separate browser-build match record

A separate reported 64-game record labelled **Prunex 0.8.0** is **63 wins, 1 draw, and 0 losses** (63.5/64 points, or 99.22%) against Stockfish 2.0 64-bit. The reported match used 1,000,000 nodes per move, 256 MB hash, one thread, and 16 openings played twice with colors reversed.

**Provenance matters:** the 0.8.0 build used for this record is based on Stockfish 19. It is not the native C++ Prunex 0.5.1 engine, and this match result must not be presented as a result achieved by the independently developed native engine.

Applying the inverse Elo expected-score formula to 63.5/64 gives an estimated rating gap of approximately **+842 points**. CCRL lists Stockfish 2.0.1 64-bit at **3,062 Elo**; using that nearby version as a proxy baseline gives a score-derived estimate of approximately **3,904 Elo**. See the [CCRL Stockfish 2.0.1 engine record](https://www.computerchess.org.uk/ccrl/4040/cgi/engine_details.cgi?eng=Stockfish+2.0.1+64-bit).

This is an experimental, score-derived comparison—not an official or independently established rating. The opponent baseline is for Stockfish 2.0.1 rather than the exact Stockfish 2.0 binary, and the match's 1M-nodes-per-move conditions are not CCRL's 40/15 test conditions. It should not be used to claim an Elo rating for the native C++ engine.

## Still to test

- Run the Windows desktop application on Windows 10/11 and complete the [desktop checklist](windows-desktop-checklist.md).
- Check responsiveness during longer searches.
- Test native search cancellation after asynchronous UCI `stop` support is implemented.
- Run a larger, controlled match before making any strength or rating claims.

No independent Elo rating has been established for the native C++ Prunex engine.


## Native search benchmark

Run the fixed five-position native benchmark from a Release build:

```bash
./build/prunex --bench
./build/prunex --bench 6
```

The default depth is 5; accepted depths are 1–10. The suite clears the transposition table and search-ordering state before each position, then reports each best move and node count plus aggregate elapsed time and nodes per second. Use the same compiler, build mode, hardware, and depth when comparing revisions. This is a repeatable search-throughput/regression instrument, not an Elo estimate or proof of playing-strength improvement. It intentionally reports raw measurements rather than claiming a rating.
