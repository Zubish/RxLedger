# Staff Permissions — Role Presets And Individual Access

Implemented 2026-10-21 following owner approval of the HealthPass-style access editor. Users is a searchable, status-filtered staff list. Manage access opens a responsive keyboard-accessible dialog with job-role presets, grouped grant checkboxes, branch checkboxes and individual expiry dates, personal restrictions, a reason and one Save changes action.

## Role and access model

`User.accessPolicy` is optional: title, explicit supported permission grants, personal denials and revision. `accessRevision` also changes when role/status/branch/manager/expiry assignment changes through other workflows. Existing users without a policy retain legacy server and branch rules; there is no automatic conversion or grant. Saving in the editor is the deliberate cutover to the displayed grants/restrictions. Activating a user with an explicit empty branch scope does not silently assign a default branch. Current defaults and named presets differ where a preset intentionally narrows access (for example a cashier does not need costs or margins).

Presets: Pharmacist, Cashier, Inventory Officer, Branch Manager and Read-only/Auditor. A manager preset supplies operational functions; it does not appoint a branch manager or turn a nonclinical person into a pharmacist. The underlying professional role and existing manager assignment still gate cross-branch clinical history. Owner-approved role selection is not credential verification: the owner remains responsible for reviewing the professional's actual authority.

Supported groups:

- Sales: prepare carts, complete sales, sales history and discounts within existing limits.
- Inventory: view stock, catalogue/suppliers, receiving, transfers, issues and stock correction/write-off.
- Pricing: cost visibility and price editing within existing automatic-pricing/override rules.
- Patients: identity/allergy lookup, registration/editing and separately authorised clinical history.
- Reports: sales reconciliation, cost/margin in reconciliation and report export.

Workspace ownership, feature-access administration, owner settings, audit-trail administration and patient merging remain protected owner controls. They are not delegable by naming a custom role “admin”. Existing branch-manager branch-release/assignment workflows retain their narrower legacy authority; a permission template does not grant global scope.

`Database.staffRoles` stores owner-created reusable name/description/role/permission templates. Applying one copies its permissions into the user's policy. Creating a template does not modify existing staff. This release supports creating and applying templates, not live linked role propagation, template editing/deletion or role version rollout. Individual restrictions are not copied to a template.

## Effective permissions and dependencies

Explicit grants minus personal denials determine effective permissions. A denial removes dependent actions too; missing/unknown dependencies never broaden access. Choosing a new preset preserves personal restrictions. “Use role defaults” clears personal restrictions against the currently selected grants.

Preparing a sale requires inventory and patient lookup; completing/discounting requires preparation. This keeps allergy awareness available during checkout. Receiving requires inventory and cost visibility. Price editing requires inventory/cost visibility. Clinical editing/history require patient lookup; margin reports require sales reports and cost visibility. Turning off a prerequisite removes dependent grant checkboxes; restriction counts reflect the effective result.

Every operational action still needs an active authorised branch. Selecting several branches assigns those branches, not global workspace administration. Empty selection grants no operational branch access. Existing manager assignments must be released before their branch can be removed. Expiry uses the existing inclusive UTC-date convention. The editor preserves individual branch dates and offers an explicit shared-date shortcut.

## Server and response enforcement

An authorised own checkout can still return its immediate/recovered receipt when history listing is disabled; it does not grant sales listing. The API checks permissions before mutation and retains branch, workspace, status, expiry, checkout, pricing-limit and owner checks. New grants can authorise supported nonclinical operations within assigned branches; they cannot bypass protected ownership or clinical-history authority. Direct URLs and hidden buttons are not the security boundary.

State, action patches, paginated sales/ledger history, financial reports and Rai analytics apply restrictions. Cost fields are removed from sale/ledger snapshots or replaced with redacted numeric placeholders in inventory types; the interface labels cost restriction and report columns use “Restricted”. Financial reports return null restricted margins/costs with a separate restriction flag. Clinical/customer details and follow-up text are removed from structured sales when patient access is denied; shared registry/continuity are withheld. Staff messaging retains its separate existing branch/channel rules; free-text messages are not automatically classified or scrubbed for patient content.

Unauthenticated bootstrap exposes branding/identity, not pricing configuration. New access audit records contain access fields and reason, not password material. General audit recording and audit responses redact credential-key fields, including older audit entries when served; stored historical audit records are not rewritten.

The active browser refreshes access on focus and every 30 seconds while visible. Returned state clears restricted cached collections and routes away from disallowed pages. API checks take effect on subsequent requests immediately; this cannot erase information already viewed or copied. Exports/print controls honour export access, but anyone allowed to read information can still copy it—the checkbox is not data-loss prevention. A completed checkout's recovery is also subject to current authorisation; revoked staff may require owner help resolving a pending checkout.

## Verification and release

`npm run test:staff-access` uses actual handlers and isolated PostgreSQL for additive legacy behaviour, owner-only assignment, dependent denials, payload/history/report redaction, current pricing/stock invariants, stale revisions, branch expiry, template isolation and credential-free audit output. Rai tests cover restriction-aware delegated analytics. Server-artifact checks load emitted relative modules.

`npm run test:staff-access:browser` covers presets, grants/denials, template creation, saved state, a populated but disabled checkout, direct route rejection and an existing session refreshing into narrower access at 390/1440px. Checkout, financial-report and navigation regressions are separate evidence. No real staff policies or pharmacy transactions are edited in production by release tests.

Release: `release/staff-permissions-v1.0.0`; change record `RXLEDGER-STAFF-PERMISSIONS-01`. No SQL migration, new environment variable or dependency. Existing workspaces do not need a destructive migration. Older code does not enforce these policies, so do not roll back to a pre-permission build while relying on restrictions. Preserve data and prefer a compatible forward fix. The previous recovery runbook and its recurring-backup limitation still apply. Owner acceptance and hosted enterprise-load testing remain separate.
