# Prunex 0.8.0 — release readiness

**Review snapshot:** 6 November 2026  
**Scope:** native C++20 engine, Windows desktop application, browser demonstration and private game archive.

This page separates controls that can be verified from repository source/CI from provider configuration and operational work that still requires an external check.

## Product architecture

- The native Prunex engine is an independently implemented C++20 chess engine with its own position representation, legal move generation, search, evaluation and UCI interface.
- The Windows desktop application is a separate native interface to that engine.
- The website browser demonstration is a separate application. It uses `chess.js` for browser game rules and the third-party Stockfish.js 19 Full build as its opponent and review engine. It does not run the native C++ engine.
- The private game archive uses Neon through a same-origin server API. Supabase Auth supplies identity and retains legacy source/fallback records. Browser-local games are stored in IndexedDB.
- Account access supports guest sessions, linking an email to the current guest identity, setting a password after email verification, password sign-in and password-reset email. The application enforces a 12-character minimum; the hosted Supabase password policy and leaked-password protection must also be checked.
- Account closure is the only destructive archive action exposed in the UI. There is no individual game/record deletion control.

## Repository-verified controls

- Supabase game, review and position-memory tables use RLS. Private archive requests are owner-scoped on the server; user metadata is not used as an authorization source.
- Account deletion is handled by a JWT-verified Supabase Edge Function. The server validates the caller, revokes sessions, deletes the Auth identity and relies on foreign-key cascades for cloud records.
- Optional position-memory sharing is off by default and is gated by per-review consent. The server and database enforce owner/consent checks.
- The website has a Vite production build, unit tests, dependency audit and Playwright desktop/mobile smoke coverage.
- The browser response policy defines a restrictive CSP, HSTS, frame protections, referrer and permissions policies, and cross-origin isolation headers.
- The native WebAssembly build compiles the same C++ implementation and has CI parity checks. The current website worker remains a separate Stockfish.js-based browser engine.
- Email-change, password-reset and password-change-notification HTML templates are stored in `supabase/templates/`. Repository tests validate their provider variables and secret hygiene. A local `supabase/config.toml` entry does not configure the hosted Supabase dashboard.

## Strength claims

No independently measured Elo rating has been established for the native C++20 engine. Node counts, a fixed-position benchmark, and results from the separate browser application are not substitutes for a controlled match series using the native executable. Archived historical match records remain in a separate evidence report and are not used as a native-engine performance claim.

## Current provider observations — 6 November 2026

- The Supabase source project contains 35 legacy games and 3 reviews across five anonymous identities. A separate verified email identity currently owns no games or reviews. The correct guest identity has not been established, so no account migration has been performed.
- A recovery snapshot row is present in Neon with source counts of 35 games, 3 reviews and 0 position-memory rows, plus a SHA-256 payload checksum. The active Neon archive tables currently contain 0 imported games, 0 reviews and 0 position-memory rows.
- The existing Neon manual snapshot predates that recovery row. A restored branch from the old snapshot does not contain the recovery table. A new manual snapshot is blocked by the project's one-snapshot limit; scheduled snapshots are unavailable on the current plan.
- Vercel has a sensitive `PRUNEX_OWNER_EMAIL` variable in Preview and Production. Its value is redacted by the available connection, so correspondence with the verified Supabase identity has not been attested.
- Supabase Auth settings and SMTP secrets are not exposed by the connected project-inspection actions. Hosted manual linking, confirmation, password policy, redirect allowlist, custom SMTP and live mailbox delivery remain unverified.
- The active GitHub `Protect main` ruleset still has no required status checks. The available GitHub connection can inspect rulesets but cannot update them.

## External release gates

The following items are not established by passing repository CI:

1. **Hosted Supabase Auth:** confirm manual identity linking is enabled, anonymous sign-in and email/password sign-in are enabled as intended, confirmation is required, and password rules/leaked-password protection match the application.
2. **Email delivery:** install the email-change, recovery and password-change templates in the hosted project, set the production Site URL and redirect allowlist, configure authenticated custom SMTP, and test delivery and link expiry in controlled mailboxes.
3. **Owner identity and migration:** link the intended existing guest session in its original browser, verify its email, set the password, confirm the games remain visible, then import only the verified user ID into Neon. Do not infer ownership or combine guest archives.
4. **Backup and restore:** configure the encrypted off-provider backup workflow with owner-supplied GitHub Actions settings, merge it to the protected branch, run it, and complete a data-bearing restore drill. An empty-schema restore is not proof of user-data recovery.
5. **Legal review:** Privacy Notice and Terms remain drafts pending qualified review of the actual operator, audience, jurisdictions, minors/consent, transfers, retention and deletion disclosures.
6. **Windows desktop:** complete interactive Windows 10/11 testing. CI build/CTest/UCI smoke checks do not validate all GUI behavior.
7. **Branch protection:** the active `Protect main` ruleset prevents deletion and force-pushes and requires pull requests, but currently has zero required approvals and no required CI status checks. Configure checks before merging a release candidate.
8. **Production promotion:** the updated application has been validated on a preview deployment. No production promotion is approved by this document.

## Deployment and test records

Record the exact Git commit, workflow run IDs, preview deployment ID, provider configuration date and unresolved release gates when this snapshot is refreshed. Do not leave older point-in-time account counts or CI states in this document as though they were current.

Release approval requires both passing automated checks and completion of the applicable external gates above.
