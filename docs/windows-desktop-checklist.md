# Windows desktop visual acceptance

The current native CTest suite contains 47 cases. The exact main source commit was freshly built and passed all 47 cases locally under GCC 11.5 Release, Clang 15 Release, and GCC AddressSanitizer/UndefinedBehaviorSanitizer. A fresh successful Windows x64 CI run is still required; the last recorded passing Windows runner used an earlier 46-case source revision.

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