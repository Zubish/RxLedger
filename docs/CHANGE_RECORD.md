# Change And Release Record

Record material changes using [the maintenance process](MAINTENANCE_AND_COLLABORATION.md). Group minor related edits. Keep implementation, technical verification, release and owner acceptance separate. Do not retroactively invent acceptance, test runs, schema checks or recovery exercises.

## SCM-2026-10-20-01 — Assimilate SEN 401 Into Development Practice

- Request/owner: Musa Ibrahim asked to assimilate the supplied guide and course reference into how RxLedger is built and how the AI assistant collaborates.
- Outcome: repository entry instructions, one maintenance process, a requirement-to-check inventory and integrated AI/QA guidance, preserving the supplied proposed guide as historical reference.
- Scope/category: preventive; repository documentation only. No app features, branding, configuration, database or dependencies are changed.
- Preserve: existing pharmacy rules, branch isolation, user authorisation and lightweight delivery. Unconfirmed source proposals do not override accepted product requirements.
- Implementation: implemented in this documentation change; find its exact commit with `git log --all --grep=SCM-2026-10-20-01`.
- Technical verification: passed focused documentation review and `git diff --check`; validated 46 relative links across the integrated documents and byte-for-byte identity of the retained source guide. Recorded source SHA-256 identifiers and reviewed course-summary page references. No application build, runtime test or recovery exercise was run for this documentation-only change.
- Release: repository documentation; no application release or migration is required. Record actual push/deployment results in the completion report; a Git-triggered hosting build does not imply new runtime behaviour.
- Owner acceptance: incorporation of the process was explicitly requested; the final document wording has not yet been reviewed by the owner.
- Recovery: documentation can be reverted through Git without data restoration. No recovery rehearsal was performed.
- Next action: use the matrix for the next relevant change; schedule integrity/recovery work explicitly rather than claim it is already complete.

## Compact Template For Future Material Changes

- ID/date / request / owner:
- User outcome and acceptance criteria:
- Category / affected components, records and dependencies:
- Existing behaviour to preserve / risk:
- Implementation state and code/document links:
- Technical verification state, dated checks and evidence / limitations:
- Release state, commit, environment/deployment, schema/configuration changes:
- Recovery action and rehearsal status:
- Owner acceptance: not yet reviewed / accepted / revisions requested:
- Remaining gaps / next action or review:
