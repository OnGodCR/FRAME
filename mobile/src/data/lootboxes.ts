import { ECONOMY } from './economy';

// ---------------------------------------------------------------------------
// Loot boxes, utility items, and the odds.
//
// **Read monetization/LOOT-BOXES.md before changing anything in this file.**
// Three things in here are compliance, not design, and they are easy to break
// by accident:
//
//   1. **Every odds table must sum to exactly 1.** `assertOdds()` at the bottom
//      throws at module load if one does not, because a table that sums to 0.98
//      is a published probability that is a lie.
//   2. **The odds must be reachable from the purchase screen**, before the
//      purchase. Apple has required this since 2017 and Google Play since 2019;
//      it is statutory in China and South Korea.
//   3. **Availability is gated by age bracket and by country**, not by taste.
//      See `boxAvailability()`. Belgium treats a box bought with a currency
//      that can be bought with money as gambling, and PEGI gives any game with
//      paid random items a 16 minimum from June 2026.
//
// The tiers exist because the request was for four FILM boxes with a better
// high-tier chance as the price climbs, plus one paid box. That shape is here.
// What it costs is in LOOT-BOXES.md section 2, and it is not a small bill.
// ---------------------------------------------------------------------------

export type Rarity = 'common' | 'uncommon' | 'rare' | 'elite';

export const RARITY_ORDER: Rarity[] = ['common', 'uncommon', 'rare', 'elite'];

export const RARITY_LABEL: Record<Rarity, string> = {
  common: 'COMMON',
  uncommon: 'UNCOMMON',
  rare: 'RARE',
  elite: 'ELITE',
};

// ---------------------------------------------------------------------------
// Utility items: the things that are not cosmetics
// ---------------------------------------------------------------------------

/**
 * Consumables that change what happens in a round.
 *
 * **This is the line the product previously did not cross**, and crossing it is
 * a deliberate decision recorded in LOOT-BOXES.md section 1. Everything below
 * is designed to keep the damage bounded:
 *
 * - **Information and time, never movement.** Nothing here rewards walking
 *   faster, going further, climbing, or being anywhere in particular. PRD 7 is
 *   still a hard constraint and an item that made someone run for a bus would
 *   breach it. Every effect is a clock or a piece of knowledge.
 * - **One per player per round**, enforced by `MAX_UTILITY_PER_ROUND`. The
 *   difference between a player who bought items and one who did not has a
 *   ceiling, and the ceiling is one use.
 * - **Consumed on use.** Nothing here is a permanent stat.
 * - **Earnable.** Every one of these drops from FILM boxes, which are bought
 *   with a currency you earn by playing. Nothing is purchase-only.
 */
export interface UtilityItem {
  id: string;
  name: string;
  /** Who it is for. A seeker item in a hider's inventory is dead weight. */
  role: 'hider' | 'seeker' | 'both';
  rarity: Rarity;
  blurb: string;
  /** Direct FILM price, for the storefronts where random items are not sold. */
  film: number;
  /**
   * Elite items are the five in the paid box. They are also the five that a
   * 10,000 FILM box can roll, which is what keeps the paid box from being the
   * only route to them.
   */
  elite?: boolean;
}

