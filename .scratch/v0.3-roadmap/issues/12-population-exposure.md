# 12 Population exposure in demand

Status: ready-for-agent
Type: task

## Why
Offshore quakes and empty-desert events rank alongside urban ones. GDACS
publishes population exposure (e.g. population in the MMI/wind/flood zones) in
its event details, and USGS PAGER has exposure estimates.

## Scope
- GDACS source: extract the population exposure when present (inspect the live
  payload and the per-event `geteventdata` if needed, and document the fields
  used). USGS: the PAGER exposure where present.
- `demandScore`: an exposure multiplier, e.g. `clamp(0.6 + 0.1·log10(pop+1), 0.6, 1.25)`
  when exposure is known, and neutral (1.0) when it's unknown. It is a named,
  calibratable constant (ticket 05 can pick it up).
- Leads show `exposure` in the popup, the brief, and the CSV.

## Acceptance
- Tests: an offshore M6.5 with population ~0 ranks below an onshore M6.0 with
  1 M exposed; unknown exposure leaves the score unchanged.
- The ⓘ model panel and `CONTEXT.md` describe the multiplier.
