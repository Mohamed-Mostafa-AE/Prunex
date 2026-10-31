# Prunex 0.4.3 Test Report

## Automated test results

| Configuration | Result |
|---|---:|
| GCC 14.2 Release | 42/42 |
| GCC AddressSanitizer + UndefinedBehaviorSanitizer | 42/42 |
| Clang 17 Release | 42/42 |
| GCC 14.2 static analysis (-fanalyzer) | No diagnostics |

Additional checks:
- BUILD_TESTING=OFF registers zero tests.
- UCI handshake, engine response, terminal positions, and quiet check evasions tested.
- FEN validation tests malformed and overflowed move counters, invalid en-passant states, duplicate castling flags, and malformed fields.
- En-passant tests include legal White and Black captures and pinned-capture rejection.
- CLI depth parsing rejects negative, nonnumeric, overflowed, and invalid divide depths.

## Reference perft counts

- Start position, depth 6: 119,060,324
- Kiwipete, depth 4: 4,085,603
- Standard position 5, depth 4: 2,103,487
- Standard position 6, depth 4: 3,894,594

## Fixes covered by regression tests

1. Strict FEN parsing and board-state validation.
2. Safe command-line depth parsing and bounds.
3. Quiescence handling for check evasions and terminal positions.
4. Windows header NOMINMAX protection.
5. Distinct Windows GUI/CLI executable names and explicit MSVC UTF-8 configuration.

## Not yet verified

- Native Windows GUI compilation and runtime.
- GUI responsiveness during deeper engine searches.
- Independent external model review (the included OpenAI review runner requires a configured API key and may incur charges).
- Elo or playing-strength rating.
