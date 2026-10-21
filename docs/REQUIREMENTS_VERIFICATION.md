# Requirements And Verification Map

Initial inventory, 2026-10-20. Derived from the SEN 401 guide and current repository references. This is not a fresh functional audit, accepted release baseline or certification. Listed checks have relevant scope; their presence does not establish full coverage. Product rules remain in the linked blueprint/specifications. Adopt this map with [the maintenance process](MAINTENANCE_AND_COLLABORATION.md).

| ID / outcome | Current reference / implementation | Existing check entry points | Evidence still to establish or refresh |
| --- | --- | --- | --- |
| RX-01 Workspace and branch isolation | App blueprint, `server/branch-scope.ts`, API authorisation | `scripts/branch-scope.test.mjs`, `scripts/workspace-deletion.test.mjs`, `scripts/browser-navigation.mjs` | Cross-workspace direct API matrix and full expired/revoked assignment/session coverage against a controlled backend |
| RX-02 Stock/batch integrity | Blueprint POS/branch rules, `api/action.ts`, `server/_shared.ts` | `scripts/pricing-policy.test.mjs`, `scripts/rxledger-rules.test.mjs`, synthetic UX fixture | Receive/sale/issue/reversal reconciliation, mixed units, concurrent writes and interrupted/duplicate submissions; document negative-stock boundaries |
| RX-03 Expiry/dispensing | `getStockRows`, FEFO paths in App/API, blueprint | `scripts/dashboard-snapshot.test.mjs`, `scripts/rxledger-rules.test.mjs` | Explicit date/time-zone baseline and expired/near-expiry/zero-stock/override boundary scenarios |
| RX-04 Sales/financial traceability | Blueprint pricing/POS rules, API sale/return logic | `scripts/pricing-policy.test.mjs`, `scripts/browser-pricing.mjs` | Backend-to-report reconciliation including supported payment, discount/tax, return/void and retry cases; tests of price calculation alone do not prove reconciliation |
| RX-05 Patient continuity | Ecosystem map, blueprint Patient Workflow Rules, continuity actions | `scripts/rxledger-rules.test.mjs`, `scripts/browser-mobile-hierarchy.mjs` | Audited ownership/transfer/fulfilment transitions and repeated actions against a controlled backend |
| RX-06 Alert preferences | [Alert policy](ALERT_POLICY.md), `src/alertPolicy.ts` | `scripts/alert-policy.test.mjs`, `scripts/browser-alerts.mjs` | Periodically refresh seven-day recurrence, restock resolution, per-user scope and mute/restore evidence; distinguish clock-driven tests from real elapsed-time observation |
| RX-07 Product identity | Current branding components/assets and blueprint design rules | `scripts/browser-landing.mjs`, `scripts/browser-colour-audit.mjs` | Explicit accepted artwork/placement inventory; the reference guide's purple-lightning assertion is unconfirmed and must not silently replace accepted branding |
| RX-08 External prescription exchange, conditional | Planned Connect/Care Network/HealthPass contracts in ecosystem blueprint | No complete prescription-exchange verification claimed | Confirm a real implemented contract before enabling; source identity, mappings, authority, duplicate protection and outage behaviour. Rai connection tests are not prescription-exchange evidence |
| RX-09 Patient details/allergy awareness | Blueprint Patient Identification And Allergy Awareness; patient fields, profile panel, API profile/sale/draft logic | `scripts/branch-scope.test.mjs`, `scripts/browser-patient-details.mjs` | Refresh real API/persistence/audit-view evidence; confirm unknown versus no-known-allergies semantics, no cross-patient carryover and authorised branch scope. Browser fixtures do not themselves prove database writes |
| RX-10 Navigation/responsive work surfaces | Blueprint shell, [navigation policy](BROWSER_NAVIGATION.md), mobile hierarchy | `scripts/browser-sidebar.mjs`, `scripts/browser-mobile-hierarchy.mjs`, `scripts/browser-navigation.mjs` | Relevant states/devices and explicit owner feedback for each design change; no blanket claim that every historical browser script currently passes |

## Using The Map

For the next material change, identify affected rows, agree or infer criteria within the owner's authorised request, run appropriate checks and link dated evidence in [the change record](CHANGE_RECORD.md). Record both failures and limits. Do not retrofit expected results to make current code appear compliant.

