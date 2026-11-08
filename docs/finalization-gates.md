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

The native source and documentation are a validated release candidate; the repository changes can be reviewed and merged independently, but the hosted Prunex Play service must not be promoted to production until the identity, archive recovery, authentication/email, legal, and manual device gates below are closed.

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
| Release PR reviewed and merged | PR #10 is the final documentation/release-readiness change set | Pending review |

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

1. **Original guest archive ownership**
   - Identify the exact guest identity that owns the intended games/reviews in the original browser profile.
   - Verify the archive in that same profile before linking email.
   - Link and verify email on that same guest identity; set its password without signing into an unrelated account.
   - Verify the server-side owner-email allowlist and reconcile owner-scoped import state.
   - Do not guess, merge, or reassign records based on email similarity or row counts.

2. **Data-bearing backup and restore**
   - Configure the encrypted backup workflow with a database-owner credential and an offline-held age identity.
   - Run it against the real, populated database.
   - Verify artifact checksum, decrypt it, restore into an isolated PostgreSQL instance, and reconcile tables, row counts, constraints, and ownership.
   - The current backup CI success validates tooling only. The existing empty-schema snapshot and recovery metadata are not a data-bearing backup.

3. **Authentication and email delivery**
   - Verify identity linking, email/password sign-in, confirmation, Site URL, and approved redirect URLs in the live Supabase project.
   - Configure custom SMTP and sender-domain SPF/DKIM/DMARC.
   - Apply the repository email templates and test email-linking, recovery, and password-change notifications with controlled mailboxes.
   - Review the leaked-password protection setting against the actual Supabase plan and available controls.

4. **Security and deployment controls**
   - Configure required CI status checks for the protected default branch, including native, sanitizer, Windows, WebAssembly, website, CodeQL, and backup-tool validation.
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
| Connect the native WebAssembly module to Prunex Play | A separate integration milestone; the current standalone WASM target is parity-tested and explicitly documented as not yet connected. |
| Add more screenshots, badges, profile widgets, and visual polish | Presentation enhancements; not a substitute for tested software. |

## E. Explicitly out of scope for this finalization pass

- Do not rewrite the engine architecture just to make the codebase look more like a larger engine.
- Do not invent an Elo rating, tournament result, performance claim, or trained network.
- Do not combine the native C++ engine and the browser engine into one description.
- Do not treat a passing backup workflow as proof of successful recovery.
- Do not promote production while archive ownership or restore capability is unresolved.
- Do not reopen the release checklist for ordinary feature ideas once the required gates are satisfied.

## Final status

- **Repository/documentation:** ready for final human review; source validation passed.
- **Native Windows downloadable release:** pending manual client-device acceptance and a final tag-bound artifact/checksum run.
- **Prunex Play production service:** blocked on the operational gates in section C.
- **Future engineering:** continue separately after the release decision.
