# 14 JSDoc types + typecheck in CI

Status: ready-for-agent
Type: task

## Why
`src/core` now runs on the server, in the browser and in CI. A shape mistake in
an event or lead breaks all three silently. Typecheck the core without
introducing a build step.

## Scope
- `src/core/types.mjs` holds JSDoc `@typedef`s for `DemandEvent`, `Scene`,
  `ScoredEvent`, `Lead`, `Recommendation`, `Pricebook` and `Feed`. Annotate the
  exported functions in `src/core/*`, `src/sources/*` and `src/radar.mjs`.
- `tsconfig.json` with `checkJs`, `noEmit`, `strict` (relax per-file only with a
  comment). `typescript` is a **devDependency** only, so the zero-runtime-deps
  promise holds.
- `npm run typecheck`, added to `ci.yml`.

## Acceptance
- `npm run typecheck` passes on CI.
- There are no runtime changes, and the tests pass unchanged.
