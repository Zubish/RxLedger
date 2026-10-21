# RxLedger Backup and Recovery

## Current observed protection — 2026-10-21

Project `crimson-hill-05547844` (RxLedger), original production branch `br-summer-rice-appce56c`, endpoint `ep-sparkling-truth-apeqnmnx`.

- Provider project reports **21,600 seconds (six hours)** of history. Recheck before relying on point-in-time availability; it is not a seven-day backup policy.
- Manual snapshot `snap-long-scene-api5p0ie`, **rxledger-launch-recovery-2026-10-21**, created 2026-10-21 05:20:02 UTC, expires **2026-10-28 06:00 UTC**. The reported snapshot point is 05:12:50 UTC. Do not infer the recovery point from its display name or request completion time.
- Daily snapshots with seven-day retention were requested but the provider rejected scheduling: **“backup schedule creation is not enabled for this project.”** No schedule is active. A fresh manual snapshot is not ongoing automatic backup protection.
- Owner/operator must enable a supported recurring backup plan (or separately secured off-provider backup automation), define acceptable data loss/recovery time, monitor failures and rehearse periodically. Until then, take manual snapshots before important changes and at each pilot operating day, and understand the interval of possible data loss. Never claim an unconfigured schedule is running.

## Rehearsal and incident record

Recurring off-provider automation and setup are documented in [RECURRING_BACKUPS.md](RECURRING_BACKUPS.md). The encrypted backup workflow is prepared but **not activated**; repository secrets could not be configured with the current integration. Neither an implementation nor a hosting provider's hosted-content backup advertisement establishes recurring protection for the Neon database. This workflow is independent of the application host, including Vercel.

Snapshot restore produced `br-floral-math-apym9rel`. The initial tool call omitted `finalize:false`; despite a drill name and no target branch, its default finalization moved the production compute and default/name onto the restored branch. This was an unintended production configuration change, not an isolated drill.

The original branch was reinstated as default and renamed production. Endpoint `ep-sparkling-truth-apeqnmnx` was moved back onto `br-summer-rice-appce56c` at approximately 05:22:08 UTC. A temporary no-compute branch (`br-summer-boat-apcgzdi8`) allowed endpoint reassignment without deleting either database. The drill's compute (`ep-old-hall-apvddwv6`) was then assigned to the restored drill branch. Both temporary branches expire 2026-10-22 06:00 UTC; neither is the application's production target.

Before and after correction, all four workspace JSON digests matched exactly between the original branch and restored snapshot. The combined tenant JSON digest was `74c954a012fbe4755e4e6bc7bc8a3964`; the restored dataset included 3,026 sales, 8,534 stock movements and 3,625 audit entries in DEMO, plus the other current workspace rows. No pharmacy record writes were performed by the checks. Both branches exposed the same 21 public base-table names, including platform authentication/configuration, audit, telemetry and Rai tables. This proves snapshot materialisation and the stated workspace/schema comparisons; it is not a full table-by-table content comparison, a restored-login test, or evidence of zero transient connection interruption. Live session/telemetry tables can change independently.

The snapshot and branch are provider-managed, access-controlled data copies. No patient JSON, password hashes or credentials were exported to the repository. Do not deploy a preview against the drill branch: it contains real data and authentication state.

## Safe procedure for subsequent recovery verification

1. Record production branch ID, default/name, compute IDs, restore window and current release/configuration. Take a snapshot and record its actual recovery point and expiry.
2. Restore with **`finalize:false` explicitly**, no production target, a unique drill name. Do not rely on a name to imply isolation. Do not call `finalize_branch_restore` for a drill.
3. Immediately inspect branches and computes. Confirm the original default/name/production endpoint are unchanged before reading data or setting expiry. Stop and correct any unexpected mapping.
4. Compare authorised aggregate counts and whole-workspace digests in the isolated copy; compare schema and critical non-tenant tables. Use synthetic identity or a safe controlled process for restored application tests; prevent outbound integrations/email and public access. Do not publish credentials or raw patient records.
5. Record timings, results, missing tests and cleanup/expiry. Never expire a branch until confirming it has no production endpoint.

## Actual incident recovery / cutover

An actual cutover can discard later writes and invalidate sessions. Quiesce writes, preserve the current branch, choose a recoverable point and reconcile post-snapshot sales, ledger, patients, audit and external payment side effects before promotion. Snapshot restoration alone cannot reverse an external bank transfer or reconstruct missing post-snapshot transactions. Invalidate old sessions and review restored authorisation/deletion state to prevent reviving revoked access or previously removed workspace data.

Promotion requires a concrete reviewed target and existing incident authorisation; verify deployment database mapping and application behaviour afterwards. A code rollback does not restore data, and an old release may discard newer registry/checkout/financial fields on save. Prefer compatible forward fixes when possible. Custom domain/DNS, Vercel environment secrets and external services are not restored by a database snapshot.
