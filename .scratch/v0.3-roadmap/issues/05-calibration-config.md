# 05 Calibration config outside code

Status: ready-for-agent
Type: task

## Why
`PRICEBOOK`, `DEFAULT_RADIUS_KM` (`src/core/value.mjs`) and `CATEGORY_WEIGHT`,
`SAR_UTILITY`, `VHR_NEED` (`src/core/score.mjs`) are illustrative heuristics.
Calibrating them with a reseller (see spec.md) shouldn't mean editing code.
Customer-specific price books are also a Pro-plan feature.

## Scope
- `config/calibration.default.json` holds the current values. Code constants are
  derived from it, or stay as the fallback, with identical behaviour by default.
- `src/core/calibration.mjs` (isomorphic): `validateCalibration(obj)` (schema
  check, ranges 0..1 for the shares, positive prices) and
  `mergeCalibration(defaults, partial)`.
- Thread a `calibration` object through `scoreEvent`, `recommend`, `toLead` and
  `buildRadar`, using the existing options-object pattern.
- Server: `TERRASIGNAL_CALIBRATION=/path.json` overrides it. A bad file fails at
  startup with a clear message.
- Dashboard: the ⓘ model panel shows which calibration is active (name + version
  field from the file).

## Acceptance
- The whole existing test suite passes unchanged with the defaults.
- New tests cover validation and merge, plus one test where a custom
  calibration changes a lead's recommendation/deal value.
- `CONTEXT.md` and the README "Honest limitations" point to the config file.
