# Responsive UX and branch isolation audit

This sweep addresses mobile crowding, navigation hierarchy, and branch-specific operational information. Three focused agents handled navigation/continuity, responsive layout, and backend branch access; the parent reviewed integration and ran Chromium browser checks.

## Changes

- Continuity has an expandable sidebar entry with Active, Stock available, Waiting, Contacted, Transfer requested, Fulfilled, Cancelled, and All requests submenus. The queue also retains a compact accessible status selector.
- The continuity queue precedes its collapsed request-creation form. Expanded patient details and actions remain grouped by patient.
- Phone navigation uses a visible menu trigger, focus trapping, Escape dismissal, focus restoration, and inaccessible hidden/background content. Desktop navigation remains open after selecting a page.
- Phone headers, dashboard metrics, POS headers, and payment controls use compact responsive layouts. Tablet forms and grids stack rather than squeeze. Tables and tab strips contain horizontal scrolling.
- Touch targets are enlarged and phone input text is at least 16px to avoid iOS focus zoom. Modal scrolling respects the viewport and overlays sit above navigation.
- Onboarding guidance starts collapsed in normal page flow on phones/tablets instead of covering operational controls.
- Initial state, login, action response deltas, and paginated history enforce branch access on the server. The active branch further narrows non-global work surfaces.
- Patient history/edits, continuity matching, receipts, stock, reports, staff, drafts, notifications, and messages respect branch context. Mart uses signed branch stock movements rather than workspace aggregate quantity. Chat carries explicit branch ownership and per-branch read timestamps.

## Browser verification

Run a local Vite server, then `npm run test:browser`. Chromium defaults to `/usr/bin/chromium`; override its executable with `RXLEDGER_CHROMIUM_PATH`. This test uses controlled API fixtures, with realistic medicines, batches, patients, two branches, continuity requests, and Mart stock. It does not write production data.

The matrix covers 320×740, iPhone 12 dimensions (390×844), tablet (768×1024), desktop (1440×1000), and a branch-local staff account at 390×844. Screens checked: Dashboard, Continuity, POS, Patients, Pharmacy, Mart, Receive, Reports, Suppliers, Notifications, Team Chat, Settings, Branches, Users, Issue Stock, and Adjust/Returns, subject to role access. It measures document overflow, captures screenshots, and records browser errors. Continuity creation and patient details are expanded during checks, and selecting a sidebar status is asserted against the queue selector.

`node scripts/browser-ux-audit.mjs --interactions-only` additionally checks drawer focus containment, Escape, submenu selection, desktop sidebar persistence, branch switching, and collapsed onboarding disclosure. Screenshots and measurements are written to ignored `artifacts/ux-audit/`.

## Automated checks and limits

The production build, lint, existing test suites, and branch regression tests are run. Branch tests exercise payload isolation, expired/unassigned access, scoped history queries, response deltas, patient edits, draft permissions, Mart corrections, and branch chat/read behavior. Lint retains one pre-existing dependency warning in `RaiConsent.tsx`; the build retains its large-bundle warning.

Chromium emulation checks layout at iPhone dimensions; it does not replace native iOS Safari testing. No live database credentials are configured in this execution environment, so authenticated production flows and real database query execution have not been tested here. API fixture checks and mutation tests are evidence for UI behavior and access logic, not a claim of live database verification.

Legacy Mart aggregate quantities without branch ledger provenance remain visible to the global admin; local branch stock requires receiving or an explicit branch correction. Historical chat messages without a branch ID remain available only to the global admin. These records are preserved, with no guessed ownership or deletion.

Changes are prepared locally. Publishing to `master` updates production according to the repository deployment workflow and requires a separate release decision.
