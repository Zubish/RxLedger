# Mobile information hierarchy

At widths up to 767px, the dashboard separates Overview, Stock and Alerts. Each section shows relevant summary metrics and content. Desktop and tablet retain the full overview.

Patient summary cards expand on demand. Within a patient profile, History, Messages and Continuity appear one at a time. Reports use a compact report selector and collapsible filters with applied-filter counts. Continuity keeps quantity and primary actions visible while stock/request details and secondary actions expand separately.

The desktop sidebar close button no longer draws its decorative bar. All three WhatsApp action locations use the shared WhatsApp logo. Data access calculations are unchanged; patient scope labels explicitly distinguish global and branch access.

Verification: production build, ESLint (zero errors; existing RaiConsent warning), all seven test suites, five navigation/device checks, 54 colour/interaction/overflow screen checks, and 24 dedicated mobile hierarchy screen checks passed. The dedicated checks cover 320px, iPhone 12-sized 390px, tablet 768px and desktop 1440px layouts, disclosure controls, the desktop close button and WhatsApp logos. Browser tests use Chromium and controlled API fixtures, not native iOS Safari or a live authenticated database.

Run `npm run test:mobile` against the local development server for the hierarchy checks. Screenshots are written to `artifacts/mobile-hierarchy`.
