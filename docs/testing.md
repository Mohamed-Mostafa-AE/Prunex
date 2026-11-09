# Test results

## Native engine

Prunex 0.8.0 currently has a **47-case CTest suite** covering move generation, position state, search, draw handling, static-exchange evaluation, UCI behaviour, and fixed-position benchmark smoke tests.

## Current-main local validation — 9 November 2026

The exact main source commit `715639559b91d0b8b359a5d3e7a2619075c2f144` was freshly configured, built, and tested in an isolated Linux environment.

| Configuration | Result |
|---|---:|
| GCC 11.5 Release | 47/47 passed |
| Clang 15.0.7 Release | 47/47 passed |
| GCC 11.5 AddressSanitizer + UndefinedBehaviorSanitizer | 47/47 passed |
| Website `npm run build` and bundled validation scripts | Passed |

The sanitizer run used leak detection and halt-on-error settings. These local results demonstrate the listed Linux builds only; they do not substitute for a successful Windows x64 workflow or manual Windows 10/11 acceptance.

## Current GitHub Actions status

The GitHub Actions runs associated with main commit `715639559b91d0b8b359a5d3e7a2619075c2f144` did not produce a fully green cross-platform matrix:

| Workflow | Current recorded result |
|---|---|
| Native compiler matrix and sanitizers | Workflow conclusion: unsuccessful. The accessible job results included GCC Release and GCC ASan/UBSan passing 47/47; the full compiler matrix was not returned. |
| Windows x64 validation | Workflow conclusion: unsuccessful; a successful current-main Windows result is not available. |
| CodeQL security analysis | Workflow conclusion: unsuccessful; a successful current-main analysis is not available. |

Run records: [Native](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42672729254) · [Windows x64](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42672729455) · [CodeQL](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42672729565).

The failed job details were not returned by the connected GitHub inspection, so no root cause is inferred here. The required next validation is a fresh successful run of the affected workflows against the final source commit.

## Historical release-candidate CI — 6 November 2026

All six source-validation workflows passed for the earlier release-candidate source commit `4bb43dbacb7a8c567c4a0aa0451f4e8e6a561dd9`. At that point the native suite contained 46 cases:

| Workflow | Historical result |
|---|---|
| Website build, unit tests, Playwright, and training-data checks | [Run 42280861610](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42280861610) |
| GCC, Clang, and sanitizer matrix | [Run 42280861589](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42280861589) |
| Windows x64 build and desktop smoke test | [Run 42280861974](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42280861974) |
| WebAssembly build and parity | [Run 42280861737](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42280861737) |
| CodeQL C/C++ and JavaScript/TypeScript analysis | [Run 42280861678](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42280861678) |
| Backup-tool validation | [Run 42280861766](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42280861766) |

The historical backup-tool result validates tooling only. It is not evidence of a successful data-bearing backup or restore.

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

Prunex does not publish a playing-strength rating. The fixed-position native benchmark measures search throughput under the selected build conditions; it is not an Elo estimate. Any future strength claim requires a reproducible tournament using the tested executable, fixed conditions, balanced colours, retained game records, and independently checked results.

## Manual acceptance still required

The Windows CI job runs on a Windows Server 2022 runner. Its GUI smoke test launches the desktop application, plays e2-e4, waits for the engine reply, verifies paired Undo, starts a new search, cancels it with New Game, flips the board, and checks normal shutdown.

Manual client-device acceptance remains necessary for visual rendering at multiple DPI settings, screen fit, promotion choices, physical input, and sustained-search responsiveness.

See [Windows desktop checklist](windows-desktop-checklist.md).
