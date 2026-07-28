#!/usr/bin/env node
/**
 * Pre-bakes a POI dataset for FRAME.
 *
 * The app normally loads landmarks live around the player's real position. This
 * script produces the offline sample it falls back to when location is denied
 * or the network is unreachable, and it is the shape the production ingest
 * takes: run once per area, store the result, never make players wait on it.
 *
 * Every placement rule lives in mobile/src/data/poiRules.ts and is imported
 * here rather than duplicated, so the offline set and the live set can never
 * disagree about what counts as a valid location.
 *
 * PRD 6.1 prefers Overture Maps bulk data over OSM for production: the ODbL
 * share-alike terms have real implications for derived geodata you publish, and
 * the Overpass usage policy does not cover production traffic. Swapping the
 * source means changing only the fetch below.
 *
 * Usage:
 *   node scripts/ingest-pois.mjs --lat 47.6097 --lon -122.3331 --radius 1000
 */

import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import {
  OVERPASS_URL,
  OVERPASS_UA,
  buildQuery,
  processElements,
} from '../mobile/src/data/poiRules.ts';

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : fallback;
};

const LAT = parseFloat(arg('lat', '47.6097'));
const LON = parseFloat(arg('lon', '-122.3331'));
const RADIUS = parseInt(arg('radius', '1000'), 10);
const OUT = arg('out', 'mobile/src/data/world.json');
const LABEL = arg('label', 'Downtown Seattle');

async function main() {
  console.log(`Querying Overpass around ${LAT},${LON} r=${RADIUS}m ...`);
  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: {
      'User-Agent': OVERPASS_UA,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ data: buildQuery(LAT, LON, RADIUS) }),
  });
  if (!res.ok) throw new Error(`Overpass ${res.status}: ${await res.text()}`);
  const data = await res.json();
  console.log(`  ${data.elements.length} raw elements`);

  const processed = processElements(data.elements, LAT, LON, RADIUS);
  const out = {
    generatedAt: new Date().toISOString(),
    source: 'OpenStreetMap via Overpass API, ODbL',
    label: LABEL,
    ...processed,
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(out));

  const byType = out.pois.reduce((a, p) => ({ ...a, [p.type]: (a[p.type] ?? 0) + 1 }), {});
  console.log(`\nWrote ${OUT}`);
  console.log(`  ${out.pois.length} POIs`, byType);
  console.log(`  ${out.counts.rejectedByBuffer} rejected by the 25 m exclusion buffer`);
  console.log(`  ${out.streets.length} street segments`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
