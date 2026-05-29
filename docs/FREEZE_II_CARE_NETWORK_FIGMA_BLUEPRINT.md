# Freeze II: RxLedger Care Network Prototype

Figma file: https://www.figma.com/design/w2V3wZg3zOA6LrtPPweuuw

This blueprint captures the intended Figma prototype for the RxLedger Care Network / HMO prescription-routing flow. It should be used with `APP_BLUEPRINT.md` before future implementation work.

## Source Discussion Memory

This file preserves the product thinking from the shared ChatGPT discussion:

- Source chat: https://chatgpt.com/share/6a19556a-3048-83ea-b28f-b15fa799eaab
- Local follow-up discussion: RxLedger should be able to grow beyond inventory/POS into pharmacy continuity, but expansion must be deliberate, auditable, and priced correctly.
- The strongest expansion path is not to make RxLedger a hospital EMR first. The better sequence is to let hospitals, HMOs, and pharmacies connect around prescription fulfillment while RxLedger remains excellent at pharmacy operations.
- HMO prescription routing should be treated as a coordination layer: hospital/provider creates the prescription, HMO validates and authorizes, RxLedger Connect normalizes the request, RxLedger Care Network matches an approved pharmacy, the pharmacy accepts/reserves/dispenses, and feedback returns to the HMO/provider.
- The HMO should remain the official authority for approval and patient notification. RxLedger should provide the workflow infrastructure and audit trail.
- Community pharmacies should not expose exact stock externally. External parties should see routing status such as `Full`, `Partial`, or `Unavailable`.
- The MVP should avoid split fulfillment. Route the whole approved prescription to one pharmacy first, then add split-fill logic only after claims, substitutions, audit trails, and patient communication are mature.
- A full patient app is not needed for the MVP. SMS/WhatsApp and a lightweight pickup link are enough.
- This expansion should be designed as `RxLedger Connect` and `RxLedger Care Network`, not as a crowded POS feature.

The product judgment from the discussion: this can be implemented without duress if it is phased correctly. It becomes risky only if RxLedger tries to become POS, EMR, HMO system, pharmacy marketplace, patient app, claims engine, and clinical AI all at once.

## Prototype Shape

The Figma file should contain three pages:

- `01 Blueprint + Flow`: strategic product map, role map, and MVP routing sequence.
- `02 Clickable Prototype`: testable desktop workflow from provider prescription to HMO review, pharmacy matching, dispensing, patient pickup, and feedback closure.
- `03 Design Notes`: RxLedger brand tokens, Material Design 3-inspired interaction rules, and implementation guardrails.

## Product Positioning

This flow should be treated as a separate RxLedger layer, not as another POS screen.

- `RxLedger Core`: inventory, POS, expiry, patients, labels, refill reminders, sales history, reports, audit.
- `RxLedger Connect`: prescription intake by API, CSV, HMO portal, or manual entry; normalizes medicine names, quantities, instructions, patient identifiers, and claim context.
- `RxLedger Care Network`: HMO routing, approved pharmacy directory, tariff rules, availability status, reservations, pickup codes, and feedback closure.
- `Claims + Feedback`: dispensing event, stock deduction, label/counseling proof, claim-ready record, and status feedback to HMO/provider.

## Pricing Implication

This expansion should trigger a pricing review before implementation.

The current subscription model can keep covering core pharmacy operations, but Care Network capabilities create higher commercial value and new support obligations. They should not be bundled into existing plans as free upgrades by default.

Recommended pricing posture:

- Keep routine improvements inside existing plans: bug fixes, mobile polish, inventory/POS refinements, patient lookup, labels, reporting improvements, and usability upgrades.
- Put HMO/EMR integrations, pharmacy routing, claim feedback, network administration, and custom API support in Enterprise or paid add-ons.
- Consider `RxLedger Connect` as an integration add-on for hospitals, HMOs, or large pharmacies that need API/CSV/manual prescription intake.
- Consider `RxLedger Care Network` as an Enterprise/network add-on for organizations coordinating multiple pharmacies, HMO approvals, and prescription routing.
- Do not delete or lock existing customer data when a customer upgrades, downgrades, or declines an add-on. Instead, gate access to the premium workflow while preserving history.
- Downgrades should preserve records but disable new high-tier actions once the account no longer qualifies.

