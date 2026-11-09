# Prunex 0.8.0 — release readiness

**Review date:** 9 November 2026  
**Repository:** `Mohamed-Mostafa-AE/Prunex`  
**Scope:** native C++20 engine, Windows desktop application, browser application, identity, and private game archive.

This record separates source-code validation from hosted-service configuration and operational acceptance.

## Architecture

- The native Prunex engine is an independently implemented C++20 chess engine with its own 0x88 board representation, legal move generation, Zobrist hashing, transposition table, iterative-deepening negamax alpha–beta/PVS search, move ordering, and UCI interface. Its current evaluator is handcrafted and tapered across middlegame/endgame phases.
- The Windows desktop application is a native interface to the engine.
- The website is a browser application. It uses `chess.js` for game rules and runs the same Prunex 0.8.0 C++20 engine through its Emscripten/WebAssembly build for opponent and review analysis. Prunex owns the browser worker, review pipeline, calibration, archive integration, and presentation.
- Private cloud games are stored in Neon PostgreSQL through a same-origin server API. Supabase Auth supplies identity and retains legacy source records. Browser-local games are stored in IndexedDB.
- Account access supports guest sessions, linking an email to the current guest identity, password setup after email verification, password sign-in, and password recovery.
- Account closure is the only destructive archive action exposed in the interface. Individual game-record deletion is not available.

## Current source validation

All six source-validation GitHub Actions workflows passed for source commit `4bb43dbacb7a8c567c4a0aa0451f4e8e6a561dd9`: 

| Workflow | Result |
|---|---|
| Website and Playwright | [Success](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42280861610) |
| Native GCC, Clang, ASan and UBSan | [Success](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42280861589) |
| Windows x64 build and desktop smoke test | [Success](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42280861974) |
| WebAssembly parity | [Success](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42280861737) |
| CodeQL, C/C++ and JavaScript/TypeScript | [Success](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42280861678) |
| Backup-tool validation (tooling only) | [Success](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42280861766) |

The native CTest suite passed 46/46 on GCC Release, Clang Release, GCC AddressSanitizer/UndefinedBehaviorSanitizer, and Windows x64. CodeQL also passed on a subsequent documentation-only PR head, with no new alerts in changed files: [CodeQL run 42291135246](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42291135246). The Windows runner exercises move input, engine reply, paired undo, search cancellation, board flip, and shutdown. Both CodeQL language jobs completed with zero SARIF findings. The website workflow covers the browser account interface, inline password recovery, actual Chromium autofill state, responsive desktop/mobile layouts, and user-facing error handling.

