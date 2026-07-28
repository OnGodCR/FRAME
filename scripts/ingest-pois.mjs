#!/usr/bin/env node
/**
 * POI ingestion for FRAME.
 *
 * Pulls real landmarks and street geometry from OpenStreetMap via the Overpass
 * API, applies the placement restrictions in PRD 6.1, and writes a dataset the
 * app renders directly.
 *
 * This is the real filter pipeline, not a demo stub. The only thing that
 * changes for production is the source: PRD 6.1 prefers Overture Maps bulk
 * data (permissive licence) over OSM, whose ODbL share-alike terms have real
 * implications for any derived geodata you publish. Overpass is the right tool
 * for a few hundred POIs in one city; it is not the right tool at scale, and
 * its usage policy would not tolerate it.
 *
 * Usage:
 *   node scripts/ingest-pois.mjs --lat 47.6097 --lon -122.3331 --radius 1000
 *   node scripts/ingest-pois.mjs --lat ... --lon ... --out mobile/src/data/world.json
 */

import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

const OVERPASS = 'https://overpass-api.de/api/interpreter';
const UA = 'FRAME/0.1 (hide-and-seek game; POI ingest; contact: dev@frame.game)';

// --- args -------------------------------------------------------------------

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

// --- PRD 6.1 category rules -------------------------------------------------

/** Publicly accessible categories POIs may be placed on. */
const ALLOWED = [
  ['leisure', 'park'],
  ['leisure', 'garden'],
  ['place', 'square'],
  ['amenity', 'library'],
  ['amenity', 'fountain'],
  ['amenity', 'marketplace'],
  ['amenity', 'cafe'],
  ['amenity', 'restaurant'],
  ['tourism', 'museum'],
  ['tourism', 'gallery'],
  ['tourism', 'artwork'],
  ['tourism', 'attraction'],
  ['tourism', 'viewpoint'],
  ['historic', 'monument'],
  ['historic', 'memorial'],
  ['railway', 'station'],
  ['public_transport', 'station'],
  ['amenity', 'bus_station'],
  ['shop', '*'],
];

/**
 * Hard exclusions. Nothing may be placed on these or within 25 m of them.
 *
 * Playgrounds are excluded even though PRD 6.1 does not name them. This is a
 * 13+ game that physically routes players to coordinates; sending them to
 * where small children play is the same category of mistake as the school
 * exclusion, so it gets the same treatment.
 */
const EXCLUDED = [
  ['amenity', 'school'],
  ['amenity', 'kindergarten'],
  ['amenity', 'college'],
  ['amenity', 'university'],
  ['amenity', 'hospital'],
  ['amenity', 'clinic'],
  ['amenity', 'doctors'],
  ['amenity', 'pharmacy'],
  ['amenity', 'place_of_worship'],
  ['amenity', 'police'],
  ['amenity', 'fire_station'],
  ['amenity', 'courthouse'],
  ['amenity', 'prison'],
  ['amenity', 'bar'],
  ['amenity', 'pub'],
  ['amenity', 'nightclub'],
  ['amenity', 'casino'],
  ['amenity', 'stripclub'],
  ['amenity', 'grave_yard'],
  ['amenity', 'funeral_hall'],
  ['shop', 'alcohol'],
  ['shop', 'cannabis'],
  ['shop', 'funeral_directors'],
  ['shop', 'erotic'],
  ['leisure', 'playground'],
  ['landuse', 'cemetery'],
  ['landuse', 'military'],
  ['landuse', 'residential'],
  ['landuse', 'farmland'],
  ['landuse', 'construction'],
  ['aeroway', '*'],
  ['military', '*'],
  ['office', 'government'],
  ['building', 'apartments'],
  ['building', 'residential'],
  ['building', 'house'],
];

const EXCLUSION_BUFFER_M = 25;

// --- overpass ---------------------------------------------------------------

function clause(list, kind) {
  return list
    .map(([k, v]) =>
      v === '*' ? `${kind}["${k}"](around:${RADIUS},${LAT},${LON});`
                : `${kind}["${k}"="${v}"](around:${RADIUS},${LAT},${LON});`,
    )
    .join('\n    ');
}

