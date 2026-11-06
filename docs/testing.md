# Test results

## Native engine

Prunex 0.8.0 has a 46-case CTest suite covering move generation, position state, search, evaluation, UCI behaviour, and fixed-position benchmark smoke tests.

The 6 November 2026 CI matrix recorded 46/46 passing tests in each configuration:

| Configuration | Result |
|---|---:|
| GCC 14.2 Release | 46/46 |
| Clang 17 Release | 46/46 |
| GCC AddressSanitizer + UndefinedBehaviorSanitizer | 46/46 |
| Windows x64 | 46/46 |

The sanitizer build ran with leak detection enabled. The Windows job also passed the desktop interaction smoke test. The results validate the tested CI configurations; they do not constitute interactive acceptance on Windows 10/11 client devices.

## Recorded CI runs

All links below refer to the same reviewed source commit, `4591190f6eea8ab01470ced2913986277dbb78d5`.

- [Website build, unit tests, and Playwright browser checks](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42251005146)
- [GCC, Clang, and sanitizer matrix](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42251005141)
- [Windows x64 build, 46/46 CTest cases, and GUI smoke](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42251005114)
- [WebAssembly build and native parity](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42251005158)
- [CodeQL C/C++ and JavaScript/TypeScript](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42251005205)
- [Backup-tool validation](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42251005120)

## Browser and account tests

The website build runs unit tests for account messages, Supabase email templates, archive authorization, review metrics, calibration data, and security configuration. Playwright covers:

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

No independently measured Elo rating or controlled public match result is currently claimed for the native C++20 engine. A strength claim requires a reproducible tournament using the current native executable, fixed conditions, balanced colours, retained PGNs, and independently checked results.

## Manual acceptance still required

The Windows CI job runs on a Windows Server 2022 runner. Its GUI smoke test launches the desktop application, plays e2-e4, waits for the engine reply, verifies paired Undo, starts a new search, cancels it with New Game, flips the board, and checks normal shutdown. Manual client-device acceptance remains necessary for visual rendering at multiple DPI settings, screen fit, promotion choices, physical input, and sustained-search responsiveness.

See [Windows desktop checklist](windows-desktop-checklist.md).
