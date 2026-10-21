# Change And Release Record

Record material changes using [the maintenance process](MAINTENANCE_AND_COLLABORATION.md). Group minor related edits. Keep implementation, technical verification, release and owner acceptance separate. Do not retroactively invent acceptance, test runs, schema checks or recovery exercises.

## RXLEDGER-RECURRING-BACKUPS-01 — Encrypted Hourly Backups And Restore Verification

- Request: implement recurring backups after native database scheduling was rejected. Hosting discussion is recommendation-only; the owner clarified no domain purchase and no intended Vercel hosting. No DNS or hosting migration is part of this change.
- Implementation: host-independent GitHub Actions job, hourly at minute 23, seven-day retention, explicit enable gate, direct TLS database dump, custom-format archive validation, age recipient encryption before artifact upload, ciphertext checksum and nonclinical manifest. Recovery identity stays outside GitHub. Whole database, no branch/tenant filtering; no database mutations or schema changes.
- Verification: four safety tests passed with real age 1.3.2 encryption, wrong-key/tampering rejection, configuration guards and failure cleanup; PostgreSQL 17.11 private Unix-socket cluster passed actual dump → encryption → decryption → transactional restore into empty database, with matching public tenant JSON and separate-schema audit content. Shell syntax, workflow YAML and focused diff checks passed. No production dump, hosted restore or login was tested; workflow uses PostgreSQL 18 and reruns the safety/restore tests before accessing its production secret.
- Activation blocker: GitHub secret listing returned HTTP 403 `Resource not accessible by integration`; no secret, recipient or enable flag was configured. Workflow remains inactive. Current protection remains the expiring manual snapshot and six-hour provider history. [Setup and limitations](RECURRING_BACKUPS.md) distinguish this from an active schedule.
- Release: infrastructure/repository change; no app runtime release, database migration or production tag. Record actual push result in the completion report. Owner acceptance not yet reviewed.
- Recovery: disable `DATABASE_BACKUPS_ENABLED` to stop scheduled jobs; retain encrypted copies and recovery identity. Actual recovery requires isolated verification and incident reconciliation from the runbook; no automatic production cutover exists. No actual production routing, pharmacy record or external side effect was changed.
- Next: repository administrator adds the direct database secret and public age recipient after retaining the private recovery key offline, enables the job, verifies a manual production backup plus isolated restore, then checks scheduled-run age and failure notification delivery. Automatic activation is not claimed.

## SCM-2026-10-20-01 — Assimilate SEN 401 Into Development Practice

- Request/owner: Musa Ibrahim asked to assimilate the supplied guide and course reference into how RxLedger is built and how the AI assistant collaborates.
- Outcome: repository entry instructions, one maintenance process, a requirement-to-check inventory and integrated AI/QA guidance, preserving the supplied proposed guide as historical reference.
- Scope/category: preventive; repository documentation only. No app features, branding, configuration, database or dependencies are changed.
- Preserve: existing pharmacy rules, branch isolation, user authorisation and lightweight delivery. Unconfirmed source proposals do not override accepted product requirements.
- Implementation: implemented in this documentation change; find its exact commit with `git log --all --grep=SCM-2026-10-20-01`.
- Technical verification: passed focused documentation review and `git diff --check`; validated 46 relative links across the integrated documents and byte-for-byte identity of the retained source guide. Recorded source SHA-256 identifiers and reviewed course-summary page references. No application build, runtime test or recovery exercise was run for this documentation-only change.
- Release: repository documentation; no application release or migration is required. Record actual push/deployment results in the completion report; a Git-triggered hosting build does not imply new runtime behaviour.
- Owner acceptance: incorporation of the process was explicitly requested; the final document wording has not yet been reviewed by the owner.
- Recovery: documentation can be reverted through Git without data restoration. No recovery rehearsal was performed.
- Next action: use the matrix for the next relevant change; schedule integrity/recovery work explicitly rather than claim it is already complete.

## SCM-2026-10-20-02 — Core Integrity Verification And Corrections