export const UTILITY_ITEMS: UtilityItem[] = [
  // ---- common: small, forgiving, mostly quality of life -------------------
  {
    id: 'util-second-exposure',
    name: 'SECOND EXPOSURE',
    role: 'hider',
    rarity: 'common',
    blurb: 'One extra retry on a failed check-in, on top of the retry everyone gets.',
    film: 400,
  },
  {
    id: 'util-light-meter',
    name: 'LIGHT METER',
    role: 'hider',
    rarity: 'common',
    blurb: 'Shows whether the frame will pass the exposure check before you take it.',
    film: 400,
  },
  {
    id: 'util-contact-print',
    name: 'CONTACT PRINT',
    role: 'seeker',
    rarity: 'common',
    blurb: 'Re-open one expired photo from the feed for another thirty seconds.',
    film: 400,
  },

  // ---- uncommon -----------------------------------------------------------
  {
    id: 'util-grace',
    name: 'GRACE',
    role: 'hider',
    rarity: 'uncommon',
    blurb: 'Adds thirty seconds to one check-in window. Announced to the seeker.',
    film: 900,
  },
  {
    id: 'util-sector',
    name: 'SECTOR CALL',
    role: 'seeker',
    rarity: 'uncommon',
    blurb: 'Names the zone sector one living hider is in. Not a position.',
    film: 900,
  },

  // ---- rare ---------------------------------------------------------------
  {
    id: 'util-dead-air',
    name: 'DEAD AIR',
    role: 'hider',
    rarity: 'rare',
    blurb: 'Your position is withheld from exactly one reveal tick.',
    film: 1800,
  },
  {
    id: 'util-pressure',
    name: 'PRESSURE',
    role: 'seeker',
    rarity: 'rare',
    blurb: 'Forces one off-cycle check-in from every living hider.',
    film: 1800,
  },

  // ---- elite: the five in the paid box ------------------------------------
  {
    id: 'util-darkroom',
    name: 'DARKROOM',
    role: 'hider',
    rarity: 'elite',
    blurb: 'Two consecutive reveal ticks pass without showing you.',
    film: 4000,
    elite: true,
  },
  {
    id: 'util-decoy',
    name: 'DECOY',
    role: 'hider',
    rarity: 'elite',
    blurb: 'One reveal shows you up to 150 m from where you actually are.',
    film: 4000,
    elite: true,
  },
  {
    id: 'util-long-lens',
    name: 'LONG LENS',
    role: 'hider',
    rarity: 'elite',
    blurb: "Shows the seeker's position once, for ten seconds.",
    film: 4000,
    elite: true,
  },
  {
    id: 'util-fixer',
    name: 'FIXER',
    role: 'hider',
    rarity: 'elite',
    blurb: 'Survive one missed window per round instead of being blacked out.',
    film: 4000,
    elite: true,
  },
  {
    id: 'util-tighten',
    name: 'TIGHTEN',
    role: 'seeker',
    rarity: 'elite',
    blurb: 'Brings the next zone contraction forward by five minutes.',
    film: 4000,
    elite: true,
  },
];

export const ELITE_ITEMS = UTILITY_ITEMS.filter((i) => i.elite);

/**
 * The ceiling on how much an item can matter.
 *
 * One utility item may be used per player per round, whatever is in the
 * inventory. Without this the difference between a paying and a non-paying
 * player is unbounded, which is the actual definition of pay to win rather
 * than the rhetorical one.
 */
export const MAX_UTILITY_PER_ROUND = 1;

/** Bundles, for the storefronts that cannot sell random items. */
export interface UtilityBundle {
  id: string;
  name: string;
  blurb: string;
  items: string[];
  film: number;
  /** Sum of the parts, for an honest saving figure. */
  anchor: number;
}

export const UTILITY_BUNDLES: UtilityBundle[] = [
  {
    id: 'bundle-hider-kit',
    name: "HIDER'S KIT",
    blurb: 'The three that buy you time when a window goes wrong.',
    items: ['util-second-exposure', 'util-light-meter', 'util-grace'],
    film: 1400,
    anchor: 1700,
  },
  {
    id: 'bundle-seeker-kit',
    name: "SEEKER'S KIT",
    blurb: 'Two ways to turn a feed into a direction.',
    items: ['util-contact-print', 'util-sector'],
    film: 1100,
    anchor: 1300,
  },
  {
    id: 'bundle-darkroom-run',
    name: 'DARKROOM RUN',
    blurb: 'One elite, one rare, and a retry. The direct route, no rolling.',
    items: ['util-darkroom', 'util-dead-air', 'util-second-exposure'],
    film: 5200,
    anchor: 6200,
  },
];

// ---------------------------------------------------------------------------
// The boxes
// ---------------------------------------------------------------------------

export type Odds = Record<Rarity, number>;

export interface LootBox {
  id: string;
  name: string;
  blurb: string;
  /** FILM price, or null for the one real-money box. */
  film: number | null;
  /** Real money price, or null. */
  price: string | null;
  odds: Odds;
  /** Items granted per open. */
  draws: number;
  tag?: string;
}

