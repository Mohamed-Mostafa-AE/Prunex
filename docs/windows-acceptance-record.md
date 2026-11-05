# Prunex Windows 10/11 acceptance record

The automated Windows x64 workflow verifies compilation, CTest, executable architecture and UCI startup. It does not test interactive desktop rendering or human input. Complete this record on a physical or virtual Windows 10/11 desktop.

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
- [ ] Resize, maximize, minimize, restore, and full-screen transitions work.
- [ ] Board flip does not break square selection or move input.
- [ ] Close during an active search exits cleanly; no orphaned engine process remains.
- [ ] Repeated launch/close cycles do not leave stale processes or corrupt settings.

## Results

- Passed:
- Failed:
- Not tested:
- Crash/error logs:
- Screenshots/video locations:
- Tester sign-off:
