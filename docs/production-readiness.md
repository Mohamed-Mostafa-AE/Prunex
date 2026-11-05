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

The Vercel Node.js archive function also requires these **server-only** variables in both Production and Preview. They must never use a `VITE_` prefix:

| Variable | Purpose | Secret? |
| --- | --- | --- |
| `NEON_DATABASE_URL` | Neon PostgreSQL connection string for the private archive | Yes |
| `SUPABASE_URL` | Server-side Supabase Auth token verification endpoint | Yes |
| `SUPABASE_PUBLISHABLE_KEY` | Server-side Supabase Auth verification key | Yes |
| `PRUNEX_OWNER_EMAIL` | Verified owner allowlist for the private archive | Yes |

The archive uses Neon as its primary write/read store. Supabase remains the identity provider, legacy-import source, and owner-scoped read fallback; it is not a general write-through replica of Neon. Configure `NEON_DATABASE_URL` to connect as the restricted `prunex_app` database role, not the database owner or a superuser. The API sets the verified owner context inside each transaction; the database applies row-level security using that context.

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

## Current release-candidate audit — 2026-11-05

### Verified repository and deployment evidence
### Follow-up verification — 2026-11-05

- The website hero headline was removed from the IntersectionObserver reveal list and given an immediate-visible CSS rule, so the primary product heading no longer depends on a scroll callback. The browser smoke test now asserts that the hero heading is present, visible, and not assigned the reveal class.
- A first-screen benchmark citation links to the Stockfish 2.0 evidence record. The full section includes the original run, retained PGN/build artifact, original job log, independent audit job, and explicit Stockfish 19-derived/native-engine distinction.
- The original benchmark ZIP was downloaded and independently inspected locally. The 64-game PGN header recount returned 62 wins, 2 draws, 0 losses; 63/64 points (98.44%); 32 games per color; 16 openings with four games each; 62 checkmates and 2 threefold repetitions. The PGN and JSON SHA-256 values match the recorded checksums.
- Vercel's project-level routing rule `prunex-security-headers` was reconciled with the repository CSP; the production site and review preview now return HTTP 200 with the expected Supabase and Cloudflare Turnstile origins and the transport/frame/isolation headers. This was a headers-only production change; the new application version has not been promoted.
- Preview deployment `dpl_B2R38W42UvvcaQ4UT1hwLJmXMDcL` is READY from commit `c1f4c735a221ec030fc6f4ff9c5b2e90638d25a3`. Its homepage HTML and served JS/CSS assets include the updated hero and benchmark content. A Playwright browser check for this same commit has not yet completed: the GitHub Actions job is stalled in `npx playwright install --with-deps chromium`, before the browser smoke test step. Do not claim full visual browser validation until the job passes.
- On the same commit, CodeQL (C/C++ and JavaScript/TypeScript), Windows x64 MSVC validation, native WebAssembly parity, native GCC/Clang regression suites, and GCC ASan/UBSan all passed. The archived benchmark audit also passed. The website build and npm audit passed, but its Playwright stage remains outstanding.


- Release-candidate source is on `feature/prunex-evaluation-intelligence`, commit `4880e54ff8875c128bb8fe4ce7b074c0cf238874`.
- Website CI passed on that commit: deterministic build/unit checks, npm audit, Chromium browser interaction suite, required output assets, training-data tests, and Python dependency audit.
- CodeQL passed on that commit.
- Native compiler/sanitizer matrix passed at `596abec89d1820a65ee8b24df419dc6bfadbe6d9`; native WebAssembly parity and Windows x64 builds passed at `307016e5c733a640efcdaff239e35e4fdc7f314f`. Native source files have not changed since those validations.
- Vercel preview deployment `prunex-review.vercel.app` is READY from the release-candidate commit. Production aliases have not been moved to this candidate.
- Vercel server-only `NEON_DATABASE_URL`, `SUPABASE_URL`, and `SUPABASE_PUBLISHABLE_KEY` have been populated for Production and Preview. `NEON_DATABASE_URL` uses the restricted `prunex_app` role. The existing `PRUNEX_OWNER_EMAIL` secret was left unchanged; its value still requires a real authenticated-owner end-to-end check.

