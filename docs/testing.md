# Test results

## Native engine

Prunex 0.8.0 has a 46-case CTest suite covering move generation, position state, search, draw handling, static-exchange evaluation, UCI behaviour, and fixed-position benchmark smoke tests.

The 6 November 2026 CI matrix recorded 46/46 passing tests in each configuration:

| Configuration | Result |
| --- | ---: |
| GCC Release | 46/46 |
| Clang Release | 46/46 |
| GCC AddressSanitizer + UndefinedBehaviorSanitizer | 46/46 |
| Windows x64 | 46/46 |

The sanitizer build ran with leak detection enabled. The Windows job also passed the desktop interaction smoke test. These results validate the tested CI configurations; they do not constitute interactive acceptance on Windows 10/11 client devices.

## Latest release-candidate CI

All six source-validation workflows passed for pull-request head `4bb43dbacb7a8c567c4a0aa0451f4e8e6a561dd9`:

| Workflow | Status | Evidence |
| --- | --- | --- |
| Website build, unit tests, Playwright, and training-data checks | Passed | [Run 42280861610](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42280861610) |
| GCC, Clang, and sanitizer matrix | Passed — 46/46 in all four configurations | [Run 42280861589](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42280861589) |
| Windows x64 build, CTest, and desktop smoke test | Passed | [Run 42280861974](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42280861974) |
| WebAssembly build and parity | Passed | [Run 42280861737](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42280861737) |
| Backup-tool validation | Passed — tooling only | [Run 42280861766](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42280861766) |
| CodeQL C/C++ and JavaScript/TypeScript analysis | Passed | [Run 42280861678](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42280861678) |

The website workflow also passed after the documentation update to the browser project: [Run 42285430091](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42285430091).

Subsequent commits after `4bb43db` on the current PR branch change documentation only; the native and browser source code has not changed since the source-validation head. CodeQL also passed on a subsequent documentation-only PR head, with no new alerts in the changed files: [CodeQL run](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42291135246). Backup-tool validation checks the workflow and tooling; it is not evidence of a successful data-bearing backup or restore.

## Browser and account tests

The website workflow runs unit tests for account messages, email templates, archive authorization, review metrics, calibration data, and security configuration. Playwright covers:

- Desktop and mobile layout, including narrow 390 px viewports.
- Account modal keyboard handling and password visibility.
- Email-field autofill through Chromium's DevTools Autofill protocol.
- Archive interactions and the absence of individual game-record deletion controls.
- Browser game interactions and review navigation.

The production build also runs an npm dependency audit.

## Native search benchmark

Run the fixed five-position benchmark from a Release build:

```bash
./build/prunex --bench
./build/prunex --bench 6
```

The default depth is 5; accepted depths are 1–10. The suite clears transposition-table and search-ordering state before each position, then reports the best move, node count, elapsed time, and aggregate nodes per second.

Use the same compiler, build mode, hardware, and depth when comparing revisions. This is a repeatable search-throughput measurement, not an Elo estimate.

## Strength reporting

The repository preserves a historical 64-game result for Prunex 0.8.0: 63 wins, 1 draw, and 0 losses against Stockfish 2.0. The original result record is linked from the README. This historical result is not an independent Elo rating for the current native build. Any new strength claim requires a reproducible tournament using the tested executable, fixed conditions, balanced colours, retained PGNs, and independently checked results.

## Manual acceptance still required

The Windows CI job runs on a Windows Server 2022 runner. Its GUI smoke test launches the desktop application, plays e2-e4, waits for the engine reply, verifies paired Undo, starts a new search, cancels it with New Game, flips the board, and checks normal shutdown.

Manual client-device acceptance remains necessary for visual rendering at multiple DPI settings, screen fit, promotion choices, physical input, and sustained-search responsiveness.

See [Windows desktop checklist](windows-desktop-checklist.md).
