# v0.3 roadmap: from demo to validated product

Status: needs-triage

Follow-ups to the v0.2 `productize` work (branch `productize`). There are two goals:
**prove the scores mean something** (history, backtest, outcome tracking), and
**ship the first thing worth paying for** (watchlists + alerts), plus the
hardening the live API needs before it is exposed publicly.

Agent-workable items are tickets under `issues/`. Items that need a human
(conversations, accounts, money, legal or vendor decisions) are listed below and
are deliberately **not** tickets.

## Tickets

| # | Ticket | Theme | Blocked by | Human prerequisite |
|---|---|---|---|---|
| 01 | [Snapshot history store](issues/01-snapshot-history.md) | validate | — | — |
| 02 | [CEMS backtest harness](issues/02-cems-backtest.md) | validate | — | — |
| 03 | [Lead status tracking](issues/03-lead-status-tracking.md) | validate | — | — |
| 04 | [Watchlists + per-watchlist Atom feed](issues/04-watchlists-atom.md) | product | — | — |
| 05 | [Calibration config outside code](issues/05-calibration-config.md) | product | — | — |
| 06 | [API rate limiting + API keys](issues/06-api-rate-limit-keys.md) | hardening | — | — |
| 07 | [Deploy artifacts for the live API](issues/07-deploy-artifacts.md) | hardening | 06 | pick a host |
| 08 | [NASA FIRMS feed](issues/08-firms-feed.md) | demand | — | FIRMS MAP_KEY |
| 09 | [ReliefWeb feed + GLIDE dedupe](issues/09-reliefweb-feed.md) | demand | — | ReliefWeb appname |
| 10 | [EFFIS burnt-area feed](issues/10-effis-feed.md) | demand | — | — |
| 11 | [Footprint-polygon supply](issues/11-footprint-supply.md) | model | — | — |
| 12 | [Population exposure in demand](issues/12-population-exposure.md) | model | — | — |
| 13 | [Weekly EO demand report generator](issues/13-weekly-report.md) | GTM | 01 | — |
| 14 | [JSDoc types + typecheck in CI](issues/14-jsdoc-typecheck.md) | quality | — | — |
| 15 | [Accessibility + mobile pass](issues/15-a11y-mobile.md) | quality | — | — |

Suggested order: 01 → 02 (proof), 04 + 06 (first paid feature, safe API), then feeds/model.

## Human-only (documented, not ticketed)

- **Calibrate with reseller sales people.** Show the radar to 3–5 tasking/sales
  leads (Airbus, Planet, ICEYE partners...). Ask "would you have called on this
  lead, and what was it worth?" Their answers feed `PRICEBOOK`, `VHR_NEED`,
  `SAR_UTILITY` and the demand priors (via ticket 05's config file).
- **Collect RFP/tender outcomes.** Match the radar's logged leads (01, 03)
  against tenders that actually got published, to measure lead time. The tooling
  is ticketed; getting the outcome data takes a person.
- **Accounts and the paid tier.** Choose an auth/billing approach (e.g. a hosted
  auth provider + Stripe) before watchlists become server-side and multi-tenant.
  Ticket 04 stays client-side on purpose until this is decided.
- **Hosting choice + spend.** Pick a VPS / Fly.io / other for the live API and pay
  for it. Ticket 07 only produces the deploy artifacts.
- **Domain + access form.** Register a domain. Replace the GitHub-issue "Request
  access" link with a real form or mailing-list provider.
- **Data access keys.** Sign up for a NASA FIRMS MAP_KEY (08) and register a
  ReliefWeb appname (09). The tickets can be built and tested offline before then.
- **Commercial catalogue access.** Showing what competitors already captured
  needs Maxar/Planet/Airbus catalogue access and licence review.
- **CRM connectors.** HubSpot/Salesforce sync needs a design partner's instance
  and credentials. Until then, the CSV export covers it.
- **Distribution.** Publish the weekly report (13) on LinkedIn or a newsletter.
- **Funding.** Look at ESA BIC, InCubed and Copernicus Masters calls.
