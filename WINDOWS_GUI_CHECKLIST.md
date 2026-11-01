# Windows GUI verification checklist

The Windows CI workflow checks the native x64 build, CTest suite, and UCI startup. Complete this manual checklist on Windows 10/11 before describing the desktop GUI as fully tested.

## Build and launch

- [ ] Configure with Visual Studio 2022 x64 and CMake.
- [ ] Build Release successfully.
- [ ] Launch `Prunex.exe` and confirm the board and controls render.
- [ ] Launch `prunex-cli.exe` and verify `uci` and `isready`.

## Gameplay

- [ ] Select a white piece and verify legal destinations highlight.
- [ ] Make a legal move and verify side-to-move changes.
- [ ] Attempt an illegal move and verify the board remains unchanged.
- [ ] Complete a human/engine turn, press Undo, and verify both half-moves restore.
- [ ] Undo after only a human move.
- [ ] Flip the board and verify click mapping.
- [ ] Start a new game after several moves.
- [ ] Verify check, checkmate, and stalemate status.
- [ ] Verify queen-default promotion.
- [ ] Test search depths 1 and 8 and record UI responsiveness.
- [ ] Resize, minimize, restore, and close the window.

Record Windows version, compiler version, test output, and screenshots for any defect. Do not mark GUI runtime validation complete until this checklist has been exercised on Windows.
