# Prunex 0.8.0 native search kernel

This page describes the **native C++20 engine** in `src/main.cpp`. It is a control-flow map of the implementation, not a neural-network diagram, not a recording of one search, and not a playing-strength claim.

## Search flow

```mermaid
flowchart TD
    A["UCI go / findBestMove"] --> B["Generate legal root moves<br/>Set optional deadline"]
    B --> C["Iterative deepening<br/>depth 1 → requested limit"]
    C --> D["Aspiration window<br/>from depth 3: previous score ± 40 cp"]
    D --> E["negamax(position, depth, alpha, beta, ply, PV)"]
    E --> F["Abort / max-ply guards<br/>Check extension"]
    F --> G["Zobrist key + draw checks<br/>Repetition · 50-move · insufficient material"]
    G --> H{"depth ≤ 0?"}
    H -- Yes --> Q["Quiescence search"]
    H -- No --> I["Transposition-table probe"]
    I --> J{"Usable exact / bound hit?"}
    J -- Yes --> R["Return cached score"]
    J -- No --> K["Null-move pruning gate"]
    K --> L["Generate legal moves"]
    L --> M["Move ordering"]
    M --> N["PVS move loop"]
    N --> O["First move: full window<br/>Later moves: null window"]
    O --> P["Late-move reductions<br/>Re-search when required"]
    P --> S["Update best score / alpha"]
    S --> T{"alpha ≥ beta?"}
    T -- Yes --> U["Beta cutoff<br/>Update killer + history"]
    T -- No --> V{"More legal moves?"}
    U --> W["Store TT score / bound / best move"]
    V -- Yes --> N
    V -- No --> W
    W --> X["Return node score"]
    Q --> X
    R --> X
    X --> Y["Aspiration fail-low / fail-high?<br/>Widen window and retry"]
    Y --> C
    Y --> Z["Completed-depth UCI info<br/>depth · score · nodes · NPS · TT hits · PV"]
    Z --> AA["Continue next depth / emit bestmove"]

    subgraph SUPPORT["Supporting implementation"]
      AB["Move ordering: hash move · promotions · SEE captures · killer moves · history"]
      AC["Tapered handcrafted evaluation: material · activity · pawn terms · bishop pair · king shelter · rook files"]
      AD["Zobrist key: pieces · side · castling · en-passant"]
      AE["Quiescence: stand pat outside check; captures, promotions, all check evasions in check"]
    end
    M -.-> AB
    I -.-> AD
    Q -.-> AE
    Q -.-> AC
    E -.-> AC
```

## What the implementation actually does

- **Root search:** `findBestMove` generates legal moves, optionally establishes a time deadline, advances the transposition-table generation, and iterates from depth 1 to the requested limit. Time-limited UCI search is capped at depth 12.
- **Aspiration windows:** from depth 3, the initial window is the previous completed score ± 40 centipawns. Fail-low or fail-high widens the window and retries.
- **Negamax:** checks cancellation and maximum ply, extends the search when in check, records Zobrist keys for repetition handling, checks draw rules, then enters quiescence at depth 0.
- **Transposition table:** entries contain the position key, best move, score, depth, bound type (exact/lower/upper), and generation. Mate scores are normalized for storage and retrieval.
- **Null-move pruning:** gated to suitable non-PV, non-check nodes at depth 3 or greater with sufficient non-pawn material. At depth 7 or greater, a cutoff is verified with a reduced search.
- **PVS and reductions:** the first move gets a full-window search. Later moves get a null-window search; quiet late moves may be reduced, then re-searched if they improve alpha.
- **Move ordering:** hash move, promotions, captures ranked with static-exchange evaluation, killer moves, then history scores.
- **Quiescence:** when not in check, uses stand-pat evaluation and searches captures/promotions; when in check, searches all legal evasions. It has a bounded quiescence ply.
- **Evaluation:** handcrafted tapered middlegame/endgame scoring, blended by material phase. Terms in the current implementation include material, center/activity, pawn advancement, doubled and isolated pawns, passed and connected pawns, bishop pair, king shelter, and rook-file bonuses.
- **UCI observability:** each completed iteration reports depth, centipawn score, nodes, NPS, transposition-table hits, hash fullness, and the principal move; the search then emits `bestmove`.

## Generate the diagram

From the repository root:

```bash
python3 tools/visualize_search_kernel.py
```

The script writes `docs/assets/prunex-search-kernel.svg`. It uses only Python's standard library. The generated SVG can be opened in a browser or viewed directly in GitHub.

## Source of truth

- [Native implementation: `src/main.cpp`](../src/main.cpp)
- [Engine architecture in the README](../README.md#native-engine-architecture)
- [Testing methodology](testing.md)

The diagram and this page describe code paths. They do not certify a particular binary, reproduce a match, or establish an Elo rating.
