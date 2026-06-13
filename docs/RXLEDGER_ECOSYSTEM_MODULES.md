# RxLedger Ecosystem Modules

This document keeps RxLedger modular as it grows from pharmacy operations into patient continuity, interoperability, and clinical decision support.

RxLedger is not only an inventory app. Its stronger direction is:

> Pharmacy operations plus patient memory plus care coordination.

Each module below should have a clear workflow, permission model, audit trail, and pricing implication before implementation.

## 1. RxLedger Core

Purpose: run the day-to-day pharmacy business reliably.

Includes:

- Medicine inventory.
- Mart/general retail inventory.
- Batch, expiry, FEFO, and supplier tracking.
- Receiving stock.
- POS sales.
- Draft carts.
- Pricing and discount controls.
- Branch operations and stock requests.
- Reports and exports.
- Users, roles, branch access, notifications, audit, and settings.

Implementation status: active.

## 2. Patient Continuity

Purpose: make sure the patient does not start from scratch at every visit or branch.

Includes:

- Patient lookup from sales history.
- Medication history.
- Refill timing.
- Counseling and follow-up messages.
- Cross-branch patient memory where permissions allow it.
- Active continuity requests surfaced when the patient returns to any branch with permission.
- Future safety timeline and adherence signals.

Implementation status: active, with room to improve.

## 3. Continuity Centre

Purpose: remember requested or prescribed medicines that could not be supplied, then reconnect the patient when stock becomes available.

Scope:

- Unavailable medicine continuity request.
- Patient and phone context.
- Requested quantity.
- Source note, urgency, or prescription note.
- Branch and staff recorder.
- Stock-arrival matching.
- Branch availability list for medicines not on the current shelf.
- Map links based on saved branch addresses.
- Contacted, fulfilled, cancelled, and waiting outcomes.
- Quiet grouped notification that points staff to the queue instead of sending one alert per patient.

Important boundary:

- Do not copy the Totalenergies Pharmacy Inventory implementation directly into RxLedger.
- RxLedger needs its own community-pharmacy version because POS drafts, cashier checkout, Mart products, branch operations, and patient history behave differently here.
- Do not auto-sell, auto-transfer, or auto-close a request from stock matching alone. Pharmacists and branch staff must review and confirm the next action.

Implementation status: active first version.

## 4. Clinical Safety Assistant

Purpose: help pharmacy professionals notice risks humans can miss.

Possible scope:

- Drug-drug interaction prompts.
- Drug-food interaction cautions.
- Duplicate therapy prompts.
- Repeated antibiotic-use prompts.
- Possible misuse-pattern prompts.
- Counseling reminders.
- Patient safety summaries.

Safety boundary:

- The assistant should never diagnose, prescribe, accuse patients, or autonomously block dispensing.
- It should present explainable review prompts for pharmacists and keep human decision-making in control.
- Alerts should be auditable and dismissible with reason.

Implementation status: future module.

## 5. RxLedger Connect

Purpose: receive and normalize external prescription or claim context.

Possible sources:

- API.
- CSV.
- HMO/provider portal.
- Manual intake.
- Future EMR integration.

Responsibilities:

- Normalize medicine names.
- Normalize quantities and instructions.
- Preserve patient identifiers.
- Preserve claim/source metadata.
- Prepare safe handoff into RxLedger Core or Care Network.

Implementation status: future integration layer.

## 6. RxLedger Care Network

Purpose: coordinate approved prescription fulfillment between providers, HMOs, and pharmacies.

Possible scope:

- HMO/provider prescription routing.
- Approved pharmacy matching.
- Availability status: full, partial, unavailable.
- Reservation window.
- Pickup code or lightweight pickup link.
- Dispensing feedback.
- Claim-ready audit trail.

Boundary:

- This should remain a separate ecosystem layer, not a crowded POS feature.
- External parties should not see exact pharmacy stock counts.
- Claims and feedback behavior should be priced and governed carefully.

Implementation status: future Enterprise/network module.

Reference: [FREEZE_II_CARE_NETWORK_FIGMA_BLUEPRINT.md](FREEZE_II_CARE_NETWORK_FIGMA_BLUEPRINT.md)

## 7. Analytics And Stewardship

Purpose: turn RxLedger data into operational and public-health insight.

Possible scope:

- Reorder intelligence.
- Expiry waste analysis.
- Branch performance.
- Refill/adherence behavior.
- Antibiotic-use patterns.
- Controlled or watch-list medicine monitoring.
- Patient continuity metrics.

Implementation status: future module, after Core and Patient Continuity are stable.

## Build Order

Recommended order:

1. Stabilize RxLedger Core.
2. Improve Patient Continuity.
3. Design Medication Owed / Backorder for community pharmacy.
4. Add rule-based Clinical Safety prompts.
5. Add AI-assisted explanations only after rules and audit behavior are working.
6. Build RxLedger Connect.
7. Build RxLedger Care Network.
8. Expand Analytics And Stewardship.

This keeps RxLedger ambitious without letting the app lose its pharmacy operating discipline.
