# 03 Lead status tracking

Status: ready-for-agent
Type: task

## Why
The radar shows leads, but a sales user can't record what they did with one. A
per-lead status turns the radar into a working pipeline, and it produces the
conversion data the product brief's metrics need.

## Scope
- In the dashboard (`public/js/app.mjs`), add a status control per lead: `new`
  (default), `contacted`, `quoted`, `won`, `lost`, `ignored`, with an optional
  note and an optional value (€). It is stored in `localStorage` under a
  versioned key, keyed by lead id.
- A filter chip for "my pipeline" (anything not `new`/`ignored`), plus a status
  column in the CSV export (`src/core/export.mjs`: an optional `statuses` map
  argument, so the server export stays unchanged).
- Export/import of statuses as JSON, so a user can move between browsers.
- KPI strip: "won € / quoted €" next to the modelled pipeline.

## Acceptance
- Statuses survive a reload and deep links.
- Old snapshots, and leads that disappear, don't crash anything (orphaned
  statuses are kept but hidden).
- There are unit tests for the export with statuses.
- Manually verified in a browser (screenshot in the PR).

## Out of scope
Server-side storage and accounts (see "Accounts and the paid tier" in spec.md).
