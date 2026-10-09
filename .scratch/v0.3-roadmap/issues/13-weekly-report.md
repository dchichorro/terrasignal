# 13 Weekly EO demand report generator

Status: ready-for-agent
Type: task
Blocked by: 01

## Why
A weekly "where free Copernicus data fell short" post is cheap content that
builds credibility with the ICP. Publishing it is a human job; generating it
shouldn't be.

## Scope
- `scripts/weekly-report.mjs` reads `history/` for the last ISO week and writes
  `reports/YYYY-Www.md` and a self-contained `reports/YYYY-Www.html`.
- Contents:
  - the top 10 opportunities, each with its class transitions
  - how many gaps closed by free data, and the median time to close
  - VHR-gap share by hazard
  - new CEMS activations
  - a one-paragraph summary written from a template (no LLM call)
- Charts are inline SVG generated in code: the top-opportunity bar chart, and
  coverage-gap vs VHR-gap by hazard.
- An optional GitHub Actions `weekly-report.yml` (Mondays) that commits the
  report, and links it on the landing page as "Latest report".

## Acceptance
- A test runs on a fixture history week and snapshots the key numbers.
- The HTML opens offline (no external assets).
