# 15 Accessibility + mobile pass

Status: ready-for-agent
Type: task

## Why
The landing page and dashboard were built for a 1280-wide demo. Prospects will
open the shared deep links on phones, and public-sector buyers check
accessibility.

## Scope
- Run axe-core via the existing playwright-core setup (a script, not a runtime
  dep) on `index.html` and `radar.html`. Fix the serious and critical issues:
  contrast, labels on icon buttons, focus order, keyboard access to the lead
  list and popups, `prefers-reduced-motion` for the constellation animation.
- Mobile (≤ 480 px): the lead list becomes a bottom sheet over the map, the
  filters scroll horizontally, and the popups fit the viewport.
- `scripts/a11y.mjs` (`npm run a11y`) reports violations. Optionally run it in CI
  against the static build.

## Acceptance
- There are zero serious/critical axe violations on both pages.
- Before/after screenshots at 390×844 and 1280×760 are attached to the PR.
- The demo video script still runs (`npm run video`).