### External release blockers still requiring operator action

- Neon is on the Free plan with a six-hour PITR history window and one manual snapshot. A daily backup schedule was attempted on 2026-11-05 and rejected by Neon because scheduled backup creation is not enabled for this project. Neon scheduled snapshots are a paid-plan feature and have a maximum 35-day retention; this does not meet the 90-day off-provider requirement. No off-provider backup archive or 90-day retention job is configured.
- A limited restore-mechanics drill was completed on 2026-11-05. Snapshot `prunex-empty-schema-before-owner-migration` was restored to the isolated branch `restore-drill-20261105`; all four `prunex_archive` tables were present with RLS enabled, and the restricted `prunex_app` role saw zero rows without an owner context. The test compute was suspended after verification. This snapshot predates the live owner import and contains no archive records, so it does not prove recovery of live games/reviews; a data-bearing restore drill remains outstanding.
- The live Supabase project has an out-of-band migration `vortex_cloud_encrypted_backups` absent from this repository. Its `vortex_private.encrypted_backups` table is empty and its database comment identifies append-only, client-side AES-256-GCM-encrypted SQLite snapshots. No active backup/restore Edge Function is deployed. This is not a Neon export or a verified Prunex backup pipeline; preserve it, identify its owning VORTEX source/repository, and reconcile it separately rather than treating it as Prunex disaster recovery.
- The live Supabase Prunex source currently contains 35 game rows, 3 review rows, and 0 position-memory rows. The Neon target archive and migration-state tables remain empty. The deterministic idempotency/owner-isolation test passes, but the authenticated live owner import and source/target reconciliation remain outstanding.
- A read-only live Auth census on 2026-11-05 found 5 anonymous users, 0 non-anonymous users, and 0 users with a confirmed email. The 35 games span 5 distinct user IDs and the 3 reviews span 3 distinct user IDs. The owner identity has not yet been linked and verified, so selecting one guest account or importing the records as a single owner would be unsafe. The intended owner must link and verify the allowlisted email through the app before the owner-scoped migration can run.
- The Vercel project-level `prunex-security-headers` route rule was reconciled with the repository CSP. Follow-up HTTP 200 checks of both `prunex-play.vercel.app` and the latest preview/review alias confirmed the Supabase HTTPS/WebSocket and Cloudflare Turnstile origins, HSTS, frame protection, nosniff, referrer policy, permissions policy, COOP and COEP. This verifies response-header configuration, not the owner-authenticated archive/recovery flows, which remain outstanding.
- The existing `PRUNEX_OWNER_EMAIL` Vercel secret was not changed or disclosed. Its match to the intended owner must be validated through a real verified Supabase email-link session. Guest creation, email linking/recovery, private archive save/list/review, position-memory opt-in/revocation, account deletion, and live response headers still require an authenticated live-domain end-to-end run.
- GitHub branch protection is disabled. The connected GitHub integration reports repository metadata but its installation cannot access the admin-only branch-protection endpoint, and no branch-protection write action is available through this connection. Enable required checks and review/merge policy in repository settings before promoting a release commit.
- The Privacy Notice and Terms of Use are explicitly marked as drafts. Their data-flow description is source-aligned, but qualified legal review for the intended jurisdictions, audience, age/consent requirements, international transfers, retention and deletion has not occurred and cannot be represented as complete.
- Windows x64 build, executable architecture checks, UCI smoke test, and CTest pass in GitHub Actions on `windows-2022`. Manual Windows 10/11 desktop interaction remains outstanding: responsiveness, search cancellation, promotion, undo, close/shutdown, and display behavior need a real desktop session.
- Production deployment remains on the previous production commit. The release-candidate preview is READY, but no production promotion has been performed. Do not promote until the data-bearing backup/restore path, owner authentication and migration, legal review, branch protection, and manual desktop release checks are resolved.

