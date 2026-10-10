# Platform portal operations

The approved first release is read-only at `/platform-admin`. Its authentication, cookies, MFA and owner membership are independent of pharmacy authentication. Do not promote a pharmacy account to platform owner or use shared DEMO credentials.

## Initial owner setup

Provision a 32-byte random single-use invitation. Store only its SHA-256 hash in `platform_invites`, with a short expiry, and deliver the link privately with the token in the URL fragment. Optionally pin `platform_config.owner_email` before provisioning. The initial setup endpoint rejects enrollment once any platform owner exists. Never commit invitations, passwords or database credentials.

The owner chooses an email and password of at least 12 characters, enrolls an authenticator, saves recovery codes, and verifies a code before accessing reports. Public signup and password-only authenticator resets are disabled. Sessions expire after 30 minutes; a separate session-bound MFA proof is required by every report and export endpoint.

## Storage and collection

Apply `db/migrations/platform-auth.sql`, then `db/migrations/platform.sql`. These are additive migrations; they do not update `tenant_state.data`. The random auth secret is generated and stored server-side in `platform_config`. Rotate it only as an intentional session invalidation.

`tenant_state` is the authoritative directory. Category, observed activity and activation live separately in `platform_workspace_meta`. New workspaces default to pharmacy; DEMO is classified explicitly. Foreign keys cascade workspace-specific telemetry and metadata on tenant deletion. Existing pharmacy content is never copied into platform tables.

Instrumented API coverage is state/action requests, including early errors. Backend load/auth/save timing is available when those phases execute. Successful core operations are recorded after commit and deduplicated using the server operation/audit identity. Foreground feature visits, coarse viewport categories, Core Web Vitals and coarse browser error groups are collected only after pharmacy authentication. No request bodies, raw queries, patient content, messages, prices or auth tokens are telemetry fields. Collection failure must not fail an already committed pharmacy operation.

The owner sees actual measurement start, selected rolling interval, UTC timestamps, release and sample counts. DEMO/internal activity is excluded by default. Activation begins with the first observed successful sale or receipt; pre-instrumentation activation is unknown. New-workspace counts describe surviving accounts created in the period, not a historical signup ledger. CSV export covers the currently displayed directory page and is audited.

## External availability and retention

`.github/workflows/platform-availability.yml` probes `/api/bootstrap` approximately every five minutes. GitHub scheduling may be delayed. Ingestion validates GitHub OIDC issuer, audience, repository, branch and exact workflow identity. No repository secret is required. Missing scheduled observations are unknown; incomplete coverage has no uptime percentage.

The authenticated probe job also runs idempotent daily maintenance: raw events 30 days, daily workspace activity 12 months, minimal platform audit 12 months, and expired auth records. Per-workspace daily rows cascade when the workspace is deleted. Daily summaries do not contain pharmacy content. Current report windows are 24 hours, 7 days and 30 days. Longer cohort/retention and release-comparison views can be added after adequate observations exist; the current portal does not invent historical trends.

## Verification

- `npm test`: existing pharmacy regressions plus owner/MFA, proxy and telemetry privacy checks.
- `npm run test:platform`: browser layouts and history at 320, 390, 768 and 1440 pixels.
- `npm run test:navigation`: existing pharmacy navigation/refresh/expiry checks.
- `scripts/platform-database-check.mjs`: optional isolated-branch real SQL/Better Auth integration; requires a restricted credential file and refuses a branch with existing owners. It creates and removes only its own platform test identities/events. Never point it at production.
- `npm run build` and `npm run lint`.

Keep the twelve-entry Vercel function budget. Platform, auth and telemetry URLs are rewritten to the existing guarded API dispatcher, while each handler independently enforces its own authorization. RAI consent and pharmacy permissions are unchanged.
