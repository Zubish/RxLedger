# Browser navigation

All 17 workspace pages use URL fragments such as `/workspace#/patients` and `/workspace#/reports`. Continuity status is included as `#/continuity?status=matched`. Workspace paths and existing query parameters remain intact.

Sidebar links, dashboard links and coach links create history entries. Back and Forward restore the selected page without creating extra entries. Refresh initializes the selected page from its URL; restored pages load their sales, ledger or audit data as needed. Admin-only pages are checked again against the authenticated user's access. Unknown page URLs fall back to Dashboard.

Expired sessions show login, including when the browser was on the root URL. Refresh while signed out stays on login. Login restores the requested permitted page. A fresh visit to the public root without a session or app page URL still opens the landing page.

`npm run test:navigation` checks refresh on all 17 pages at 390px, 768px and 1440px, Back/Forward, Continuity status history, dashboard links, restricted-page restoration and expired-session login. It uses Chromium with controlled API fixtures.
