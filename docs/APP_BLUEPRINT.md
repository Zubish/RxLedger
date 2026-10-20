# RxLedger App Blueprint

This blueprint is the working guide for future RxLedger changes. Read it before changing layout, navigation, POS logic, patient workflow, branch access, reporting behavior, or ecosystem modules.

For ecosystem planning, also read [RXLEDGER_ECOSYSTEM_MODULES.md](RXLEDGER_ECOSYSTEM_MODULES.md). For reusable skills that apply beyond RxLedger, also read [SKILL_LIBRARY.md](SKILL_LIBRARY.md). The blueprint is RxLedger-specific; the skill library is cross-industry.

For proposed platform-owner administration, workspace-wide visibility and application performance measurement, read [PLATFORM_ADMIN_PORTAL.md](PLATFORM_ADMIN_PORTAL.md). That specification is a draft for review, separate from pharmacy administration and operational Analytics And Stewardship; implementation has not begun.

## Product Shape

RxLedger is a pharmacy operations workspace, not a marketing site once a user is authenticated. The app should feel calm, dense, professional, and built for repeated counter/back-office use.

The core promise is:

- Branch-aware stock control.
- Fast POS checkout.
- Patient continuity from POS sales history.
- Audit-friendly reports and operational traceability.
- Role-based access for admins, branch managers, pharmacists, cashiers, inventory staff, and viewers.

## Ecosystem Module Map

RxLedger should grow as separate, deliberate modules:

1. **RxLedger Core**
   Inventory, Mart, POS, branches, pricing, receiving, reports, users, audit, notifications, and settings.

2. **Patient Continuity**
   Patient lookup, medication history, refill timing, and counseling/follow-up messages in the user's branch scope; global admins retain cross-branch patient context.

3. **Continuity Centre**
   RxLedger-native workflow for unavailable requested/prescribed medicines, patient follow-up, stock-arrival matching, branch availability guidance, and contacted/fulfilled/cancelled outcomes. This is not the Totalenergies clinic pending-medication flow; it is branch-aware community-pharmacy continuity.

4. **Clinical Safety Assistant**
   Future pharmacist-assistive review prompts for interactions, duplicate therapy, repeated antibiotic use, possible misuse patterns, and counseling reminders. This module must keep pharmacists in control.

5. **RxLedger Connect**
   Future external prescription intake by API, CSV, HMO/provider portal, or manual entry.

6. **RxLedger Care Network**
   Future HMO/provider/pharmacy routing, availability status, reservation, pickup, dispensing feedback, and claim-ready records.

7. **Analytics And Stewardship**
   Future intelligence for reorder behavior, expiry waste, adherence/refill behavior, antibiotic use, controlled medicine watchlists, and branch performance.

Core, Patient Continuity, and Continuity Centre can keep improving inside the app today. Connect, Care Network, advanced clinical AI, and network workflows should remain separate Enterprise/add-on layers until their data, audit, and pricing rules are clear.

## Infrastructure And Partnership Lessons (2026-10-13)

