# Data and Business Rules

Use this skill when changing persistence, plan logic, drafts, permissions, audit records, or user data handling.

## Data Retention Principle

Changing plans, roles, or workflow state must not silently delete user history.

Preserve:

- Stock.
- Sales.
- Patient/customer history.
- Branch/site history.
- Audit logs.
- Security events.
- Reports and ledger records.

If a lower plan cannot support current usage, block the change until extra usage is archived, exported, or made inactive.

## Plan Change Pattern

- Upgrade: immediate when payment/commercial status allows it.
- Downgrade: allowed only when active usage fits the target plan.
- Trial: data persists after trial.
- Enforcement belongs in both UI and API.
- History stays available even if future write access is limited.

## Draft and Temporary State Pattern

Use drafts for interrupted work:

- Save temporary work with an expiry.
- Clear the active workspace after saving a draft if it reduces cognitive load.
- Clear buttons should clear only active unsaved work.
- Deleting saved drafts should be a separate explicit action.

## Permissions Pattern

- Use role and context together.
- A global admin can manage the account.
- Branch managers manage only their assigned branch.
- View-only users should see reports and alerts without write actions.
- Permission changes should be audited.

## Audit Pattern

Audit important actions:

- Create/update/delete critical records.
- Stock movement.
- Sale completion.
- Settings changes.
- User access changes.
- Security actions.

Audit records should explain who acted, what changed, and which entity was affected.

## Validation Pattern

- Validate required fields on both frontend and backend.
- Block impossible stock actions server-side.
- Block unsafe role or plan changes server-side.
- Keep user-facing errors specific enough to fix the problem.
