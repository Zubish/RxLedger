# RxLedger Skills Library

This library captures reusable skills learned while building RxLedger. Use it before starting major work on RxLedger or any new product in another industry.

The goal is not to copy RxLedger's pharmacy UI everywhere. The goal is to reuse the thinking: workflow-first product design, careful data handling, responsive interfaces, conservative engineering, and disciplined verification.

## How To Use This Library

1. Read the relevant skill modules before planning a change.
2. Translate the skill to the target industry instead of copying pharmacy-specific terms.
3. Keep domain logic, UI layout, data retention, and verification in the same conversation.
4. After implementation, update the relevant skill if a better pattern was discovered.

## Core Skills

| Skill                    | When To Use                                                  | Reference                                                              |
| ------------------------ | ------------------------------------------------------------ | ---------------------------------------------------------------------- |
| Product workflow design  | Turning real operational work into app flows                 | [product-workflow-design.md](skill-library/product-workflow-design.md) |
| UI and visual design     | Layout, hierarchy, density, brand, image use, readability    | [ui-ux-design.md](skill-library/ui-ux-design.md)                       |
| Responsive and mobile UX | Mobile menus, scroll behavior, touch layout, overflow checks | [responsive-mobile-ux.md](skill-library/responsive-mobile-ux.md)       |
| Frontend engineering     | React, state, component behavior, scoped changes             | [frontend-engineering.md](skill-library/frontend-engineering.md)       |
| Data and business rules  | Plan changes, retention, drafts, audit, permissions          | [data-business-rules.md](skill-library/data-business-rules.md)         |
| QA and deployment        | Build, lint, browser checks, GitHub, Vercel                  | [qa-deployment.md](skill-library/qa-deployment.md)                     |
| Industry adaptation      | Moving from pharmacy to other business domains               | [industry-adaptation.md](skill-library/industry-adaptation.md)         |
| AI collaboration         | How to work with an AI coding agent productively             | [ai-collaboration.md](skill-library/ai-collaboration.md)               |

## Universal Product Principles

- Start from the user's job, not from a feature list.
- Treat each page as a work surface with a primary task.
- Preserve user data unless the user explicitly deletes it.
- Make destructive actions narrow and named.
- Use plan or permission limits to control access, not to erase history.
- Prefer practical automation before AI generation.
- Build for the smallest important screen early, not at the end.
- Verify live behavior, not only code shape.
- Keep brand expression useful: imagery and color should support trust, clarity, and task focus.
- Document product rules as soon as they become stable.

## Cross-Industry Translation

When moving to a new industry, map RxLedger concepts like this:

| RxLedger Concept  | Generic Pattern                  | Example In Another Industry                                    |
| ----------------- | -------------------------------- | -------------------------------------------------------------- |
| Branch            | Operating site or team workspace | Restaurant outlet, clinic, warehouse, school campus            |
| Medicine batch    | Trackable inventory unit         | Food lot, spare part batch, lab reagent, fashion stock batch   |
| Expiry/FEFO       | Time-sensitive allocation rule   | Food freshness, warranty expiration, service SLA               |
| POS draft         | Temporary active transaction     | Restaurant order, clinic intake, repair estimate               |
| Patient history   | Customer continuity record       | Client purchase history, student profile, case file            |
| Refill reminder   | Scheduled follow-up              | Subscription renewal, maintenance reminder, appointment recall |
| Audit log         | Operational accountability       | Compliance trail, supervisor review, financial record          |
| Role access       | Permission boundary              | Owner, manager, cashier, technician, auditor                   |
| Subscription plan | Commercial boundary              | Basic, growth, enterprise SaaS tiers                           |

## Pre-Implementation Checklist

- What is the user's real-world workflow?
- What data must never be lost?
- What is the smallest useful version of this feature?
- Which screen owns the action?
- What happens on mobile?
- What happens when a user switches context, branch, plan, or role?
- What should be preserved, archived, or blocked?
- How will we verify success locally and in production?

## Maintenance Rule

If a future project teaches a better pattern, update the specific module and keep this index stable. The library should stay portable across industries and concise enough to read before real work starts.
