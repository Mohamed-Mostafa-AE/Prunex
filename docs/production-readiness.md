# Prunex 0.8.0 — release readiness

**Review snapshot:** 6 November 2026  
**Reviewed code commit:** `4591190f6eea8ab01470ced2913986277dbb78d5`  
**Scope:** native C++20 engine, Windows desktop application, browser demonstration, and private game archive.

This document separates repository validation from hosted-service configuration and operational acceptance.

## Architecture

- The native Prunex engine is a C++20 chess engine with its own board representation, legal move generation, search, evaluation, and UCI interface.
- The Windows desktop application is a native interface to that engine.
- The website is a separate browser application. It uses `chess.js` for game rules and the Stockfish.js 19 Full browser package for its opponent and review analysis. It does not execute the native C++ engine.
- Private cloud games are stored in Neon PostgreSQL through a same-origin server API. Supabase Auth supplies identity and retains legacy source records. Browser-local games are stored in IndexedDB.
- Account access supports guest sessions, linking an email to the current guest identity, password setup after email verification, password sign-in, and password recovery.
- Account closure is the only destructive archive action exposed in the UI. Individual game-record deletion is not available.

## Repository and CI validation

The current code commit passed all six workflow groups: [website and Playwright](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42251005146), [GCC/Clang/sanitizers](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42251005141), [Windows x64](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42251005114), [WebAssembly parity](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42251005158), [CodeQL](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42251005205), and [backup-tool validation](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42251005120). The native CTest suite passed 46/46 in GCC Release, Clang Release, GCC ASan/UBSan, and Windows x64. The Windows Server 2022 runner also completed the desktop interaction smoke test.

The branch has a Vercel preview deployment built from this commit: [open preview](https://prunex-play-h61330rq8-mohamedhussam09-9067.vercel.app). The deployment is a preview, not a production promotion.

Repository-verified controls:

- Supabase game, review, and position-memory tables use row-level security.
- Private archive requests are owner-scoped on the server using a verified Supabase identity and the server-only owner-email allowlist.
- Account deletion is handled by a JWT-verified Edge Function.
- Optional position-memory sharing is off by default and requires per-review consent.
- The website build includes unit tests, dependency audit, and Playwright desktop/mobile smoke coverage.
- Browser response headers include CSP, HSTS, frame protections, referrer and permissions policies, and cross-origin isolation.
- The native WebAssembly target compiles the same C++ implementation and has parity checks. The website worker remains a separate browser implementation.
- Email-change, password-reset, and password-change notification templates are versioned in the repository. Hosted email delivery has not been verified.

## Live provider observations — 6 November 2026

### Identity and archive ownership

The source Supabase project contains 13 Auth identities: 12 anonymous users and one email-confirmed identity. It contains 35 legacy games across five user IDs and 3 reviews across three user IDs. The confirmed email identity owns zero games and zero reviews. The intended archive identity remains unverified, so no migration, reassignment, or deletion has been performed.

Neon contains one checksummed recovery record with a source snapshot reporting 35 games, 3 reviews, and 0 position-memory rows. The active Neon archive tables currently contain 0 games, 0 reviews, and 0 position-memory rows. The snapshot record preserves source data; it is not an owner-verified import into the active archive.

### Authentication and email

The application enforces a 12-character password minimum. Supabase Security Advisor reports breached-password protection disabled. No controlled mailbox test has established real verification, recovery, or password-change delivery, and the hosted Auth identity-linking, email-provider, SMTP, Site URL, and redirect settings have not been verified.

### Database and backup

The active Neon project is on the Free plan with six-hour point-in-time history. The snapshot schedule is empty. A recovery record with source counts and a SHA-256 checksum exists, but the active archive remains empty and a full encrypted export/decrypt/restore drill has not been demonstrated. The Supabase encrypted-backup table contains no backup records.

### Database security findings

Supabase Security Advisor reports guest-table policy warnings. The inspected game and review policies are assigned to the authenticated role and constrain records by `auth.uid()`; anonymous guest sessions use that Auth role. Shared position-memory reads are separately scoped to authenticated users and are intentional for the optional shared-memory feature. These policies should remain aligned with the guest and consent model; removing them without a replacement would break the current workflow.

Supabase also reports breached-password protection disabled. Unused-index notices are informational and should be assessed against query plans before indexes are removed.

### Branch protection

The active GitHub `Protect main` ruleset prevents deletion and force-pushes and requires pull requests, but it has zero required approvals and no required status checks. The passing checks are not enforced as merge requirements.

## Release decision

Automated code validation is green, and a current preview is ready. Production release is not yet cleared because these controls remain unverified:

1. Hosted Supabase identity linking, email confirmation, password policy, Site URL, redirect allowlist, and custom SMTP; followed by real mailbox tests for verification, recovery, and password-change notifications.
2. Identification of the original guest identity that owns the intended archive. The confirmed email identity currently owns no legacy games or reviews; no records may be reassigned by inference.
3. A data-bearing backup and restore process, including successful export, integrity verification, and restoration into an isolated target.
4. Manual Windows 10/11 client-device acceptance for visual layout, scaling, promotion, physical input, and sustained search. The automated runner is Windows Server 2022.
5. Qualified legal review and written clearance of the Privacy Notice and Terms.
6. Required GitHub status checks and an approval rule on `main`.
7. Production deployment and production-domain smoke testing after the preceding release controls are closed.

No independently measured Elo rating or controlled comparative match result is claimed for the current native engine.
