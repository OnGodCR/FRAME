import { ECONOMY } from './economy';

// ---------------------------------------------------------------------------
// The daily assignment.
//
// One prompt, the same for every player in the world on a given calendar date,
// derived from the date itself so it needs no server to agree. It is a task,
// not a contest: there is no score and no voting, because judging a photograph
// means either a model looking at it (forbidden by PRD 4.5) or other players
// looking at it (a moderation problem nobody needs). The validator confirms
// the capture was real, live, and not a reused frame, and that is the whole
// bar. Completing it pays XP and FILM.
//
// The date is the player's LOCAL calendar date, not UTC. Everyone should get
// "today's" assignment on their own today; a shared instant matters less than
// the prompt being the same one their friends are talking about.
//
// ---------------------------------------------------------------------------
// SAFETY, which is the whole reason this file was rewritten
// ---------------------------------------------------------------------------
//
// The first version of this list included "the view from as high as you can
// legally stand" and "the narrowest gap you can find". Those are dangerous
// prompts. "As high as possible" is a competitive instruction to climb, and
// "legally" is not the constraint that stops someone falling. A game that
// routes teenagers to real coordinates cannot hand out prompts whose optimal
// play is to get somewhere precarious. They are gone and are not coming back.
//
// Every prompt must satisfy all of:
//
//   1. **No superlatives that reward physical risk.** Never "as high as", "as
//      far as", "the narrowest", "the deepest". A superlative is an instruction
//      to keep going, and a prompt should have an obvious stopping point.
//      DESTINATION prompts are the exception and are safe precisely because the
//      thing being optimised is walking toward a shop on a pavement.
//   2. **Achievable on public ground**, in any city, and in a suburb.
//   3. **Never routes anyone onto private property, into traffic, or after
//      another person.** Compare the POI exclusion filters in poiRules.ts.
//   4. **Never asks for a person as the subject.** "No faces, ever" is a
//      promise the whole product makes and the copy must not undercut it.
//   5. **Answerable at ground level, standing still, in a few minutes.**
// ---------------------------------------------------------------------------

/**
 * A destination prompt. The player walks toward a category of ordinary
 * commercial or civic place and the app shows how close they got.
 *
 * This is the safest possible shape for a daily task: the optimal play is
 * "walk along a pavement to a shop", which is what the game wants people doing
 * anyway. It also reuses the POI category data already coming from
 * OpenStreetMap, so the target is a real place rather than a guess.
 *
 * `category` values match the OSM-derived POI categories in poiRules.ts.
 */
export interface DestinationAssignment {
  kind: 'destination';
  /** Shown to the player. */
  text: string;
  /** OSM category tokens that count as a match, lowercased. */
  category: string[];
  /** Short label for the distance readout, e.g. "ICE CREAM". */
  label: string;
}

/** An observation prompt. Something to notice and photograph where you are. */
export interface ObserveAssignment {
  kind: 'observe';
  text: string;
}

export type Assignment = DestinationAssignment | ObserveAssignment;

const dest = (
  text: string,
  label: string,
  category: string[],
): DestinationAssignment => ({ kind: 'destination', text, label, category });

const observe = (text: string): ObserveAssignment => ({ kind: 'observe', text });

export const ASSIGNMENTS: Assignment[] = [
  // ---- destination prompts ----
  dest('Get as close as you can to an ice cream shop.', 'ICE CREAM', [
    'ice_cream',
    'confectionery',
    'dessert',
  ]),
  dest('Get as close as you can to a bookshop.', 'BOOKS', ['books', 'bookshop', 'library']),
  dest('Get as close as you can to a coffee shop.', 'COFFEE', ['cafe', 'coffee']),
  dest('Get as close as you can to a bakery.', 'BAKERY', ['bakery', 'pastry']),
  dest('Get as close as you can to a public fountain.', 'FOUNTAIN', ['fountain']),
  dest('Get as close as you can to a bus or train station.', 'TRANSIT', [
    'station',
    'bus_station',
    'railway',
    'subway',
  ]),
  dest('Get as close as you can to a park bench.', 'BENCH', ['bench', 'park', 'garden']),
  dest('Get as close as you can to a museum or gallery.', 'MUSEUM', [
    'museum',
    'gallery',
    'artwork',
  ]),
  dest('Get as close as you can to a pharmacy.', 'PHARMACY', ['pharmacy', 'chemist']),
  dest('Get as close as you can to a post box.', 'POST', ['post_box', 'post_office']),
  dest('Get as close as you can to a florist.', 'FLORIST', ['florist', 'garden_centre']),
  dest('Get as close as you can to a public library.', 'LIBRARY', ['library']),

  // ---- observation prompts ----
  observe('Something red, at street level.'),
  observe('A doorway you have walked past and never through.'),
  observe('Something with a number on it.'),
  observe('Something growing where nobody planted it.'),
  observe('A reflection that is not a mirror.'),
  observe('Something metal, worn smooth by hands.'),
  observe('A corner you turn often and have never looked at.'),
  observe('Something painted over.'),
  observe('A light that is on in the daytime.'),
  observe('Something repaired badly.'),
];

