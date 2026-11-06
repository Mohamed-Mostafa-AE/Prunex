# Prunex Windows 10/11 acceptance record

The automated Windows x64 workflow verifies compilation, CTest, executable architecture, UCI startup, and desktop interaction through the window message loop. The GUI smoke test plays e2-e4, waits for the engine reply, checks paired Undo, starts another search and cancels it with New Game, flips the board, and verifies clean shutdown. Human acceptance is still required for visual rendering at multiple DPI settings, promotion choices, sustained search responsiveness, and real mouse/touchpad input.

## Tested Windows x64 build available now

The latest passing Windows workflow is [run #42232100449](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42232100449). Download its artifact [`Prunex-Windows-x64`](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42232100449/artifacts/13510101375). It contains:

- `Release/Prunex.exe` — GUI executable, 96,768 bytes, SHA-256 `0DD2077D09D9EE309E096DEE35B9D9F98596C69F0D42FB6FA977548B956879A1`
- `Release/prunex-cli.exe` — CLI engine, 94,208 bytes, SHA-256 `09A7B1901E8A9818C8E3A4F7D70A631BEE2B9E724A30A61602E3E492BF401919`
- `windows-build-manifest.json` — Visual Studio 2022, Release, x64; commit `eb1ea467427f769af42ba088e99f20c9c2619617`.
- `Testing/Temporary/LastTest.log` — CTest output (46/46 passed).

The artifact expires on **6 December 2026 at 14:14 UTC**. CI also verified a legal e2-e4 input, engine reply, paired undo, depth-8 search cancellation through New Game, board flip responsiveness, and normal shutdown. The remaining manual acceptance is visual rendering at 100%/150% scaling, screen fit, all promotion choices, physical pointing-device input, and sustained-search responsiveness.
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

Automated in Windows CI run #42232100449:
- [x] Release executable launches and creates a responsive top-level window.
- [x] A legal e2-e4 move is accepted through the GUI message loop.
- [x] The engine returns a reply and the window title reports two plies.
- [x] Undo restores the starting position after a human/engine pair.
- [x] A depth-8 search starts; New Game cancels it and restores the starting position.
- [x] Board flip remains responsive.
- [x] Normal window close exits without leaving the process running.

Manual Windows 10/11 acceptance:
- [ ] Record Windows edition/build, display resolution, and scaling.
- [ ] Board, coordinates, controls, and status render at 100% and 150% display scaling.
- [ ] Board fits a 1366×768 window and a 1920×1080 display without clipping.
- [ ] Test with a physical mouse or touchpad and confirm square selection is reliable.
- [ ] Test all four promotion choices.
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
