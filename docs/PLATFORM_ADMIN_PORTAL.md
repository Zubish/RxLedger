# RxLedger Platform Admin Portal — approved specification

Status: approved for implementation by the product owner on 10 October 2026. The first release is read-only. The owner has confirmed that performance includes both technical health (speed, errors and uptime) and pharmacy adoption/workspace activity.

## Purpose

Give the RxLedger platform owner a self-service view of the whole application: which pharmacy workspaces exist, how actively they use the product, and whether the application is fast and reliable. This is separate from the existing pharmacy-owner dashboard and its branch administration.

The owner should be able to answer:

- How many workspaces exist, and what are their names?
- Which are real pharmacy accounts, DEMO accounts or internal test accounts?
- How many pharmacies completed setup and used RxLedger recently?
- Which features are being used, and where do users encounter failures?
- Is the app slower or less reliable on phones than on desktop?
- Which releases improved or worsened performance?

## Existing specification and implementation

- `APP_BLUEPRINT.md` defines workspace/branch roles and technical performance architecture, not platform-wide administration.
- `RXLEDGER_ECOSYSTEM_MODULES.md` proposes pharmacy operational Analytics And Stewardship, not platform health or a workspace directory.
- The Care Network blueprint mentions future network administration, a separate enterprise module.
- `/api/state` and `/api/action` already emit structured performance logs, including duration, backend phases and response bytes. Coverage is not yet a complete application-wide telemetry system.
- `Server-Timing` headers and the frontend Vercel Speed Insights component provide useful foundations. Their presence does not prove that historical metrics are available to the proposed portal.
- Tenant records live in `tenant_state`; the legacy root is not the directory's authoritative count source.
- Existing pharmacy super-admin access is restricted to its own workspace. There is no platform-owner identity or cross-workspace admin UI.

No platform-admin portal specification was found in the current repository documentation or the searched Git history.

## First release

Start with a read-only portal. Workspace changes, suspension and permanent deletion are a subsequent, separately reviewed phase. The first release must be useful before historical telemetry accumulates.

### 1. Overview

- Total registered workspaces, with separate real-pharmacy, DEMO and internal-test counts.
- New pharmacy workspaces and active pharmacy workspaces for the selected period.
- Requests, API error rate and API latency.
- Browser performance by mobile, tablet and desktop.
- Current production release and data freshness.
- Links to directory, usage and technical-health detail.

Use a small set of primary summaries followed by detail views; do not stack every metric on the home screen.

### 2. Workspace directory

- Search and paginated list of workspace name, portal slug/link, account category, creation date, branch count and active-staff count.
- Last observed activity and onboarding/activation state, with an explicit “not measured yet” state.
- Filter by account category, creation date, activity and activation state.
- Read-only workspace detail: identity, counts, activity trend, feature use and technical-health summaries.
- Download a permission-checked CSV of the currently filtered directory or summary, with an audit record.
- Direct database counts are authoritative. Never infer current workspace existence from old logs, the legacy root or analytics events.

Do not open a pharmacy's patient records, stock, sales content or staff passwords through this portal. Opening its normal workspace link requires that workspace's own authorization; it does not grant impersonation.

### 3. Adoption and feature use

- Workspace signups, completed setup and successful first core operation.
- Daily, weekly and monthly active pharmacy workspaces.
- Aggregate feature use for POS, Pharmacy, Mart, Receive, Patients, Continuity and Reports.
- Aggregate successful core operations, such as completed sale, stock receipt, continuity creation and report export.
- Returning-workspace trends and onboarding drop-off, once sufficient observations exist.
- DEMO/internal activity excluded from real-pharmacy adoption by default, with a clearly labelled option to include it.

Feature use must describe application activity, not display medicine names, patient identifiers, sale amounts, prescription content or WhatsApp messages.

### 4. Technical health

- Request volume, success/error rates and latency by normalized route/action.
- p50 and p95 latency, with sample counts and backend load/auth/save timing where captured.
- Response-size trends and failed operation counts.
- Browser Core Web Vitals: LCP, INP and CLS, grouped by page, device category and release where the provider supports those dimensions.
- Sanitized frontend error groups and backend failure groups.
- External availability checks, separate from observed request success.
- Release comparison over equivalent time windows, with sample sizes and incomplete-data indicators.

Authentication failures, permission denials and application/server failures must be distinguishable. A traffic-free interval is not evidence of uptime. No request metrics means “no observations”, not “healthy”.

## Metric definitions

| Metric | Definition/source |
| --- | --- |
| Registered workspaces | Current `tenant_state` rows, grouped by server-controlled account category. |
| New pharmacy workspaces | Real-pharmacy workspace creations in the selected interval. This is distinct from current surviving accounts. |
| Active staff | Current active user records; not a count of sessions or recent visitors. |
| Active pharmacy workspace | At least one authenticated user-initiated page visit or successful core operation in the interval. Background polling, health probes and automatic session refresh do not count. |
| Activated pharmacy | Completed setup and at least one successful sale or stock receipt after setup. The definition must be visible beside the funnel. |
| Feature visit | Foreground user navigation to a feature, deduplicated by event ID; automatic rerenders/polling do not produce visits. |
| Core-operation success | Event emitted after the backend commits the operation successfully. Retries are deduplicated by operation ID. |
| API failure rate | Failed application/server requests divided by measured requests in the selected scope. Show HTTP status breakdown separately, including expected 4xx responses. |
| API p95 latency | 95th percentile of observed request durations for the selected interval/filter; display number of samples. |
| Browser performance | Observed Core Web Vitals from real browser visits, using the provider's documented percentile/aggregation rules and coverage limits. |
| Availability | Successful external probe observations divided by expected scheduled probes; missing probes are unknown and must not count as successful. |
| Returning workspaces | Real workspaces active in a selected cohort's later period; show cohort size, period and eligibility. |

