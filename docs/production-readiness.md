# Prunex 0.8.0 — production readiness

This checklist separates repository-verified controls from provider settings and operational checks that cannot be inferred from source code. The native C++ engine, Windows desktop application, and browser demo are separate delivery targets.

## Verified controls

- Native C++20 engine release metadata is Prunex 0.8.0. The UCI search path has asynchronous cancellation and native regression coverage.
- The website has a Vite production build and Chromium browser smoke test. The build guard rejects incomplete cloud archive configuration, non-HTTPS Supabase endpoints, and browser-prefixed server secrets. Cloud archive builds do not require CAPTCHA.
- Supabase game, review, and position-memory tables have RLS enabled. Game and review rows are owner-scoped; shared-memory reads expose only the minimum move-quality fields.
- Account deletion uses a JWT-verified Edge Function which verifies caller identity server-side, revokes refresh-token sessions, deletes the Auth user, and relies on foreign-key cascades for cloud records.
- Shared position-memory consent is stored per review and checked by a SECURITY INVOKER RPC. The RPC atomically replaces or clears all samples for a game, while PostgreSQL RLS enforces owner and consent checks on every insert/delete.
- The browser security policy uses a restrictive CSP, HSTS, frame protections, referrer policy, and cross-origin isolation.
- A native WebAssembly target compiles the same C++ implementation. CI checks static-evaluation, best-move, and node-count parity across five fixed positions and publishes a versioned JS/WASM artifact. The current website worker has not yet been switched to that artifact.
- Browser-prefixed environment variables are public. Never expose a service-role key or provider secret through a `VITE_*` variable.

## Supabase dashboard checks

1. Enable Anonymous Sign-Ins only if the cloud archive is intended to be available. Anonymous users use the PostgreSQL `authenticated` role, so the owner-scoped RLS policies are essential.
2. No CAPTCHA is required for browsing or gameplay. Keep Supabase Auth CAPTCHA protection disabled for the current cloud sign-in configuration. Supabase recommends CAPTCHA/Turnstile to reduce abuse of public anonymous sign-in endpoints; the Auth rate limit is 30 anonymous sign-ins per hour per IP by default. Turnstile remains an optional hardening measure, not a release requirement.
3. Set the exact production Site URL and email redirect allowlist. Test guest email linking/recovery end-to-end using the production domain.
4. Configure a production email delivery provider if email linking/recovery is offered. Verify sender-domain authentication, delivery, bounces, and rate limits.
5. Confirm database backup retention and point-in-time recovery appropriate to the service, and run a restore drill before relying on cloud archives.
6. Re-run Supabase security/performance advisors after each schema change. Anonymous-access warnings are expected while the product deliberately supports guest identities and the owner-scoped policies remain in place.
7. The leaked-password-protection advisor is not applicable to the current passwordless flow (anonymous guest sessions and email identity linking). Enable password protections before introducing password-based sign-in or password-setting features.

Optional later hardening: create a Cloudflare Turnstile widget and secret, enable Supabase Auth CAPTCHA, then set `VITE_TURNSTILE_SITE_KEY` and `VITE_REQUIRE_GUEST_TURNSTILE=true` in Vercel Production. The secret remains in Supabase Auth. The widget is requested only when creating a cloud guest identity; it does not block site browsing or chess gameplay.

## Vercel production environment

| Variable | Purpose | Secret? |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL | No |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Browser publishable key | No |
| `VITE_TURNSTILE_SITE_KEY` | Optional Turnstile site key for guest creation | No |
| `VITE_REQUIRE_GUEST_TURNSTILE` | Optional; defaults to `false` | No |

Do not add `SUPABASE_SERVICE_ROLE_KEY`, the Turnstile secret, Vercel tokens, signing keys, or private credentials to the website build environment under a `VITE_` prefix.

A production deployment is not validated until an end-to-end run confirms guest creation, private game saving, review saving, opt-in memory replacement, opt-out revocation, account deletion, and live response headers. No CAPTCHA should appear in the current configuration.

## GitHub and dependency supply chain

- Keep Dependabot enabled for npm, Python corpus tooling, and GitHub Actions.
- Run CodeQL on the release branch and active feature branches.
- Require successful native, website, dependency-audit, and code-scanning checks before release.
- Enable secret scanning and push protection in repository settings where available.
- Commit `website/package-lock.json` and use `npm ci` for reproducible builds.
- Review npm and Python dependency audit findings. Do not suppress advisories without recording the accepted risk and mitigation.

## Legal, privacy, and licensing release gate

The website Privacy Notice and Terms of Use are marked as drafts. They must be reviewed by a qualified professional for the intended audience and jurisdictions before unrestricted public launch. Confirm consent and retention wording for optional shared position-memory contributions, account deletion, provider processing and transfers, age-related requirements, and user support.

Retain all browser-engine and artwork license notices and corresponding-source obligations. The browser demo and native C++ implementation have distinct components and license scopes; do not describe third-party components as original native-engine code.

## Native and desktop release gate

- Run CTest on GCC, Clang, MSVC x64, and sanitizers for the release commit. Dedicated Linux compiler/sanitizer CI and Windows x64 CI cover these native paths.
- Desktop search now runs asynchronously, with cancellation on new game, undo, and window close. Complete the manual Windows 10/11 run-through and verify responsiveness, cancellation, promotion, undo, and shutdown before treating the desktop binary as a polished end-user release.
- Native WebAssembly build integration and five-fixture native/WASM parity tests are implemented and run in CI. Integrating the generated module into the browser worker remains a separate product-level task; the existing website demo still uses its current browser backend.
- Do not publish Elo/strength claims without reproducible paired-color matches, fixed openings, sufficient game counts, and confidence intervals or SPRT.

## Monitoring and response

Monitor Vercel runtime errors and deployment health, Supabase Auth and Edge Function failures, database saturation, rate-limit events, and unusual guest-signup patterns. Keep a rollback deployment available. Use GitHub private vulnerability reporting, and rotate suspected exposed credentials before assessing downstream impact.

## Release decision

Passing repository CI is necessary but not sufficient for public production release. Provider configuration, live-domain end-to-end tests, legal review, backup/restore verification, and Windows desktop interaction checks remain explicit release gates.
