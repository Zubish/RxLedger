# Change And Release Record

Record material changes using [the maintenance process](MAINTENANCE_AND_COLLABORATION.md). Group minor related edits. Keep implementation, technical verification, release and owner acceptance separate. Do not retroactively invent acceptance, test runs, schema checks or recovery exercises.

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
