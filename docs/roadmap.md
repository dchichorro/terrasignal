# v0.3 roadmap: from demo to validated product

Follow-ups to the v0.2 `productize` work (PR #1). There are two goals:
**prove the scores mean something** (history, backtest, outcome tracking), and
**ship the first thing worth paying for** (watchlists + alerts), plus the
hardening the live API needs before it is exposed publicly.

Agent-workable items are GitHub issues labelled [`v0.3`](https://github.com/dchichorro/terrasignal/issues?q=label%3Av0.3) + `ready-for-agent`. Items that need a human
(conversations, accounts, money, legal or vendor decisions) are listed below and
are deliberately **not** issues.

## Issues

| Issue | Theme | Blocked by | Human prerequisite |
|---|---|---|---|
| #2 Snapshot history store | validate | — | — |
| #3 CEMS backtest harness | validate | — | — |
| #4 Lead status tracking | validate | — | — |
| #5 Watchlists + per-watchlist Atom feed | product | — | — |
| #6 Calibration config outside code | product | — | — |
| #7 API rate limiting + API keys | hardening | — | — |
| #8 Deploy artifacts for the live API | hardening | #7 | pick a host |
| #9 NASA FIRMS feed | demand | — | FIRMS MAP_KEY |
| #10 ReliefWeb feed + GLIDE dedupe | demand | — | ReliefWeb appname |
| #11 EFFIS burnt-area feed | demand | — | — |
| #12 Footprint-polygon supply | model | — | — |
| #13 Population exposure in demand | model | — | — |
| #14 Weekly EO demand report generator | GTM | #2 | — |
| #15 JSDoc types + typecheck in CI | quality | — | — |
| #16 Accessibility + mobile pass | quality | — | — |

Suggested order: #2 → #3 (proof), #5 + #7 (first paid feature, safe API), then feeds and model.

## Human-only (documented, not issues)

- **Calibrate with reseller sales people.** Show the radar to 3–5 tasking/sales
  leads (Airbus, Planet, ICEYE partners...). Ask "would you have called on this
  lead, and what was it worth?" Their answers feed `PRICEBOOK`, `VHR_NEED`,
  `SAR_UTILITY` and the demand priors (via #6's config file).
- **Collect RFP/tender outcomes.** Match the radar's logged leads (#2, #4)
  against tenders that actually got published, to measure lead time. The tooling
  has issues; getting the outcome data takes a person.
- **Accounts and the paid tier.** Choose an auth/billing approach (e.g. a hosted
  auth provider + Stripe) before watchlists become server-side and multi-tenant.
  #5 stays client-side on purpose until this is decided.
- **Hosting choice + spend.** Pick a VPS / Fly.io / other for the live API and pay
  for it. #8 only produces the deploy artifacts.
- **Domain + access form.** Register a domain. Replace the GitHub-issue "Request
  access" link with a real form or mailing-list provider.
- **Data access keys.** Sign up for a NASA FIRMS MAP_KEY (#9) and register a
  ReliefWeb appname (#10). The issues can be built and tested offline before then.
- **Commercial catalogue access.** Showing what competitors already captured
  needs Maxar/Planet/Airbus catalogue access and licence review.
- **CRM connectors.** HubSpot/Salesforce sync needs a design partner's instance
  and credentials. Until then, the CSV export covers it.
- **Distribution.** Publish the weekly report (#14) on LinkedIn or a newsletter.
- **Funding.** Look at ESA BIC, InCubed and Copernicus Masters calls.