The initial integrity priorities are RX-01 through RX-04. This prioritisation identifies work to assess; it does not authorise destructive tests against production, an architecture rewrite or a change to accepted pharmacy rules.

## Integrity Pass — 2026-10-20 (SCM-2026-10-20-02)

Implemented focused corrective work for RX-01/02/04/09 and branch-owned Continuity side effects; this is not a complete audit of every requirement.

| Requirement | Fresh evidence | Remaining limits |
| --- | --- | --- |
| RX-01 | Actual state/action handlers and authentication SQL against isolated PGlite PostgreSQL: foreign-workspace tokens, suspended/expired/invalid sessions, foreign-branch and viewer writes, revoked assignments and branch-filtered sales history. Conditional saves prevent stale permission/state replacement. | Local embedded PostgreSQL transport replaces Neon; no production patient transactions. Full role/action/history matrix and high-contention hosted-service load still need coverage. |
| RX-02 / RX-03 | Backend checks for receive-to-least-unit conversion, repeated-line allocation, FEFO, expired/foreign stock, sale/issue/physical-return reconciliation and invalid adjustments. Persisted API checks reject overselling and consumed-draft replay without changing stored tenant JSON. Atomic PostgreSQL version comparison allows one concurrent snapshot writer and rejects the stale writer. | More multi-client load, transfer/requisition failures and expiry date/time-zone boundary cases remain. Draft replay protection and concurrent-save rejection are not general checkout idempotency or offline replay. |
| RX-04 | Persisted receiving at 2800/28 gives 100 cost/tablet and 130 selling price at 30% markup; sale quantity, total and signed ledger agree. Backend regression covers item override/custom rounding and rejects invalid receiving money. | Report UI/export totals, all payment methods, discount/tax boundaries and financial refund/void contracts remain to verify. Inventory return does not establish a refunded sale. |
| RX-09 | Persisted profile correction, audit before/after, and a stale checkout retaining current branch allergies. Mocked browser checks at 390/1440 cover profile save/refresh, reopened stale draft, compact POS display and switching to an unrelated patient. | Browser uses synthetic mocked API; persisted handler tests are separate. Full audit-report UI and clinical identity matching beyond existing phone rules remain outside this pass. |

Reproduce with `npm test` (includes the isolated PostgreSQL suite), `npm run test:integrity`, and `npm run test:patient-details` against a local Vite server. PGlite is a pinned development-only dependency; tests initialize a disposable database in memory and do not contact the production database. Its tests replace Neon transport and telemetry delivery, while executing application validation, authentication, authorization, persistence SQL and response scoping.

## Checkout Reliability — Duplicate Sale Protection

Release **checkout-reliability-v1.0.0**, record **RXLEDGER-CHECKOUT-RELIABILITY-01**. RX-02/RX-04 now include operation-key deduplication and original-receipt recovery; RX-01 includes scoped lookup/cancellation and fresh authorisation after conflicts. See [the contract and evidence](CHECKOUT_RELIABILITY.md).

Fresh isolated PostgreSQL coverage exercises repeated requests, forced concurrent saves, cancellation/sale races in both directions, consumed-draft replay, changed-cart rejection, read-only recovery and authenticated boundaries. Browser → actual API → isolated PostgreSQL checks at 390/1440 exercise committed response loss, injected rejected retry, refresh recovery, non-arrival cancellation, preserved stock/sale/audit counts, clear status, label-popup failure and editable definite rejection. Native client transport checks bound a hanging request without automatic replay.

This closes the previously recorded checkout operation-key gap for clients using the new contract. Other action types, hosted-service load, report/refund reconciliation, external payment settlement and backup/recovery remain outside this slice. Previous dated evidence and its historical limitations are preserved above.

## Workspace patient registry verification — 2026-10-21

RX-01 access isolation, RX-09 patient identity and the cross-cutting audit requirements are extended by [the registry contract](WORKSPACE_PATIENT_REGISTRY.md). Shared identity is an explicit workspace-level exception; operational financial records stay branch-scoped. Actual handler/PostgreSQL tests cover role/tenant boundaries, redacted clinical history, migration audit, concurrent registration, stale revisions and owner merge. Browser checks at 390/1440px cover cross-branch recognition and current allergies, family separation and draft recovery. These checks do not establish owner acceptance, hosted high-volume performance or production restore readiness.
