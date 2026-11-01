# Prunex 0.5.1 test report

## Current verification

The cleaned source was rebuilt and the full CTest suite was rerun in the current Linux environment.

| Configuration | Result |
|---|---:|
| GCC 14.2.0 Release | 44/44 passed |
| Clang 17 Release | 44/44 passed |
| GCC Debug with AddressSanitizer and UndefinedBehaviorSanitizer | 44/44 passed |
| GCC `-fanalyzer` build | Completed without diagnostics |

The sanitizer run used leak detection. These results do not replace native Windows GUI testing.

## Test coverage

The 44 CTest cases cover:

- Start-position perft and standard reference positions, including Kiwipete and endgame cases.
- Checkmate, stalemate, quiet check evasions, and search regression positions.
- Legal en-passant captures and rejection of pinned en-passant captures for both sides.
- UCI startup, `isready`, ordinary search, `go movetime`, and clock-based time allocation.
- Rejection of malformed FEN input, invalid counters, invalid en-passant states, and invalid perft arguments.

## Historical match results

The supplied fixed-move-time match records show the following results for Prunex 0.5.1:

| Opponent | Wins | Draws | Losses | Score |
|---|---:|---:|---:|---:|
| Stockfish 4 | 0 | 0 | 64 | 0% |
| Stockfish 6 | 0 | 0 | 64 | 0% |

These matches used 100 ms per move. They are not an Elo measurement, a controlled SPRT, or evidence that Prunex is stronger than either opponent.

## Known limitations and tests still required

- The Windows GUI still searches synchronously on the UI thread. Long searches can make the window temporarily unresponsive.
- The UCI `stop` command is not implemented as asynchronous cancellation.
- The Windows GUI has not been manually exercised on a Windows 10/11 desktop as part of this Linux verification.
- The separate online website uses Stockfish.js 19 as its browser opponent; browser website tests do not measure the independent native engine's strength.
- No independent Elo rating, large-scale SPRT, or long-running self-play result is available.
- The independent engine has no standalone project license in the supplied source package.
