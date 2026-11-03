# Native Browser Engine: Architecture and Port Plan

## Objective

Run the native Prunex C++ implementation in the browser without maintaining a second chess-playing implementation. The browser build must use the same position, legal-move, evaluation, and search code as the native executable.

This document records the first implementation boundary and the order of work. It does not claim that a browser build exists yet.

## Current native implementation

The current C++ source already contains the core capabilities needed for a first browser-capable build:

- 0x88 position representation and FEN parsing
- Legal move generation, including castling, en passant, and promotion
- Zobrist position hashing and a transposition table
- Iterative deepening with alpha-beta search, aspiration windows, and quiescence
- A tapered evaluation function
- UCI command parsing and time allocation

The current program is not yet suitable for direct browser embedding. The engine, UCI input loop, output, and process entry point live in one translation unit. Search state is held in process-wide globals, output is written directly to `std::cout`, and `stop` is currently a no-op. The search runs synchronously.

## Required architecture

Separate the implementation into four layers:

1. **Chess core** — position, move generation, make/unmake, hashing, evaluation, and search. This layer must not depend on stdin, stdout, browser APIs, or a GUI.
2. **Search session** — owns the transposition table, heuristics, node counters, limits, and cancellation state for one search. It exposes progress and completion through callbacks.
3. **Protocol adapter** — translates UCI commands into core operations and emits UCI responses through an output sink. The native executable uses stdin/stdout; the browser adapter uses message events.
4. **Host adapters** — a native CLI and a WebAssembly worker. Both call the same core and search-session implementation.

The core must remain the single source of chess rules and move selection. Browser-specific code should be limited to message transport, memory limits, scheduling, and UI integration.

## First implementation milestones

### Milestone 1 — isolate the core

- Move chess types and position operations into dedicated headers/source files.
- Move search data out of file-scope mutable globals into a `SearchSession`.
- Replace direct progress printing in search with a callback or event sink.
- Keep the existing native CLI behavior unchanged through a thin adapter.
- Preserve the existing perft, UCI, FEN, and search regression suite.

**Acceptance:** the native executable builds with the same public commands, and all existing CTest cases pass.

### Milestone 2 — make search cancellable

- Add a cancellation flag owned by the active search session.
- Check cancellation at bounded intervals in both principal search and quiescence.
- Make `stop` signal cancellation and guarantee a final `bestmove` response.
- Ensure a new position/search cannot accidentally reuse mutable state from a cancelled request.
- Add deterministic tests for stop, replacement searches, and repeated start/stop cycles.

**Acceptance:** a timed or depth-limited search can be stopped promptly without corrupting the next search.

### Milestone 3 — add a WebAssembly target

- Add an Emscripten toolchain build only after the core and protocol boundaries are isolated.
- Export a small C ABI for creating/destroying a session, submitting commands, polling or receiving output, and requesting cancellation.
- Keep allocation and string ownership explicit across the JavaScript/C++ boundary.
- Start with a single-threaded worker build; add shared-memory threading only after the single-threaded build is stable.
- Keep the native build and its tests independent of Emscripten.

**Acceptance:** the browser worker can initialize the native core, submit UCI-equivalent commands, receive incremental `info` output and a final `bestmove`, and cancel an active search.

### Milestone 4 — connect the browser experience

- Replace the browser opponent/analysis transport with the WebAssembly worker adapter.
- Preserve the existing Prunex-owned review orchestration, score interpretation, move classification, and Apex criteria.
- Keep UI code independent of the engine's internal representation.
- Add browser smoke tests for initialization, legal moves, search completion, cancellation, and game review.

**Acceptance:** a browser game and review both obtain their moves and evaluations from the same native core used by the desktop/CLI build.

## Correctness and performance gates

Do not describe the browser port as complete based only on successful compilation. Require all of the following:

- Existing native CTest suite passes after each refactor.
- Perft results match the established reference positions.
- FEN, promotion, castling, en-passant, checkmate, and stalemate behavior match native tests.
- The same position and search limits produce legal best moves in native and WebAssembly builds.
- Cancellation and repeated searches do not deadlock the worker.
- Browser performance is measured on named hardware and browser versions.
- Strength claims use reproducible match conditions, sufficient game counts, and disclosed time controls.

## Scope boundary

This plan concerns the native Prunex implementation and its browser deployment. Any separately licensed third-party component or asset must retain its required notices and license compliance; it must not be represented as original Prunex implementation work.
