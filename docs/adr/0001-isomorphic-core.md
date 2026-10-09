# 1. One isomorphic scoring core for server, browser and CI

Date: 2026-10-07 · Status: accepted

## Context
The static GitHub Pages site could only show precomputed snapshots, and the custom-AOI
pin needed the Node server (`/api/aoi`). The scoring model lived in Node-only modules,
so a browser fallback would have meant a second copy of the model.

## Decision
Everything pure (scoring, value, merge, export, AOI, STAC client) lives in `src/core/`
with no Node imports, and only sibling imports. A test enforces this. The server serves it at `/core/`.
The Pages deploy copies it to `public/core/` (`npm run build:assets`, gitignored).
The browser imports the same modules. Node-only concerns (disk cache, feeds that lack
CORS, HTTP) stay in `src/lib`, `src/sources` and `src/app.mjs`.

## Consequences
- AOI scoring works on the static site: the browser queries the CORS-open Element 84 STAC directly.
- Exports (CSV/GeoJSON/brief) are generated client-side, and the format is identical to the API's.
- Old snapshots without lead fields are upgraded client-side via `toLead`.
- `src/core` must stay dependency-free. New core code can't use `node:` modules.
