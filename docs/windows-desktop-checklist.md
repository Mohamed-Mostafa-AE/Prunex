# Windows desktop checklist

The Windows CI workflow checks the native x64 build, regression tests, and UCI startup. Please complete this checklist on Windows 10 or 11 before describing the desktop application as fully tested.

## Build and launch

- [ ] Configure a Visual Studio 2022 x64 build with CMake.
- [ ] Build the Release configuration.
- [ ] Launch `Prunex.exe` and check that the board and controls appear.
- [ ] Launch `prunex-cli.exe` and try `uci` and `isready`.

## Playing a game

- [ ] Select a white piece and check that legal destinations are highlighted.
- [ ] Make a legal move and check that the side to move changes.
- [ ] Try an illegal move and check that the position stays unchanged.
- [ ] Play a human/engine turn, press Undo, and check that both half-moves are restored.
- [ ] Undo after making only a human move.
- [ ] Flip the board and check that square selection still works.
- [ ] Start a new game after several moves.
- [ ] Check check, checkmate, and stalemate positions.
- [ ] Check pawn promotion.
- [ ] Try search depths 1 and 8 and note how responsive the window remains.
- [ ] Resize, minimize, restore, and close the window.

Record the Windows version, compiler version, test output, and any problems found. Leave items unchecked until they have been tested on a Windows machine.