Source: the user-provided full transcript of [the healthcare infrastructure interview](https://youtu.be/ChcXqdcHDTY). These are planning decisions aligned with the existing vision, not newly implemented capabilities. The interview date and company/name spellings have not been independently verified. Its market figures are historical speaker claims, not current evidence for marketing or investment materials.

### Validate The Pharmacy Workflow

- Preserve the direction: pharmacy operations plus patient memory plus care coordination. Improve Core and continuity before adding network complexity.
- Interview and observe practising pharmacy teams even when the founder has pharmacy and software-engineering experience (1:16–1:28, 2:51–3:12). Test receiving, sale completion, unavailable prescriptions, refills, branch permissions and interrupted connectivity on real counter devices.
- Include pharmacies outside major urban centres and document differences in staffing, devices, connectivity and workflow; national expansion is a hypothesis to validate, not a launch promise (7:51–8:15).
- Record task completion time, errors, support needs and adoption alongside qualitative feedback. Use a baseline and agreed observation period before claiming improvement.

### Trustworthy Availability Before Network Discovery

Manual availability/price calls became difficult to scale (1:46–2:29); the interview links visibility to inventory/POS capture (5:01–5:24).

- Receiving, sales, returns, write-offs, adjustments and unit conversion must preserve trustworthy branch stock and their audit trail.
- Future network availability must carry source branch, last-updated time and a freshness policy. Distinguish recorded stock from pharmacy-confirmed availability; stale or disconnected data must show unknown/reconfirmation required.
- External partners receive authorised `Full`, `Partial` or `Unavailable` status, not exact stock counts or unrestricted commercial records. Confirm or reserve before promising supply; reservations must expire and be released safely.
- Preserve the existing Care Network MVP: one approved pharmacy fulfils the whole prescription. The multiple-pharmacy problem (4:49–4:57) motivates later split fulfilment, but does not override the current MVP boundary.
- Refill reminders and Continuity requests are not automatic orders, delivery services or proof of adherence. A stock match does not complete a sale or establish that the patient received medicine.

### Medicine Standardisation And Interoperability

The transcript's PCM/paracetamol example (6:09–6:36) makes standardisation a prerequisite for Connect.

- Define a versioned medicine identity/mapping contract covering ingredient(s), strength and units, dosage form, release characteristics, route where relevant, brand/generic identity and pack/dispensing units.
- Preserve source names, identifiers and mapping provenance. Ambiguous mappings require pharmacist review; do not overwrite local catalogues or merge products from a text-name match alone.
- Separate equivalent naming from therapeutic alternatives. Substitution requires appropriate professional review and applicable prescriber/HMO approval; software must not silently change therapy.
- Connect should use documented, versioned contracts, stable identifiers, authenticated partner scope, idempotent requests, acknowledgements, error handling and auditability. Evaluate applicable standards such as FHIR rather than inventing an isolated exchange format or claiming compliance without validation.
- HealthPass remains the care-history and controlled-sharing layer; RxLedger remains pharmacy operations and dispensing. Agree consent/authorisation, identity matching, source-of-truth and feedback contracts before connecting them. Rai remains a separate planned support layer.

### Connectivity And Operational Resilience

Poor connectivity affects sales and availability transparency (9:47–10:12). POS-device compatibility does not itself prove offline capability.

- First measure behaviour on slow links, interruptions and reconnects: clear pending/failed/saved states, bounded payloads and recovery without lost or duplicate transactions.
- Offline writes remain a future design requiring secure local storage, permitted cached data, session/permission expiry, idempotent replay, reconciliation, conflict handling and explicit server confirmation. Never represent an unsynchronised sale or stock estimate as confirmed network availability.
- Test phone/tablet/POS-browser ergonomics and reconnect failure paths before publishing offline or device-support promises. Preserve server-authorised branch access throughout.

### Phased Collaboration And Partnership

At 4:02–4:15 the speaker proposes public–private shared infrastructure as a possibility; she does not establish that such a partnership already exists. At 11:09–11:50 she identifies funding, private–private/public–private collaboration and technology as complementary needs.

- Begin with an opt-in private pharmacy/provider pilot. Consider government participation after evidence of reliable operations and patient continuity; government endorsement is not a prerequisite or an existing affiliation.
- A future public pilot must name the responsible programme owner, participating facilities/pharmacies, professional approval roles, financing/reimbursement where relevant, service responsibilities and measurable outcomes.
- Preserve HMO authority for approved routing/notification in insured workflows. A non-HMO public programme needs an explicitly defined equivalent authority, not an assumed bypass of approvals.
- Partnership access is limited by purpose, tenant/branch scope and agreed data-sharing permissions. Public reporting should use appropriately aggregated data and suppress small groups where identification is possible; participation does not grant access to patient histories or exact commercial inventory.
- Review applicable Nigerian professional, medicines and data-protection requirements for each actual workflow. Batch/supplier records support traceability; inventory software alone cannot certify medicine authenticity (10:19–11:02).
- Affordability needs financing or negotiated partner arrangements (12:27–13:10). Do not promise insurance, subsidies, fixed prices or delivery without the responsible partner and sustainable economics. Preserve Enterprise/add-on pricing boundaries for integration and network support.

### Evidence And Build Gates

1. Stabilise Core and continuity with observed pharmacy testing, including weak connectivity.
2. Define medicine mapping, availability freshness and exchange contracts before Connect.
3. Pilot one-pharmacy routing with reservation, audited dispensing and feedback; resolve reconciliation and permission failures before expansion.
4. Expand into HMO/public partnerships, split fulfilment and aggregate analytics only after ownership, economics and outcomes are established.

Pilot measures should specify a denominator, baseline and time window: sale/receiving completion time and error rate; stock discrepancy and stockout duration; eligible unavailable requests fulfilled; refill follow-ups completed; reservation failures; expiry loss; and performance/recovery on small devices and weak links. Follow-up completion is not proof of medication adherence. Public-health or cost-saving claims require appropriate evidence.

## Technical Map

- Frontend: Vite + React + TypeScript in `src/`.
- Main authenticated shell: `src/App.tsx`.
- Main CSS system: `src/App.css`; landing-specific Tailwind-like classes live mostly in `src/RxLedgerLanding.tsx`.
- API routes: `api/`, using Vercel serverless handlers.
- Persistence: Neon Postgres stores each workspace in a tenant-scoped `tenant_state` row and stores sessions separately. The legacy root remains a migration/rollback source, not an authenticated hot path.
- Deployment: GitHub push to `master` triggers Vercel production.

## Performance Architecture

- Bootstrap reads only workspace settings and user count. It must not load or rewrite operational history.
- Authenticated state excludes the historical global-admin audit archive; Audit loads that archive on demand.
- Authenticated state and login exclude historical sales. POS, Patients, and Reports hydrate sales through `/api/state?scope=sales` in bounded pages when those views are opened.
- Authenticated state and login exclude historical ledger entries. Current medicine stock is carried by `stockSnapshot`, dashboard movement counts are carried by `ledgerSummary`, and Reports hydrates detailed movement rows through `/api/state?scope=ledger` in bounded pages.
- Mutating actions keep the existing single pharmacy transaction boundary, then return ID-based deltas for sales, ledger entries, and audit logs instead of resending complete history.
- API performance logs record route, action name, load/auth/save durations, total duration, and response bytes. They must not record patient, medicine, prescription, or payment content.
- `Server-Timing` headers expose backend phases for browser and Vercel diagnosis.
- Existing root workspaces migrate to `tenant_state` with `ON CONFLICT DO NOTHING` so deployment cannot replace newer tenant data.

Current populated-workspace baseline (June 20, 2026):

- Full TEP-NG JSON: approximately 13.77 MB.
- Initial state after deferred audit history: approximately 7.93 MB.
- Phase 2 sales-history deferral removes historical sales from login/initial state; sales hydrate on demand in pages of up to 500 records.
- Phase 2 ledger deferral removes historical ledger entries from login/initial state while preserving current stock through read models; movement history hydrates on demand in pages of up to 500 records.
- Progressive history loading means the browser loads the first recent page only. Patients and Reports expose explicit load-more controls for older visits and ledger rows instead of looping through every page at once.
- Stock rows and high-volume report rows use per-render ID lookup maps for medicines, products, batches, suppliers, branches, users, and sale references. Do not reintroduce repeated `.find()` scans inside ledger/report row loops.
- Normal action response core after heavy-collection deltas: approximately 428 KB, plus changed records.

The next performance phase is server-side dashboard/report aggregation beyond stock and movement hydration, followed by relational history tables/indexes when the JSONB read-model boundary is no longer enough. It must preserve branch-authorized patient history, branch-aware reporting, auditability, and the existing sale/dispensing save boundary.

## Authenticated Shell

The authenticated layout is:

- Fixed left control panel/sidebar on desktop, with a persistent 72px icon rail when collapsed. On pointer-driven desktops, entering the rail expands the panel over the workspace and leaving collapses it; keep the workspace position stable. Keyboard focus also expands it and keeps it open until focus leaves. Hide desktop panel toggles; retain a tap trigger for mobile/coarse-pointer devices. Do not restore the floating/drag-to-position drawer handle. Collapsed icons retain accessible names, hover titles and direct navigation. Continuity expands the full panel to expose its submenu.
- Drawer-style sidebar on tablet/mobile (900px and below), opened by the header panel button. Keep backdrop, focus trapping, Escape dismissal and focus restoration; hidden mobile navigation is inert while the desktop icon rail remains interactive.
- Topbar with account/branch context.
- Main workspace scrolls naturally.
- Repeated or dense content inside a section may have its own scroll area.

Do not add floating marketing layouts, oversized hero sections, or decorative page cards inside the authenticated workspace.

## Page Map

- Dashboard: metrics, assigned branch strip, branch summaries, operational alerts, stock tables.
- Medicines: medicine catalog, requisition cart, batch/stock context.
- Mart: non-medicine product catalog for POS.
- Suppliers: supplier records and supplied stock history.
- Receive: stock receiving into the active branch.
- POS: sale catalog, active cart, draft carts, payment, patient care fields, sales history.
- Patients: patient lookup, medication history, refill reminders, follow-up messages.
- Continuity: patient-linked unavailable medicine requests, branch availability options, map links, and follow-up status.
- Issue Stock: branch stock issue workflow.
- Adjustments: write-off, returns, and correction posting.
- Reports: stock on hand, movement ledger, pharmacy/mart modes, CSV/print output.
- Messages: group/direct staff chat.
- Notifications: scoped operational alerts.
- Audit: activity history.
- Users: staff approval, roles, security events.
- Branches: branch/site records and branch staff access.
- Guide: beta workflow guide.
- Settings: company identity, logo, thresholds.

Future expansion memory:

- `Freeze II / Care Network`: HMO-routed prescription workflow, EMR/HMO prescription intake, approved pharmacy matching, patient pickup links, stock reservation, label/counseling handoff, and closed-loop dispensing feedback. Use [FREEZE_II_CARE_NETWORK_FIGMA_BLUEPRINT.md](FREEZE_II_CARE_NETWORK_FIGMA_BLUEPRINT.md) before designing or implementing this expansion.
- `Clinical Safety Assistant`: pharmacist-assistive alerts must be explainable, auditable, dismissible with reason, and framed as review prompts rather than diagnoses or autonomous dispensing decisions.
- `Pharmacist Safety Review`: deterministic POS prompts should use patient reliability, age/pregnancy/renal/liver context, duplicate therapy, antibiotic repetition, high-risk medicines, and counselling rules. Persist pharmacist outcome/note and prompt summary on drafts/sales.
- Allergy/current medicine context should be captured inside the POS review panel and used only as explainable pharmacist prompts.
- Continuity transfer requests are queue states only. They must not deduct stock or mark patient need fulfilled until a POS sale/dispensing event happens.
- `Continuity Centre`: do not emit one notification per patient. Group continuity prompts and route the real work into the Continuity Centre, patient profile, POS missing-stock panel, and receiving-stock matching.

## Scroll Policy

Use scroll intentionally:

- The browser/main workspace scrolls for normal page progression.
- The sidebar/control panel is viewport-fixed and should not shrink, detach, or end halfway down a scrolled page.
- Use internal scroll only for dense repeated content:
  - Tables.
  - Long branch, supplier, alert, audit, access, chat, patient, and modal lists.
  - POS cart line items.
- Do not put small forms or sparse cards in scroll containers.
- On mobile, prefer natural page scrolling. Internal max-heights should be removed where the content needs reading and tapping space.
- Tables may scroll horizontally inside `.table-wrap`; the whole app should not create horizontal page overflow.
- Sticky table headers are allowed inside `.table-wrap` only.

Shared scroll sizing lives in CSS variables:

- `--rx-scroll-short`: compact repeated lists, such as dashboard snippets or POS cart lines.
- `--rx-scroll-medium`: primary panel lists, such as branch grids, patient lists, access lists.
- `--rx-scroll-deep`: table/chat/report surfaces.
- `--rx-scroll-modal`: modal list content.

Before adding a new `max-height` or `overflow`, prefer these variables and check the mobile override section.

## Design Rules

- Border radius should usually be `8px`; keep larger radii for modals or special POS surfaces only.
- Authenticated pages should be dense but readable: smaller headings inside cards, clear hierarchy, restrained decoration.
- Use lucide icons for actions and navigation.
- Use cards for repeated items, modals, and framed tools. Do not put cards inside cards unless the inner item is a genuine repeated record.
- Use Rai's burgundy (`#82172C`), dark wine (`#671121`), and soft rose (`#F8EDF0`) for brand/navigation/action accents throughout RxLedger, balanced by white surfaces and readable neutral text. Shared screen tokens and component styling live in `src/rxledger-theme.css`; preserve semantic warning, expiry, success and healthy-stock colours and existing print styles. No frosted glass or additional animation is required.
- Apply the burgundy palette to hover, selected, expanded, and keyboard focus states as well as default controls. Green is reserved for meaningful health/success/availability indicators and WhatsApp identity; it is not a second navigation or general action palette. WhatsApp links share `--rx-whatsapp` and `--rx-whatsapp-deep` for accessible branded contrast.
- WhatsApp calls to action use the shared official WhatsApp logo across patient follow-ups, refills, and continuity requests. The initial visual preview was accepted before this rollout.
- The landing page keeps its existing design and scoped tokens. Dashboard layout lives in `src/dashboard-burgundy.css`: compact summary cards, branch context, branch overview and operational alerts alongside a current inventory snapshot. `DashboardInventorySnapshot` is read-only and uses only already-permitted dashboard stock rows and branch summaries. Batch health categories are mutually exclusive and exclude zero-stock batches. Branch value bars show current cost value, not a fabricated historical trend. Existing metric calculations, alert details, FEFO table and role/branch rules remain unchanged.
- Shared header notification and profile controls lead to existing Notifications and Settings pages. They do not introduce new permission or data-loading paths.
- Text must fit its container on mobile and desktop.
- Buttons should describe concrete actions. Icon buttons need titles or accessible labels.

## POS Rules

- POS cart is the active working cart.
- Saving a POS draft persists a 10-minute temporary cart and then clears the active cart to reduce information overload.
- The POS `Clear` button clears only the active cart/form.
- Draft deletion must happen from the Draft carts modal only.
- Completing a sale removes the selected draft and deducts inventory.
- Pharmacists and allowed branch roles can prepare/save drafts; only cashiers complete sales.

## Subscription Rules

- Subscription plan definitions live in `src/subscriptionPlans.ts` and should be the source of truth for landing pricing, the Settings subscription panel, and future billing enforcement.
- Free trial is 30 days and exposes the Smart Pharmacy plan. Trial data is never deleted when the trial ends.
- Customers can upgrade immediately without data migration because the workspace data stays in place.
- Customers can downgrade only when active usage fits the lower plan limits. For example, Single Branch allows 1 active branch and 5 active staff; Smart Pharmacy allows 5 active branches and 25 active staff.
- Downgrading must never delete stock, sales, patient, branch, or audit history. Extra branches/staff should be archived, exported, or made inactive before the lower plan becomes active.
- Workspace settings persist `subscriptionPlanId`, `trialStartedAt`, and `trialEndsAt`. The app and API both block plan changes that exceed the target plan boundary.
- High-support or high-value features belong in Enterprise: unlimited branches/staff, custom integrations, SLA, dedicated onboarding, custom reports, and future AI/clinical automation.
- Expansion features must not become free upgrades by accident. HMO routing, EMR/HMO integrations, pharmacy network matching, claim feedback, custom APIs, and care-network coordination should be priced as Enterprise features or paid add-ons, because they create new revenue value and support obligations beyond normal pharmacy operations.
- Existing plans should keep receiving quality, security, usability, and workflow improvements inside their promised scope. New cross-organization workflows should require a plan upgrade, add-on, or custom contract.

## Automatic Pricing And Markup Warnings

- Apply item-specific overrides before category markup, then global markup. Calculate against cost per least sellable unit after receiving-container conversion.
- Rounding supports no rounding, presets 1/5/10/50/100 NGN and a custom increment of at least NGN 0.01. Round to the nearest increment, not always upward; retain currency precision and never calculate an automatic selling price below unit cost.
- Frontend previews and server persistence must agree. Catalogue medicine/retail edits and receiving must use the same hierarchy, including an edited item's unsaved category/SKU.
- Receiving must resolve the displayed default medicine before converting container cost; default selection, explicit selection, warning, automatic price and review must all use that same medicine and its pack size. Show cost and suggested/automatic selling price per named least sellable unit even when automatic pricing is off.
- When manual prices are allowed, show a warning below the final rounded target with expected and entered prices per named least sellable unit. Preserve below-cost blocking and the permanent-admin/reason requirement for automatic-pricing overrides.
- Settings changes apply to subsequent pricing operations; do not silently rewrite existing stock prices or historical transactions. Automatic pricing remains controlled by the existing workspace switch.

## Patient Workflow Rules

- Patients are derived from POS sales data, not a separate manual CRM table yet.
- Saved patient profiles can be corrected from the patient page; edits update matching sales, draft carts, and continuity requests with an audit entry.
- Search must work by name, phone, and receipt reference.
- Patient cards should stay compact because each card carries only identity, visit count, last seen, and spend.
- Medication history and follow-up messages are scrollable panel lists on desktop and natural lists on mobile.
- WhatsApp/copy actions should never require leaving the patient context.
- Patient Continuity is the strategic differentiator. Avoid adding scattered patient widgets that do not strengthen the patient journey.

## Clinical Safety Rules

- Start with deterministic, auditable rules before AI-generated explanations.
- Show why an alert was raised.
- Avoid accusatory language such as labeling a patient as abusive or addicted.
- Use language like "review recommended" and "possible pattern".
- Pharmacists should be able to resolve, dismiss, or document follow-up.
- The assistant should not diagnose, prescribe, or autonomously block dispensing.

## Branch and Access Rules

- Stock belongs to branches/sites.
- Only the designated global admin sees broad account context. Other users, including branch admins, receive operational records only for active assigned/managed branches; expired assignments grant no access. The selected branch narrows their work surface further.
- Scope initial/login/action payloads and history pagination on the server, including stock summaries, patients, receipts, continuity, staff, drafts, messages, and response deltas. Patient history and edits remain branch-specific for users without global access.
- Continuity status filters live under an expandable Continuity navigation entry, with a compact selector in the queue. On small devices, keep the queue before its collapsed creation form.
- Mart quantity is derived by branch from signed product movements. Never attribute legacy aggregate stock to a branch without provenance; receiving or an explicit branch stock correction establishes ownership. Group and direct messages carry a branch ID; unattributed historical messages stay available only to the global admin.
- Branch switching should feel like switching workspaces and preserve scoped operational context.
- Staff access is explicit. Do not silently grant branch write access from registration.
- On phones and tablets, onboarding guidance starts collapsed in normal page flow. It must not cover working controls. Inputs use at least 16px text and primary touch controls at least 44px targets.

## Verification Checklist

For UI changes:

- Run `npm run build`.
- Run `npm run lint`.
- Check 390px mobile width for horizontal overflow.
- Check desktop scrolling with the sidebar open.
- For POS changes, verify draft save, cart clear, draft load, draft delete, and sale completion behavior.
- For patient changes, verify list density, profile layout, reminders, copy, and WhatsApp links.

For deployment changes:

- Commit with a focused message.
- Push `master`.
- Confirm Vercel deployment is `READY`.
- Confirm production returns the new bundle.
- Check `/api/bootstrap`, `/api/state`, and `/api/action` timing and response bytes in Vercel runtime logs.
- Confirm Speed Insights trends by route after enough real-user samples have accumulated.
