# Prunex 0.8.0 — release readiness

**Review date:** 6 November 2026  
**Reviewed code commit:** `20973e346c8d78e852f65aca256ecc6f17dc1a1b`  
**Scope:** native C++20 engine, Windows desktop application, browser application, identity, and private game archive.

This record separates source-code validation from hosted-service configuration and operational acceptance.

## Architecture

- The native Prunex engine is a C++20 chess engine with its own board representation, legal move generation, search, evaluation, and UCI interface.
- The Windows desktop application is a native interface to the engine.
- The website is a separate browser application. It uses `chess.js` for game rules and the Stockfish.js 19 Full browser package for its opponent and review analysis; it does not execute the native C++ engine.
- Private cloud games are stored in Neon PostgreSQL through a same-origin server API. Supabase Auth supplies identity and retains legacy source records. Browser-local games are stored in IndexedDB.
- Account access supports guest sessions, linking an email to the current guest identity, password setup after email verification, password sign-in, and password recovery.
- Account closure is the only destructive archive action exposed in the interface. Individual game-record deletion is not available.

## Current source validation

All six GitHub Actions workflows passed for the reviewed commit:

| Workflow | Result |
|---|---|
| Website and Playwright | [Success](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42252559692) |
| Native GCC, Clang, ASan and UBSan | [Success](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42252559531) |
| Windows x64 build and desktop smoke test | [Success](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42252559544) |
| WebAssembly parity | [Success](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42252559596) |
| CodeQL, C/C++ and JavaScript/TypeScript | [Success](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42252559539) |
| Backup-tool validation | [Success](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42252559677) |

The native CTest suite passed 46/46 on GCC Release, Clang Release, GCC AddressSanitizer/UndefinedBehaviorSanitizer, and Windows x64. The Windows runner exercises move input, engine reply, paired undo, search cancellation, board flip, and shutdown. Both CodeQL language jobs completed with zero SARIF findings. The website workflow covers the browser account interface, inline password recovery, actual Chromium autofill state, responsive desktop/mobile layouts, and user-facing error handling.

The current Vercel preview is a separate deployment from production. Production promotion is not recorded in this release review.

## Live identity and archive state — 6 November 2026

### Supabase source

The live project has 13 Auth identities: 12 anonymous identities and one confirmed non-anonymous email identity. The public archive tables contain 35 games, 3 reviews, and 0 position-memory rows. Those games and reviews belong to five anonymous user IDs; the confirmed email identity has no games or reviews.

The original guest identity that owns the intended personal archive has not been established. No records have been reassigned, imported, or deleted. Import authorization must remain tied to the exact guest identity after email confirmation; row counts and email similarity are not sufficient evidence of ownership.

### Neon archive

The active Neon archive contains:

| Table | Rows |
|---|---:|
| `prunex_archive.games` | 0 |
| `prunex_archive.game_reviews` | 0 |
| `prunex_archive.position_memory` | 0 |
| `prunex_archive.migration_state` | 0 |

A checksummed recovery record stores the legacy source counts (35 games, 3 reviews, 0 position-memory rows) and its payload hash. It is not an imported active archive or a verified full database backup. The only Neon manual snapshot is named `prunex-empty-schema-before-owner-migration`; a restore-check branch also contains an empty schema. The Neon snapshot schedule is empty.

### Authentication and email

The application enforces a 12-character password minimum and does not store password values in browser storage or game records. Supabase Security Advisor reports breached-password protection disabled. Hosted identity-linking settings, confirmation settings, Site URL, redirect allowlist, custom SMTP, and the three email templates have not been verified in the live dashboard. No controlled mailbox test confirms email-linking, recovery, or password-change notification delivery.

### Security advisor observations

Supabase health advisor returned no findings. Security advisor reports anonymous-access policy warnings for the game, review, and position-memory tables because anonymous Supabase sessions use the `authenticated` Postgres role. The inspected game and review policies restrict rows using `auth.uid()`; position-memory reads are shared only for the optional position-memory feature, with writes tied to a user's own game and an opted-in review. These policies must be evaluated against the guest/consent model rather than removed to silence the warning.

The advisor also reports breached-password protection disabled. Four unused-index notices are informational; no index was dropped without query-plan evidence.

## Repository and release controls

- The top-bar account control opens account and password settings. Password sign-in and password recovery are available; recovery remains inline in the sign-in interface.
- The account interface exposes account closure, not individual game or record deletion.
- The autofill regression test invokes Chromium autofill through CDP and checks the browser autofill state and computed field appearance.
- The repository retains the native engine, browser application, and third-party licensing boundaries separately.
- The project-name explanation is recorded in `README.md` and `docs/project-name.md`: PRUN refers to alpha–beta pruning; EX refers to competitive execution. This is the founder's stated naming inspiration, not a formal acronym.
- The active GitHub `Protect main` ruleset still has no required status-check rule and requires zero approvals. Green workflows therefore are not currently enforced as merge requirements.
- The website's `main.js` remains a large application controller; `src/gui.cpp` also retains a build-time dependency on the CLI translation unit. These are known refactoring opportunities. They should be addressed incrementally with full regression coverage, not through a broad pre-release rewrite.

## Release decision

**Source-code validation is green. Production release is not cleared.** The following controls still require evidence outside repository CI:

1. Hosted Supabase identity-linking and password settings, approved redirect URLs, email templates, custom SMTP, sender-domain verification, and successful real-mailbox tests.
2. Verification of the exact original guest identity that owns the intended archive. The confirmed email account owns no legacy games or reviews; no records may be reassigned by inference.
3. A complete encrypted database export, checksum verification, decryption, and data-bearing restore into an isolated target. The empty-schema snapshot and source-count record do not satisfy this requirement.
4. Manual Windows 10/11 client-device acceptance for visual rendering, display scaling, promotion, physical input, and sustained search. The automated runner is Windows Server 2022.
5. Qualified legal review and approval of the Privacy Notice and Terms of Use, which remain labelled drafts.
6. Required status checks on `main`; a human approval rule should be enabled only if an independent reviewer is available.
7. Production-domain smoke testing after the other release controls are closed.

No independently measured Elo rating or comparative match result is claimed for the native engine.