const QUERY = `
[out:json][timeout:90];
(
  ${clause(ALLOWED, 'node')}
  ${clause(ALLOWED, 'way')}
);
out center tags;
(
  ${clause(EXCLUDED, 'node')}
  ${clause(EXCLUDED, 'way')}
);
out center tags;
way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified|pedestrian|living_street|footway)$"](around:${RADIUS},${LAT},${LON});
out geom;
`;

async function overpass(query) {
  const res = await fetch(OVERPASS, {
    method: 'POST',
    headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ data: query }),
  });
  if (!res.ok) throw new Error(`Overpass ${res.status}: ${await res.text()}`);
  return res.json();
}

// --- geo helpers ------------------------------------------------------------

const R_EARTH = 6371000;
const toRad = (d) => (d * Math.PI) / 180;

function metersBetween(aLat, aLon, bLat, bLon) {
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon) * Math.cos(toRad((aLat + bLat) / 2));
  return Math.hypot(dLat, dLon) * R_EARTH;
}

/** Normalize to 0..1 map space where the zone circle is inscribed. */
function project(lat, lon) {
  const dx = toRad(lon - LON) * Math.cos(toRad(LAT)) * R_EARTH;
  const dy = toRad(LAT - lat) * R_EARTH;
  return { x: 0.5 + dx / (2 * RADIUS), y: 0.5 + dy / (2 * RADIUS) };
}

// --- classification ---------------------------------------------------------

function matches(tags, list) {
  return list.some(([k, v]) => tags[k] !== undefined && (v === '*' || tags[k] === v));
}

/**
 * PRD 6.2 POI types. Assignment is deterministic by category so a given
 * landmark is always the same type across ingests.
 */
function poiType(tags) {
  if (
    tags.tourism === 'museum' ||
    tags.historic === 'monument' ||
    tags.historic === 'memorial' ||
    tags.railway === 'station' ||
    tags.public_transport === 'station'
  ) {
    return 'beacon';
  }
  if (
    tags.amenity === 'library' ||
    tags.amenity === 'fountain' ||
    tags.place === 'square' ||
    tags.leisure === 'park'
  ) {
    return 'waystation';
  }
  return 'cache';
}

function categoryOf(tags) {
  if (tags.leisure === 'park' || tags.leisure === 'garden') return 'park';
  if (tags.place === 'square') return 'plaza';
  if (tags.amenity === 'library') return 'library';
  if (tags.amenity === 'fountain') return 'fountain';
  if (tags.tourism === 'museum' || tags.tourism === 'gallery') return 'museum';
  if (tags.historic) return 'monument';
  if (tags.railway === 'station' || tags.public_transport === 'station') return 'transit';
  if (tags.amenity === 'bus_station') return 'transit';
  if (tags.tourism) return 'landmark';
  if (tags.shop || tags.amenity) return 'retail';
  return 'other';
}

// --- main -------------------------------------------------------------------

