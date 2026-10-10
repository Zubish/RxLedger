# Alert management

Notifications and dashboard operational alerts use expandable groups by type and branch. Each item, the current group, or all currently active alerts can be cleared or muted. Groups capture only the issues currently displayed; they never suppress future medicines or new issues.

Clearing asks the user to choose **Remind me in 7 days** or **Move to muted list**. Cleared unresolved issues return after seven elapsed days, including while the app remains open. Muted issues stay in a separate list until restored or resolved. Both lists offer individual, group and all-item restore controls. Opening an alert does not clear it.

Preferences belong to the authenticated user inside that workspace and persist in the existing tenant database JSON. Server responses include only that user's preferences in authorized branches; a browser refresh or another device retains them. The server derives inventory alert branch ownership from current stock, rather than trusting client metadata.

Inventory identities include type, branch and medicine or batch. A stock shortage resolves when quantity exceeds its reorder threshold. Ledger-derived read models remove that issue's suppression during normal stock updates, so a subsequent shortage alerts immediately. Escalation from low to zero stock or near-expiry to expired creates a new identity and appears immediately. New non-inventory updates use their event timestamps. Expired stock remains visible in a persistent unresolved-count notice and stock metrics even if its notifications are cleared or muted.

No scheduler or schema migration is needed: issue state is evaluated against current inventory and the saved clear timestamp. Muting changes personal notifications; it does not resolve the underlying operational issue or change other users' lists.

Validation: `npm test` covers the seven-day boundary, resolution, escalation, new issues, per-user/branch scope, ledger-derived resolution and real API handler persistence/authorization. With Vite running, `npm run test:alerts` exercises the browser at 320, 390, 768 and 1440px using an isolated API fixture. Production pharmacy data is not used for these mutations.