/**
 * Nearest POI matching a destination assignment, or null if the loaded world
 * has nothing of that kind.
 *
 * Matching is a substring test both ways because OSM category tokens are
 * inconsistent: an ice cream place can come back as `ice_cream`,
 * `ice_cream;cafe`, or `confectionery` depending on who tagged it. Being loose
 * here is correct; the cost of a near-miss match is showing the player a
 * slightly wrong shop, and the cost of a strict miss is a task that reads as
 * broken in most of the world.
 *
 * Returns null rather than a fallback distance. A destination task with no
 * candidate nearby must degrade to "no target found", never to a made-up
 * number that sends someone walking toward nothing.
 */
export function nearestMatch<T extends { category: string; distM: number }>(
  pois: T[],
  a: DestinationAssignment,
): T | null {
  const wanted = a.category.map((c) => c.toLowerCase());
  const hits = pois.filter((p) => {
    const cat = (p.category || '').toLowerCase();
    return wanted.some((w) => cat.includes(w) || w.includes(cat));
  });
  if (!hits.length) return null;
  return hits.reduce((best, p) => (p.distM < best.distM ? p : best));
}

/** Milliseconds in a day. */
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * A stable integer for a local calendar date. Built from the Y/M/D components
 * rather than the raw timestamp so a daylight-saving shift cannot skip or
 * repeat a day, which is the classic way this kind of counter breaks.
 */
export function dayIndex(now: Date = new Date()): number {
  const local = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor(local / DAY_MS);
}

/**
 * Scatters consecutive days across the list so the cycle is not obviously a
 * loop. 7 is coprime with the list length, so every prompt still appears once
 * per full cycle.
 */
export function assignmentFor(now: Date = new Date()): Assignment {
  const i = dayIndex(now);
  const n = ASSIGNMENTS.length;
  return ASSIGNMENTS[(((i * 7) % n) + n) % n];
}

/**
 * What completing today's assignment pays. Cosmetic currency only.
 * Single source is ECONOMY in data/economy.ts.
 */
export const DAILY_REWARD = { xp: ECONOMY.dailyCheckin.xp, film: ECONOMY.dailyCheckin.film };

/**
 * The streak is weekly, not daily. A daily streak is the wrong shape for
 * Hidewire: a real round needs three friends and half an hour, so a daily
 * requirement punishes players for other people's calendars. The assignment
 * itself is solo and daily, but what is tracked and shown is "weeks in a row
 * you turned up at all", which is achievable by anyone who plays at all.
 */
export const STREAK_WINDOW_DAYS = 7;

export interface DailyState {
  /** dayIndex of the last completed assignment, or null. */
  lastDone: number | null;
  /** Consecutive weeks with at least one completion. */
  streak: number;
}

export const FRESH_DAILY: DailyState = { lastDone: null, streak: 0 };

/** Whether today's assignment is still outstanding. */
export function isDailyOpen(d: DailyState, now: Date = new Date()): boolean {
  return d.lastDone !== dayIndex(now);
}

/**
 * Applies a completion. The streak advances when the previous completion was
 * in the preceding window, holds when it was in the current one, and resets
 * only after a full window with nothing in it.
 */
export function completeDaily(d: DailyState, now: Date = new Date()): DailyState {
  const today = dayIndex(now);
  if (d.lastDone === today) return d;
  if (d.lastDone === null) return { lastDone: today, streak: 1 };
  const gap = today - d.lastDone;
  if (gap >= STREAK_WINDOW_DAYS * 2) return { lastDone: today, streak: 1 };
  if (gap >= STREAK_WINDOW_DAYS) return { lastDone: today, streak: d.streak + 1 };
  return { lastDone: today, streak: Math.max(1, d.streak) };
}