## Follow-up audit — benchmark evidence and homepage fix — 2026-11-05

- The homepage hero headline no longer depends on the scroll-reveal observer. It is removed from the reveal target list and has an immediate-visible style rule. Browser smoke coverage asserts that the heading is visible on desktop and mobile and is not assigned the reveal class.
- The historical Stockfish 2.0 claim is now evidence-qualified. GitHub Actions run [#41253517143](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/41253517143) completed a 64-game test of a Stockfish 19-derived executable labelled Prunex 0.8.0 against Stockfish 2.0: 62 wins, 2 draws, 0 losses (63/64 points, 98.44%) at 100,000 nodes per move and 128 MB hash per engine. The test was not performed by the independently implemented native C++20 engine and is not an Elo rating.
- The retained Actions artifact includes the PGN, JSON summary, test executable, source archive, provenance and licenses. A new GitHub Actions audit (run [#42066798928](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42066798928)) downloaded that artifact, recounted the PGN against the JSON summary, and verified the PGN and summary hashes. The artifact is currently listed to expire on 2027-01-29; keep the artifact link and its retention window in mind.
- A separate reported local 1,000,000-node run at 63–1–0 is explicitly not merged into the archived result. Its raw PGN/JSONL is unavailable in the Actions artifact and it remains owner-reported, not independently audited.
- The new Vercel preview deployment `dpl_7WY57BGLtAs4wC5beSE9ZMKTHQJf` is READY from commit `d3c53504a84868549a3d1399ff0bef1142711ee9`. Its homepage returns HTTP 200 and serves the updated hero/benchmark HTML. The original CSP discrepancy was traced to a separate Vercel project-level route rule, `prunex-security-headers`, which overrode `website/vercel.json`. A replacement routing-policy version `91802acb-e444-471e-aa81-7b389ca456ef` was staged, verified on its route preview, then promoted. Subsequent HTTP 200 checks of `prunex-play.vercel.app` and `prunex-review.vercel.app` confirmed the Supabase HTTPS/WebSocket and Cloudflare Turnstile origins are now present together with HSTS, X-Frame-Options, nosniff, referrer policy, permissions policy, COOP and COEP. The actual authenticated archive/Auth flow remains outstanding; an unauthenticated API fetch could not be completed through the Vercel share-link fetch after access protection rejected the reused share link.
- The LinkedIn announcement is not approved for publication while the operational, legal, Windows desktop and CSP release gates above remain open. Any future post must attribute the Stockfish 2.0 result to the separate Stockfish 19-derived test build, not the native C++ engine.

## Release decision

Passing repository CI is necessary but not sufficient for public production release. Provider configuration, live-domain end-to-end tests, legal review, backup/restore verification, and Windows desktop interaction checks remain explicit release gates.

## Follow-up verification — final release-candidate UI and evidence audit — 2026-11-05

- Current branch head: `8662db488d218296aaf54258a96e1b14926da9d6`. This is the verified preview candidate; PR #10 remains an open draft and has not been merged.
- Fresh Vercel preview deployment `dpl_uDWfbp5hAG77njKyP9fTSgwuWX2J` is READY from that exact commit and is aliased to [`prunex-review.vercel.app`](https://prunex-review.vercel.app/). The homepage, Privacy Notice, and Terms pages each returned HTTP 200 on cache-miss checks. The homepage HTML includes the visible hero title, first-screen benchmark teaser, full evidence section, permanent-evidence link, and the Stockfish 19-derived/native-engine distinction. Its response CSP contains the configured Supabase and Cloudflare origins.
- Latest website CI [run #42075417463](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42075417463) passed on the candidate commit. This includes production build, npm audit, training-data and Python dependency tests, hosted-Chrome discovery, Vite preview startup, full Playwright desktop/mobile browser smoke suite, required build assets, and visual screenshot upload.
- Visual review artifact [`prunex-responsive-device-review`](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42075417463/artifacts/13439450168) contains the homepage responsive captures and dedicated desktop/phone Stockfish evidence captures. The phone capture hides the sticky header only while cropping the screenshot; the live page's sticky navigation is not modified by that screenshot-only step. The artifact expires 2026-11-08; the source report, JSON summary, provenance and checksums are committed permanently in `benchmarks/stockfish-2.0/`.
- The evidence section's test capture verifies the 62–2–0, 98.44% result and methodology, while explicitly disclosing that the tested “Prunex 0.8.0” executable was Stockfish 19-derived and is not the independent native C++20 engine. The permanent repository evidence index links the machine-readable summary, provenance and source-artifact checksums.
- All other automated workflows passed on the same candidate commit: [CodeQL #42075433228](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42075433228), [Windows x64 #42075433290](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42075433290), [native compiler/sanitizer matrix #42075433347](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42075433347), [native WebAssembly parity #42075433612](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42075433612), and [archived benchmark audit #42075433294](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42075433294).
- The Vercel production site still serves the previous application build. No production application promotion was performed. The only prior production change was the project-level security-header routing-rule correction. The backup/restore, owner identity/migration, legal, manual desktop, and GitHub protection gates listed above remain open, so this is not yet an unrestricted production release approval.


## Operator handoff and prepared automation — 2026-11-05

### Encrypted 90-day Neon backup pipeline prepared

- Added `.github/workflows/prunex-db-backup.yml`: daily at 02:17 UTC, plus manual dispatch, with a PostgreSQL 18 custom-format dump, age encryption **before upload**, SHA-256 checksum, and GitHub artifact retention requested at 90 days.
- The workflow is restricted to `main`, uses no pull-request triggers, and uploads only ciphertext plus its checksum because this repository is public. Public artifact metadata (run time and ciphertext size) remains visible.
- The backup job fails closed unless the connection points to PostgreSQL 18 and the credential can bypass RLS. Live Neon inspection confirmed `neondb_owner` has `BYPASSRLS`; the restricted `prunex_app` connection is not sufficient.
- No backup secret or encryption key has been added. To activate, follow [`docs/backup-restore-runbook.md`](backup-restore-runbook.md): create an age keypair locally; add the public recipient as Actions variable `PRUNEX_BACKUP_AGE_RECIPIENT`; add an owner-level connection string as Actions secret `NEON_BACKUP_DATABASE_URL`; merge the workflow to `main`; manually run once; verify the encrypted artifact appears and has the intended expiry.
- Artifact retention is requested as 90 days. GitHub's public-repository cap is 90 days, subject to any lower organization/enterprise policy. GitHub Actions artifact storage is billable based on usage; check allowance and usage before enabling a recurring full-database export.
- Added [`tools/backup/verify-restore.sh`](../tools/backup/verify-restore.sh), which verifies checksums, decrypts locally, restores to disposable PostgreSQL 18 via Docker, checks the four archive tables and RLS flags, prints row counts and cleans up. A real data-bearing drill still requires the first post-migration backup artifact.
- Added [backup automation CI](../.github/workflows/backup-tools-ci.yml) to shell-check the verifier and parse the workflow YAML.

### Owner migration handoff prepared

- Added [`docs/owner-account-activation.md`](owner-account-activation.md). The intended action is to link the current owner's existing guest session to the configured Vercel `PRUNEX_OWNER_EMAIL` using the in-app **Account & Data → Link this guest archive** control, then complete the email verification in the same browser profile.
- Rechecked live Supabase on 2026-11-05: 11 anonymous users, 0 email-confirmed users, 35 games across 5 guest IDs (7 each), 3 reviews, 0 position-memory samples. No owner was guessed or any guest rows changed.
- After the owner confirms verification, the migration can be run for that single ID and reconciled. Other guest records will remain untouched.

### Legal and Windows operator packs prepared

- Added [`docs/legal-review-brief.md`](legal-review-brief.md), grounded in the current Privacy Notice, Terms, account code and provider architecture. It lists specific questions for qualified counsel, including jurisdiction, minor/child audience, consent, transfers, retention/deletion, and licensing.
- Added [`docs/windows-acceptance-record.md`](windows-acceptance-record.md) with the actual passing Windows x64 build artifact, executable SHA-256 values, expiry date and manual UI acceptance checklist. This still needs to be run by the operator on a real Windows 10/11 desktop.
- Added [`docs/github-branch-protection.md`](github-branch-protection.md) with concrete ruleset configuration. The connected GitHub app still lacks the admin-write capability to apply it directly.

### User actions required to finish the live gates

1. Apply the `main` ruleset in [GitHub repository rules](https://github.com/Mohamed-Mostafa-AE/Prunex/settings/rules).
2. Generate the age identity offline and add the two Actions settings listed in the backup runbook. Do not send the private identity or database connection string in chat.
3. Link and verify the intended guest archive in the same browser profile as described in `docs/owner-account-activation.md`.
4. Run the Windows executable and return the completed acceptance record.
5. Obtain legal counsel's redlines/sign-off for the two draft legal pages.

No production migration, database data modification, billing-plan upgrade, or Vercel production promotion was performed as part of this operator-pack preparation.


## Operator enablement package — 2026-11-05

- Added daily encrypted Neon backup automation: `.github/workflows/prunex-db-backup.yml`. It runs at 02:17 UTC only on `main` or via manual dispatch; uses PostgreSQL 18 `pg_dump`; requires a credential with RLS bypass; encrypts with age before upload; and requests 90-day GitHub artifact retention. Because the GitHub repository is public, only encrypted ciphertext plus SHA-256 checksum is stored as an artifact. No plaintext dump or private age identity is committed or uploaded.
- Backup workflow activation still requires the owner to add Actions variable `PRUNEX_BACKUP_AGE_RECIPIENT` and Actions secret `NEON_BACKUP_DATABASE_URL`, then merge the workflow to `main` and manually execute the first run. The backup secret must be the Neon `neondb_owner`/BYPASSRLS connection; the restricted `prunex_app` URL cannot capture RLS-hidden rows. GitHub public artifact retention cannot exceed 90 days and may be capped lower by organization settings.
- Added `tools/backup/verify-restore.sh` for a local data-bearing restore drill into a disposable PostgreSQL 18 Docker container. It verifies checksum, decrypts locally, restores, verifies the four archive tables and RLS, prints row counts, and cleans the temporary container and plaintext dump. It has not yet been run against a post-migration backup because no such backup artifact exists.
- Added `.github/workflows/backup-tools-ci.yml` to validate workflow YAML and lint the restore helper. The first run found an unused loop counter; it was fixed in commit `55ed112` and the follow-up CI result is pending.
- Added `docs/owner-account-activation.md` with the exact in-app flow to link the owner's existing guest session to the configured verified email. Live Supabase census is now 11 anonymous users, 0 email-confirmed users, 35 games across five guest IDs (7 each), 3 reviews and 0 position-memory samples. No guest data has been modified or merged.
- Added `docs/legal-review-brief.md`, a counsel handoff based on the current published Privacy Notice/Terms drafts and the source code/data flows. It requests jurisdiction, minor/child audience, consent, transfers, retention/deletion and licensing review; it is not a substitute for sign-off.
- Added a Windows acceptance record linked to the real passing x64 build artifact [`Prunex-Windows-x64`](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42075433290/artifacts/13437603709), containing `Release/Prunex.exe`, `Release/prunex-cli.exe`, a build manifest with SHA-256 values and the CTest log. Artifact expiry is 2026-12-05. Manual Windows 10/11 UI acceptance remains pending.
- Added `docs/github-branch-protection.md` with exact `main` ruleset settings. The GitHub connector still has no admin write action, so the owner must create the active ruleset through repository settings.
- Added [`docs/operator-handoff.md`](operator-handoff.md) as the single owner checklist covering branch rules, backup activation, existing guest linking, Windows test execution and legal counsel review.

