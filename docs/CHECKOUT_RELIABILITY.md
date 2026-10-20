# Checkout Reliability — Duplicate Sale Protection

Release: **checkout-reliability-v1.0.0**. Git tag: **release/checkout-reliability-v1.0.0**. Change record: **RXLEDGER-CHECKOUT-RELIABILITY-01**.

## User Outcome

An interrupted confirmation can be retried without recording a second sale, deducting stock again or generating another receipt. POS clearly separates processing, confirmed, uncertain and rejected outcomes. Stock and financial recording still use existing server pricing and permission rules.

## Operation Contract

1. POS creates a UUID v4 for each new checkout and freezes its request for retries. Double submission is blocked synchronously and the form is disabled while processing or uncertain.
2. Every `recordSale` requires `operationId` and explicit `branchId`. Older cached POS clients receive a refresh instruction; existing historical sales remain readable without these fields.
3. The sale stores `checkoutOperationId` and a SHA-256 fingerprint of canonical request JSON, excluding the operation ID. The fingerprint detects a changed request; it is not an anonymisation guarantee or a signature supplied by the client.
4. Operation lookup is bound to the authenticated workspace, professional and branch. Current session, branch activity and checkout permissions are checked for recording, status, cancellation and conflict recovery.
5. A retry of a confirmed matching request returns the original sale ID, receipt reference and recorded totals. It bypasses allocation and draft consumption. A changed request under the same ID is rejected and retains uncertain status until the original receipt is recovered.
6. Sale, ledger, audit and draft consumption persist in the existing atomic version-checked tenant update. For simultaneous requests, the stale writer reloads state, re-authorises and returns the committed receipt. It never saves its previously mutated copy. Unrelated conflicts remain recoverable failures.
7. Successful replay includes the original sale and associated ledger movements in the response patch, even when unchanged on the server. The browser can recover history after a lost response without duplicating entries.

## Uncertain Confirmation And Refresh

- Checkout API requests have a 20-second client timeout. Timeout, missing response or uncertain save errors keep the cart locked and retain the same operation ID. There is no automatic sale resubmission.
- `Retry confirmation` resends the frozen request in the same mounted POS. A rejected retry does not prove that an earlier interrupted request failed; it remains uncertain.
- Only the opaque operation ID is stored in tab session storage, scoped by workspace/user/branch. Cart contents and patient information are not persisted in browser storage by this feature. Checkout is blocked if the ID cannot be stored before submission.
- After refresh or returning to POS, `Check confirmation` uses the stored ID to retrieve the original result. If it is not found, the professional can check again or cancel the unconfirmed checkout before starting another sale. An absent lookup result alone is not proof that an in-flight request cannot commit.
- `cancelCheckout` returns a completed receipt if one already exists. Otherwise it atomically records a scoped cancellation tombstone and audit entry. A delayed sale request for that ID is blocked, including when it loaded state before cancellation; version comparison rejects its stale write.
- A racing cancellation that loses to a sale returns that sale's receipt and does not claim cancellation or create a refund. A cancellation is not a void/refund of an existing sale.
- A definite first-attempt validation rejection unlocks the preserved cart for correction. An uncertain request is resolved or cancelled first.
- The confirmed receipt is shown separately from medication-label printing. A blocked print window cannot turn a confirmed checkout into a failure notice.

## Data And Recovery

The existing tenant JSON gains optional sale metadata and `cancelledCheckouts` entries (`operationId`, `userId`, `branchId`, `cancelledAt`). No SQL schema migration or new runtime dependency is required. Cancellation entries are retained; no expiry/purge policy is introduced. Scoped API responses expose only the user's permitted cancellation entries.

Rollback to older code removes these guards and older normalisers can omit the new cancellation collection. Preserve the full current tenant data and quiesce pending checkout traffic before such a rollback; prefer a compatible forward fix. A code rollback is not a restore of operational data. No production recovery exercise was performed for this release.

## Verification

- `npm run test:checkout`: actual handlers, authentication and persistence SQL in isolated PGlite PostgreSQL; lost confirmation/replay, forced simultaneous-save conflict, read-only status, cancellation winning/losing races, consumed-draft replay, actor/branch/workspace/session boundaries and malformed IDs. Client transport tests cover timeout with no automatic resubmission and explicit rejected/unknown outcomes.
- `npm run test:checkout:browser` with Vite running: Playwright at 390px/1440px routes browser requests to actual application handlers and isolated PostgreSQL. Tests double submission, committed response loss, an injected rejected retry, same receipt/stock/audit counts, refresh, request loss before the server, cancellation blocking late arrival, definite rejection, opaque-only session storage, print-failure messaging and overflow.
- Existing regression suite, build/lint and patient browser regression remain required for this shared flow.

These checks use synthetic records. The Neon transport and telemetry delivery are replaced locally; this is not a hosted-service contention benchmark or production transaction verification. Other devices intentionally creating different operation IDs represent distinct checkouts. Clearing browser storage removes local recovery references; completed operations remain in server sales history. Offline writes, external payment-provider settlement, broad report reconciliation and restore drills remain separate work.
