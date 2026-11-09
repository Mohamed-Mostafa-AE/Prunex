# Development notes

## Project structure

Prunex 0.8.0 is the native C++20 chess engine and Windows desktop application, with a UCI command-line interface. The engine code covers board state, legal move generation, search, static evaluation, and UCI communication.

The website is a separate browser chess experience. Its opponent and review worker use the native Prunex 0.8.0 C++20 engine compiled to WebAssembly.

## Implemented foundations

- 0x88 position representation, legal move generation, castling, en passant, promotions, FEN parsing, and make/undo behavior.
- Iterative-deepening alpha-beta/PVS search, move ordering, transposition table, quiescence search, repetition and fifty-move draw handling, insufficient-material detection, null-move pruning with verification at greater depths, time controls, and asynchronous UCI search cancellation.
- Native static evaluation terms and a repeatable five-position benchmark command.
- Native regression coverage for perft, move legality, search outcomes, side-to-move scoring, evaluation symmetry, and interrupted search.
- Asynchronous Windows desktop search with UI-thread result application, cancellation on new game/undo/window close, and stale-result generation checks.
- A native WebAssembly build target using the same C++ implementation, a small C API, and a five-position parity test for static evaluation, best moves, and node counts.
- Browser game/review/archive features, explicit sharing controls, account recovery/deletion, and optional shared position-memory retrieval.
- Offline PGN corpus ingestion, provenance manifests, native static-evaluation annotation, and held-out diagnostic calibration tooling.
- CI validation for Windows x64, Linux GCC/Clang, sanitizers, native/WASM parity, website builds/browser smoke tests, dependency audits, and CodeQL analysis.

## Remaining engineering work

1. Complete visual Windows 10/11 desktop acceptance for 100%/150% DPI scaling, promotion choices, physical pointing-device input, and sustained-search responsiveness. CI now covers a legal move, engine reply, paired undo, depth-8 cancellation with New Game, board flip, and clean shutdown.
2. Continue improving the browser worker's responsiveness and expose additional search diagnostics without changing the shared native/WebAssembly engine behaviour.
3. Run native evaluation calibration against a sufficiently large licensed corpus; inspect held-out log-loss/Brier metrics before considering evaluation changes.
4. Validate candidate search/evaluation changes through tactical tests and controlled paired-color matches before making strength claims.
5. Complete a reproducible release build and inspect the published WASM artifact for the intended browser targets.

## Review order

Review move generation and make/undo behavior first, then evaluation and search, then the UCI lifecycle and thread-safety, and finally the Windows desktop and browser deployment paths. Keep benchmark throughput, calibration quality, tactical correctness, and playing strength as separate measurements.
