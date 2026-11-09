# Windows desktop visual acceptance

The current main commit `89a60ba3665674121cd42d98840257eba346577c` passed the Windows x64 Release workflow on Windows Server 2022 with Visual Studio 2022: all 47 CTest cases passed, x64 executable and UCI startup checks passed, and the automated GUI smoke path completed. See [the current Windows x64 run](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42686689854) and [its build artifact](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42686689854/artifacts/13703744988).

This checklist is the final manual visual and input acceptance on a Windows 10/11 client desktop. Record results in [the acceptance record](windows-acceptance-record.md).

## Display and input

- [ ] Record Windows edition/build, display resolution, and scaling.
- [ ] At 100% and 150% scaling, verify the board, coordinates, status, and controls render without overlap or clipping.
- [ ] Check the fixed-size window on 1366×768 and 1920×1080 displays.
- [ ] Use a physical mouse or touchpad to select pieces and squares.
- [ ] Confirm selected-square and legal-destination highlights are clear and correctly positioned.
- [ ] Check board flip and square selection with both orientations.

## Game states and promotion

- [ ] Test all four promotion choices (queen, rook, bishop, and knight).
- [ ] Check check, checkmate, stalemate, and draw presentations.
- [ ] Play several moves and verify Undo/redo behavior where available.

## Search and lifecycle

- [ ] Observe responsiveness during sustained searches at depths 1, 4, and 8.
- [ ] Close during an active search and confirm the process exits without an orphaned engine thread.
- [ ] Repeat launch/close cycles and check for stale processes or damaged settings.

Record screenshots and any issues in [the acceptance record](windows-acceptance-record.md).