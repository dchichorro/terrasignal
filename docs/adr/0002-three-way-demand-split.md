# 2. Split demand into coverage gap, VHR gap and serviceable

Date: 2026-10-07 · Status: accepted (supersedes the two-way gap/serviceable split)

## Context
v0.1 scored `opportunity = D·(1−S)` and `serviceable = D·S`. Once Sentinel-1 radar was added
to supply, almost every European event became "Copernicus-ready", which reads as "no market".
That's wrong: fresh 10 m free data can't grade building damage, count debris or map access
routes. That sub-metre need is why CEMS and insurers buy commercial VHR at all.

## Decision
Introduce a per-hazard VHR share `v` (`VHR_NEED`) and split demand three ways:
coverage gap `D(1−S)`, VHR gap `D·S·v`, serviceable `D·S(1−v)`. `opportunity` is the sum
of the first two. Classification stays on coverage `S`, so its meaning doesn't change.
Covered high-`v` hazards (earthquake, tsunami, storm, landslide) get a *VHR damage
assessment* recommendation.

## Consequences
- The three parts still sum to demand (unit-tested ±2 for rounding).
- `VHR_NEED`, like `SAR_UTILITY` and the priors, is a heuristic to calibrate against real orders.
- The UI meter has three colours: red (coverage), pink (VHR) and green (serviceable).
