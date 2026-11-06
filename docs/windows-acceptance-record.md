# Prunex Windows 10/11 acceptance record

The automated Windows x64 workflow verifies compilation, CTest, executable architecture, UCI startup, and a basic GUI launch/responsiveness/clean-shutdown smoke test. It does not verify human move input, promotion, board rendering at multiple DPI settings, or sustained search interaction. Those checks remain a hands-on Windows 10/11 acceptance task.

## Tested Windows x64 build available now

The latest passing Windows workflow is [run #42075433290](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42075433290). Download its artifact [`Prunex-Windows-x64`](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42075433290/artifacts/13437603709). It contains:

- `Release/Prunex.exe` — GUI executable, 93,696 bytes, SHA-256 `693DE11F75209AB6F7BDA3EE14C53EBDEE9CBB1322A949011158597D94894393`
- `Release/prunex-cli.exe` — CLI engine, 94,208 bytes, SHA-256 `B2AB5349269592F7841C00B302029B1F1D3649CA46AD0317CB9D2A3C650F06C6`
- `windows-build-manifest.json` — identifies commit `e41f24cc10448b2e2deac4f7ae956266d8910173`, MSVC/Visual Studio 2022, Release, x64.
- `Testing/Temporary/LastTest.log` — CTest output.

The artifact is currently scheduled to expire on **5 December 2026**. Download it before then. The CI run verifies the build, CTest, AMD64 PE machine type and UCI startup; your manual acceptance record below is still required for desktop interaction.

## Environment

- Date/time:
- Windows edition/version/build:
- Device/display resolution and scaling:
- CPU:
- GPU/driver:
- Prunex build/artifact URL:
- Commit SHA:
- Tester:

## Acceptance checks

- [ ] Release executable launches without missing-DLL or SmartScreen/runtime error.
- [ ] Board, coordinates, controls, and status render at 100% and 150% display scaling.
- [ ] Board fits a 1366×768 window and a 1920×1080 display without clipping.
- [ ] New game and side-to-move state work.
- [ ] Legal moves are accepted and illegal moves are rejected without corrupting position.
- [ ] Undo works after a human-only move.
- [ ] Undo restores both half-moves after a human/engine pair.
- [ ] Redo/review navigation works where available.
- [ ] Pawn promotion works for all four promotion pieces.
- [ ] Check, checkmate, stalemate, and draw states render correctly.
- [ ] Engine search starts, returns a move, and can be cancelled.
- [ ] The window remains responsive at search depths 1, 4, and 8.
- [ ] The fixed-size window fits the tested display without clipping; record the display resolution and scaling.
- [ ] Board flip does not break square selection or move input.
- [ ] Close during an active search exits cleanly; no orphaned engine process remains.
- [ ] Start a new game during an active search; the previous search result does not modify the new game.
- [ ] Repeated launch/close cycles do not leave stale processes or corrupt settings.

## Results

- Passed:
- Failed:
- Not tested:
- Crash/error logs:
- Screenshots/video locations:
- Tester sign-off:
