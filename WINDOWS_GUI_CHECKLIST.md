# Windows GUI Verification Checklist

Complete after a successful Windows Actions build, then test manually on Windows 11.

## Build and launch
- [ ] Configure with Visual Studio 2022 x64 and CMake.
- [ ] Build Release successfully.
- [ ] Launch Prunex.exe and confirm the board and controls render.
- [ ] Launch prunex-cli.exe and verify `uci` and `isready`.

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
- [ ] Test search depths 1 and 8, noting UI responsiveness.
- [ ] Resize, minimize, restore, and close the window.

Record Windows version, compiler version, test output, and screenshots for any defect. Do not mark GUI runtime validation complete until this checklist has been exercised on Windows.
