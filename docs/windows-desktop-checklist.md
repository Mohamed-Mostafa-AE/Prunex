# Windows desktop verification

The Windows CI workflow builds the native GUI and CLI, runs the CTest suite, checks the executable architecture and UCI startup, and launches the desktop window in a Windows runner. The automated GUI smoke test checks window creation, title, responsiveness and clean shutdown. It does not replace a hands-on Windows 10/11 session.

## Build and launch

- [ ] Build the Release configuration with Visual Studio 2022 x64 and CMake.
- [ ] Launch `Prunex.exe`; confirm the board, coordinates, controls and status text render.
- [ ] Confirm the fixed-size window fits the available display without being hidden by the taskbar.
- [ ] Launch `prunex-cli.exe` and verify `uci` and `isready`.

## Playing a game

- [ ] Select a white piece and confirm legal destinations are highlighted.
- [ ] Make a legal move and confirm the side to move changes.
- [ ] Try an illegal move and confirm the position is unchanged.
- [ ] Play a human/engine turn and check that Undo restores both half-moves.
- [ ] Undo after a human-only move.
- [ ] Flip the board and confirm square selection still works.
- [ ] Start a new game after several moves.
- [ ] Check check, checkmate and stalemate positions.
- [ ] Check pawn promotion and the selected promotion piece.
- [ ] Try search depths 1, 4 and 8; confirm the window remains responsive.
- [ ] Start a search, start a new game, and confirm the old search cannot alter the new position.
- [ ] Close the window during an active search and confirm the process exits without an orphaned engine thread.

## Environment and results

Record the Windows edition/build, display resolution and scaling, CPU/GPU, compiler version, tested commit, and any issues. Keep screenshots and logs with the test record. Leave checks unchecked until they have been observed on a Windows desktop.
