# Prunex 0.5.2

Prunex is a C++20 chess engine with a native Windows desktop interface and a UCI-capable command-line engine.

## Engine improvements

The 0.5.0 search core adds Zobrist position hashing, a 262,144-entry transposition table, iterative deepening, aspiration windows, principal-variation search, hash/MVV-LVA/killer/history move ordering, late-move reductions, improved quiescence handling, and tapered positional evaluation with pawn-structure, bishop-pair, passed-pawn, and rook-file terms.

Version 0.5.1 added UCI move-time and clock-based time management. Version 0.5.2 adds null-move pruning with verification, in-search repetition and 50-move draw handling, king-safety evaluation, a tempo bonus, and rejection of king-capture pseudo-moves. The engine accepts `go movetime` and `go wtime/btime/winc/binc/movestogo` and returns the best move from its last fully completed iterative-deepening iteration when its budget expires.

The engine techniques are implemented in Prunex's own source. No Stockfish source code or neural-network weights are included. No Elo rating is claimed until controlled matches have been completed.

## Windows 11 build

Requirements: Visual Studio 2022 with Desktop development with C++, CMake 3.20+, and the Windows 10/11 SDK.

Download and extract `Prunex-0.5.2.zip`, then open PowerShell in the extracted `Prunex` directory:

```powershell
cmake -S . -B build -A x64
cmake --build build --config Release
ctest --test-dir build -C Release --output-on-failure
```

Launch `build\Release\Prunex.exe` for the desktop GUI and `build\Release\prunex-cli.exe` for the UCI console engine.

The GUI supports click-to-move, legal-move highlighting, human-versus-engine play, search depth 1–8, new game, undo-turn, board flip, check/checkmate/stalemate status, and queen promotion by default. Search remains synchronous on the UI thread.

## Regression coverage

The 44-test suite covers standard perft positions, FEN validation, en-passant legality, terminal positions, quiet check evasions, mate-in-one selection, make/undo hash restoration, transposition-table reuse, UCI move-time search, clock-based search, king-capture rejection, repetition recognition, 50-move draws, and position restoration after search.

See [TEST_REPORT.md](TEST_REPORT.md) and [WINDOWS_GUI_CHECKLIST.md](WINDOWS_GUI_CHECKLIST.md).

## Stockfish 4 and 6 benchmark

The `Prunex versus Stockfish 4 and 6` GitHub Actions workflow builds the official `sf_4` and `sf_6` source tags from [the official Stockfish repository](https://github.com/official-stockfish/Stockfish). It ran 64 games against each version, using 16 opening positions, two repeats, both colors, one thread per engine, and equal 100 ms per move.

**Measured Prunex 0.5.1 baseline:**

| Opponent | Prunex wins | Draws | Prunex losses | Score |
|---|---:|---:|---:|---:|
| Stockfish 4 | 0 | 0 | 64 | 0% |
| Stockfish 6 | 0 | 0 | 64 | 0% |

Prunex 0.5.1 did not beat either opponent in this baseline; all 128 games ended by checkmate. The 0.5.2 tournament is being run separately, and no win is claimed until its PGNs and summaries are reviewed. This is a fixed-move-time test, not an Elo rating or a large-scale SPRT. PGNs and JSON summaries are available in the [completed tournament run](https://github.com/Mohamed-Mostafa-GT/Prunex/actions/runs/41235739463).

## Play against Prunex in your browser

The `web/` application provides a browser chessboard that runs the Prunex C++ engine compiled to WebAssembly. The engine runs in a Web Worker on the visitor's device. The page supports legal moves, move history, undo, board flip, promotion choice, and adjustable search time.

For local play, download the `github-pages` artifact from the [browser build workflow run](https://github.com/Mohamed-Mostafa-GT/Prunex/actions/runs/41236751855), extract the ZIP and its `artifact.tar`, then run `py -3 -m http.server 8000` from the extracted site folder. Open `http://localhost:8000`. Python 3 and an internet connection for the chess.js library are required. The engine itself runs locally in your browser.

The `Play Prunex in the browser` workflow also builds a GitHub Pages artifact. To publish it, open **Settings → Pages** and select **GitHub Actions** as the build and deployment source. The intended project URL is `https://mohamed-mostafa-gt.github.io/Prunex/`. The first deployment is currently blocked because Pages is not enabled for the repository.

The Pages site is public. GitHub Pages supports private source repositories only on paid GitHub plans; GitHub Free requires a public source repository. The source repository remains private.
