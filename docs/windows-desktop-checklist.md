# Windows desktop visual acceptance

The latest Windows x64 workflow builds the GUI and CLI, runs all 46 native CTest cases, verifies x64 executable headers and UCI startup, and exercises a GUI interaction path: e2-e4, engine reply, paired undo, depth-8 search cancellation through New Game, board flip, and clean shutdown.

This checklist is for the remaining human visual and input acceptance on a Windows 10/11 desktop.

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