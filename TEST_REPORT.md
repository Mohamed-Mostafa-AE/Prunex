# Prunex 0.5.0 Test Report

## Engine search changes

The 0.5.0 search implementation adds a Zobrist-keyed transposition table, iterative deepening, aspiration windows, principal-variation search, hash/MVV-LVA/killer/history move ordering, and late-move reductions. Evaluation now blends middle-game and endgame scores and includes piece-square activity, bishop-pair value, doubled and isolated pawn penalties, passed-pawn bonuses, and rook-file bonuses.

A local Release comparison on the initial chess position at fixed depth 5 recorded 275,040 searched nodes in the original 0.4.3 search and 3,725 nodes in the 0.5.0 search. The score at that depth was +18 centipawns in both runs. This is a single-position node-count comparison, not an Elo measurement or a claim about match results.

## Automated validation

- GCC 14.2.0 Release build completed successfully.
- Release CTest suite: 42/42 passed.
- GCC AddressSanitizer/UndefinedBehaviorSanitizer Debug build: 42/42 passed, with leak detection enabled.
- Clang 17 Release build: 42/42 passed.
- GCC 14.2 static analysis with `-fanalyzer`: no diagnostics.
- Search regressions verify checkmate and stalemate at the quiescence horizon, quiet check evasions, mate-in-one selection, make/undo Zobrist-key restoration, and transposition-table reuse.
- Existing perft coverage verifies the start position, Kiwipete, endgame position 3, and standard positions 4–6.
- Existing FEN and CLI tests cover malformed and overflowed move counters, duplicate castling rights, invalid en-passant state, invalid perft depths, and divide depth zero.
- En-passant tests cover legal captures for both colors and reject pinned captures that expose the king.

## Remaining validation

- No official Elo measurement has been completed. A repeatable SPRT or similarly controlled engine match against fixed opponents and time controls is needed to quantify playing-strength change.
- Search strength has not yet been validated across a large tactical suite or long self-play match set.
- Windows CI for the earlier 0.4.3 package passed, but the 0.5.0 Windows build must pass separately after the updated package is committed.
- The Win32 GUI still searches synchronously on the UI thread.
- No PGN handling, time-managed UCI search, opening book, endgame tablebases, or configurable hash size is implemented.
