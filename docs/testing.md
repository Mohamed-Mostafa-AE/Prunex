# Test results

## Regression tests

The current CTest suite contains 44 cases. The following results are from recorded Linux runs:

| Build | Result |
|---|---:|
| GCC 14.2.0 Release | 44/44 passed |
| Clang 17 Release | 44/44 passed |
| GCC Debug with AddressSanitizer and UndefinedBehaviorSanitizer | 44/44 passed |
| GCC static analysis | Completed without diagnostics |

The sanitizer run used leak detection. These results cover the native engine and do not replace a manual run of the Windows desktop application.

## What the tests cover

- Start-position perft and standard reference positions, including Kiwipete and endgame cases.
- Checkmate, stalemate, quiet check evasions, and search regression positions.
- Legal en-passant captures and rejection of pinned en-passant captures for both sides.
- UCI startup, `isready`, ordinary search, `go movetime`, and clock-based time allocation.
- Rejection of malformed FEN input, invalid counters, invalid en-passant states, and invalid perft arguments.

## Recorded engine matches

The supplied fixed-move-time records for Prunex 0.5.1 show these results at 100 ms per move:

| Opponent | Wins | Draws | Losses |
|---|---:|---:|---:|
| Stockfish 4 | 0 | 0 | 64 |
| Stockfish 6 | 0 | 0 | 64 |

These were small match runs, not an Elo test or a controlled SPRT. They should not be used as a general rating estimate.

## Prunex 0.8.0 vs Stockfish 2.0

The reported 64-game match record is **63 wins, 1 draw, and 0 losses** (63.5/64 points, or 99.22%) against Stockfish 2.0 64-bit. The match used 1,000,000 nodes per move, 256 MB hash, one thread, and 16 openings played twice with colors reversed.

Applying the inverse Elo expected-score formula to 63.5/64 gives an estimated rating gap of approximately **+842 points**. CCRL lists Stockfish 2.0.1 64-bit at **3,062 Elo**; using that nearby version as a proxy baseline gives a score-derived estimate of approximately **3,904 Elo**. See the [CCRL Stockfish 2.0.1 engine record](https://www.computerchess.org/cgi/engine_details.cgi?engine=Stockfish+2.0.1+64-bit).

This is an experimental estimate, not an official or independently established rating. The opponent baseline is for Stockfish 2.0.1 rather than the exact Stockfish 2.0 binary, and the match's 1M-nodes-per-move conditions are not CCRL's 40/15 test conditions. The benchmarked Prunex 0.8.0 build is based on Stockfish 19; this provenance must be considered when interpreting the result.

## Still to test

- Run the Windows desktop application on Windows 10/11 and complete the [desktop checklist](windows-desktop-checklist.md).
- Check responsiveness during longer searches.
- Test search cancellation after asynchronous `stop` support is implemented.
- Run a larger, controlled match before making any strength or rating claims.

No independent Elo rating has been established for the native Prunex engine; the score-derived estimate above is a separate experimental comparison and must not be presented as an official rating.
