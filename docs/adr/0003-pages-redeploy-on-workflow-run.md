# 3. Redeploy Pages after each data run (workflow_run)

Date: 2026-10-07 · Status: accepted

## Context
`radar-data.yml` commits hourly snapshots with `GITHUB_TOKEN`. GitHub doesn't start
workflows for events created by `GITHUB_TOKEN`, so `pages.yml` (on `push`) never ran after
bot commits. The last Pages deploy was 2026-09-20 and the public site had been frozen
since then, even though data commits kept landing.

## Decision
`pages.yml` also triggers on `workflow_run` of `radar-data` (completed + success), checks
out `main` explicitly (to get the fresh data commit, not the triggering SHA) and runs
`build-static --assets-only` before upload.

## Consequences
- The site refreshes within minutes of each data commit.
- A deploy also runs when radar-data found no material change. That's cheap (≈20 s) and idempotent.