- Request/owner: Musa Ibrahim authorised the recommended first priorities: access isolation, stock accuracy, pricing and patient information.
- Acceptance criteria: forbidden workspace/branch requests do not mutate data; receive/sale/issue/physical return reconcile in least units; repeated lines cannot overdraw stock; stale carts cannot erase recorded allergies; conflicting saves cannot silently overwrite committed changes; regression checks remain repeatable.
- Scope/category: corrective/preventive; action API, shared tenant persistence, POS patient snapshot selection, backend/browser checks and authoritative rules. Preserve existing UI layout, accepted pricing/rounding configuration, branch ownership, patient editing location and production records.
- Findings fixed: same-batch double allocation across duplicate medicine lines; cross-branch automatic Continuity closure; consumed/expired draft fallback to a new sale; stale POS allergy metadata; negative/unsupported adjustment directions; invalid receiving money; unconditional whole-workspace saves losing concurrent changes.
- Persistence: server-only load/version tracking plus atomic PostgreSQL comparison of existing `updated_at`, carried through read-model construction. Stale saves fail with refresh/retry guidance. Creation remains explicit and cannot replace an existing workspace. No schema migration or production data repair performed.
- Dependency/configuration: pinned PGlite 0.5.10 development dependency for isolated persisted API/SQL verification. No new runtime dependency or environment setting.
- Implementation: implemented; exact commit discoverable with `git log --all --grep=SCM-2026-10-20-02`.
- Technical verification: existing suite passed before changes; focused backend regressions, isolated PostgreSQL API suite and patient browser checks at 390/1440 passed after changes. Build passed; lint has no errors and the existing RaiConsent effect-dependency warning. Final suite/diff/release checks reported with the completion result. Browser fixtures are mocked; isolated PostgreSQL is real local SQL execution with replaced Neon transport/telemetry, not hosted Neon or production transaction testing.
- Release: intended existing RxLedger Git integration, `master`, production `rxledger.vercel.app`. Commit/deployment state must be verified and reported, not inferred from this record. No database migration.
- Recovery: code rollback remains compatible with existing data schema but would remove the new integrity guards. No restore exercise or historical reconciliation performed; no production fixture data inserted.
- Owner acceptance: not yet reviewed; implementation was authorised, final behaviour/design acceptance remains separate.
- Remaining: general operation-key checkout idempotency for ambiguous responses, complete role/action matrix, higher-contention hosted-service checks, financial report/refund reconciliation and backup/recovery exercise. See the dated requirements map for precise limits.

## RXLEDGER-CHECKOUT-RELIABILITY-01 — Checkout Reliability: Duplicate Sale Protection

- Request/owner: Musa Ibrahim authorised the next slice, reliable checkout retries, and required descriptive commit/production release naming.
- Release name/version/tag: **Checkout Reliability — Duplicate Sale Protection**, **checkout-reliability-v1.0.0**, **release/checkout-reliability-v1.0.0**. [Named releases](RELEASES.md) and public release manifest identify the intended code; actual deployment is verified separately.
- Outcome/criteria: one operation records one sale/receipt/stock deduction; duplicates and concurrent retries return the original result; ambiguous confirmation does not invite a new sale; first-attempt validation rejection preserves an editable cart; refresh recovery and safe cancellation work without storing patient/cart data locally.
- Scope/category: corrective/preventive; POS, API transport/action handler, tenant JSON/read normalisation/response scope, synthetic API/browser checks and release documentation. Preserve existing permissions, price rules, financial recording and patient metadata.
- Implementation: implemented; contract in [CHECKOUT_RELIABILITY.md](CHECKOUT_RELIABILITY.md). New sale metadata stores operation ID/fingerprint; scoped cancellation tombstones prevent late commits. Conflicts reload/re-authorise and recover committed results. Matching replay does not create another audit entry or consume stock/drafts again.
- Verification: all 15 test files pass; build passes; lint has no errors and the existing RaiConsent dependency warning. Focused PostgreSQL, browser-to-handler-to-PostgreSQL checkout checks and the patient browser regression pass at 390/1440; exact release results reported at completion. Browser fault injection drops a response after an actual local commit, drops a request before arrival and injects a rejected retry. Production patient transactions are not tested or inserted.
- Data/configuration: additive optional JSON metadata/collection; no SQL migration, new environment variable or runtime dependency. New recording requests require an operation ID; old cached POS must refresh. Historical sales remain readable.
- Recovery: prior code lacks the protocol and may omit cancellation metadata on save. Preserve full data, resolve/quiesce pending checkouts and prefer a compatible forward fix. No production restore exercise performed.
- Owner acceptance: implementation authorised; final result not yet reviewed.
- Remaining: hosted-service contention/load, other action idempotency, financial-report/refund reconciliation and restore drills. This feature is not offline checkout or payment-provider settlement.

