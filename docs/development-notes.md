# Development notes

## What is in the project

Prunex is a C++20 chess engine with a native Windows interface and a UCI command-line interface. The engine code covers board state, legal moves, search, position evaluation, and communication with chess interfaces.

The website has a separate browser chess demo. It uses chess.js for the browser game and Stockfish.js Lite as the demo opponent. Neither is part of the native Prunex engine.

## Work completed

- Implemented the engine's board and position representation.
- Added legal move generation and handling for castling, en passant, and promotion.
- Added the search and evaluation routines.
- Added UCI commands, time controls, and background search execution.
- Added atomic search cancellation; UCI `stop`, `position`, `ucinewgame`, replacement `go`, and `quit` now stop and join active searches safely.
- Added a Windows desktop interface.
- Added regression tests for rules, search positions, and UCI behavior.
- Added a website with an interactive browser demonstration.

## Known areas to improve

1. Move desktop search off the UI thread so the window stays responsive during longer searches.
2. Move desktop search off the UI thread so the window stays responsive during longer searches.
3. Finish a manual Windows 10/11 test of the desktop interface.
4. Decide on a license for the native engine before distributing its source publicly.

## Suggested review order

Start with move generation and make/undo behavior. Then review evaluation and search. Finish with UCI input, time management, and the Windows interface.
