// Demand-feed registry. A source is a module exporting
//   id, label, fetchEvents({ bbox, days }) → unified events
// Add a feed by writing one module and listing it here.
import * as gdacs from './gdacs.mjs';
import * as eonet from './eonet.mjs';
import * as usgs from './usgs.mjs';
import * as cems from './cems.mjs';

export const SOURCES = [cems, gdacs, usgs, eonet];