## RXLEDGER-CHECKOUT-RELIABILITY-02 — Incomplete Confirmation Protection

- Owner/request: continuation of Musa Ibrahim's authorised Checkout Reliability slice and descriptive release naming.
- Finding: the inherited API parser substituted an empty object for unreadable JSON. A truncated committed response could enter the success path without a valid action result.
- Implementation: reject malformed JSON, invalid response roots and incomplete action envelopes; preserve uncertain checkout recovery. No database/schema/configuration change.
- Verification: native client cases cover truncated JSON and incomplete/null/array success bodies; browser fault injection truncates the response after an actual isolated PostgreSQL commit, then refresh/status recovery retrieves the same sale. Build/lint/regression results and production checks reported at completion.
- Release name/version/tag: **Checkout Reliability — Duplicate Sale Protection**, **checkout-reliability-v1.0.1**, **release/checkout-reliability-v1.0.1**. Published **v1.0.0** remains unchanged; this is a separate descriptive patch commit/tag.
- Recovery: same checkout data/rollback limits as the parent release; no production record repair or restore exercise.
- Owner acceptance: not yet reviewed.

## RXLEDGER-WORKSPACE-PATIENT-REGISTRY-01 — Cross-Branch Recognition

- Date/owner/request: 2026-10-21; Musa Ibrahim authorised shared workspace patient recognition across pharmacy branches.
- Outcome: dedicated identity registry; canonical contacts and explicit selection prevent accidental duplicate registration and family allergy mixing. Separate people may share a phone with a documented reason. Current allergies follow the patient; operational/financial access remains branch-restricted.
- Scope/category: adaptive/preventive; tenant normalisation, API permissions/actions, POS/drafts/continuity identity links, Patients registration/edit/merge dialogs and clinical-history disclosure. [Contract](WORKSPACE_PATIENT_REGISTRY.md).
- Implementation: implemented. Additive conservative legacy import, audited save-time initialisation, revision-checked edits, owner-only reviewed merge and redacted/audited professional care history. No SQL migration, environment variable or new dependency.
- Verification: all 16 test files pass, including actual handler/isolated PostgreSQL registry and concurrency cases. Browser → API → isolated PostgreSQL registry flow passes at 390/1440px; checkout and patient-details browser regressions pass at both widths. Build passes. Lint passes with the existing RaiConsent dependency warning. Deployment evidence is recorded at release completion. No production patient test writes or enterprise load benchmark.
- Release: **Workspace Patient Registry — Cross-Branch Recognition**, `release/workspace-patient-registry-v1.0.0`. Production delivery must be verified against the named manifest and served build separately.
- Recovery: legacy import rehearsed in isolation; preserve complete tenant JSON and quiesce writes before incompatible rollback. Prefer compatible forward fixes; old code can discard registry metadata. No production restore drill.
- Owner acceptance: not yet reviewed. Existing ambiguous legacy identities require review, not silent merging; high-volume roster pagination remains future work.

## RXLEDGER-SALES-RECONCILIATION-01 — Financial Snapshots And Recovery Checks

