# Prunex 0.8.0 — release readiness

**Review snapshot:** 6 November 2026  
**Scope:** native C++20 engine, Windows desktop application, browser demonstration, and private game archive.

This document distinguishes repository-verified controls from service configuration and operational checks that require a separate validation.

## Architecture

- The native Prunex engine is a C++20 chess engine with its own board representation, legal move generation, search, evaluation, and UCI interface.
- The Windows desktop application is a native interface to that engine.
- The website is a separate browser application. It uses `chess.js` for game rules and the Stockfish.js 19 Full browser package for its opponent and review analysis. It does not execute the native C++ engine.
- Private cloud games are stored in Neon PostgreSQL through a same-origin server API. Supabase Auth supplies identity and retains legacy source records. Browser-local games are stored in IndexedDB.
- Account access supports guest sessions, linking an email to the current guest identity, password setup after email verification, password sign-in, and password recovery.
- Account closure is the only destructive archive action exposed in the UI. Individual game-record deletion is not available.

## Repository-verified controls

- Supabase game, review, and position-memory tables use row-level security.
- Private archive requests are owner-scoped on the server using a verified Supabase identity and the server-only owner-email allowlist.
- Account deletion is handled by a JWT-verified Edge Function.
- Optional position-memory sharing is off by default and requires per-review consent.
- The website build includes unit tests, dependency audit, and Playwright desktop/mobile smoke coverage.
- Browser response headers include CSP, HSTS, frame protections, referrer and permissions policies, and cross-origin isolation.
- The native WebAssembly target compiles the same C++ implementation and has parity checks. The website worker remains a separate browser implementation.
- Email-change, password-reset, and password-change notification templates are versioned in the repository. The local Supabase configuration does not update the hosted dashboard.

## Live provider observations — 6 November 2026

### Identity and archive ownership

The source Supabase project contains 35 legacy games and 3 reviews across five anonymous identities. A separate confirmed email identity currently owns no games or reviews. The intended guest identity has not been established, so no account migration or reassignment has been performed.

A recovery record in Neon stores a source snapshot reporting 35 games, 3 reviews, and 0 position-memory rows, with a SHA-256 payload checksum. The active Neon archive currently has 0 imported games, 0 reviews, and 0 position-memory rows.

### Authentication and email

The application enforces a 12-character password minimum. The hosted Supabase password policy and breached-password protection are separate controls.

Supabase Security Advisor currently reports breached-password protection disabled. The project is on the Free plan; the provider's stronger password-screening capability is not available in the current project tier.

The available project connection does not expose hosted Auth identity-linking, email-provider, SMTP, or redirect-allowlist configuration. No controlled mailbox test has established delivery, link expiry, or password-reset completion.

### Database and backup

The active Neon project is on the Free plan with six-hour point-in-time history. Its one manual snapshot quota is already used. The Neon API reports that scheduled backup configuration is not enabled for this project. An encrypted-backup table exists in Supabase, but it contains no backup records.

The legacy source snapshot is not a data-bearing backup of the active Neon archive, and it has not passed a full encrypted export/decrypt/restore drill.

### Database security findings

Supabase Security Advisor reports anonymous-policy warnings on the guest game and review tables. These policies apply to authenticated-role guest users and restrict access by `auth.uid()`; disabling the guest model without a replacement would break the current archive workflow. Shared position-memory reads are intentional and remain subject to the feature's consent design.

Supabase also reports breached-password protection disabled. Unused-index notices are informational and should be evaluated against query plans before any index is removed.

### Branch protection

The active GitHub `Protect main` ruleset still has no required status checks. The connected repository tools can inspect rulesets but do not provide repository-administration write access to change them.

## Release decision

The current branch has passing automated code checks, but it is not approved for production promotion until the following external controls have been verified:

1. Hosted Supabase manual identity linking, email confirmation, password policy, Site URL, and redirect allowlist.
2. Custom SMTP configuration and successful verification, recovery, and password-change messages to controlled mailboxes.
3. Identification of the correct guest archive in its original browser session, followed by a verified, user-scoped migration and source/destination count reconciliation.
4. A data-bearing backup and restore process. The current Neon plan and snapshot quota do not provide a completed off-provider recovery drill.
5. Interactive Windows 10/11 desktop acceptance.
6. Qualified legal review and written clearance of the Privacy Notice and Terms.
7. Required GitHub status checks on `main`.
8. A final production deployment and smoke test after the preceding checks are closed.

No comparative rating or match result is claimed for the current native engine. The release record should be updated only when a gate has a verifiable result.
