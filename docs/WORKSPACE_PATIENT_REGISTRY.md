# Workspace Patient Registry — Cross-Branch Recognition

Implemented 2026-10-21. Patient identity belongs to a pharmacy workspace, shared across its branches. It is never a public or cross-company registry.

## Identity and contact

Each patient has a stable ID, name, primary phone, optional former contact/name aliases, recorded age/date, gender, allergy status/details and a revision. Nigerian local, +234 and 00234 formats match the same contact. New contacts require 7–15 digits. A phone identifies candidates, not a person: the operator must select an existing patient. Registering the same name/contact is rejected; a different person sharing the contact requires a reason. No automatic family or reassigned-number merge occurs.

Sales, drafts and continuity carry patient IDs. Current registry details are fetched on POS selection and draft recovery. Unknown allergy status explicitly asks the professional to ask; confirmed none is distinct from unknown. Patient changes clear inherited clinical context. Profile documentation stays in Patients or a focused registration dialog; POS displays identity and allergy information only.

## Permissions

- Active workspace owner and active patient-facing admin/pharmacist/cashier or assigned branch manager can access workspace identity, register and edit within their authorised active branch context.
- Viewer/inventory-only users without management authority do not receive the shared registry.
- Cross-branch medicine history requires a separate server-authorised request by a pharmacist or branch manager/owner. Each read is audited. Response includes date, branch name and medicine quantity/instructions/days supply; it excludes prices, sale totals, receipt references and payment details.
- Sales, stock, ledger, receipts, drafts, continuity operations and financial reports retain their existing branch authorisation. Shared identity grants no foreign-branch transaction access.
- Only the workspace owner can merge duplicates. Require both current revisions, identity confirmation, a reason and explicitly reviewed final demographics/allergies. Keep the source as a merged alias; relink patient references, not financial values or clinical snapshots.

The [staff permission policy](STAFF_PERMISSIONS.md) adds explicit feature restrictions to these boundaries. Patient lookup, editing and clinical history are separately controllable; professional/branch authority still applies.

## Persistence and existing records

The optional `patients` collection and patient IDs are additive fields in existing tenant JSON; no SQL schema or configuration change is needed. Legacy import deterministically separates branch/name/contact groups, marks them for review and preserves documented historical allergies. It does not assume that matching contacts across branches prove the same person. Existing ambiguous duplicates need owner review.

Reading projects the legacy registry without writing tenant data. The next normal successful save persists the projection and a system migration audit. Full-precision tenant compare-and-swap protects concurrent writes. Patient revision checks reject stale edits/merges; competing duplicate registrations cannot both overwrite the workspace. Profile edits preserve historical transaction clinical snapshots and monetary/stock data. Old phone-wide update requests are rejected once the registry exists.

Former names/contacts remain aliases after corrections or merges, supporting recognition and preventing accidental duplicate registration. Checkout replay still returns the originally committed receipt before evaluating current patient information. Patient information is not added to browser recovery storage.

## Verification and limits

Synthetic checks exercise the actual action handler and isolated PostgreSQL through PGlite: canonical phones, conservative/idempotent legacy import, save-time migration audit, branch/workspace roles, redacted/audited care history, family separation, concurrent registration, stale revisions, reviewed merge and draft patient changes. The browser suite exercises registration → branch A sale → branch B recognition/care → draft → profile correction → family selection → owner merge at 390px and 1440px. Checkout and patient-details browser regressions also run at those widths. No production patient test records are inserted.

This is not a national patient identifier, clinical validation, offline registry, HealthPass integration or enterprise-scale benchmark. The current tenant JSON and roster are loaded with the workspace; server pagination and hosted high-volume/load checks remain future work. Age is recorded at a point in time, not inferred from a birth date. Clinical history access is recorded but does not certify consent or legal compliance.

## Release and recovery

Release: `release/workspace-patient-registry-v1.0.0`; change record `RXLEDGER-WORKSPACE-PATIENT-REGISTRY-01`. Deployment and owner acceptance are tracked independently.

Prefer a compatible forward fix. Older code may omit the new registry and identity links when saving. Preserve full workspace JSON and quiesce writes before any incompatible rollback; reverting code alone is not a data recovery procedure. The additive import was tested in isolation; no production restore drill was performed.