Default reporting: last 7 days, with 24-hour and 30-day options. Use UTC storage and explicitly label the display timezone. Do not silently mix cumulative counts with rolling-period counts. Use the active account category at event time when separating historical DEMO/test activity.

## Access and isolation

- Introduce a separate platform-owner permission stored and checked on the server. A pharmacy `admin` role, primary-admin ID, tenant setting or client-supplied flag must never confer platform access.
- Initial access is owner-only, using a specifically provisioned platform identity. No public registration, automatic promotion or shared DEMO credentials can grant this role.
- Require MFA for platform access; choose an identity mechanism that supports it before implementation. Do not implement a new password system just for this portal.
- Reserve a distinct route, proposed `/platform-admin`, and exclude that route from workspace-slug resolution and workspace registration.
- Authorize every platform API and export independently; protect against requests made outside the UI. Use short-lived platform sessions and reauthentication for future sensitive actions.
- Audit platform sign-ins, failed access, exports and future administrative changes. Audit records must not contain patient data or full request bodies.
- Pharmacy users continue to see only their permitted branches. This portal does not change existing tenant or branch permissions.

## Collection and storage

- Put platform metadata and telemetry in dedicated relational tables/services, not inside pharmacy JSONB records.
- Keep account category and platform permissions separate from tenant-editable settings. Do not rename DEMO or alter its pharmacy data to classify it.
- Collect route/action identifiers, timestamp, release, coarse device category, result/status, duration, response bytes and scoped pseudonymous IDs where needed.
- Do not collect request bodies, field contents, patient names/phones, prescriptions, medicine histories, payment details, auth tokens, raw URL queries or session replay.
- Use an allowlist of event names and properties, server-assigned workspace identity for operational events, validation, rate limits and deduplication. Browser telemetry is untrusted and must not be the sole source for signup or transaction counts.
- Collection must not block checkout or other core work. Instrumentation failures must not cause user-operation failure; collection failures need their own monitoring.
- Aggregate on the server. The portal must not fetch every workspace's operational JSON to compute charts in the browser.
- API timing and real browser metrics can integrate with Vercel observability where available. Confirm plan, retention, export/API availability and cost before selecting that source. A browser Speed Insights component alone is not a durable analytics backend.
- Historical data is only shown if actually available. Do not fabricate prior activity or reconstruct deleted workspace data. Clearly mark the start of measurement.
- Proposed retention for review: raw events 30 days, daily aggregates 12 months and minimal platform audit records 12 months. Workspace deletion must remove its identifying metadata and scoped telemetry according to the agreed deletion policy; any retained anonymous aggregate must not allow reconstruction of that workspace. Provider backup limits remain explicit.

## Responsive UX

- Desktop: compact overview, readable trend charts and paginated tables.
- Mobile: concise summary, separate Overview / Workspaces / Usage / Health screens and filters in a disclosure or sheet.
- Workspace detail opens as a navigable page; short filter/detail tasks may use accessible modals.
- Use the established burgundy design system and meaningful status colours, labelled trends, keyboard access and 44px mobile touch targets.
- Browser Back/Forward and refresh preserve page and report filters. Loading, empty, partial, stale and failed-data states are distinct.

## Later phases

- Tester feedback linked to page/release, with optional user-submitted diagnostic context and no automatic capture of patient content.
- Owner-controlled workspace suspension, restoration and deletion, with exact workspace identity, typed confirmation, reauthentication and a clear data-removal summary.
- Alert thresholds, notifications and issue triage after a reliable baseline exists.
- Additional read-only platform operators, scoped permissions and billing/plan reporting if required.

## Acceptance criteria

1. Owner can see the exact current workspace total and names without asking an assistant or accessing SQL.
2. DEMO and test traffic do not inflate real-pharmacy adoption figures.
3. Pharmacy admins and staff cannot access platform pages, APIs or exports, including by guessing URLs or changing client state.
4. Seeded telemetry fixtures produce known counts, latency percentiles and denominators; retries/polling do not inflate adoption or operation metrics.
5. Browser events and API logs contain none of the excluded pharmacy/patient content.
6. Charts state their interval, timezone, measurement start, freshness and sample size; absent observations are not represented as zero failures or perfect uptime.
7. Phone, tablet and desktop views remain navigable without page overflow, and browser history/refresh work.
8. DEMO's existing workspace content and existing pharmacy workflows remain unchanged.
9. Feature collection does not turn a successful sale or receipt into a failed operation.
10. Directory and aggregate queries remain paginated/bounded and avoid full cross-workspace operational payloads.

## Decisions before implementation

- Confirm the remaining scope and workflow details; technical health and adoption/workspace activity are already agreed.
- Provision the owner's platform identity and select its MFA mechanism without sharing credentials in chat.
- Confirm retention and what may remain anonymously aggregated after workspace deletion.
- Choose the telemetry provider/storage after checking actual Vercel capabilities and costs.
- Confirm the read-only first release versus including workspace management immediately.

Build order after specification review: platform access and directory; collection and verified aggregates; technical health; responsive portal and full authorization/browser checks. Management and alerting follow in separately reviewed phases.
