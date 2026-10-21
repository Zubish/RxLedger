# Recurring encrypted database backups

## Status — 2026-10-21

Implementation prepared in `.github/workflows/database-backup.yml` and `scripts/database-backup.sh`. **Not activated. No recurring backup or off-provider production copy has been verified.** GitHub repository-secret access returned HTTP 403 for the connected integration. No database secret or recovery key was added. Existing provider protection and snapshot expiry remain as recorded in [RECOVERY_RUNBOOK.md](RECOVERY_RUNBOOK.md).

The repository is public. Only age-encrypted database archives and nonclinical manifests may be uploaded as artifacts; never upload plaintext dumps or recovery identities. The recovery identity must stay outside GitHub, the repository and the app host. Someone obtaining the GitHub repository or encrypted artifact should not thereby obtain the recovery key. A compromised backup runner can still read the live database while dumping; restrict repository writers and protect the default branch. This is an initial off-provider copy, not immutable archival storage or a compliance certification.

## Policy and scope

- Proposed pilot cadence: hourly at minute 23 UTC; seven-day artifact retention. Set `DATABASE_BACKUPS_ENABLED=true` explicitly only after setup and a successful manual run/download/decryption/isolated restore. Cadence is a starting operational choice, not an owner-accepted data-loss SLA.
- GitHub schedules may be delayed, disabled or fail. An hourly schedule does not guarantee one-hour RPO. Check the latest successful artifact age, not merely workflow existence. If no success in two hours, investigate immediately and take a manual provider snapshot. Recovery time has no established SLA yet.
- Dump the entire application database with a direct TLS PostgreSQL connection, including tables outside `public`; no tenant/branch filters. This preserves registry, transactions, ledger, audit, platform and authentication data together. `pg_dump` supplies a consistent snapshot while writes continue.
- No global database roles/ACLs, external uploaded files, DNS, Vercel secrets, payment-provider state or external integration side effects are included. Recreate database privileges separately and use the release/configuration record during recovery. Expired/revoked sessions and deletions require review before reopening a restored system.
- `pg_restore --list` checks archive readability, **not full restore correctness**. A manifest records `restoreVerified:false` deliberately.
- Artifacts expire after seven days (subject to repository limits); successful runs consume GitHub Actions minutes/storage. Download and retain an additional encrypted copy in a separately controlled location for stronger account-loss protection. No automatic deletion of live pharmacy records is performed by this job.

## One-time setup by a repository administrator

1. Install [age](https://github.com/FiloSottile/age#installation) on your own trusted device. Run `age-keygen -o rxledger-recovery.key`. Store the private file securely in two offline locations and test that you can retrieve it. Do not paste it into a chat or save it in GitHub. Obtain the public recipient with `age-keygen -y rxledger-recovery.key`.
2. In **GitHub → Zubish/RxLedger → Settings → Secrets and variables → Actions**, add secret `BACKUP_DATABASE_URL`: the existing production database's **direct/unpooled** TLS URL, preferably using a dedicated backup identity with SELECT privileges on every application table/schema (and future tables). Do not use a preview, restored drill or newly created database. Permission failures must fail the dump rather than silently omit tables. No schema filter is used. Confirm the intended endpoint against the recovery runbook before adding it.
3. Add variable `BACKUP_AGE_RECIPIENT` with the public `age1...` recipient. Add variable `DATABASE_BACKUPS_ENABLED` with value `true` once the recovery identity is securely held. The job is otherwise skipped, including manual runs. Enable Actions and failure email notifications for this repository in your GitHub account. Notification delivery and independent stale-backup monitoring are not configured by the code.
4. Run **Actions → Encrypted database backup → Run workflow**. Verify all steps succeed, an encrypted artifact exists, and the latest successful run corresponds to production. Download the artifact. Confirm its encrypted file SHA-256 matches the manifest. Test decryption and restoration in a private disposable database before relying on the schedule. If the manual run fails, remove/disable the enable variable until corrected; use manual provider snapshots meanwhile.
5. Check the following scheduled run and latest artifact age; record the first actual backup/recovery point, restore timings and test results in the runbook. Review weekly and rehearse monthly or after significant schema changes. Scheduled workflows run from the default branch. The job has no pull-request trigger and does not accept an arbitrary target URL from workflow inputs.

## Restore rehearsal

Use a disposable private PostgreSQL instance, never production or a publicly deployed preview. Treat dumps as untrusted input: PostgreSQL restore executes SQL, so isolate the destination. Disable outbound mail/payment/integration access. Install the same or a compatible newer PostgreSQL client/server version; the workflow uses PostgreSQL 18 clients. A newer source server requires an explicit client update.

1. Download and unpack the encrypted artifact outside any web root. Compare SHA-256 with `manifest.json` before decryption.
2. On the trusted recovery device, run `age --decrypt --identity /secure/path/rxledger-recovery.key --output /private/path/database.dump /private/path/database.dump.age`. Keep plaintext permissions 0600; delete it after the drill. Do not retain plaintext in CI artifacts.
3. Inspect with `pg_restore --list /private/path/database.dump`. Restore to an **empty isolated** database with `pg_restore --exit-on-error --single-transaction --no-owner --no-acl --dbname "$RESTORE_TEST_DATABASE_URL" /private/path/database.dump`. Keep the URL secret. Do not use `--clean` on an existing target.
4. Compare table inventory, whole-workspace digests and critical table contents against the snapshot point, then safely test restored login/permissions, patient lookup, saved sale/stock ledger and financial reconciliation. Live production counts can legitimately change after dump start. Do not claim exact consistency using separate later live queries.
5. Record evidence, recovery duration, actual data-loss window and missing checks; destroy the isolated copy and plaintext. An actual production cutover additionally requires the incident/reconciliation steps in the recovery runbook.

## Local verification

`bash -n scripts/database-backup.sh` and `python3 scripts/database-backup.test.py` (requires `age` and `age-keygen`). Four synthetic tests use actual age encryption/decryption and simulated PostgreSQL clients: round trip and metadata; wrong key/corruption; dump/archive/encryption failure cleanup; missing/pooled/non-TLS/web-root configuration rejection. These tests alone do not prove database dump or production restore success.

`python3 scripts/database-backup-postgres.test.py` requires PostgreSQL server/client binaries on PATH. It creates a temporary private Unix-socket PostgreSQL cluster, inserts synthetic patient/sale/stock JSON and a separate-schema audit table, runs the actual backup script, decrypts the archive and restores it transactionally into a new empty database. Both tables' contents must match. It never reads a production URL or reassigns a Neon endpoint. Verified locally using PostgreSQL 17.11 and age 1.3.2 on 2026-10-21; the workflow reruns these checks using PostgreSQL 18 before accessing its backup secret. This establishes the backup/restore mechanism with synthetic data, not a verified hosted production backup, restored login or recovery-time SLA.

## Sources

- [PostgreSQL pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html): consistent snapshot and client compatibility.
- [GitHub artifact retention](https://docs.github.com/en/organizations/managing-organization-settings/configuring-the-retention-period-for-github-actions-artifacts-and-logs-in-your-organization): retention and storage policy.
- [age](https://github.com/FiloSottile/age): recipient encryption and separate recovery identity.