The canonical [prunex-play.vercel.app](https://prunex-play.vercel.app/) domain currently returns HTTP 200 but resolves to production deployment `dpl_Ddkb1haGZLihbzoaULCZUnbTy2os`, built from feature-branch commit `b188ff216281c17d90c3000118bba4e06f7e3582`. The latest main-linked deployment inspected in this review was `READY` at commit `bf9e8d4a9828da1bb1f824b678043d16706107aa`, but it was not a production-target deployment; the current main head had not yet been built for production. Keep the production alias unchanged until the owner archive, backups, authentication, legal, and device-acceptance gates are closed.

## Live identity and archive state — 6 November 2026

### Supabase source

A live check on 9 November 2026 found 31 Auth identities: 30 anonymous identities and one email-confirmed identity. The public archive tables contain 35 games, 3 reviews, and 0 position-memory rows. The 35 games are split evenly across five anonymous identities (7 each); the confirmed email identity owns zero games and zero reviews.

The original guest identity that owns the intended personal archive has not been established. No records have been reassigned, imported, or deleted. Import authorization must remain tied to the exact guest identity after email confirmation; row counts and email similarity are not sufficient evidence of ownership.

### Neon archive

The active Neon archive contains:

| Table | Rows |
|---|---:|
| `prunex_archive.games` | 0 |
| `prunex_archive.game_reviews` | 0 |
| `prunex_archive.position_memory` | 0 |
| `prunex_archive.migration_state` | 0 |

Read-only checks on 9 November 2026 found zero rows in the active Neon `games`, `game_reviews`, and `position_memory` tables. The restore-check and restored-drill branches also contain zero rows in those archive tables. A checksummed legacy-source record stores counts of 35 games and 3 reviews with a payload hash, but it is not an imported archive or a verified full database backup. Supabase's `vortex_private.encrypted_backups` table currently contains zero backup records.

### Authentication and email

The application enforces a 12-character password minimum and does not store password values in browser storage or game records. Supabase Security Advisor reports breached-password protection disabled. Hosted identity-linking settings, confirmation settings, Site URL, redirect allowlist, custom SMTP, and the three email templates have not been verified in the live dashboard. No controlled mailbox test confirms email-linking, recovery, or password-change notification delivery. The required server-side Vercel variable keys are present for Supabase Auth verification, the owner-email allowlist, and the restricted Neon application connection; their presence does not prove successful end-to-end operation.

### Security advisor observations

Supabase health advisor returned no findings. Security advisor reports anonymous-access policy warnings for the game, review, and position-memory tables because anonymous Supabase sessions use the `authenticated` Postgres role. The inspected game and review policies restrict rows using `auth.uid()`; position-memory reads are shared only for the optional position-memory feature, with writes tied to a user's own game and an opted-in review. These policies must be evaluated against the guest/consent model rather than removed to silence the warning.

The advisor also reports breached-password protection disabled. Four unused-index notices are informational; no index was dropped without query-plan evidence.

## Repository and release controls

- The top-bar account control opens account and password settings. Password sign-in and password recovery are available; recovery remains inline in the sign-in interface.
- The account interface exposes account closure, not individual game or record deletion.
- The autofill regression test invokes Chromium autofill through CDP and checks the browser autofill state and computed field appearance.
- The repository retains the native engine, browser application, and third-party licensing boundaries separately.
- The project-name explanation is recorded in `README.md` and `docs/project-name.md`: PRUN comes from alpha–beta PRUNing; EX represents the execution of adversarial search while anticipating the opponent's replies.
- The native C++ evaluator is handcrafted and tapered, and both native and browser builds use this same evaluator.
- The deployed Supabase `delete-account` Edge Function is active with JWT verification enabled. Its live logic verifies the caller token, restricts allowed origins, requires explicit confirmation, revokes refresh sessions, and deletes only the authenticated account.
- The active GitHub `Protect main` ruleset requires pull requests, but currently has zero required approvals and no required status checks. Green workflows therefore are not enforced as merge requirements.
- The website's `main.js` remains a large application controller; `src/gui.cpp` also retains a build-time dependency on the CLI translation unit. These are known refactoring opportunities. They should be addressed incrementally with full regression coverage, not through a broad pre-release rewrite.

## Required operator actions before production promotion

These are dashboard/device tasks; repository CI cannot complete them.

1. **Resolve the original guest identity.** Open the candidate preview in the exact browser profile containing the legacy archive. Confirm that the games are visible before changing identity. Use **Account & password** to link and verify an email on that existing guest session, then set its password in the same profile. Do not sign in to an unrelated account or reassign records by guessing. Verify the confirmed identity and the server-side `PRUNEX_OWNER_EMAIL` allowlist match before allowing the owner-scoped import. Reconcile the selected owner's games, reviews, foreign keys, and migration state in Supabase and Neon.
2. **Complete Supabase Auth setup.** In Authentication settings, enable manual identity linking, confirm email/password sign-in and email confirmations, set the production Site URL, and allow only the approved production/preview redirects. Apply the three repository email templates (email change, password recovery, password changed). Configure custom SMTP and verified sender-domain DNS (SPF, DKIM, DMARC), then test confirmation, recovery, and password-change notifications using controlled mailboxes. The leaked-password protection setting is currently off; Supabase currently documents it as Pro-plan-and-above, so check the project's plan before deciding whether to upgrade.
3. **Activate and prove encrypted backups.** In GitHub → Settings → Secrets and variables → Actions, add variable `PRUNEX_BACKUP_AGE_RECIPIENT` and secret `NEON_BACKUP_DATABASE_URL`. Use a database-owner connection able to read all archive rows (the restricted `prunex_app` connection is not suitable). Keep the age private identity offline. After the backup workflow is on `main`, run it manually, download an encrypted artifact, verify its checksum, decrypt and restore to an isolated PostgreSQL 18 instance, and reconcile row counts. A successful tooling test or empty-schema restore is not sufficient.
4. **Enforce merge protection.** Edit [Protect main](https://github.com/Mohamed-Mostafa-AE/Prunex/rules/26650516) to require the website/browser, native compiler/sanitizer, Windows x64, WebAssembly parity, both CodeQL language analyses, and backup-tool checks. Keep the pull-request rule. Require an independent approval if a second reviewer is available. Re-read the saved ruleset to confirm enforcement.
5. **Complete Windows client acceptance.** Run the checklist in `docs/windows-desktop-checklist.md` on actual Windows 10/11 devices, including 100%/150% DPI, 1366×768 and 1920×1080 layouts, all promotions, physical input, end states, sustained search, and repeated shutdown.
6. **Obtain qualified legal sign-off.** The Privacy Notice and Terms remain drafts. Counsel should review operator identity, audience/age and consent, Egyptian and other applicable privacy rules, cross-border transfers, retention, deletion, backups, and the separate native/browser licensing boundaries.
7. **Release the tested commit, not the preview by accident.** After the preceding gates close, merge the reviewed PR to `main`, build a production-target deployment from the merged commit with production environment settings, test the staged production deployment, and only then assign/promote the production alias. Do not promote the current preview deployment as a substitute for a production build.

## Release decision

**Source-code validation is green. Production release is not cleared.** The following controls still require evidence outside repository CI:

1. Hosted Supabase identity-linking and password settings, approved redirect URLs, email templates, custom SMTP, sender-domain verification, and successful real-mailbox tests.
2. Verification of the exact original guest identity that owns the intended archive. The confirmed email account owns no legacy games or reviews; no records may be reassigned by inference.
3. A complete encrypted database export, checksum verification, decryption, and data-bearing restore into an isolated target. The empty-schema snapshot and source-count record do not satisfy this requirement.
4. Manual Windows 10/11 client-device acceptance for visual rendering, display scaling, promotion, physical input, and sustained search. The automated runner is Windows Server 2022.
5. Qualified legal review and approval of the Privacy Notice and Terms of Use, which remain labelled drafts.
6. Required status checks on `main`; a human approval rule should be enabled only if an independent reviewer is available.
7. Production-domain smoke testing after the other release controls are closed.


