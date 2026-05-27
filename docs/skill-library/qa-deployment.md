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

A change is not complete until:

- The code or docs are committed.
- Verification results are known.
- Any limitation is stated plainly.
- Deployment is confirmed when production is affected.