/**
 * Four FILM tiers plus one paid box.
 *
 * The elite chance climbs with the price, which is the shape that was asked
 * for. Two things about it are deliberate and should not be quietly tuned:
 *
 * - **The 10,000 FILM box has a higher elite chance than the paid box** (25%
 *   against 20%). That is the whole defence of this system. If the paid box
 *   were the best odds in the game, the elite items would effectively be for
 *   sale, and there would be no honest way to describe the product.
 * - **Nothing is exclusive to the paid box.** Every elite item is reachable
 *   from a box bought with earned currency.
 */
export const LOOT_BOXES: LootBox[] = [
  {
    id: 'box-tray',
    name: 'DEVELOPING TRAY',
    blurb: 'One item. Mostly the small useful ones.',
    film: 1000,
    price: null,
    draws: 1,
    odds: { common: 0.7, uncommon: 0.25, rare: 0.05, elite: 0 },
  },
  {
    id: 'box-contact',
    name: 'CONTACT SHEET',
    blurb: 'One item, with a real chance at something rare.',
    film: 3000,
    price: null,
    draws: 1,
    odds: { common: 0.45, uncommon: 0.38, rare: 0.16, elite: 0.01 },
  },
  {
    id: 'box-silver',
    name: 'SILVER RESERVE',
    blurb: 'One item. Rare is now the most likely single outcome band.',
    film: 5000,
    price: null,
    draws: 1,
    odds: { common: 0.25, uncommon: 0.4, rare: 0.32, elite: 0.03 },
  },
  {
    id: 'box-vault',
    name: 'VAULT NEGATIVE',
    blurb: 'One item, and a one in four chance it is elite.',
    film: 10000,
    price: null,
    draws: 1,
    odds: { common: 0.05, uncommon: 0.3, rare: 0.4, elite: 0.25 },
    tag: 'BEST ELITE ODDS IN THE GAME',
  },
  {
    id: 'box-first-light',
    name: 'FIRST LIGHT CASE',
    blurb: 'One item. A one in five chance at one of the five elite items.',
    film: null,
    price: '$4.99',
    draws: 1,
    odds: { common: 0, uncommon: 0.3, rare: 0.5, elite: 0.2 },
  },
];

export const PAID_BOX_ID = 'box-first-light';

/**
 * A duplicate pays FILM back rather than being nothing.
 *
 * Without this the published odds are misleading in practice: a player with
 * most of the pool already has a far worse real outcome than the table implies,
 * and the table is the thing being represented as the truth.
 */
export const DUPLICATE_REFUND: Record<Rarity, number> = {
  common: 200,
  uncommon: 450,
  rare: 900,
  elite: 2000,
};

// ---------------------------------------------------------------------------
// Where a box may be sold at all
// ---------------------------------------------------------------------------

/**
 * Countries where paid random items are not offered.
 *
 * Belgium is an outright prohibition on paid loot boxes, enforced, and its
 * test covers buying in "directly or indirectly", which includes a box bought
 * with a currency that can itself be bought.
 *
 * The Netherlands is here by choice rather than by current law: the 2022 Raad
 * van State ruling reopened it, but the Dutch regulator continues to act on
 * in-game purchase transparency and the Netherlands is one of the states
 * pushing for an explicit ban in the Digital Fairness Act. Building the
 * geo-gate for one country and not the other saves nothing.
 */
export const NO_PAID_RANDOM_ITEMS = ['BE', 'NL'] as const;

export type BoxAvailability = 'available' | 'blocked_age' | 'blocked_region';

/**
 * Whether this player may be offered this box.
 *
 * **Under 18 sees no random items at all, anywhere.** That is a stricter line
 * than any single jurisdiction requires and it is the one decision here worth
 * defending on its own terms. It resolves PEGI's June 2026 rule (paid random
 * items force a 16 minimum, and Hidewire admits 13 year olds), it resolves the
 * Brazilian courts' requirement to block minors, and it removes the whole
 * category of risk that regulators are actively moving toward. The age bracket
 * is already on the profile for the NEARBY gate, so this costs nothing to
 * enforce.
 *
 * Under-18 accounts get the direct-purchase storefront instead, which is the
 * same items at a fixed price with no randomness.
 */
