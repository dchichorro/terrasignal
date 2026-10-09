#!/usr/bin/env node
import { createServer } from 'node:http';
import { buildRadar, buildAoi, REGIONS } from './radar.mjs';
import { createHandler } from './app.mjs';

const PORT = Number(process.env.PORT ?? 4660);
const HOST = process.env.HOST ?? '0.0.0.0'; // reachable from the LAN / Tailscale; HOST=127.0.0.1 for local-only
const server = createServer(createHandler({ buildRadar, buildAoi, regions: REGIONS }));

server.listen(PORT, HOST, async () => {
  console.log(`TerraSignal radar on http://${HOST}:${PORT}`);
  if (process.env.TERRASIGNAL_NO_WARM) return;
  for (const region of ['global', 'eu']) {
    try {
      await buildRadar({ region, days: 45, focus: 30 });
      console.log(`cache warm: ${region}`);
    } catch {
      /* next request will retry live */
    }
  }
});
