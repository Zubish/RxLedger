# Responsive and Mobile UX

Use this skill when debugging mobile layout, side panels, scroll behavior, or responsive cards.

## Mobile First Checks

Always check at least:

- 390px width mobile.
- Desktop with sidebar open.
- Desktop with sidebar collapsed if the app supports it.
- Any page with long lists, tables, modals, or fixed panels.

## Scroll Rules

- Prefer natural page scroll on mobile.
- Use internal scroll only for dense repeated lists, tables, chat, modal lists, and cart line items.
- Fixed sidebars must remain full-height and must not detach during page scroll.
- Avoid nested scroll areas unless each scroll surface has a clear purpose.
- Horizontal overflow should be contained inside table wrappers, not the whole page.

## Navigation Rules

- Mobile drawers should close after navigation only on mobile.
- Desktop sidebars should not auto-collapse after clicking a menu item.
- Users must always have a visible way to leave the current screen.
- Branch, workspace, or context switchers should remain reachable without hunting.

## Touch Layout Rules

- Buttons need enough height for tapping.
- Inputs should not be cramped into multi-column grids on narrow screens.
- Avoid putting important controls below long scroll traps.
- Keep modal actions visible and obvious.

## Verification Techniques

- Measure `document.documentElement.scrollWidth > window.innerWidth`.
- Check card and button bounding boxes after expanding/collapsing.
- Verify open and closed states, not only the initial render.
- Screenshot both desktop and mobile when visual design changes matter.

## Common Failure Patterns

- CTA pushed to the bottom with `margin-top: auto`, leaving strange gaps.
- Sidebar positioned outside the correct grid column after collapse.
- Table or input width forcing page-level horizontal scroll.
- Internal max-height on mobile hiding content that should read naturally.
- Menu closes once and leaves the user stranded.
