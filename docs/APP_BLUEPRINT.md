# RxLedger App Blueprint

This blueprint is the working guide for future RxLedger changes. Read it before changing layout, navigation, POS logic, patient workflow, branch access, or reporting behavior.

For reusable skills that apply beyond RxLedger, also read [SKILL_LIBRARY.md](SKILL_LIBRARY.md). The blueprint is RxLedger-specific; the skill library is cross-industry.

## Product Shape

RxLedger is a pharmacy operations workspace, not a marketing site once a user is authenticated. The app should feel calm, dense, professional, and built for repeated counter/back-office use.

The core promise is:

- Branch-aware stock control.
- Fast POS checkout.
- Patient continuity from POS sales history.
- Audit-friendly reports and operational traceability.
- Role-based access for admins, branch managers, pharmacists, cashiers, inventory staff, and viewers.

## Technical Map

- Frontend: Vite + React + TypeScript in `src/`.
- Main authenticated shell: `src/App.tsx`.
- Main CSS system: `src/App.css`; landing-specific Tailwind-like classes live mostly in `src/RxLedgerLanding.tsx`.
- API routes: `api/`, using Vercel serverless handlers.
- Persistence: Neon Postgres stores root tenant state, workspace JSON, and sessions.
- Deployment: GitHub push to `master` triggers Vercel production.

## Authenticated Shell

The authenticated layout is:

- Fixed left control panel/sidebar on desktop.
- Drawer-style sidebar on tablet/mobile.
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
- Avoid one-hue pages. RxLedger uses green as the operational anchor with cyan/purple/amber as accents, but pages should not become a single-color wash.
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

## Patient Workflow Rules

- Patients are derived from POS sales data, not a separate manual CRM table yet.
- Search must work by name, phone, and receipt reference.
- Patient cards should stay compact because each card carries only identity, visit count, last seen, and spend.
- Medication history and follow-up messages are scrollable panel lists on desktop and natural lists on mobile.
- WhatsApp/copy actions should never require leaving the patient context.

## Branch and Access Rules

- Stock belongs to branches/sites.
- Admin can see broad account context; non-admin users operate only assigned/managed branches.
- Branch switching should feel like switching workspaces and preserve scoped operational context.
- Staff access is explicit. Do not silently grant branch write access from registration.

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
