// The PRD 6.1 placement rules, in one place.
//
// Both consumers import this file: scripts/ingest-pois.mjs for pre-baking an
// offline dataset, and the app at runtime for wherever the player actually is.
// The filters must never drift between those two paths, which is the whole
// reason this is not duplicated.

export type PoiType = 'cache' | 'beacon' | 'waystation';

export interface Poi {
  id: string;
  name: string;
  type: PoiType;
  category: string;
  lat: number;
  lon: number;
  x: number;
  y: number;
  distM: number;
  hours: string | null;
}

export interface Street {
  c: number;
  p: number[][];
}

export interface World {
  label: string;
  center: { lat: number; lon: number };
  radiusM: number;
  pois: Poi[];
  streets: Street[];
  counts?: { pois: number; rejectedByBuffer: number; exclusionFeatures: number };
  source?: string;
  generatedAt?: string;
}

/** Publicly accessible categories a POI may be placed on. */
export const ALLOWED: [string, string][] = [
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
 * Hard exclusions. Nothing is placed on these or within 25 m of them.
 *
 * Playgrounds are excluded even though PRD 6.1 does not name them. This game
 * physically routes teenagers to coordinates; sending them where small children
 * play is the same class of mistake as the school exclusion.
 */
export const EXCLUDED: [string, string][] = [
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

export const EXCLUSION_BUFFER_M = 25;

/** How many of each type to keep, spread out across the zone. */
export const QUOTA: Record<PoiType, number> = { beacon: 8, waystation: 8, cache: 16 };

// --- geo ---------------------------------------------------------------------

const R_EARTH = 6371000;
const toRad = (d: number) => (d * Math.PI) / 180;

export function metersBetween(aLat: number, aLon: number, bLat: number, bLon: number) {
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon) * Math.cos(toRad((aLat + bLat) / 2));
  return Math.hypot(dLat, dLon) * R_EARTH;
}

/** Normalized 0..1 map space where an offset of 0.5 is the zone radius. */
export function project(
  lat: number,
  lon: number,
  cLat: number,
  cLon: number,
  radiusM: number,
) {
  const dx = toRad(lon - cLon) * Math.cos(toRad(cLat)) * R_EARTH;
  const dy = toRad(cLat - lat) * R_EARTH;
  return { x: 0.5 + dx / (2 * radiusM), y: 0.5 + dy / (2 * radiusM) };
}

// --- classification ----------------------------------------------------------

type Tags = Record<string, string>;

export function matches(tags: Tags, list: [string, string][]) {
  return list.some(([k, v]) => tags[k] !== undefined && (v === '*' || tags[k] === v));
}

/** PRD 6.2 types. Deterministic so a landmark keeps its type across ingests. */
export function poiType(tags: Tags): PoiType {
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

export function categoryOf(tags: Tags): string {
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

// --- overpass ----------------------------------------------------------------

export const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
export const OVERPASS_UA = 'Hidewire/0.1 (hide-and-seek game; POI ingest)';

export function buildQuery(lat: number, lon: number, radius: number) {
  const clause = (list: [string, string][], kind: string) =>
    list
      .map(([k, v]) =>
        v === '*'
          ? `${kind}["${k}"](around:${radius},${lat},${lon});`
          : `${kind}["${k}"="${v}"](around:${radius},${lat},${lon});`,
      )
      .join('\n    ');

  return `
[out:json][timeout:60];
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
way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified)$"](around:${radius},${lat},${lon});
out geom;
`;
}

// --- the pipeline ------------------------------------------------------------

interface OverpassEl {
  type: string;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  geometry?: { lat: number; lon: number }[];
  tags?: Tags;
}

/**
 * Turns a raw Overpass response into a filtered, balanced, projected world.
 * Every PRD 6.1 rule is applied here and nowhere else.
 */
export function processElements(
  elements: OverpassEl[],
  cLat: number,
  cLon: number,
  radiusM: number,
): Omit<World, 'label'> {
  const streets: Street[] = [];
  const candidates: { lat: number; lon: number; tags: Tags }[] = [];
  const exclusions: { lat: number; lon: number }[] = [];

  const round4 = (n: number) => Math.round(n * 1e4) / 1e4;

  for (const el of elements) {
    const tags = el.tags ?? {};

    if (tags.highway && el.geometry) {
      const major = /^(motorway|trunk|primary|secondary)$/.test(tags.highway);
      const pts = el.geometry
        .map(({ lat, lon }) => {
          const { x, y } = project(lat, lon, cLat, cLon, radiusM);
          return [round4(x), round4(y)];
        })
        .filter((_, i, a) => i === 0 || i === a.length - 1 || i % 2 === 0);
      if (pts.length >= 2) streets.push({ c: major ? 1 : 0, p: pts });
      continue;
    }

    const c = el.type === 'node' ? { lat: el.lat!, lon: el.lon! } : el.center;
    if (!c || c.lat === undefined) continue;

    if (matches(tags, EXCLUDED)) {
      exclusions.push(c);
      continue;
    }
    if (matches(tags, ALLOWED) && tags.name) {
      candidates.push({ ...c, tags });
    }
  }

  // 25 m exclusion buffer.
  let rejectedByBuffer = 0;
  const kept = candidates.filter((cand) => {
    const tooClose = exclusions.some(
      (ex) => metersBetween(cand.lat, cand.lon, ex.lat, ex.lon) < EXCLUSION_BUFFER_M,
    );
    if (tooClose) rejectedByBuffer++;
    return !tooClose;
  });

  // Dedupe by name, nearest wins.
  const byName = new Map<string, { lat: number; lon: number; tags: Tags; d: number }>();
  for (const k of kept) {
    const d = metersBetween(cLat, cLon, k.lat, k.lon);
    if (d > radiusM) continue;
    const prev = byName.get(k.tags.name);
    if (!prev || d < prev.d) byName.set(k.tags.name, { ...k, d });
  }

  // Quota per type, spread greedily so there is something in every direction
  // rather than a pile of shops on one block.
  const pool = [...byName.values()];
  const picked: typeof pool = [];
  for (const [type, limit] of Object.entries(QUOTA) as [PoiType, number][]) {
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

  const pois: Poi[] = picked
    .sort((a, b) => a.d - b.d)
    .map((p, i) => {
      const { x, y } = project(p.lat, p.lon, cLat, cLon, radiusM);
      return {
        id: `poi-${i}`,
        name: p.tags.name,
        type: poiType(p.tags),
        category: categoryOf(p.tags),
        lat: Math.round(p.lat * 1e6) / 1e6,
        lon: Math.round(p.lon * 1e6) / 1e6,
        x: round4(x),
        y: round4(y),
        distM: Math.round(p.d),
        hours: p.tags.opening_hours ?? null,
      };
    });

  return {
    center: { lat: cLat, lon: cLon },
    radiusM,
    pois,
    streets: streets.sort((a, b) => b.c - a.c).slice(0, 600),
    counts: { pois: pois.length, rejectedByBuffer, exclusionFeatures: exclusions.length },
  };
}
