import * as Location from 'expo-location';
import baked from './world.json';
import {
  OVERPASS_URL,
  OVERPASS_UA,
  buildQuery,
  processElements,
  World,
} from './poiRules';

// Where the world layer comes from.
//
// The client queries Overpass directly here because the demo has no backend.
// THIS IS NOT THE PRODUCTION SHAPE. Overpass is a volunteer-run service whose
// usage policy does not permit per-client traffic, and PRD 6.1 wants Overture
// bulk data anyway. In production the app asks your own server for POIs near a
// coordinate, the server serves them from PostGIS having ingested once, and the
// filters in poiRules.ts run at ingest time instead of on the phone.
// Swapping that in means changing only fetchWorld() below.

export const BAKED_WORLD = baked as World;

export type WorldStatus =
  | { state: 'idle' }
  | { state: 'locating' }
  | { state: 'loading'; label: string }
  | { state: 'ready'; world: World; live: true }
  | { state: 'fallback'; world: World; reason: string };

async function fetchWorld(lat: number, lon: number, radiusM: number): Promise<World> {
  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: {
      'User-Agent': OVERPASS_UA,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `data=${encodeURIComponent(buildQuery(lat, lon, radiusM))}`,
  });
  if (!res.ok) throw new Error(`map data unavailable (${res.status})`);
  const json = await res.json();
  const processed = processElements(json.elements ?? [], lat, lon, radiusM);
  return { ...processed, label: 'Your area' };
}

/** Reverse geocode purely for the human-readable label on the map caption. */
async function labelFor(lat: number, lon: number): Promise<string> {
  try {
    const [place] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
    if (!place) return 'Your area';
    return place.district || place.city || place.subregion || place.region || 'Your area';
  } catch {
    return 'Your area';
  }
}

/**
 * Resolve the world around the player.
 *
 * Location permission is requested here rather than at launch, per PRD 10.2:
 * asking for it cold is the biggest drop-off in the install funnel, so it is
 * asked at the moment a round needs it.
 */
export async function loadWorld(
  radiusM: number,
  onStatus: (s: WorldStatus) => void,
): Promise<void> {
  onStatus({ state: 'locating' });

  let coords: { latitude: number; longitude: number };
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      onStatus({
        state: 'fallback',
        world: BAKED_WORLD,
        reason: 'Location is off',
      });
      return;
    }
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    coords = pos.coords;
  } catch {
    onStatus({
      state: 'fallback',
      world: BAKED_WORLD,
      reason: 'No location fix',
    });
    return;
  }

  const label = await labelFor(coords.latitude, coords.longitude);
  onStatus({ state: 'loading', label });

  try {
    const world = await fetchWorld(coords.latitude, coords.longitude, radiusM);
    if (!world.pois.length) {
      onStatus({
        state: 'fallback',
        world: BAKED_WORLD,
        reason: 'No public landmarks found near you',
      });
      return;
    }
    onStatus({ state: 'ready', world: { ...world, label }, live: true });
  } catch (e) {
    onStatus({
      state: 'fallback',
      world: BAKED_WORLD,
      reason: 'Map data unreachable',
    });
  }
}

export const worldOf = (s: WorldStatus): World =>
  s.state === 'ready' || s.state === 'fallback' ? s.world : BAKED_WORLD;