- Date/owner/request: 2026-10-21; Musa Ibrahim authorised financial-report reconciliation followed by backup/recovery verification before the public pilot launch.
- Outcome: Reports → Sales reconciliation calculates full-period totals server-side with branch authorisation, financial and stock arithmetic checks, payment totals, historical cost visibility, CSV and print. New sales persist cost and optional cash/change snapshots with kobo rounding. Remove UI-only unconfigured VAT assertion; preserve original transactions.
- Category/scope: corrective/preventive; sale recording/normalisation, shared financial helpers, authenticated state report scope, focused Reports UI, PostgreSQL/browser verification, [financial contract](FINANCIAL_RECONCILIATION.md) and [recovery runbook](RECOVERY_RUNBOOK.md). No new SQL schema, environment variable, runtime dependency or Vercel function.
- Verification: actual handler/PostgreSQL financial tests cover money, payment methods, rejected writes, physical returns, cost repricing independence, old missing snapshots, >1 page, stock mismatches and access/date boundaries. Browser flow covers saved POS values → report → downloaded CSV at 390/1440px; checkout browser regression passes at both widths. All 17 test files and build pass; lint reports only the pre-existing RaiConsent dependency warning. The navigation regression passes at 390/1440px (mocked backend), including refresh, Back/Forward and session expiry. Delivery evidence is reported at completion.
- Recovery evidence/incident: hosted manual snapshot restored successfully; workspace JSON digests and all 21 public base-table names matched. Initial restore accidentally finalized and switched production/default/compute; original branch/default/name and endpoint were reinstated, workspace digests still matched. Temporary branches expire 2026-10-22 06:00 UTC. See the runbook for exact IDs/times, limitations and mandatory non-finalizing drill procedure. No claim of a fully isolated first drill, zero connection interruption or full restored-login validation.
- Backup limitation: project history is six hours; no recurring schedule exists. Provider rejected daily seven-day scheduling. Manual snapshot expires 2026-10-28 06:00 UTC. Ongoing backup coverage requires a supported policy and monitoring; not marked complete.
- Release: **Sales Reconciliation — Financial Snapshots**, `release/sales-reconciliation-v1.0.0`. Additive JSON fields; older code can omit cost snapshots, so prefer compatible forward fixes. Snapshot restoration is separate from code rollback and cannot undo external payments.
- Owner acceptance: not yet reviewed. Remaining: recurring backup coverage, reviewed tax/refund/settlement contracts, hosted load and custom-domain setup once supplied.

## RXLEDGER-STAFF-PERMISSIONS-01 — Role Presets And Individual Access

- Date/owner/request: 2026-10-21; Musa Ibrahim approved adapting the HealthPass role/personal-restriction pattern to RxLedger Users.
- Outcome: searchable responsive staff list; focused access editor with presets, grouped grant checkboxes, individual denials, per-branch assignment/expiry, reusable templates and explicit audited save. Workspace ownership stays protected; role titles do not establish clinical credentials.
- Scope/category: adaptive/preventive; optional user access policies/revisions and reusable template collection, mutation gates, history/report/analytics restrictions, response/cache redaction, navigation/controls, audit credential hygiene and public bootstrap minimisation. [Contract](STAFF_PERMISSIONS.md).
- Data/configuration: additive JSON only; no SQL schema, credentials, environment variable or dependency changes. Existing staff access is retained until explicitly saved. Templates are snapshots, not dynamically linked assignments.
- Verification: actual API/PostgreSQL cases exercise grants/denials/dependencies, owner protection, stale saves, branch boundaries/expiry, structured data redaction, pricing/catalogue/stock bypasses, template isolation and audit output. Browser editor/session flows pass at 390/1440px; checkout and financial browser regressions pass at 390/1440px, and navigation at 390/768/1440px. All 18 test files and build pass; lint reports only the existing RaiConsent dependency warning. No production staff or pharmacy test mutations.
- Release: **Staff Permissions — Role Presets And Individual Access**, `release/staff-permissions-v1.0.0`. Production readiness and served manifest/assets are verified independently.
- Recovery: prefer compatible forward fixes. Prior builds do not enforce these policies and may drop metadata; a code rollback alone is unsafe when restrictions are relied upon. No new production restore drill; recurring-backup limitation remains in [RECOVERY_RUNBOOK.md](RECOVERY_RUNBOOK.md).
- Owner acceptance: not yet reviewed. Limits: no template editing/deletion or live role propagation, no automated professional credential verification, no prevention of copying previously authorised data, no new delegated owner-administration permissions or enterprise load claim.

## Compact Template For Future Material Changes

- ID/date / request / owner:
- User outcome and acceptance criteria:
- Category / affected components, records and dependencies:
- Existing behaviour to preserve / risk:
- Implementation state and code/document links:
- Technical verification state, dated checks and evidence / limitations:
- Release state, commit, environment/deployment, schema/configuration changes:
- Recovery action and rehearsal status:
- Owner acceptance: not yet reviewed / accepted / revisions requested:
- Remaining gaps / next action or review:
