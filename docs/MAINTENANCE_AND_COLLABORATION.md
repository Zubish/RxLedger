# Maintenance And AI Collaboration

Adopted 2026-10-20 following the owner's instruction to assimilate the SEN 401 working guide. This is RxLedger's lightweight engineering process, used alongside the app blueprint. It does not certify implementation, legal compliance or clinical safety.

## Authority And Sources

- Current user instructions and already-granted authorisation guide the work. The [app blueprint](APP_BLUEPRINT.md) and its specialised documents hold product rules; this document holds the maintenance process.
- The [original proposed working guide](references/RxLedger_SEN401_Working_Guide.txt) is retained unchanged as a historical source, not a second active specification. Its RxLedger-specific recommendations require alignment with current requirements. In particular, its purple-lightning-logo statement was not independently established as the accepted visual baseline; preserve accepted assets and separate pharmacy-uploaded branding. Do not change artwork based on that statement alone.
- The supplied *SEN 401 Detailed Course Summary*, 14 pages, is a condensed study summary of the course, not the original textbook or a compliance standard. We reviewed the supplied PDF; its page references support the concepts below. The three implementation cycles and RxLedger requirements are practical adaptations, not course quotations.
- HealthPass prescription exchange remains planned unless a current contract and implementation establish otherwise. A similar screen in another product does not establish identical rules or authorise an integration.

## How The Owner And AI Assistant Work Together

The owner provides goals, priorities, constraints and acceptance feedback. The AI assistant inspects the implementation, identifies material tradeoffs, implements authorised changes, verifies outcomes and maintains durable records. Domain assumptions and uncertain findings must be stated rather than silently converted into requirements.

1. Understand the user outcome and identify what must remain unchanged. If the owner requests discussion before implementation, stop at analysis and concrete options.
2. Inspect code, relevant documents and existing checks. Trace the workflow across UI, API, persisted state, permissions, reports and external dependencies.
3. Define concise acceptance criteria and proportionate verification. Ask only about ambiguity that materially changes scope or correctness; continue useful independent work while awaiting clarification.
4. Implement the smallest coherent change. Preserve unrelated working behaviour and existing data. Update frontend and backend rules together where required.
5. Verify the actual behaviour, including relevant failure paths. Distinguish synthetic/mocked browser checks from real API/database checks and fresh evidence from historical records.
6. Release only within authorisation. Record the commit, intended environment, deployment and data/configuration implications. Confirm the served version and affected workflow when production is changed.
7. Report the outcome, checks, material limits and release state plainly. Give progress updates during sustained work. Record the owner's acceptance or requested revisions separately.

Existing authorisation carries forward. Do not insert new confirmation gates for routine reversible work. Clarify a genuinely unresolved product decision before dependent implementation; do not ask the owner to repeat an approval already provided. Destructive work needs a bounded target and a validated, appropriate recovery/retention plan; redeploying old code cannot restore deleted or migrated data by itself.

## Baselines And Controlled Items

A baseline is an explicitly accepted reference, not merely the newest commit or deployment. Maintain these distinctions:

- Functional: accepted workflows, actors, branch/workspace scope and outcomes in the blueprint and specialised specifications.
- Technical: architecture, API contracts, data ownership, persistence boundaries and integration dependencies.
- Configuration: exact commit/build, deployment/environment, schema or migration state, lockfile and relevant configuration changes. Record names and purposes of secret settings, never values.
- Visual: accepted assets, component behaviour and relevant device states. Passing layout measurements does not establish that the owner approves the design.

Controlled items include code, dependency lockfiles, migration scripts, tests/fixtures, product rules, reusable assets, environment configuration definitions and release/recovery records. Reuse the existing repository and hosting/database records rather than introducing a separate CMDB unless scale warrants it.

## Impact Analysis And Priorities

Trace stock changes through receiving → pack/least-unit conversion → batch balance → sale/issue/return → movement ledger → reports → alerts. Trace access changes through workspace → branch assignment → server authorisation → query/response → interface. Patient-detail changes also touch workspace identity links, profile lookup, selected-patient context, draft/sale snapshots, audit, clinical-history permissions and operational branch scope. Shared patient identity does not grant cross-branch financial access; see [the registry contract](WORKSPACE_PATIENT_REGISTRY.md).

Prioritise unauthorised access, incorrect stock/financial effects and lost data, followed by blocked workflows and recurring support defects. Continue authorised usability work while recording material integrity gaps; this priority does not silently cancel the owner's requested work.

Classify meaningful work as corrective, adaptive, perfective or preventive. When a failure recurs, inspect the common cause before adding another local workaround. Capture behaviour before refactoring; similar frontend/server formulas need consistent contracts and meaningful comparison tests.

## Verification And Acceptance

