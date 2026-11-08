# Prunex 0.8.0 — finalization gates

**Purpose:** separate the work required to publish a credible source release from the additional controls required to operate the hosted browser product. This prevents routine engineering improvements from keeping a release open indefinitely.

## 0.8.0 feature freeze — effective 7 November 2026

**The feature scope for Prunex 0.8.0 is frozen.** From this point until the 0.8.0 release decision, work is limited to:

- Fixing reproducible defects in functionality already included in 0.8.0.
- Closing the release gates documented below.
- Completing code, security, licensing, documentation, and release-readiness review.
- Making the smallest necessary change when a concrete defect or release blocker is found, with a regression test where practical.

The following are not 0.8.0 work: new features, new product capabilities, broad refactors, architecture redesigns, speculative optimization, evaluation/search enhancements, and visual polish. Record worthwhile ideas for the next development cycle instead of adding them to this release.

A change may enter the frozen scope only when it is necessary to correct a demonstrated defect, address a security or data-integrity issue, or close an explicit release gate. Keep such changes narrowly scoped; do not use them as an opening for adjacent improvements.

**Completion rule:** once the required gates are closed and the final review is complete, stop changing 0.8.0. Any later feature or architectural work starts in the next development cycle.

## Release decision in one sentence

The native C++ source has passed its documented automated validation, but the project is not ready for a public launch under the requested engine-content restrictions. The browser application still runs a separately licensed neural-network engine. Replacing that runtime with the native Prunex WebAssembly engine is now an explicit release blocker, alongside archive ownership, recovery, hosted authentication/email, branch protection, legal review, and final manual acceptance.

## A. Basic repository finalization

These are the minimum conditions for a professional, reviewable public repository.

| Requirement | Current state | Decision |
|---|---|---|
| Clear project identity and accurate README | Complete | Keep |
| Architecture and component boundaries documented | Complete | Keep |
| Native build and UCI instructions | Documented | Keep |
| License scope and third-party notices | Documented; final legal review remains separate | Keep |
| Reproducible native regression suite | 46/46 across GCC, Clang, sanitizers, and Windows x64 | Pass |
| Browser, Windows, WebAssembly and CodeQL CI | All six source-validation workflows passed on the source-validation commit; latest documentation-tip CodeQL also passed | Pass |
| No unsupported playing-strength or training claims | No native Elo claim; no claim that offline corpus tools train engine weights | Pass |
| Release integration | PR #10 and its follow-up documentation changes are integrated into `main`; current head is `bf9e8d4a9828da1bb1f824b678043d16706107aa` | Complete |

Subsequent commits after source-validation commit `4bb43dbacb7a8c567c4a0aa0451f4e8e6a561dd9` are documentation-only. CodeQL also passed on a later documentation-only PR head. Native/browser source validation remains tied to the source-bearing commit because no application source changed afterward.

## B. Required before publishing a native desktop release

These items are required if Prunex 0.8.0 is presented as a supported downloadable Windows desktop release. They do not need to block source-code review or merging documentation.

- [ ] Perform manual Windows 10/11 acceptance on a real client device. Cover 100% and 150% display scaling, 1366×768 and 1920×1080 layouts, physical mouse/touchpad input, all promotion choices, checkmate/stalemate/draw states, sustained search, cancellation, and repeated launch/close.
- [ ] Build the release binaries from the exact final tag/commit using the documented toolchain.
- [ ] Run the complete native CTest suite against those exact release binaries.
- [ ] Publish the source tag and release notes, and attach only artifacts built from that tag.
- [ ] Publish SHA-256 checksums for every downloadable artifact.
- [ ] Confirm the license-scope notice and all third-party notices are present in the distributed package.

Do not claim a measured Elo, tournament result, or comparative strength until a controlled match-testing process has been run and its PGNs, conditions, and analysis are retained. An Elo result is not required to publish the source code.

## C. Required before Prunex Play production promotion

These are operational blockers for the hosted browser service. They are not required to merge the native engine documentation PR, but they are mandatory before promoting the current preview to the production alias.

0. **Replace the browser engine before claiming the project is free of the separate neural-network engine**
   - The current browser worker launches a separately licensed engine bundle. Do not remove its name, attribution, source links, or license files while the bundle is still shipped.
   - The existing `src/wasm_api.cpp` exports synchronous FEN evaluation and fixed-depth search (depth 1–12). It does not currently provide the browser application's time-budgeted search, progress reporting, MultiPV alternatives, or in-search cancellation.
   - Extend the native WebAssembly API/worker to provide the browser features that are retained, or explicitly remove and retest any browser features that will no longer be supported. Do not silently degrade game review or opponent play.
   - Only after the native replacement is working, remove the third-party engine package, copied binaries, worker path, dedicated license/source notices, engine-specific code paths, tests, CI artifact checks, and stale documentation.
   - Keep unrelated third-party notices, including chess-piece artwork and other dependencies, under their own licenses.
   - Run the full website build, dependency audit, browser tests, WebAssembly parity tests, and a current-tree source/artifact scan before merging.

1. **Original guest archive ownership**
   - Live recheck on 9 November 2026: Supabase has 35 games across five anonymous identities and 3 reviews across three identities. The sole confirmed email identity owns zero games and zero reviews. The active Neon archive has zero imported games, reviews, and position-memory rows. A retained checksummed source snapshot records 35 games and 3 reviews; it has not been restored into the active archive.
   - Identify the exact guest identity that owns the intended games/reviews in the original browser profile.
   - Verify the archive in that same profile before linking email.
   - Link and verify email on that same guest identity; set its password without signing into an unrelated account.
   - Verify the server-side owner-email allowlist and reconcile owner-scoped import state.
   - Do not guess, merge, or reassign records based on email similarity or row counts.

