# Prunex 0.5.1 Test Report

## Engine search

The 0.5.0 search core adds a Zobrist-keyed transposition table, iterative deepening, aspiration windows, principal-variation search, hash/MVV-LVA/killer/history move ordering, late-move reductions, and tapered positional evaluation with piece-square activity, bishop-pair value, pawn-structure terms, passed-pawn bonuses, and rook-file bonuses.

Version 0.5.1 adds UCI move-time and clock-based search using `go movetime`, `go wtime/btime`, `winc/binc`, and `movestogo`. Deadline checks occur during recursive search; when the budget expires, the engine returns the best move from the last fully completed iterative-deepening iteration.

## Automated validation

- GCC 14.2.0 Release build: 44/44 CTest cases passed.
- Clang 17 Release build: 44/44 CTest cases passed.
- GCC AddressSanitizer + UndefinedBehaviorSanitizer Debug build: 44/44 CTest cases passed with leak detection enabled.
- GCC 14.2 static analysis with `-fanalyzer`: no diagnostics.
- Search tests cover checkmate/stalemate at the quiescence horizon, quiet check evasions, mate-in-one selection, make/undo Zobrist-key restoration, and transposition-table reuse.
- Move-generation tests cover the start position, Kiwipete, and standard perft positions 3–6.
- FEN, CLI, and en-passant tests cover malformed counters, overflow, duplicate castling rights, invalid en-passant states, legal captures, and pinned-capture rejection.
- UCI tests verify ordinary depth search, `go movetime`, and clock-based time allocation.

## Search-efficiency comparison

A local Release comparison on the initial position at fixed depth 5 recorded 275,040 searched nodes in version 0.4.3 and 3,725 nodes in version 0.5.0, with a reported score of +18 centipawns in both runs. This is one-position node-count data, not an Elo measurement or evidence of match superiority.

## Competitive benchmark results

A completed fixed-move-time tournament played 64 games against each official Stockfish build, using 16 opening positions repeated twice with both colors for Prunex. Both engines used one search thread and 100 ms per move.

| Opponent | Prunex wins | Draws | Prunex losses | Score |
|---|---:|---:|---:|---:|
| Stockfish 4 | 0 | 0 | 64 | 0% |
| Stockfish 6 | 0 | 0 | 64 | 0% |

All 128 games ended with a checkmate. The mean game lengths were 58.22 plies against Stockfish 4 and 60.97 plies against Stockfish 6. The benchmark artifacts include complete PGNs and JSON summaries.

Prunex 0.5.1 did not beat Stockfish 4 or Stockfish 6 under these settings. These results indicate that its playing strength remains substantially below both opponents at the tested 100 ms per move; they are not an Elo rating or a controlled SPRT estimate.

## Remaining limitations

- The Win32 GUI still searches synchronously on the UI thread.
- No Elo rating has been established.
- No large-scale SPRT or long-run self-play result has been produced.
- No PGN import/export, opening book, endgame tablebases, or configurable hash size is implemented.
