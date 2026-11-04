# Prunex 0.8.0 — production readiness

This checklist distinguishes repository-verified controls from provider settings and operational checks that cannot be inferred from source code. The native C++ engine, Windows desktop application, and browser demo are separate delivery targets.

## Verified controls

- Native C++20 engine release metadata is Prunex 0.8.0. The UCI search path has asynchronous cancellation and native regression coverage.
- The website has a Vite production build and Chromium browser smoke test.
- Supabase game, review, and position-memory tables have RLS enabled. Game/review rows are owner-scoped; the shared-memory read surface exposes only the minimum move-quality fields.
- Account deletion uses a JWT-verified Edge Function which verifies caller identity server-side, revokes refresh-token sessions, deletes the Auth user, and relies on foreign-key cascades for cloud records.
- Shared position-memory contributions are optional. Their consent is stored per review, inserts/updates require that consent, and owners can delete their own contributed sample rows. Database constraints check field shape and score ranges; they do not prove that a move is legal or that a client-supplied evaluation is truthful.
- The browser security policy uses a restrictive CSP, HSTS, frame protections, referrer policy, and cross-origin isolation.
- Browser-prefixed environment variables are public. A service-role key or any provider secret must never use a `VITE_*` name or be shipped in the client bundle.

## Required Supabase dashboard actions

1. Enable Cloudflare Turnstile under **Authentication → Bot and Abuse Protection → CAPTCHA** and configure the matching server secret. Allow only the exact production and approved preview domains in the Turnstile widget.
2. Configure the matching public site key in Vercel and set `VITE_REQUIRE_CAPTCHA=true` for Production. The Turnstile secret stays in Supabase Auth settings.
3. Enable leaked-password protection under **Authentication → Password Security**. This remains a provider setting; it cannot be switched on by the repository's SQL migration.
4. Set the exact production Site URL and email redirect allowlist. Test guest email-link recovery end-to-end using the production domain.
5. Confirm anonymous sign-in rate limits, CAPTCHA enforcement on every guest-creation path, and Auth abuse monitoring.
6. Configure an email delivery provider for production use. Verify sender-domain authentication, delivery, bounces, and rate limits.
7. Confirm database backup retention and point-in-time recovery appropriate to the service, and run a restore drill before relying on cloud archives.
8. Re-run Supabase security/performance advisors after each schema change. Anonymous-access warnings are expected for the guest-account product only while CAPTCHA is enabled and owner RLS remains intact.

## Vercel production environment

Configure and verify the following in the project's Production environment:

| Variable | Purpose | Secret? |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL | No |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Browser publishable key | No |
| `VITE_TURNSTILE_SITE_KEY` | Cloudflare Turnstile public site key | No |
| `VITE_REQUIRE_CAPTCHA` | Must be `true` for production cloud guest creation | No |

Do not add `SUPABASE_SERVICE_ROLE_KEY`, the Turnstile secret, Vercel tokens, signing keys, or private credentials to the website build environment under a `VITE_` prefix.

A production deployment is not validated until the deployed build has the correct environment values and an end-to-end run confirms guest creation, private game saving, review saving, opt-in memory insertion, opt-out cleanup, account deletion, and the live response headers.

## GitHub and dependency supply chain

- Keep Dependabot enabled for npm and GitHub Actions.
- Run CodeQL on the release branch and active feature branches.
- Require successful native, website, dependency-audit, and code-scanning checks before release.
- Enable secret scanning and push protection in repository settings where available.
- Commit `website/package-lock.json` and use `npm ci` for reproducible builds.
- Review npm and Python dependency audit findings. Do not suppress advisories without recording the accepted risk and mitigation.

## Legal, privacy, and licensing release gate

The website Privacy Notice and Terms of Use are marked as drafts. They must be reviewed by a qualified professional for the intended audience and jurisdictions before unrestricted public launch. Confirm consent and retention wording for optional shared position-memory contributions, account deletion, provider processing and transfers, age-related requirements, and user support.

Retain all browser-engine and artwork license notices and corresponding-source obligations. The browser demo and native C++ implementation have distinct components and license scopes; do not describe third-party components as original native-engine code.

## Native and desktop release gate

- Run CTest on GCC, Clang, MSVC x64, and sanitizers for the release commit.
- Desktop search now runs asynchronously, with cancellation on new game, undo, and window close. Complete the manual Windows 10/11 run-through and verify responsiveness, cancellation, promotion, undo, and shutdown before treating the desktop binary as a polished end-user release.
- Native WebAssembly build integration and automated native/WASM parity tests are not implemented yet; the existing browser demo is a separate component and does not satisfy this requirement.
- Do not publish Elo/strength claims without reproducible paired-color matches, fixed openings, sufficient game counts, and confidence intervals or SPRT.

## Monitoring and response

Monitor Vercel runtime errors and deployment health, Supabase Auth and Edge Function failures, database saturation, rate-limit events, and unusual guest-signup patterns. Keep a rollback deployment available. Use GitHub private vulnerability reporting, and rotate suspected exposed credentials before assessing downstream impact.

## Release decision

Passing repository CI is necessary but not sufficient for public production release. Provider configuration, live-domain end-to-end tests, legal review, backup/restore verification, and the Windows desktop check remain explicit release gates.
