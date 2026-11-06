# Prunex database backup and restore runbook

## Current activation status — 6 November 2026

The backup workflow is committed, but no successful production run on `main` or encrypted backup artifact is recorded. The Neon Free project does not permit scheduled snapshot configuration through the available API, and its manual snapshot quota is already occupied by an earlier empty-schema checkpoint. The existing source-data recovery record is not a tested database export/restore archive.

Do not describe backups as active or recovery as verified until an encrypted artifact has been produced, downloaded and decrypted in a controlled environment, and restored with row counts reconciled against the source.

## Design

The Neon project is PostgreSQL 18. Its Free plan currently has a six-hour point-in-time history window and does not allow scheduled Neon snapshots. This repository therefore includes a second, off-provider backup path using GitHub Actions:

- A scheduled full PostgreSQL custom-format dump runs daily at 02:17 UTC (04:17 Cairo time during UTC+2).
- The dump is encrypted locally with age **before** any upload.
- Only the age ciphertext and SHA-256 checksum are uploaded to GitHub Actions artifacts.
- Artifacts request 90-day retention. Public repositories are capped at 90 days by GitHub's current policy; organization/enterprise settings can impose a lower cap.
- The workflow refuses to dump if its PostgreSQL 18 client/server versions do not match or if the configured database role cannot bypass RLS. This prevents a successful-looking but incomplete backup.
- The workflow uses only `workflow_dispatch` and the daily schedule. It does not run for pull requests.

The repository is public. Artifact metadata (run date and encrypted file size) is visible to repository readers; the database contents are not readable without the age private identity.

## One-time setup (repository owner)

### 1. Generate an encryption keypair on a trusted machine

Install age from its official release/package source. Then run:

```bash
age-keygen -o prunex-backup-identity.txt
```

The command prints a public recipient beginning with `age1...`. Keep the entire `prunex-backup-identity.txt` file private and offline. Do not commit it, attach it to an issue, or paste it into chat.

### 2. Add the public recipient as an Actions variable

Open [Prunex Actions settings](https://github.com/Mohamed-Mostafa-AE/Prunex/settings/variables/actions), choose **New repository variable**, and add:

- Name: `PRUNEX_BACKUP_AGE_RECIPIENT`
- Value: the `age1...` recipient printed by `age-keygen`

This value is public-key material; it is safe to store as a repository variable.

### 3. Add a database connection as an Actions secret

Open [Prunex Actions secrets](https://github.com/Mohamed-Mostafa-AE/Prunex/settings/secrets/actions), choose **New repository secret**, and add:

- Name: `NEON_BACKUP_DATABASE_URL`
- Value: a PostgreSQL connection string for the Prunex Neon database using a role that can read every row in `prunex_archive`.

The current Neon table owner is `neondb_owner`, and a live check confirmed it has `BYPASSRLS`. The existing application connection uses the restricted `prunex_app` role and is **not suitable for full backups**. Use the database owner connection string from Neon Console → Project → Connect. Keep it only in the GitHub secret; never paste it into a workflow file or commit it.

GitHub stores repository secrets encrypted. Keep the default branch protected with pull-request review before enabling this secret.

### 4. Merge the backup workflow to main, then run it once

The workflow is `.github/workflows/prunex-db-backup.yml`. It is restricted to `main`. Once the PR is merged and both settings exist:

1. Open [Actions → Prunex encrypted database backup](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/workflows/prunex-db-backup.yml).
2. Select **Run workflow** on `main`.
3. Confirm the run succeeds and creates an artifact named `prunex-neon-backup-...`.
4. Download the artifact and retain the private age identity offline.

The daily schedule then runs automatically at 02:17 UTC. GitHub may bill artifact storage; review the repository's Actions storage allowance/usage. Retention is requested as 90 days but must be checked against the effective repository/organization policy.

## Manual data-bearing restore drill

After the first real backup exists, perform a restore into a disposable local PostgreSQL 18 instance—not into production.

1. Download one encrypted backup artifact and extract the `.dump.age` file.
2. On a computer that holds the private identity, decrypt it:

```bash
age --decrypt --identity prunex-backup-identity.txt \
  --output prunex-neon.dump prunex-neon-*.dump.age
```

3. Verify the encrypted artifact checksum using its `SHA256SUMS` file before decrypting. Then inspect the custom-format archive:

```bash
pg_restore --list prunex-neon.dump
```

4. Run the repository's local restore verifier from the checked-out repository:

```bash
bash tools/backup/verify-restore.sh \
  /path/to/prunex-neon-YYYY-MM-DDTHH-MM-SSZ.dump.age \
  /path/to/prunex-backup-identity.txt \
  /path/to/SHA256SUMS
```

The script verifies the artifact checksum, decrypts into a temporary directory, starts an isolated PostgreSQL 18 Docker container, restores with `pg_restore --exit-on-error`, checks all four required archive tables and their RLS flags, prints row counts, and removes the container and plaintext dump when it exits. It uses only localhost port 55432; stop any service already using that port first.

5. Record the source artifact ID, restore date, PostgreSQL version, the four row counts, RLS verification, and any errors. Reconcile counts against the live Neon archive and source migration record; do not treat a successful empty-schema restore as proof of data-bearing recovery.
6. Keep the encrypted artifact and private age identity safe. The script removes its temporary plaintext dump and database container on exit. Keep the private age identity offline.

Do not declare the backup gate complete until a real post-migration backup has been produced, downloaded, decrypted, and restored successfully, with row counts reconciled against the source.

## Failure behaviour

The workflow fails closed when secrets/variables are missing, the database server/client is not PostgreSQL 18, or the backup connection cannot bypass RLS. Do not relax these checks to make a job green. If Neon schema/role ownership changes, update the backup role and verify it can capture all archive rows.