async function main() {
  console.log(`Querying Overpass around ${LAT},${LON} r=${RADIUS}m ...`);
  const data = await overpass(QUERY);
  console.log(`  ${data.elements.length} raw elements`);

  const coordsOf = (el) =>
    el.type === 'node' ? { lat: el.lat, lon: el.lon } : el.center ?? null;

  const streets = [];
  const candidates = [];
  const exclusions = [];

  for (const el of data.elements) {
    const tags = el.tags ?? {};

    if (tags.highway && el.geometry) {
      const major = /^(motorway|trunk|primary|secondary)$/.test(tags.highway);
      const foot = /^(footway|pedestrian|living_street)$/.test(tags.highway);
      // Footpaths are dense and add nothing at this zoom; skip them and keep
      // the road network legible.
      if (foot) continue;
      const pts = el.geometry
        .map(({ lat, lon }) => {
          const { x, y } = project(lat, lon);
          return [+x.toFixed(4), +y.toFixed(4)];
        })
        .filter((p, i, a) => i === 0 || i === a.length - 1 || i % 2 === 0);
      if (pts.length >= 2) streets.push({ c: major ? 1 : 0, p: pts });
      continue;
    }

    const c = coordsOf(el);
    if (!c) continue;

    if (matches(tags, EXCLUDED)) {
      exclusions.push({ ...c, why: Object.entries(tags).find(([k, v]) => matches({ [k]: v }, EXCLUDED))?.join('=') });
      continue;
    }
    if (matches(tags, ALLOWED) && tags.name) {
      candidates.push({ ...c, tags });
    }
  }

  console.log(`  ${candidates.length} named candidates, ${exclusions.length} exclusion features, ${streets.length} street segments`);

  // Apply the 25 m exclusion buffer.
  const kept = [];
  let buffered = 0;
  for (const cand of candidates) {
    const tooClose = exclusions.some(
      (ex) => metersBetween(cand.lat, cand.lon, ex.lat, ex.lon) < EXCLUSION_BUFFER_M,
    );
    if (tooClose) {
      buffered++;
      continue;
    }
    kept.push(cand);
  }
  console.log(`  ${buffered} rejected by the ${EXCLUSION_BUFFER_M} m exclusion buffer`);

  // Deduplicate by name, keep the closest to centre.
  const byName = new Map();
  for (const k of kept) {
    const d = metersBetween(LAT, LON, k.lat, k.lon);
    if (d > RADIUS) continue;
    const prev = byName.get(k.tags.name);
    if (!prev || d < prev.d) byName.set(k.tags.name, { ...k, d });
  }

  // Selecting the nearest N gives a pile of shops in one block. Take a quota
  // per POI type instead, and within each type spread the picks out greedily
  // so the map has something to walk to in every direction.
  const QUOTA = { beacon: 8, waystation: 8, cache: 16 };
  const pool = [...byName.values()];
  const picked = [];

  for (const [type, limit] of Object.entries(QUOTA)) {
    const ofType = pool.filter((p) => poiType(p.tags) === type);
    if (!ofType.length) continue;
    const chosen = [ofType.reduce((a, b) => (a.d < b.d ? a : b))];
    while (chosen.length < Math.min(limit, ofType.length)) {
      let best = null;
      let bestGap = -1;
      for (const cand of ofType) {
        if (chosen.includes(cand)) continue;
        const gap = Math.min(
          ...chosen.map((c) => metersBetween(cand.lat, cand.lon, c.lat, c.lon)),
        );
        if (gap > bestGap) {
          bestGap = gap;
          best = cand;
        }
      }
      if (!best) break;
      chosen.push(best);
    }
    picked.push(...chosen);
  }

  const pois = picked
    .sort((a, b) => a.d - b.d)
    .map((p, i) => {
      const { x, y } = project(p.lat, p.lon);
      return {
        id: `poi-${i}`,
        name: p.tags.name,
        type: poiType(p.tags),
        category: categoryOf(p.tags),
        lat: +p.lat.toFixed(6),
        lon: +p.lon.toFixed(6),
        x: +x.toFixed(4),
        y: +y.toFixed(4),
        distM: Math.round(p.d),
        hours: p.tags.opening_hours ?? null,
      };
    });

  const out = {
    generatedAt: new Date().toISOString(),
    source: 'OpenStreetMap via Overpass API, ODbL',
    label: LABEL,
    center: { lat: LAT, lon: LON },
    radiusM: RADIUS,
    counts: {
      pois: pois.length,
      rejectedByBuffer: buffered,
      exclusionFeatures: exclusions.length,
    },
    pois,
    streets: streets.sort((a, b) => b.c - a.c).slice(0, 600),
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(out));
  const byType = pois.reduce((a, p) => ({ ...a, [p.type]: (a[p.type] ?? 0) + 1 }), {});
  console.log(`\nWrote ${OUT}`);
  console.log(`  ${pois.length} POIs`, byType);
  console.log(`  ${out.streets.length} street segments`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
