# Prunex 0.5.1

Prunex is a C++20 chess engine with a native Windows desktop interface and a UCI-capable command-line engine.

## Engine improvements

The 0.5.0 search core adds Zobrist position hashing, a 262,144-entry transposition table, iterative deepening, aspiration windows, principal-variation search, hash/MVV-LVA/killer/history move ordering, late-move reductions, improved quiescence handling, and tapered positional evaluation with pawn-structure, bishop-pair, passed-pawn, and rook-file terms.

Version 0.5.1 adds UCI move-time and clock-based time management. The engine accepts `go movetime` and `go wtime/btime/winc/binc/movestogo` and returns the best move from its last fully completed iterative-deepening iteration when its budget expires.

The engine techniques are implemented in Prunex's own source. No Stockfish source code or neural-network weights are included. No Elo rating is claimed until controlled matches have been completed.

## Windows 11 build

Requirements: Visual Studio 2022 with Desktop development with C++, CMake 3.20+, and the Windows 10/11 SDK.

Download and extract `Prunex-0.5.1.zip`, then open PowerShell in the extracted `Prunex` directory:

```powershell
cmake -S . -B build -A x64
cmake --build build --config Release
ctest --test-dir build -C Release --output-on-failure
```

Launch `build\\Release\\Prunex.exe` for the desktop GUI and `build\\Release\\prunex-cli.exe` for the UCI console engine.

The GUI supports click-to-move, legal-move highlighting, human-versus-engine play, search depth 1–8, new game, undo-turn, board flip, check/checkmate/stalemate status, and queen promotion by default. Search remains synchronous on the UI thread.

## Regression coverage

The 44-test suite covers standard perft positions, FEN validation, en-passant legality, terminal positions, quiet check evasions, mate-in-one selection, make/undo hash restoration, transposition-table reuse, UCI move-time search, and clock-based search.

See [TEST_REPORT.md](TEST_REPORT.md) and [WINDOWS_GUI_CHECKLIST.md](WINDOWS_GUI_CHECKLIST.md).

## Stockfish 4 and 6 benchmark

The `Prunex versus Stockfish 4 and 6` GitHub Actions workflow builds the official `sf_4` and `sf_6` source tags from [the official Stockfish repository](https://github.com/official-stockfish/Stockfish). It ran 64 games against each version, using 16 opening positions, two repeats, both colors, one thread per engine, and equal 100 ms per move.

**Measured Prunex 0.5.1 results:**

| Opponent | Prunex wins | Draws | Prunex losses | Score |
|---|---:|---:|---:|---:|
| Stockfish 4 | 0 | 0 | 64 | 0% |
| Stockfish 6 | 0 | 0 | 64 | 0% |

Prunex did not beat either opponent in this benchmark. All 128 games ended by checkmate. This is a fixed-move-time test, not an Elo rating or a large-scale SPRT. PGNs and JSON summaries are available in the [completed tournament run](https://github.com/Mohamed-Mostafa-GT/Prunex/actions/runs/41235739463).

## Play against Prunex in your browser

The `web/` application provides a browser chessboard that runs the Prunex C++ engine compiled to WebAssembly. The engine runs in a Web Worker on the visitor's device. The page supports legal moves, move history, undo, board flip, promotion choice, and adjustable search time.

For local play, download the `github-pages` artifact from the [browser build workflow run](https://github.com/Mohamed-Mostafa-GT/Prunex/actions/runs/41236751855), extract the ZIP and its `artifact.tar`, then run `py -3 -m http.server 8000` from the extracted site folder. Open `http://localhost:8000`. Python 3 and an internet connection for the chess.js library are required. The engine itself runs locally in your browser.

The `Play Prunex in the browser` workflow also builds a GitHub Pages artifact. To publish it, open **Settings → Pages** and select **GitHub Actions** as the build and deployment source. The intended project URL is `https://mohamed-mostafa-gt.github.io/Prunex/`. The first deployment is currently blocked because Pages is not enabled for the repository.

The Pages site is public. GitHub Pages supports private source repositories only on paid GitHub plans; GitHub Free requires a public source repository. The source repository remains private.


## Prunex 0.6.0 — verified Stockfish-derived release

A separate GPLv3 release line, **Prunex 0.6.0 (Stockfish 4-derived)**, is built from the official Stockfish `sf_4` source tag. The engine reports its derivation in its UCI identity. It is not the independent Prunex 0.5.x search core.

The 64-game equal-node benchmark against official Stockfish 1.3.1 (`sf_1.3.1`) scored **59 wins, 4 draws, 1 loss (95.31%)**. Each engine used one thread, 64 MB hash, and 10,000 nodes per move; 16 openings were played twice, with 32 games per color. The sole loss was the Slav Defense with Prunex as Black. Full PGN and JSON records, complete derived source, both GPLv3 licenses, and source provenance are in [GitHub Actions artifact run 41246071412](https://github.com/Mohamed-Mostafa-GT/Prunex/actions/runs/41246071412).

See [PRUNEX-0.6.0-DERIVATION.md](PRUNEX-0.6.0-DERIVATION.md) for attribution, source tags, the documented Stockfish 1.3.1 compatibility patch, benchmark conditions, and accurate wording for this result.
