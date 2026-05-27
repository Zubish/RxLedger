# Frontend Engineering

Use this skill when changing React components, state, layout behavior, or frontend data flow.

## Engineering Posture

- Read the existing code before inventing a new pattern.
- Keep edits scoped to the owning component and nearby styles.
- Use existing helpers, data models, and design vocabulary.
- Add abstractions only when they remove real complexity or match an existing pattern.
- Keep behavior deterministic when possible.

## React Patterns

- Keep state close to the component that owns the interaction.
- Use typed IDs and shared plan/config modules when multiple surfaces need the same business rules.
- Avoid duplicated rule definitions between landing pages, settings pages, and APIs.
- For expandable lists, store state by stable item id.
- For derived metrics, use memoization when input arrays are non-trivial.

## CSS and Layout Patterns

- Prefer stable dimensions for fixed-format UI: grids, cards, boards, toolbars, counters.
- Use responsive grid changes instead of squeezing desktop columns onto mobile.
- Avoid CSS that makes dynamic content resize unrelated layout areas.
- Use class names with product meaning when the styling is part of the brand or section identity.

## Data and UI Relationship

- The UI should represent business rules faithfully.
- If a rule affects saving or billing, enforce it on the API as well as the UI.
- A landing page can explain a rule, but it is not enforcement.
- Settings screens should reflect the same source of truth as marketing/pricing.

## Safe Editing Workflow

- Inspect relevant files with `rg` and focused reads.
- Patch only the files needed.
- Run build and lint after code changes.
- Use browser checks for visual or responsive changes.
- Preserve unrelated user changes.

## Common Patterns From RxLedger

- Shared subscription plan definitions in one module.
- API-side downgrade blockers matching UI-side plan blockers.
- Patient profiles derived from sales history before adding a separate CRM table.
- POS draft behavior separated from active cart clearing.
- Branch-aware filtering carried through dashboard, reports, and notifications.
