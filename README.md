# Prunex 0.5.0

Prunex is a C++20 chess engine with a native Windows desktop interface and a UCI-capable command-line engine.

## Engine improvements

Version 0.5.0 adds Zobrist position hashing, a 262,144-entry transposition table, iterative deepening, aspiration windows, principal-variation search, hash/MVV-LVA/killer/history move ordering, late-move reductions, improved quiescence handling, and a tapered positional evaluation with pawn-structure, bishop-pair, passed-pawn, and rook-file terms.

These are classical techniques implemented in Prunex's own source. No Stockfish source code or neural-network weights are included. No Elo rating is claimed; strength still needs to be measured through controlled engine matches.

## Windows 11 build

Requirements: Visual Studio 2022 with Desktop development with C++, CMake 3.20+, and the Windows 10/11 SDK.

Download and extract `Prunex-0.5.0.zip`, then open PowerShell in the extracted `Prunex` directory:

```powershell
cmake -S . -B build -A x64
cmake --build build --config Release
ctest --test-dir build -C Release --output-on-failure
```

Launch `build\Release\Prunex.exe` for the desktop GUI and `build\Release\prunex-cli.exe` for the UCI console engine.

The GUI supports click-to-move, legal-move highlighting, human-versus-engine play, search depth 1–8, new game, undo-turn, board flip, check/checkmate/stalemate status, and queen promotion by default. Search is synchronous on the UI thread, so the window may temporarily stop responding at higher depths.

## Console engine

The console engine supports UCI, `--perft DEPTH`, `--perft-fen "FEN" DEPTH`, and `--divide-fen "FEN" DEPTH`. UCI search accepts depths 1–12.

The 42-test regression suite covers standard perft positions, FEN validation, en-passant legality, terminal positions, quiet check evasions, a mate-in-one search, make/undo hash restoration, and transposition-table reuse.

See [TEST_REPORT.md](TEST_REPORT.md) for the test results and [WINDOWS_GUI_CHECKLIST.md](WINDOWS_GUI_CHECKLIST.md) for manual GUI verification. The repository's Windows Actions workflow builds the GUI and console binary and publishes them as workflow artifacts.
