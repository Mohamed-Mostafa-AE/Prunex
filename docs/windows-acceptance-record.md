# Prunex Windows 10/11 acceptance record

The automated Windows x64 workflow verifies compilation, CTest, executable architecture, UCI startup, and desktop interaction through the window message loop. The GUI smoke test plays e2-e4, waits for the engine reply, checks paired Undo, starts another search and cancels it with New Game, flips the board, and verifies clean shutdown. Human acceptance is still required for visual rendering at multiple DPI settings, promotion choices, sustained search responsiveness, and real mouse/touchpad input.

## Tested Windows x64 build available now

The latest passing Windows workflow is [run #42229642503](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42229642503). Download its artifact [`Prunex-Windows-x64`](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42229642503/artifacts/13506873704). It contains:

- `Release/Prunex.exe` — GUI executable, 93,696 bytes, SHA-256 `9115CBBBE8F8957C4448277C1659904450F5C560B8B3C3A902754DB7000307D4`
- `Release/prunex-cli.exe` — CLI engine, 94,208 bytes, SHA-256 `44188A25C93B7070CCE1EBE632A51E8C2C42F2D98E806A65B8FE68F1A2E9A721`
- `windows-build-manifest.json` — commit `2ff47018cd45f9fcfeafe9c492c55fd8e88855e4`, Visual Studio 2022, Release, x64.
- `Testing/Temporary/LastTest.log` — CTest output (46/46 passed).

The artifact expires on **6 December 2026 at 13:57 UTC**. CI verifies x64 PE executables, all native tests, UCI startup, and a basic GUI launch/responsiveness/clean-shutdown smoke test. Manual move input, promotion, DPI, and sustained-search acceptance remains separate.
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

Automated in the latest Windows x64 workflow:
- [x] Release executable launches and creates a responsive top-level window.
- [x] A legal e2-e4 move is accepted through the GUI message loop.
- [x] The engine returns a reply and the title reports the expected two plies.
- [x] Undo restores the starting position after a human/engine pair.
- [x] New Game cancels an active search and restores the starting position.
- [x] Board flip remains responsive.
- [x] Normal window close exits without leaving the process running.

Manual Windows 10/11 acceptance:
- [ ] Record Windows edition/build, display resolution, and scaling.
- [ ] Board, coordinates, controls, and status render at 100% and 150% display scaling.
- [ ] Board fits a 1366×768 window and a 1920×1080 display without clipping.
- [ ] Test with a physical mouse or touchpad and confirm square selection is reliable.
- [ ] Try all four pawn-promotion choices; the current GUI's default promotion behavior should be checked explicitly.
- [ ] Check checkmate, stalemate, and draw states visually.
- [ ] Observe responsiveness during sustained search at depths 1, 4, and 8.
- [ ] Repeat launch/close cycles on the target machine and check for stale processes or damaged settings.

## Results

- Passed:
- Failed:
- Not tested:
- Crash/error logs:
- Screenshots/video locations:
- Tester sign-off:
