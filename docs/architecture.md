# Prunex architecture

This document describes the current repository architecture. It distinguishes implemented components from future integration work.

## System overview

```mermaid
flowchart TB
    subgraph Native["Native Prunex — C++20"]
        Position["Position and 0x88 board"]
        MoveGen["Pseudo-legal generation + legality filtering"]
        Search["Iterative-deepening negamax"]
        Eval["Handcrafted tapered evaluator"]
        UCI["UCI command interface"]
        Position --> MoveGen --> Search
        Search --> Eval
        UCI --> Position
        UCI --> Search
    end

    subgraph Desktop["Windows desktop application"]
        GUI["Native Windows GUI"]
    end

    GUI --> Native

    subgraph Wasm["Prunex C++20 compiled to WebAssembly"]
        API["Emscripten C API"]
    end
    Native -. "same C++ implementation" .-> API

    subgraph Browser["Prunex Play — separate browser application"]
        UI["Browser UI"]
        Rules["Browser chess rules"]
        Worker["Prunex WebAssembly worker"]
        Review["Review pipeline"]
        Calibration["Expected-points calibration"]
        Archive["Game archive integration"]
        UI --> Rules
        UI --> Worker
        Worker --> API
        Worker --> Review
        Review --> Calibration
        UI --> Archive
    end
```

Prunex Play loads the same C++20 engine implementation through the versioned WebAssembly API. The browser worker calls the time-bounded search and evaluation exports; the native command-line and Windows applications use the same underlying engine source.

## Native engine data flow

1. The UCI interface loads a start position or FEN and applies the supplied move sequence.
2. The position layer stores board state in a 128-slot 0x88 representation.
3. Pseudo-legal moves are generated, then filtered by king-safety checks.
4. Search uses iterative deepening, negamax alpha–beta/PVS, move ordering, a transposition table, aspiration windows, late-move reductions, quiescence, repetition and fifty-move draw handling, insufficient-material detection, and null-move pruning with verification at greater depths.
5. The static evaluator calculates material and handcrafted positional terms, then blends middlegame and endgame scores by game phase.
6. UCI reports search information and the selected best move.

## Native implementation boundaries

| File | Responsibility |
|---|---|
| `src/main.cpp` | Native engine implementation, UCI loop, CLI diagnostics and benchmark |
| `src/gui.cpp` | Windows desktop window, board rendering and interaction |
| `src/wasm_api.cpp` | C-compatible API exported by the Emscripten build |
| `CMakeLists.txt` | Native, Windows, WebAssembly and CTest build definitions |
| `tests/` | Native regression, UCI, GUI smoke and WASM parity tests |

The Windows desktop currently includes the engine implementation translation unit at build time. The architecture review recommends extracting a reusable engine-core library before increasing the number of native front ends.

## Search and evaluation

The native search stores position keys and bounds in a fixed-size transposition table. Move ordering uses the hash move, promotions, captures, killer moves, and history scores. Search-path repetition checks and the fifty-move rule identify draw lines; dead positions are scored as draws. Null-move pruning is restricted to suitable non-PV positions and uses a verification search at greater depths. Late-move reductions are applied to later quiet moves when the node is not in check and the move does not give check. Fail-low and fail-high aspiration windows widen and repeat the root search.

The evaluator is handcrafted and tapered. Its terms include material, piece activity, pawn structure, passed/connected pawns, bishop pair, king shelter, and rook-file activity.

## Browser application boundary

The browser application has separate modules for the engine worker, review metrics, evaluation calibration, game database access, account feedback, and UI presentation. Its worker loads the Prunex 0.8.0 WebAssembly build, which is compiled from the same native C++20 engine source. The browser interface adds scheduling, expected-points interpretation, move grading, archive access, and presentation; it does not implement a second chess engine.

## Offline data workflow

The offline tooling is independent from both live game storage and engine execution:

```mermaid
flowchart LR
    PGN["Licensed PGN archive"] --> Import["Streamed importer"]
    Import --> Manifest["Checksummed corpus manifest"]
    Import --> Splits["Train / validation / test splits"]
    Splits --> Annotate["Native static-evaluation annotation"]
    Annotate --> Diagnostics["Held-out calibration diagnostics"]
    Diagnostics --> Human["Human review + controlled match testing"]
```

Position annotation records the native engine's static score; it does not train or change engine weights. Calibration diagnostics measure score-to-outcome interpretation, not playing strength.

## Validation boundaries

- Native CTest validates tested move-generation, position, search and UCI behaviour.
- GCC/Clang/sanitizer/Windows jobs validate the tested compile/runtime configurations.
- WebAssembly parity checks compare the standalone exported API with native reference results.
- Browser tests validate UI, account, archive, review and application integration.
- None of these alone establishes an independent Elo rating, production disaster recovery, external email delivery, or manual Windows 10/11 visual acceptance.
