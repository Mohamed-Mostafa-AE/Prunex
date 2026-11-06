# Prunex Windows desktop acceptance record

The automated Windows x64 workflow verifies compilation, CTest, executable architecture, UCI startup, and desktop interaction through the window message loop. The GUI smoke test plays e2-e4, waits for the engine reply, checks paired Undo, starts another search and cancels it with New Game, flips the board, and verifies clean shutdown. Manual acceptance is still required on Windows 10/11 client devices for visual rendering, DPI scaling, promotion, physical input, and sustained-search responsiveness.

## Latest automated Windows x64 build

The latest passing Windows workflow is [run #42251005114](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42251005114). Download the [Prunex-Windows-x64 artifact](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42251005114/artifacts/13520266801).

- Commit: `4591190f6eea8ab01470ced2913986277dbb78d5`
- Runner: Windows Server 2022; Visual Studio 2022; Release; x64.
- Native CTest: 46/46 passed.
- GUI path: legal e2-e4 input, engine reply, paired undo, search cancellation via New Game, board flip, normal shutdown.
- Artifact SHA-256: `ce3923a7172422395b32eaabcd64748845d2833bf84437bd07d63b4fe6f1c004`.
- Artifact expiry: 6 December 2026, 16:18 UTC.

The automated GUI check does not replace physical Windows 10/11 acceptance.

## Manual Windows 10/11 acceptance

- [ ] Record Windows edition/build, display resolution, and scaling.
- [ ] Board, coordinates, controls, and status render at 100% and 150% display scaling.
- [ ] Board fits a 1366×768 window and a 1920×1080 display without clipping.
- [ ] Test with a physical mouse or touchpad and confirm square selection is reliable.
- [ ] Test all four promotion choices.
- [ ] Check checkmate, stalemate, and draw states visually.
- [ ] Observe responsiveness during sustained search at depths 1, 4, and 8.
- [ ] Repeat launch/close cycles on the target machine and check for stale processes or damaged settings.

## Results

Human acceptance status: not recorded.
