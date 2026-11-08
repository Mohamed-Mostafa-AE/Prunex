# Prunex Windows desktop acceptance record

The automated Windows x64 workflow verifies compilation, CTest, executable architecture, UCI startup, and desktop interaction through the window message loop. The GUI smoke test plays e2-e4, waits for the engine reply, checks paired Undo, starts another search and cancels it with New Game, flips the board, and verifies clean shutdown. Manual acceptance is still required on Windows 10/11 client devices for visual rendering, DPI scaling, promotion, physical input, and sustained-search responsiveness.

## Latest automated Windows x64 build

The latest passing Windows workflow is [run #42279871986](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42279871986). Download the [Prunex-Windows-x64 artifact](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42279871986/artifacts/13535052628).

- Commit: `d7bf1ee678fc256ce26c7dd614c4abb2a83168ae`
- Runner: Windows Server 2022; Visual Studio 2022; Release; x64.
- Native CTest: 46/46 passed.
- GUI path: legal e2-e4 input, engine reply, paired undo, search cancellation via New Game, board flip, normal shutdown.
- Pull-request head: `6fe61051538f2122191cba67e79921a8ba67ee06` (the Windows job built merge commit `d7bf1ee678fc256ce26c7dd614c4abb2a83168ae`).
- GUI executable SHA-256: `659DE27421BEB5ADB04A186CB45D825E1D1D5B6FF27A307CB7CB99D82A1DE0F4`.
- CLI executable SHA-256: `43F59958275008BE1F2D53E2BF101E2E06ED270B2ECFF8AC769F89EE01F62FE9`.
- Artifact ZIP SHA-256: `a2cd5cdb22fa8df5072397da8287b111a193ba724a9a1fde96a31726afed28fd`.
- Artifact expiry: 6 December 2026, 19:31 UTC.

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
