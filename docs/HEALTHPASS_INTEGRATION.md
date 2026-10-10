# HealthPass prescription integration

This implements the signed-prescription → pharmacy review → existing RxLedger sale → HealthPass supply-feedback slice. HMO routing, insurance claims, shared account federation, multi-pharmacy splitting and autonomous AI actions are excluded.

HealthPass owns prescribing, patient identity/consent and the patient timeline. RxLedger owns medicine mapping, branch stock, FEFO/batch expiry, payment/sale and actual supply. Rai receives authorized summaries through its existing access policy and cannot approve a prescription or record supply.

## Configuration

Set server-only environment variables in both environments; never put service secrets in Vite variables:

- `HEALTHPASS_SERVICE_SECRET`: randomly generated secret of at least 32 characters.
- `HEALTHPASS_SERVICE_KEY_ID`: explicit environment-specific key identifier.
- `HEALTHPASS_SOURCE_ORGANIZATION_ID`: the approved originating HealthPass facility.
- `HEALTHPASS_PHARMACY_TENANT_ID`: the existing RxLedger tenant slug.
- `HEALTHPASS_PHARMACY_BRANCH_ID`: the assigned active RxLedger branch.
- `HEALTHPASS_AUTHORIZATION_URL`: HealthPass's HTTPS `/api/v1/integrations/rxledger/authorization` endpoint. Production dispensing fails closed without this URL or when authorization is unavailable/denied.

Current adapter supports one configured facility/tenant/branch partner. More partners require a credential registry with separate credentials and scopes, not trusting tenant fields from incoming bodies. Production professional verification, MFA/consent review, Nigeria data/inference locations, restore verification and managed secret rotation remain deployment prerequisites.

## Service protocol

POST `/api/healthpass` with JSON and three headers:

```
x-ecosystem-key-id: configured key ID
x-ecosystem-timestamp: current Unix seconds
x-ecosystem-signature: hex HMAC-SHA256(secret, timestamp + "." + exact UTF-8 request body)
```

Timestamp tolerance is five minutes; persistent inbox/operation IDs prevent duplicate effects even within this interval. Requests are capped at 256 KiB. The Vercel body parser is disabled so authentication verifies the exact bytes.

Actions:

- `{action:"receivePrescription",event}`: validate and persist an immutable signed order; return `{prescriptionId,version,status:"acknowledged",duplicate}`.
- `{action:"receivePrescriptionControl",event}`: apply `prescription.cancelled` or `consent.revoked` with payload `{prescriptionId,version,patientLinkId}`. Revocation removes shared patient name/contact/instructions from the queue; prior actual sales and supply evidence retain their pharmacy provenance.
- `{action:"pullEvents"}`: return at most 100 pending partner-scoped feedback events.
- `{action:"acknowledgeEvents",eventIds}`: mark delivery acknowledged after HealthPass commits its inbox/timeline transaction.

Every event uses the camelCase versioned envelope in `src/healthpassContracts.ts`. A receipt acknowledgement is distinct from pharmacist acceptance and supply. Feedback event types are `prescription.acknowledged`, `prescription.reviewed` and `dispense.recorded`. Dispense items carry prescription item ID, RxLedger medicine ID, actual quantity and prescribed dispensing unit, plus counselling/label instructions.

HealthPass retries failed dispatch/control tasks and polls feedback. It must commit each event once before acknowledging; transport is at least once. Outbox rows remain pending until acknowledgement, so delivery failures never undo stock transactions.

## Pharmacy workflow

The POS page includes the HealthPass queue for assigned pharmacists/cashiers. Only an active assigned pharmacist can accept and map an order. Mapping checks exact strength, form and least sellable unit; ambiguous conversion/substitution requires prescriber clarification. Acceptance does not reserve or deduct stock; stock reservation is deliberately unsupported in this slice.

`/api/action` action `reviewHealthPassPrescription` accepts `{prescriptionId,version,status,mappings,note}`. Accepted mappings contain `{prescriptionItemId,medicineId}` for every item.

The existing `recordSale` action accepts optional `healthpass:{prescriptionId,version,operationId,items}`; items contain `{prescriptionItemId,medicineId,quantity}` and must match each medicine line in the sale cart. The existing sale transaction creates the ledger movement and durable feedback together in the tenant state. A stable operation ID makes retries idempotent. Remaining quantities cannot be oversupplied. Actual same-pharmacy supply can occur across multiple visits. A prescription or sharing-grant expiry/revocation blocks remaining supply.

Production state, action and sign-in responses filter the HealthPass queue through live sharing authorization on a cloned response. Denied or unavailable context is hidden without editing pharmacy-owned sale history. Checks are bounded to 100 records, five concurrent calls and a three-second request budget. Exact committed receipt/supply retries remain acknowledged after expiry/revocation; new supply still requires live authorization and revalidates the current catalog identity, formulation, strength and least sellable unit.

All tenant reads carry an original JSON baseline through normalization/read models. `saveTenantDatabase` compares that baseline in the SQL update; competing writes cannot overwrite newer stock, inbox or supply state. A conflict returns a retry error without saving the attempted sale. Reload and retry with the same operation ID. Every writer loading tenant state shares this protection.

## Verification and limits

Run `npm run test:healthpass`, `npm test`, `npm run build` and `npm run lint` after installing dependencies. Native HealthPass tests use synthetic records and cover authentication, replay/change detection, scope, mapping, partial supply, duplicate operations, oversupply, revocation and browser data minimization.

Version amendments, dispense reversals, automatic reservations and secure clarification chat are not implemented. Incoming competing prescription versions fail visibly rather than mutating an existing signed order. The pharmacy review can return a clarification request/status, but a professionally approved replacement order needs the future reconciled amendment workflow. HMO requirements in the older Care Network prototype are deferred by the user's instruction.

Rollback removes the HealthPass API/UI and linked actions while retaining stored integration/supply history. Never delete tenant data or previously recorded ledger/sales as a deployment rollback. Provision and verify actual approved infrastructure before enabling real-patient exchange; a source implementation is not a deployed integration.
