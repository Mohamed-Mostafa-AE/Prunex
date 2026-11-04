# Development notes

## Project structure

Prunex 0.8.0 is the native C++20 chess engine and Windows desktop application, with a UCI command-line interface. The engine code covers board state, legal move generation, search, static evaluation, and UCI communication.

The website is a separate browser chess experience. Its browser opponent and review implementation are independent website components; they are not the native C++ engine.

## Implemented foundations

- 0x88 position representation, legal move generation, castling, en passant, promotions, FEN parsing, and make/undo behavior.
- Iterative-deepening alpha-beta search, move ordering, transposition table, quiescence search, time controls, and asynchronous UCI search cancellation.
- Native static evaluation terms and a repeatable five-position benchmark command.
- Native regression coverage for perft, move legality, search outcomes, side-to-move scoring, evaluation symmetry, and interrupted search.
- Asynchronous Windows desktop search with UI-thread result application, cancellation on new game/undo/window close, and stale-result generation checks.
- Browser game/review/archive features, explicit sharing controls, account recovery/deletion, and optional shared position-memory retrieval.
- Offline PGN corpus ingestion, provenance manifests, native static-evaluation annotation, and held-out diagnostic calibration tooling.
- CI validation for Windows x64, the website build/browser smoke test, dependency audits, and CodeQL analysis.

## Remaining engineering work

1. Complete manual Windows 10/11 desktop interaction checks, including search cancellation, new game, undo, and closing while the engine is thinking.
2. Implement a native WebAssembly target and automated native/WASM parity tests. The current browser demo does not constitute native WebAssembly integration.
3. Run native evaluation calibration against a sufficiently large licensed corpus; inspect held-out log-loss/Brier metrics before considering evaluation changes.
4. Validate candidate search/evaluation changes through tactical tests and controlled paired-color matches before making strength claims.
5. Complete sanitizer runs and a reproducible release build on the supported compiler matrix.

## Review order

Review move generation and make/undo behavior first, then evaluation and search, then the UCI lifecycle and thread-safety, and finally the Windows desktop and browser deployment paths. Keep benchmark throughput, calibration quality, tactical correctness, and playing strength as separate measurements.
