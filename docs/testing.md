# Test results

## Native engine

Prunex 0.8.0 has a 46-case CTest suite covering move generation, position state, search, evaluation, UCI behavior, and fixed-position benchmark smoke tests.

The 6 November 2026 CI matrix recorded 46/46 passing tests in each of the following configurations:

| Configuration | Result |
|---|---:|
| GCC 14.2 Release | 46/46 |
| Clang 17 Release | 46/46 |
| GCC AddressSanitizer + UndefinedBehaviorSanitizer | 46/46 |
| Windows x64 | 46/46 |

The sanitizer build ran with leak detection enabled. These results validate the native test suite; they do not constitute interactive acceptance of the Windows desktop application.

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

The Windows CI job now exercises a GUI interaction path, including a legal move, engine reply, paired undo, search cancellation, board flip, and clean shutdown. The separate desktop checklist covers visual DPI, screen fit, promotion, physical input, and sustained-search acceptance.

See [Windows desktop checklist](windows-desktop-checklist.md).
