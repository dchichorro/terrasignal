# 07 Deploy artifacts for the live API

Status: ready-for-agent
Type: task
Blocked by: 06

## Why
The live API currently runs as a background process on the devbox. It doesn't
survive a reboot and has no monitoring. Choosing and paying for a host is a
human decision (spec.md). This ticket prepares everything so that a deploy is
one command once that's decided.

## Scope
- `deploy/terrasignal.service`: a systemd unit (dedicated user,
  `Restart=on-failure`, `TERRASIGNAL_CACHE_DIR=/var/cache/terrasignal`,
  `HOST`/`PORT` env, hardening: `ProtectSystem=strict`, `NoNewPrivileges`).
- `Dockerfile` (node:22-slim, non-root, `HEALTHCHECK` on `/api/health`) and
  `.dockerignore`.
- `deploy/README.md` covers three paths: devbox systemd (works today), any VPS
  via Docker, and Fly.io (`fly.toml` with a volume for the cache).
- A GitHub Actions `uptime.yml` (every 15 min, `workflow_dispatch`) that curls
  `$LIVE_API_URL/api/health` when the repo variable is set and fails loudly
  otherwise, plus a docs note on hooking up notifications.
- Graceful shutdown in `src/server.mjs` (SIGTERM → stop accepting, finish
  in-flight requests, exit).

## Acceptance
- `docker build` and `docker run` serve `/api/health` 200 locally.
- The systemd unit installs on the devbox and survives `systemctl restart`. Don't
  enable it at boot without the user's OK.
- There is a test for the graceful-shutdown handler.
