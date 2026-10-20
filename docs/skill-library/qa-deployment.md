# QA and Deployment

Use this skill before declaring a change complete.

## Baseline Checks

For code changes:

```bash
npm run build
npm run lint
```

For docs-only changes, build is optional unless docs affect generated output or navigation.

## Browser Verification

Use browser checks when changing:

- Layout.
- Mobile behavior.
- Menus or side panels.
- Landing sections.
- Forms.
- POS.
- Patient workflows.
- Pricing cards.

Check:

- Page loads.
- No console-breaking behavior.
- No horizontal overflow.
- Main action is visible.
- Expanded/collapsed states work.
- Text remains readable.

## Deployment Workflow

1. Stage focused files.
2. Commit with a focused message.
3. Push `master`.
4. Confirm Vercel deployment reaches `READY`.
5. Confirm production serves the expected bundle or asset.

## Production Confirmation Patterns

- Fetch the production homepage and inspect asset bundle names.
- Fetch new public assets directly.
- For text or CSS changes, confirm the live JS or CSS bundle contains expected markers.
- For protected app flows, use local API/Vercel dev when credentials are available.

## Risk-Based Test Depth

- Small copy or docs change: inspect diff.
- Single visual section: build, lint, browser screenshot/metrics.
- Shared UI component: test desktop and mobile.
- POS/data workflow: test full happy path and destructive edge cases.
- API/business rule: test frontend guard and backend guard.

## Completion Standard

Technical delivery is not complete until:

- The code or docs are committed.
- Verification results are known.
- Any limitation is stated plainly.
- Deployment is confirmed when production is affected.

## Verification Is Not Acceptance

Follow [the maintenance process](../MAINTENANCE_AND_COLLABORATION.md). System/technical checks establish their tested scope; acceptance establishes whether the owner approves the intended outcome. A build, screenshot, mocked API flow or READY deployment each establishes different evidence. Label these honestly and keep owner acceptance separate.

For runtime releases, verify the served configuration and the affected workflow as authorised. Record backend/production access limits; bundle checks do not prove real transaction or database behaviour. For stock, pricing, access or migration changes, include relevant reconciliation and failure paths. Recovery of changed data is separate from redeploying previous code.

Link exact commits, deployments, schema/configuration implications and results in [the change record](../CHANGE_RECORD.md). Do not run an app release merely to change documentation, or claim a recovery rehearsal that was not performed. Existing Git automation may still build a documentation push; report only the resulting state actually verified.
