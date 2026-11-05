# Release operations and external controls

This document records release tasks that cannot be completed by repository code or CI alone. It is intended for maintainers and reviewers.

## Main-branch protection

The repository's active ruleset, **Protect main**, currently prevents branch deletion and force-pushes and requires pull requests. It does not yet require CI status checks or approvals. Configure the required website, CodeQL, native, WebAssembly, Windows, backup-tool and benchmark-audit checks before merging a release candidate. The ruleset must be checked again after saving.

See [GitHub branch protection](github-branch-protection.md) for the exact control names and recommended settings.

## Encrypted database backups

The encrypted backup workflow is committed at `.github/workflows/prunex-db-backup.yml`. Its prerequisites are:

- Actions variable `PRUNEX_BACKUP_AGE_RECIPIENT`: the public age recipient.
- Actions secret `NEON_BACKUP_DATABASE_URL`: an owner-level PostgreSQL connection with permission to read all rows, including RLS-protected rows.

The matching private age identity must remain offline and must never be committed or shared. The workflow should be merged to `main`, run manually once, and checked for an encrypted artifact with the configured retention. Complete a data-bearing restore drill using `tools/backup/verify-restore.sh`; an empty-schema restore does not verify recovery of user records.

See [Backup and restore runbook](backup-restore-runbook.md) for encryption, retention and restore details.

## Legacy guest archive migration

Legacy guest data must be linked from its original browser profile. Do not infer ownership from row counts or select an anonymous user based on guesswork. The email must be linked and verified on the existing Supabase identity before the owner-scoped import runs.

See [Guest archive linking and migration](owner-account-activation.md). Only the verified identity matching the server-side `PRUNEX_OWNER_EMAIL` allowlist may be imported. Other guest identities must remain untouched.

## Windows desktop acceptance

CI verifies the Windows x64 build, architecture, tests and UCI smoke test. It does not replace interactive testing on Windows 10 or 11. Complete [the Windows acceptance record](windows-acceptance-record.md), including search cancellation, new game, undo, promotion, close/shutdown and display behavior.

## Legal and privacy review

The [Privacy Notice](../website/privacy.html) and [Terms of Use](../website/terms.html) remain drafts. They require review by qualified counsel against the actual operator, audience, age/consent obligations, jurisdictions, transfers, retention and deletion processes. Keep the visible draft labels until the final wording is approved.

## Release decision

A green CI run is necessary but not sufficient for production promotion. The owner-authenticated archive migration, email provider delivery, data-bearing backup/restore, legal review, manual Windows acceptance and required branch checks are separate release gates.
