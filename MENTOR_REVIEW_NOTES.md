# Prunex 0.5.1 — mentor review notes

## Project identity

Prunex 0.5.1 is the independent C++20 chess-engine implementation. Its board representation, position handling, legal move generation, search, evaluation, and UCI interface are implemented in the project source rather than taken from Stockfish.

The browser site at https://prunex-play.vercel.app/ is a separate interactive demo and uses Stockfish.js 19 Lite as its browser opponent. It is not the independent Prunex search core.

## Cleanup completed

- Standardized formatting in the C++ engine and regression test files using the checked-in `.clang-format` rules.
- Added a small number of comments around non-obvious implementation decisions.
- Removed the optional external model-review utility and associated dependency files from the cleaned source package.
- Removed the old 0.4.3 archive from the active source package.
- Kept the Stockfish 4/6 benchmark outcome visible and documented.
- Updated project documentation to separate engine provenance, browser-demo provenance, and measured results.
- Replaced the previous project artwork with the supplied Prunex logo.

## Verified on Linux

- GCC 14.2.0 Release: 44/44 CTest cases passed.
- Clang 17 Release: 44/44 CTest cases passed.
- GCC ASan/UBSan Debug with leak detection: 44/44 CTest cases passed.
- GCC `-fanalyzer`: no diagnostics.

## Engineering work remaining

1. Move Windows GUI engine search off the UI thread and return completed search results safely to the UI thread.
2. Implement asynchronous UCI search cancellation so `stop` can interrupt an active search.
3. Build and manually test the GUI on Windows 10/11.
4. Keep the browser site explicit that Stockfish.js is its demo opponent, not the independent Prunex 0.5.1 engine.
5. Choose and add a license before public redistribution of the independent engine.

## Suggested mentor review order

Review move generation and make/undo correctness first, then evaluation and search, and finally UCI input and time management. Ask for a Windows GUI demonstration after the responsiveness work is addressed.
