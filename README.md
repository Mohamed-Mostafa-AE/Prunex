# Prunex 0.4.3

Prunex is a C++20 chess engine project with a native Windows desktop GUI and a UCI-capable console engine.

## Build on Windows 11

Requirements: Visual Studio 2022 with Desktop development with C++, CMake 3.20+, and the Windows SDK.

```powershell
cmake -S . -B build -A x64
cmake --build build --config Release
ctest --test-dir build -C Release --output-on-failure
```

Launch `build\Release\Prunex.exe` for the GUI and `build\Release\prunex-cli.exe` for the UCI console engine.

## GUI

- Click-to-move chessboard with legal-move highlighting
- Human plays White against Prunex
- Adjustable search depth (1–8)
- New game, undo-turn, and board flip
- Check, checkmate, and stalemate status
- Queen promotion by default

## Limitations

The GUI search runs synchronously on the UI thread and can temporarily block the window. The GUI has not yet been verified on an actual Windows machine. No Elo rating is claimed. There is no PGN import/export, clock, opening book, transposition table, or promotion-choice dialog.

## Validation

The supplied Linux test report records 42/42 tests passing under GCC Release, GCC ASan/UBSan, and Clang 17 Release, plus no GCC static-analyzer diagnostics. Extended perft counts are also recorded in [TEST_REPORT.md](TEST_REPORT.md). These Linux tests do not establish that the Win32 GUI has passed on Windows.

The complete v0.4.3 source distribution is attached to the ChatGPT conversation as `Prunex-Cpp-0.4.3-Tested.zip`; the current GitHub connector can commit text files but does not expose a local binary-file upload operation.

See [WINDOWS_GUI_CHECKLIST.md](WINDOWS_GUI_CHECKLIST.md) for manual GUI verification.
