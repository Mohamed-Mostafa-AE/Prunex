# Prunex 0.8.0 — release checklist

## Scope

Version 0.8.0 is feature-frozen. This checklist covers release correctness, security, service configuration, recovery, licensing, and acceptance. Broad refactors and additional features are intentionally deferred to a later development cycle.

## Completed source and repository work

- The native engine, Windows desktop application, and WebAssembly browser build are documented in the repository.
- The root MIT license applies to original Prunex contributions. Separately licensed components and assets retain their own notices and terms; see LICENSE-SCOPE.md.
- The name origin is documented in README.md and docs/project-name.md: PRUN refers to alpha–beta pruning; EX represents competitive execution.
- Public benchmark material does not claim a measured Elo rating or unsupported competitive result.
- Main commit `89a60ba3665674121cd42d98840257eba346577c` contains the reviewed documentation, website, and test-assertion corrections. Its native engine source is unchanged from `715639559b91d0b8b359a5d3e7a2619075c2f144`, which passed 47/47 under GCC 11.5 Release, Clang 15.0.7 Release, and GCC 11.5 AddressSanitizer/UndefinedBehaviorSanitizer.
- The post-merge website/browser and training-data workflows passed on main: [run 42686690073](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42686690073).
- The Windows x64 Release build and automated desktop smoke passed all 47 native CTest cases on main: [run 42686689854](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42686689854).
- Both CodeQL language analyses passed on main: [run 42686689576](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42686689576).
- The Windows x64 artifact built from the current main commit is available [here](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42686689854/artifacts/13703744988).

The listed source and automated CI checks are complete. The remaining hosted-service, data-recovery, branch-protection, legal, production-alias, and physical Windows acceptance gates below remain separate.

## Required before a 0.8.0 release

### 1. Current source and automated CI — completed

- The current main-commit website/browser and training-data workflows passed: [run 42686690073](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42686690073).
- The Windows x64 build passed all 47 native CTest cases and its UCI/GUI smoke checks: [run 42686689854](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42686689854).
- Both CodeQL language analyses passed: [run 42686689576](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42686689576).
- Local GCC, Clang, and ASan/UBSan builds passed 47/47 on the unchanged native source revision documented above.
- A separate standalone WebAssembly parity workflow is retained as historical evidence; the current website build verifies that the WebAssembly runtime assets are present, but this release pass did not rerun the dedicated parity job.

### 2. Enforce default-branch protection

- Keep pull requests mandatory for main.
- Configure required status checks for the relevant website/browser, native compiler/sanitizer, Windows x64, WebAssembly, CodeQL, and backup-tool workflows.
- Require branches to be up to date before merging.
- Require an independent approval when a second reviewer is available.
- Re-read the saved ruleset and verify that the checks are actually enforced.

### 3. Complete archive ownership and migration

- Confirm the exact guest Auth identity that owns the archive before any migration.
- Preserve the original identity when linking and verifying an email; do not infer ownership from an email address, browser hostname, or record count.
- Import only records belonging to the verified identity. Reconcile games, reviews, position-memory records, foreign keys, ownership, and migration state.
- Verify that a retry is idempotent and does not duplicate records.

### 4. Complete hosted authentication and email validation

- Verify the hosted identity-linking, email confirmation, password sign-in, recovery, Site URL, and redirect allowlist settings.
- Install the repository email templates and configure custom SMTP with a verified sender domain and correct SPF, DKIM, and DMARC records.
- Test confirmation, recovery, and password-change messages with controlled mailboxes.
- Review the hosted breached-password protection setting and enable it where supported by the service plan.

### 5. Prove data recovery

- Configure the encrypted backup workflow with a database-owner credential and a public encryption recipient.
- Keep the private decryption identity offline; never store it in source control or expose it in logs.
- Run a backup against a populated archive, verify its checksum, decrypt it, and restore it into an isolated PostgreSQL instance.
- Reconcile table counts, relationships, owner scope, and integrity. Tooling tests and empty-schema snapshots do not constitute a successful data-bearing restore.

### 6. Complete legal and privacy review

- Obtain qualified review of the Privacy Notice and Terms of Use before treating them as approved.
- Review operator disclosures, the likely audience and age/guardian-consent requirements, applicable privacy regimes, cross-border transfers, subprocessors, retention, deletion, backup expiry, and third-party licensing.
- Keep the public Privacy Notice and Terms clearly marked as drafts until approval is documented.

### 7. Deploy the reviewed source to production

- Create a fresh production-target deployment from the final main commit using production environment settings.
- Test the exact candidate deployment, including authentication, archive operations, responsive layouts, account closure, and error handling.
- Confirm that the canonical production domain resolves to that deployment before announcing the browser service.
- Do not promote an older feature-branch deployment or a preview build as a substitute for a production build.

### 8. Final manual Windows acceptance

This is the final hands-on technical acceptance step, after the source, hosted services, recovery, legal, and deployment gates above are closed.

- Run docs/windows-desktop-checklist.md on the intended Windows 10/11 client device.
- Verify 100% and 150% display scaling, 1366×768 and 1920×1080 layouts, physical input, all promotion choices, checkmate/stalemate/draw states, sustained search, cancellation, and repeated launch/close.
- Record the device, test date, results, and any defects in docs/windows-acceptance-record.md.

### 9. Build and publish the release

- Tag the exact accepted source commit.
- Build the release binaries from that tag and run the complete CTest suite against those binaries.
- Publish release notes and downloadable artifacts built from that tag only.
- Generate and publish SHA-256 checksums for every downloadable artifact.
- Include the root MIT license and all required third-party notices in the release package.

## Future improvements — not release blockers

- Extract a reusable engine core library from src/main.cpp.
- Split the website application controller into smaller modules.
- Expand UCI options and protocol documentation.
- Broaden the fixed-position benchmark set and add a reproducible match-testing harness.
- Continue search and evaluation development in a later version.

These improvements should be tracked separately and should not reopen the 0.8.0 scope once all required release gates are satisfied.