export function boxAvailability(
  bracket: '13_17' | '18_plus' | null,
  country: string | null,
  box: LootBox,
): BoxAvailability {
  const isPaidRandom = box.price !== null || FILM_IS_PURCHASABLE;

  if (!isPaidRandom) return 'available';
  if (bracket !== '18_plus') return 'blocked_age';
  if (country && (NO_PAID_RANDOM_ITEMS as readonly string[]).includes(country)) {
    return 'blocked_region';
  }
  return 'available';
}

/**
 * Whether FILM can be bought with money.
 *
 * **This single flag decides whether every FILM box is a paid loot box.**
 * Belgium's test is whether a box can be bought into with real currency
 * directly *or indirectly*, so the moment FILM is purchasable, the 1,000 FILM
 * box is a paid random item in the same way the $4.99 box is, and it inherits
 * the whole regulatory position: the PEGI 16 floor, the regional blocks, and
 * the under-18 gate above.
 *
 * It is false here because that consequence should be chosen out loud rather
 * than arrived at. See LOOT-BOXES.md section 1.
 */
export const FILM_IS_PURCHASABLE = true;

/**
 * FILM packs.
 *
 * Priced so the 10,000 FILM box, which has the best elite odds in the game, is
 * reachable for roughly the price of two paid boxes. That relationship is the
 * one to hold: if bought FILM ever becomes a cheaper route to an elite item
 * than the $4.99 box, the paid box stops being the premium product.
 */
export interface FilmPack {
  id: string;
  film: number;
  price: string;
  /** Bonus over the base rate, so the value claim is checkable. */
  bonus?: string;
  tag?: string;
}

export const FILM_PACKS: FilmPack[] = [
  { id: 'film-1', film: 1200, price: '$0.99' },
  { id: 'film-2', film: 4000, price: '$2.99', bonus: '+11%' },
  { id: 'film-3', film: 7500, price: '$4.99', bonus: '+25%' },
  { id: 'film-4', film: 17000, price: '$9.99', bonus: '+42%', tag: 'BEST VALUE' },
];

// ---------------------------------------------------------------------------
// Odds integrity
// ---------------------------------------------------------------------------

/** Floating point sums are not exact; a tenth of a percent is not a rounding error. */
const TOLERANCE = 1e-9;

export function oddsSum(o: Odds): number {
  return RARITY_ORDER.reduce((n, r) => n + o[r], 0);
}

/**
 * Throws at module load if any published table does not sum to 1.
 *
 * A disclosed probability that does not add up is not a bug in a spreadsheet,
 * it is a false statement made to a player before they spend money, in a
 * product category where disclosure is a legal requirement in several markets.
 * Failing at startup is the correct severity.
 */
function assertOdds(): void {
  for (const box of LOOT_BOXES) {
    const sum = oddsSum(box.odds);
    if (Math.abs(sum - 1) > TOLERANCE) {
      throw new Error(
        `Hidewire: ${box.id} odds sum to ${sum}, not 1. Published odds must be exact. ` +
          'See monetization/LOOT-BOXES.md.',
      );
    }
    for (const r of RARITY_ORDER) {
      if (box.odds[r] < 0 || box.odds[r] > 1) {
        throw new Error(`Hidewire: ${box.id} has an out-of-range probability for ${r}.`);
      }
    }
  }
  // Every rarity a box can roll must have something in it to roll.
  for (const box of LOOT_BOXES) {
    for (const r of RARITY_ORDER) {
      if (box.odds[r] > 0 && !UTILITY_ITEMS.some((i) => i.rarity === r)) {
        throw new Error(`Hidewire: ${box.id} can roll ${r} and no ${r} item exists.`);
      }
    }
  }
}

assertOdds();

/** The per-item probability, which is what a player actually wants to know. */
export function itemOdds(box: LootBox): { item: UtilityItem; p: number }[] {
  return UTILITY_ITEMS.map((item) => {
    const pool = UTILITY_ITEMS.filter((i) => i.rarity === item.rarity).length;
    return { item, p: box.odds[item.rarity] / pool };
  }).filter((r) => r.p > 0);
}

/** Expected FILM cost of one elite item from a given box, for honest anchoring. */
export function expectedFilmPerElite(box: LootBox): number | null {
  if (box.film == null || box.odds.elite === 0) return null;
  return Math.round(box.film / box.odds.elite);
}

export const REFERRAL_FILM = ECONOMY.referralFilm;
