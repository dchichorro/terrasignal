// OpenAPI 3.1 description of the TerraSignal API (served at /api/openapi.json).
const region = { name: 'region', in: 'query', schema: { type: 'string', enum: ['eu', 'global'], default: 'eu' } };
const days = { name: 'days', in: 'query', description: 'events opened within N days', schema: { type: 'integer', minimum: 1, maximum: 90, default: 45 } };
const focus = { name: 'focus', in: 'query', description: 'top-N events by demand to scan for supply', schema: { type: 'integer', minimum: 1, maximum: 60, default: 30 } };
const radarParams = [region, days, focus];

export const OPENAPI = {
  openapi: '3.1.0',
  info: {
    title: 'TerraSignal API',
    version: '0.2.0',
    description:
      'Live Earth-observation demand vs free Copernicus supply. Every event carries demand, free supply ' +
      '(Sentinel-2 optical + Sentinel-1 SAR), a classification, a recommended product and an indicative deal value ' +
      '(illustrative price book).',
  },
  paths: {
    '/api/radar': { get: { summary: 'Scored demand events and KPIs', parameters: radarParams, responses: { 200: { description: 'radar' } } } },
    '/api/aoi': {
      get: {
        summary: 'Score a custom area of interest',
        parameters: [
          { name: 'lat', in: 'query', required: true, schema: { type: 'number', minimum: -90, maximum: 90 } },
          { name: 'lng', in: 'query', required: true, schema: { type: 'number', minimum: -180, maximum: 180 } },
          { name: 'radiusKm', in: 'query', schema: { type: 'number', minimum: 1, maximum: 100, default: 10 } },
          { name: 'days', in: 'query', schema: { type: 'integer', minimum: 7, maximum: 90, default: 45 } },
        ],
        responses: { 200: { description: 'scored AOI lead' }, 400: { description: 'invalid input' } },
      },
    },
    '/api/leads.csv': { get: { summary: 'Leads as CSV (CRM import)', parameters: radarParams, responses: { 200: { description: 'text/csv' } } } },
    '/api/leads.geojson': { get: { summary: 'Leads as GeoJSON (GIS)', parameters: radarParams, responses: { 200: { description: 'application/geo+json' } } } },
    '/feed.xml': { get: { summary: 'Atom feed of tasking leads (Slack/Teams/RSS)', parameters: radarParams, responses: { 200: { description: 'application/atom+xml' } } } },
    '/api/health': { get: { summary: 'Liveness', responses: { 200: { description: 'ok' } } } },
  },
};
