# Named RxLedger Releases

Use descriptive commit subjects and annotated production tags. Report the release name and tag first; Git hashes and Vercel deployment IDs are secondary technical references. Git's generated hash is not the release name. Never reuse an existing production tag for different code.

For a new release, update `public/release.json`, its change record and this list. Link the annotated tag to the exact verified commit and confirm that production serves the named release manifest and tested assets. A named tag identifies code; deployment readiness and owner acceptance are recorded separately.

## Staff Permissions — Role Presets And Individual Access

- Version: **staff-permissions-v1.0.0**
- Annotated tag: **release/staff-permissions-v1.0.0**
- Change record: **RXLEDGER-STAFF-PERMISSIONS-01** in [CHANGE_RECORD.md](CHANGE_RECORD.md).
- Owner-controlled feature grants, personal restrictions, branch/date scope and reusable preset snapshots. Enforced in actions, structured data, history, reports and analytics; responsive Users editor and session refresh.
- Contract, evidence and compatibility limits: [STAFF_PERMISSIONS.md](STAFF_PERMISSIONS.md).

## Sales Reconciliation — Financial Snapshots

- Version: **sales-reconciliation-v1.0.0**
- Annotated tag: **release/sales-reconciliation-v1.0.0**
- Change record: **RXLEDGER-SALES-RECONCILIATION-01** in [CHANGE_RECORD.md](CHANGE_RECORD.md).
- Complete server-side sales reconciliation, recorded costs/cash/change, consistent NGN rounding and transparent historical/tax limitations. CSV and print share report results.
- [Financial contract](FINANCIAL_RECONCILIATION.md); [hosted recovery evidence and scheduling limitation](RECOVERY_RUNBOOK.md). This release does not claim automated backups, refunds, VAT compliance or bank settlement.

## Workspace Patient Registry — Cross-Branch Recognition

- Version: **workspace-patient-registry-v1.0.0**
- Annotated tag: **release/workspace-patient-registry-v1.0.0**
- Change record: **RXLEDGER-WORKSPACE-PATIENT-REGISTRY-01** in [CHANGE_RECORD.md](CHANGE_RECORD.md).
- Shared patient identities and current allergy information across workspace branches, explicit family-contact selection, revision-checked edits and owner-reviewed merges. Audited professional care history is separate from branch-restricted financial data.
- Contract, migration/recovery limits and verification: [WORKSPACE_PATIENT_REGISTRY.md](WORKSPACE_PATIENT_REGISTRY.md).

## Checkout Reliability — Incomplete Confirmation Protection (Patch)

- Version: **checkout-reliability-v1.0.1**
- Annotated tag: **release/checkout-reliability-v1.0.1**
- Change record: **RXLEDGER-CHECKOUT-RELIABILITY-02** in [CHANGE_RECORD.md](CHANGE_RECORD.md).
- Corrects truncated JSON and incomplete success responses being accepted as action results. Uncertain checkout stays recoverable; the UI receives no incomplete database state.
- Verified with native client fault cases and browser → actual API → isolated PostgreSQL confirmation recovery after a truncated committed response, plus regression checks.
- Includes the complete duplicate-sale protection release below. The published v1.0.0 tag remains immutable.

## Checkout Reliability — Duplicate Sale Protection

- Version: **checkout-reliability-v1.0.0**
- Annotated tag: **release/checkout-reliability-v1.0.0**
- Change record: **RXLEDGER-CHECKOUT-RELIABILITY-01** in [CHANGE_RECORD.md](CHANGE_RECORD.md).
- Behaviour: repeated/uncertain checkout confirmation recovers the original receipt and deducts stock once; processing and recovery states are clear; refresh recovery stores only an opaque ID; cancelling an unconfirmed checkout blocks delayed submission safely.
- Contract, checks and recovery limits: [CHECKOUT_RELIABILITY.md](CHECKOUT_RELIABILITY.md).
- Deployment evidence is reported after verifying the exact tag/commit, production alias, public release manifest, served assets and unauthenticated API guards. No production pharmacy transactions are inserted by release tests.
