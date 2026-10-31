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

## Competitive benchmark status

No Stockfish 4 or Stockfish 6 match result is claimed yet. A GitHub Actions workflow now builds the official `sf_4` and `sf_6` source tags and runs 64 color-balanced games against each opponent at 100 ms per move, with one search thread per engine. It stores PGNs and JSON score summaries as workflow artifacts. The benchmark must run against the 0.5.1 package before a result can be reported.

## Remaining limitations

- The Win32 GUI still searches synchronously on the UI thread.
- No Elo rating has been established.
- No large-scale SPRT or long-run self-play result has been produced.
- No PGN import/export, opening book, endgame tablebases, or configurable hash size is implemented.