2. **Data-bearing backup and restore**
   - Configure the encrypted backup workflow with a database-owner credential and an offline-held age identity.
   - Run it against the real, populated database.
   - Verify artifact checksum, decrypt it, restore into an isolated PostgreSQL instance, and reconcile tables, row counts, constraints, and ownership.
   - The retained 5 November recovery record contains a checksummed source payload with 35 games, 3 reviews, and 0 position-memory rows. The active Neon archive remains empty. The source snapshot is not an encrypted database backup or a verified restore; the backup workflow's CI success validates tooling only.

3. **Authentication and email delivery**
   - Verify identity linking, email/password sign-in, confirmation, Site URL, and approved redirect URLs in the live Supabase project.
   - Configure custom SMTP and sender-domain SPF/DKIM/DMARC.
   - Apply the repository email templates and test email-linking, recovery, and password-change notifications with controlled mailboxes.
   - Supabase Security Advisor currently reports leaked-password protection disabled; check project-plan eligibility and enable it where supported.
   - Review the leaked-password protection setting against the actual Supabase plan and available controls.

4. **Security and deployment controls**
   - Configure required CI status checks for the protected default branch, including native, sanitizer, Windows, WebAssembly, website, CodeQL, and backup-tool validation. The live `Protect main` ruleset currently requires pull requests but zero approvals and no required CI status checks.
   - The production alias `prunex-play.vercel.app` currently resolves to a deployment built from feature-branch commit `b188ff216281c17d90c3000118bba4e06f7e3582`; a separate `READY` deployment exists for `main` commit `bf9e8d4a9828da1bb1f824b678043d16706107aa`, but it is only a preview. Build and validate a production-target deployment from `main` after the preceding release gates are closed.
   - Review the live RLS policies against the guest-account and optional shared-position-memory model; do not remove policies merely to silence advisor warnings.
   - Re-test the deployed account-closure flow and allowed-origin/JWT enforcement.
   - Build a fresh production-target deployment from the merged default branch, test that exact deployment, then promote it. Never promote the preview deployment directly.

5. **Legal and privacy review**
   - Have qualified counsel review the operator identity, privacy notice, terms, retention/deletion, backup retention, data transfers, age/guardian consent, and third-party software/artwork licensing.
   - Do not treat repository templates or automated tests as legal approval.

6. **Human product acceptance**
   - Test the actual production-candidate browser experience, identity linking, recovery emails, archive ownership, responsive layouts, and account closure using controlled test accounts.
   - Retain a release acceptance record and rollback plan.

## D. Improvements that should not block finalization

These are worthwhile follow-on engineering tasks. Track them as separate issues or future milestones rather than extending the current release indefinitely.

| Improvement | Why it can wait |
|---|---|
| Extract the engine from `src/main.cpp` into a reusable C++ core library | Current CLI, GUI, and WebAssembly builds pass. The coupling is a maintainability concern, not a demonstrated release-blocking defect. |
| Split the large website controller into smaller modules | The browser regression suite passes. Refactor incrementally with tests. |
| Expand UCI options and protocol documentation | Useful for advanced GUI compatibility and users, but current UCI usage is documented. |
| Broaden benchmark positions and add match-testing automation | Valuable for measuring progress; no unsupported strength claim is currently made. |
| Improve search heuristics and evaluation terms | Normal engine development, not a completion criterion for version 0.8.0. |

| Add more screenshots, badges, profile widgets, and visual polish | Presentation enhancements; not a substitute for tested software. |

## E. Explicitly out of scope for this finalization pass

- Do not rewrite the engine architecture just to make the codebase look more like a larger engine.
- Do not invent an Elo rating, tournament result, performance claim, or trained network.
- Do not combine the native C++ engine and the browser engine into one description.
- Do not treat a passing backup workflow as proof of successful recovery.
- Do not promote production while archive ownership or restore capability is unresolved.
- Do not reopen the release checklist for ordinary feature ideas once the required gates are satisfied.

## Final status — reviewed 9 November 2026

- **Native C++ source:** the source-validation matrix passed on the latest source-bearing validation commit; the current `main` head is documentation-only and its applicable checks are green.
- **Browser engine restriction:** not satisfied. The browser application still ships the separate neural-network engine. Replacing it with the native WebAssembly engine and removing the associated bundle/licensing footprint is a required code change, not a cosmetic documentation task.
- **Repository licensing:** MIT applies to original Prunex contributions; third-party materials retain their own terms. The training guide's stale Apache-2.0 statements are corrected in this review branch.
- **Archive:** Supabase still holds 35 games and 3 reviews across anonymous guest identities. The sole confirmed email account owns none of them. Neon active archive tables contain zero imported rows; a checksummed legacy-source snapshot exists but has not been restored or imported.
- **Authentication/security:** the Vercel server-side environment-variable keys are present, but live email delivery is unverified. Supabase Security Advisor reports leaked-password protection disabled.
- **Branch protection:** pull requests are required, but required CI checks and approvals are not configured.
- **Deployment:** the production alias remains on an older feature-branch deployment; the latest `main` deployment is a preview only.
- **Native Windows downloadable release:** pending final manual Windows 10/11 client-device acceptance and a final tag-bound artifact/checksum run.
- **Prunex Play production service:** not cleared until all section C gates are closed.
- **Future engineering:** keep broad refactors and search-strength improvements for a later cycle.