Simple principle: core pharmacy work can be subscription-tiered; cross-organization prescription infrastructure should be premium.

## MVP Rules

- HMO owns official routing and patient authorization.
- RxLedger Connect normalizes the prescription before routing.
- MVP routes the full prescription to one approved pharmacy.
- Split-fill should wait until audit, trust, and reimbursement logic are proven.
- External parties see `Full`, `Partial`, or `Unavailable`, not exact branch stock.
- Accepted prescriptions reserve stock temporarily.
- Dispensing deducts from least sellable units and sends feedback to HMO/provider.
- Pharmacist label instructions and follow-up messaging attach to the sale, not to scattered per-medicine UI fragments.

## Clickable Flow

1. `P0 Care Network Overview`
   - Shows pending prescriptions, full matches, awaiting pickup, and closed feedback.
   - Primary action: `Start test flow`.

2. `P1 Provider Prescription Status`
   - Shows provider-created prescription, medicines, dose, quantity, and instructions.
   - Primary action: `Send to HMO review`.

3. `P2 HMO Prescription Review`
   - Shows eligibility, tariff match, authorization, and approved network context.
   - Includes clinical caution preview for medicines such as Cataflam without replacing physician judgment.
   - Primary action: `Find approved pharmacies`.

4. `P3 Approved Pharmacy Matching`
   - Shows approved pharmacy options with `Full prescription match`, `Partial match`, and `Unavailable`.
   - Primary action: `Continue as assigned`.

5. `P4 Incoming HMO Prescription`
   - Pharmacy receives official request, reviews availability, label instructions, and reservation window.
   - Primary action: `Accept and reserve stock`.

6. `P5 Patient Tracking Link`
   - Lightweight patient pickup view for SMS/WhatsApp link.
   - Shows pickup code and collection instructions.
   - Primary action: `Mark as collected`.

7. `P6 Dispensing Feedback Sent`
   - Confirms claim amount, stock movement, feedback status, prescription closure, and audit events.
   - Primary action: `Restart journey`.

## Brand And UI Rules

Use RxLedger's authenticated workspace posture:

- Calm, dense, operational, and fast to scan.
- Green remains the operational anchor.
- Cyan, purple, and amber are used as workflow/status accents.
- Avoid one-hue pages.
- Use 8px radius for cards and buttons.
- Use cards for repeated records and framed tools only.
- Avoid decorative marketing sections inside the authenticated workflow.
- Prefer compact status chips, table rows, and clear primary buttons.

Suggested color tokens:

- Primary green: `#006B45`
- Operational green: `#1F7F63`
- Soft green: `#EAF7F1`
- Cyan accent: `#47BFFF`
- Purple routing: `#5657FF`
- Amber caution: `#F2B94B`
- Deep sidebar ink: `#071114`
- Text ink: `#172024`
- Muted text: `#667A82`
- Surface: `#FFFFFF`
- App background: `#F8FBFB`
- Border: `#D7E4E3`

## Material Design 3 Alignment

The prototype should borrow these Material Design 3 ideas while preserving RxLedger identity:

- Clear surface hierarchy.
- Tonal status states.
- Compact chips for state.
- Elevated cards only where they carry records.
- Predictable navigation and primary/secondary action distinction.
- Accessible contrast and readable text over any colored surface.

## Data Safety Notes

- Patient identity should prefer phone number or official member identifiers.
- Name-only entries should not be auto-linked to an existing patient.
- HMO and provider views should not expose exact stock counts.
- Pharmacy acceptance should create an auditable reservation.
- Dispense completion should be the point where stock is deducted and feedback is sent.