| Change | Minimum useful evidence |
| --- | --- |
| Wording or repository documentation | Focused diff, links/references and consistency review; no app build required unless generated/runtime output is affected |
| Local layout or controls | Build/lint, relevant phone/desktop states, readable controls and no overflow; inspect the visual result |
| Shared navigation, patient or pricing flow | Relevant flow and regression checks, role/branch context, refresh and saved-state behaviour where affected |
| Permissions, transactions or integrations | Real server-rule checks plus relevant end-to-end evidence; examine unauthorised requests, failure, retry, concurrency and data reconciliation as applicable |
| Migration, removal or recovery | Rehearse in isolation, validate data meanings/counts/totals, concurrent-write handling and recovery limits before production cutover |

Keep a small synthetic scenario set: receive and sell with reconciled stock/ledger; supported return/adjustment; unauthorised branch/workspace request; controlled expiry boundaries; interrupted/repeated operation; protected-route refresh and timeout. Existing check files are entry points, not proof that every scenario is covered. The [requirements matrix](REQUIREMENTS_VERIFICATION.md) records gaps without asserting unsupported coverage.

For each meaningful change, track independent states:

- Implementation: proposed / in progress / implemented / deferred.
- Technical verification: not run / partial / passed / failed, with scope and evidence.
- Release: local / committed / pushed / deployed, with references when applicable.
- Owner acceptance: not yet reviewed / accepted / revisions requested. Deployment and passing tests do not set this state automatically.

Functional audit: does tested behaviour meet the accepted requirement? Physical audit: does the delivered configuration match the intended release? A deployment marked READY answers only part of the second question. A bundle marker proves delivery of an asset, not successful dispensing or correct access control.

## Records, Release And Recovery

Use [descriptive commits and named annotated production tags](RELEASES.md). Lead release communication with the human-readable name and version; generated Git/Vercel IDs are secondary trace references.

Use [CHANGE_RECORD.md](CHANGE_RECORD.md) for material changes; group minor edits rather than creating paperwork for every line. Link existing blueprints and operational guides instead of duplicating their rules. Existing relevant references include [navigation](BROWSER_NAVIGATION.md), [alerts](ALERT_POLICY.md), [platform operations](PLATFORM_ADMIN_OPERATIONS.md), [workspace removal](WORKSPACE_REMOVAL.md) and [ecosystem modules](RXLEDGER_ECOSYSTEM_MODULES.md).

A meaningful record should include:

- ID/date, owner/request, problem/evidence and user outcome/acceptance criteria.
- Affected components, data, dependencies, preserved behaviour and risk/category.
- Implementation and verification evidence, with limitations.
- Commit, deployment/environment, schema/migration and configuration implications.
- Recovery approach and whether it was rehearsed; owner acceptance and next action.

For runtime releases, confirm the intended target and served version, exercise the affected workflow within authorised access and inspect relevant signals. Report unavailable production access as a limit. Never label a mocked local flow as production/database verification.

A code-only rollback can restore previous code where compatible. Changed data requires a separate restoration/reconciliation plan. For migration, map old/new meanings and ownership, rehearse, compare counts/totals, define cutover and choose pilot/phased/parallel operation where appropriate. Retirement requires preserved records, export/replacement access, withdrawn integrations/access and continuity checks under the actual retention requirements.

Record a formal departure with reason, affected requirement, risk, owner, compensating measure and review date. The course distinguishes a deviation (generally authorised beforehand) from a waiver (acceptance of an existing nonconformance). Neither is a reason to invent approval gates for normal work or conceal an unresolved defect.

## Improvement Cycles And Measures

1. Baseline: map accepted rules to implementation/checks; identify unverified unit, expiry, reversal, isolation and permission paths.
2. Integrity: prioritise discovered scope/reconciliation/retry failures; fix causes and add checks for actual failure modes.
3. Rollout/support: rehearse recovery, verify actual external contracts and improve actionable staff-facing errors; pilot significant changes where practical.

These are workstreams, not a claim that a full audit or recovery rehearsal is complete. The initial matrix is a starting inventory. Measure critical workflow success, stock/ledger discrepancies, duplicates, scope defects, escaped regressions, failed releases, recovery time and recurring support issues. Establish definitions, denominators and an initial observation period before targets; commit counts are not product outcomes.

## Course Traceability

| Concept | Supplied summary pages |
| --- | --- |
| SCM policy, proportionality, ownership and planning | 2–4 |
| Controlled items, baselines, dependencies and libraries | 4–5 |
| Change control, status accounting, deviations and waivers | 5–6 |
| Functional/physical audits | 7 |
| Testing, maintenance categories and process | 7–9 |
| Comprehension, reverse engineering and reengineering | 9–11 |
| Migration, continuity, archival and retirement | 11–12 |

The separate functional/technical/configuration baselines and separate system/acceptance testing in the source are applied here without claiming that the course prescribes RxLedger's features, brand or deployment platform.
