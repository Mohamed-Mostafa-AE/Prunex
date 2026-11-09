# Test results

## Native engine

Prunex 0.8.0 has a **47-case CTest suite** covering move generation, position state, search, draw handling, static-exchange evaluation, UCI behaviour, and fixed-position benchmark smoke tests.

## Current source validation — 9 November 2026

The current main commit is `89a60ba3665674121cd42d98840257eba346577c`. Its native engine sources are unchanged from `715639559b91d0b8b359a5d3e7a2619075c2f144`, which was freshly configured, built, and tested in an isolated Linux environment.

| Configuration | Result |
|---|---:|
| GCC 11.5 Release | 47/47 passed |
| Clang 15.0.7 Release | 47/47 passed |
| GCC 11.5 AddressSanitizer + UndefinedBehaviorSanitizer | 47/47 passed |
| Windows 2022 / Visual Studio 2022 x64 Release | 47/47 passed |

The sanitizer run used leak detection and halt-on-error settings. The current-main Windows workflow also verified x64 executable headers, UCI startup, and a GUI smoke path covering e2-e4, engine reply, paired undo, search cancellation via New Game, board flip, and clean shutdown.

The following post-merge runs completed successfully on the current main commit:

| Workflow | Evidence |
|---|---|
| Website build, dependency audit, browser smoke tests, and training-data checks | [Run 42686690073](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42686690073) |
| Windows x64 build and desktop smoke test | [Run 42686689854](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42686689854) |
| CodeQL C/C++ and JavaScript/TypeScript | [Run 42686689576](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42686689576) |

The Windows x64 artifact is [available here](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42686689854/artifacts/13703744988). Its build manifest identifies the current main commit and records executable SHA-256 hashes.

These results verify the listed builds and automated checks. Physical Windows 10/11 acceptance, hosted authentication/email validation, a populated-data backup/restore drill, legal review, and production deployment are separate release gates. The tests do not establish an Elo rating.

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
