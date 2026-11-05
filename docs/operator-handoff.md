# Prunex 0.8.0 — operator handoff

This page lists the small number of actions that require the repository owner or an external reviewer. The application code, benchmark evidence trail, preview deployment, backup workflow, restore helper and verification documents have been prepared in this branch.

## 1. Protect the default branch

Open [GitHub → Settings → Rules → Rulesets](https://github.com/Mohamed-Mostafa-AE/Prunex/settings/rules) and create an active ruleset for `main`.

Use the exact settings in [GitHub branch protection setup](github-branch-protection.md): require pull requests, block force pushes and deletion, and require the specified successful CI checks. The connected GitHub integration can read branch status but cannot write admin rulesets. Confirm the ruleset is active after saving.

## 2. Activate encrypted 90-day backups

Open [Backup and restore runbook](backup-restore-runbook.md). The workflow is already committed at `.github/workflows/prunex-db-backup.yml` and is tested by `.github/workflows/backup-tools-ci.yml`.

On your own computer, generate an age keypair and keep the private identity file offline. In GitHub Actions settings, add:
- Repository variable `PRUNEX_BACKUP_AGE_RECIPIENT` = the public `age1...` recipient.
- Repository secret `NEON_BACKUP_DATABASE_URL` = Neon PostgreSQL 18 connection string using `neondb_owner` (or a role confirmed to bypass RLS).

Do not paste the private identity or database connection string into ChatGPT, issues, or commits. Once PR #10 is reviewed/merged to `main`, run the workflow manually once and check that a `prunex-neon-backup-...` artifact is created with a 90-day expiry. Artifact storage can consume Actions storage allowance. Then complete the local restore drill with `tools/backup/verify-restore.sh`.

## 3. Link your actual guest archive

Use [Owner account activation](owner-account-activation.md). On the browser/device profile that contains your own guest archive, open [the review website](https://prunex-review.vercel.app/), open Play → Game archive → Account & Data, and use **Link this guest archive to the verified owner email**. Use the exact email configured in Vercel's `PRUNEX_OWNER_EMAIL` setting. Complete the email verification link in that same browser profile.

Then tell me only that verification succeeded and the archive still shows your games. Do not send a magic-link URL, access token, refresh token, or browser storage export. I will confirm the authenticated user and migrate only that verified owner's records; all other guest archives remain untouched.

## 4. Run the Windows desktop acceptance test

Download the [passing Prunex-Windows-x64 artifact](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42075433290/artifacts/13437603709). Extract it and run `Release/Prunex.exe`. The archive includes the CLI engine, build manifest, executable SHA-256 hashes and CTest log. It currently expires **5 December 2026**.

Complete [the Windows acceptance record](windows-acceptance-record.md) on Windows 10 or 11. Return the checklist with pass/fail results, Windows build and any logs/screenshots. The existing CI result is not a substitute for the interactive test.

## 5. Obtain legal review

Send the current [Privacy Notice](https://prunex-review.vercel.app/privacy.html), [Terms of Use](https://prunex-review.vercel.app/terms.html), and [counsel review brief](legal-review-brief.md) to a qualified lawyer/privacy professional who can assess the actual operator, audience and jurisdictions. Ask for redlines or written sign-off. Do not remove the visible Draft labels until the reviewed versions are incorporated and approved.

## What to send back

You can report progress in one message without sharing secrets:

- Branch ruleset: active / not yet.
- Backup settings: both added / not yet; first run: passed / failed / not run.
- Owner link: verified / exact error (no link tokens).
- Windows checklist: attach or paste the completed acceptance record.
- Legal review: redlines received / written approval received / still pending.

Once these confirmations arrive, the remaining database checks can be performed against real evidence instead of assumptions.
