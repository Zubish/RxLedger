# Product Workflow Design

Use this skill when designing a feature, page, workflow, or roadmap.

## Core Method

1. Identify the user role.
2. Identify the moment of work.
3. Identify the object being handled.
4. Identify what must happen before, during, and after the action.
5. Decide what should be automated, suggested, blocked, saved, or audited.

## Lessons From RxLedger

- Patient follow-up features made sense because they came from POS history, not from a separate CRM fantasy.
- POS drafts needed a 10-minute memory because real counters are interrupted.
- Saving a draft should clear the active cart because staff need less clutter after parking a transaction.
- Clear buttons should clear only the current work surface, not saved records.
- Refill reminders and counseling follow-ups are workflow extensions, not feature creep.
- Patient lookup has high value because it removes memory dependence and improves continuity.

## Reusable Workflow Questions

- What does the worker say or ask in real life?
- What object do they reach for first: customer, item, order, record, invoice, site, or staff member?
- What information must be visible without opening another screen?
- What information can be hidden until requested?
- What action should happen automatically after save?
- What action should require confirmation?
- What history must stay available after the immediate task is done?

## Feature Boundary Pattern

Classify a feature before building:

- Core: required to complete the daily job.
- Smart: improves speed, continuity, reminders, or coordination.
- Enterprise: multi-site scale, custom integration, SLA, advanced controls.

This prevents low plans from receiving high-cost features and keeps advanced workflows from bloating the basic product.

## Practical Automation Before AI

Prefer deterministic workflow automation first:

- Templates before generated text.
- Rules before predictions.
- Scheduled reminders before adherence scoring.
- Search and retrieval before natural language assistants.

Add AI only when the rule-based version is working and the added intelligence is clear.
