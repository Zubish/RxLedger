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
