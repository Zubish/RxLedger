# AI Collaboration

Use this skill when working with an AI coding agent on product or engineering tasks.

## Strong Collaboration Pattern

- Give the business goal and the user pain.
- Let the agent inspect the codebase before choosing implementation details.
- Ask for verification, not just code.
- Ask for mobile and desktop checks when UI is involved.
- Keep corrections concrete: name the page, state, screenshot, and expected behavior.

## Good Requests

- "Check the mobile POS layout and fix the drawer so users can leave the screen."
- "Make this pricing logic real in the app, not just on the landing page."
- "Do a final sweep for similar sidebar scroll errors."
- "Preserve draft carts when clearing the active POS cart."

## Product Feedback Pattern

When something feels off, describe:

- What page or section.
- What state: open, closed, scrolled, mobile, desktop.
- What action caused it.
- What should remain available.
- What data must not be lost.

## Agent Verification Expectations

For UI:

- Build and lint.
- Browser check at mobile and desktop sizes.
- Screenshot or measured layout when useful.
- Production verification after deploy.

For data:

- Explain data retention.
- Add frontend and backend guards when needed.
- Confirm destructive actions are narrow.

## Documentation Loop

When a decision becomes stable, add it to:

- `docs/APP_BLUEPRINT.md` for RxLedger-specific rules.
- `docs/SKILL_LIBRARY.md` or its modules for reusable lessons.

This prevents the same issue from being rediscovered in future work.

## RxLedger Maintenance Agreement

Apply [Maintenance And AI Collaboration](../MAINTENANCE_AND_COLLABORATION.md) and the [requirements/check map](../REQUIREMENTS_VERIFICATION.md). User corrections are requirements evidence, not proof that earlier passing tests established acceptance. Record owner acceptance only for the specific result they reviewed.

Inspect before editing, distinguish verified facts from hypotheses, trace impacted records and permissions, and report the actual verification and release state. Honour discussion-only instructions and existing authorisation; do not add repeated permission questions for routine authorised work. Keep authoritative decisions in the blueprint and material change evidence in [the change record](../CHANGE_RECORD.md), not only chat history.
