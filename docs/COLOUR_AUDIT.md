# Burgundy theme consistency

Burgundy is the primary navigation, action, selection, and focus accent throughout RxLedger. Deep burgundy handles hover/pressed contrast; white and neutral surfaces keep operational screens readable. Rose supports selected rows, subtle borders, and secondary surfaces.

Green remains where it conveys stock health, successful operations, availability, or WhatsApp identity. Warning, expired-stock, and other safety colours retain their meaning. Print layout and readability are preserved; the decorative sales-history print header also uses burgundy.

The sweep fixes drawer hover, Continuity controls, patient history selection, POS prices, branch/account labels, report summaries, supplier links, secondary buttons, and decorative legacy green/cyan backgrounds. WhatsApp actions share an accessible dark green with a deeper hover shade. The existing sign-in/loading favicon shape uses burgundy and rose instead of purple and cyan.

Only the selected patient Follow-up Messages WhatsApp action receives the recognizable WhatsApp logo. Refills and other WhatsApp actions retain their prior icons so this single preview can be reviewed before a broader icon change.

Run `npm run test:colours` against the local Vite server for computed-colour, hover/focus, overflow, and single-icon preview checks at phone, tablet, and desktop sizes. The test uses controlled operational fixtures and captures screenshots and remaining semantic green usage under ignored `artifacts/ux-audit/`. The regular `npm run test:browser` shares the same fixtures.

Browser checks use Chromium emulation, not native iOS Safari, and do not exercise a live authenticated database. Build, lint, and existing business/access tests provide additional verification.

The completed sweep passed 51 screen/device colour, interaction, and overflow checks at 390px, 768px, and 1440px. Additional checks passed for sign-in and the sales-history modal at all three sizes. The browser asserts exactly one WhatsApp logo in Follow-up Messages and unchanged Smartphone icons in refill actions. Build and all seven test suites passed; lint reports no errors and the existing RaiConsent dependency warning.
