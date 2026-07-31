import { color } from '../theme';

// Single source of truth for cosmetics. Shop, Season Pass, and Loadout all
// read from here so an item's name, art, and price can never disagree.

export type PreviewKind = 'pin' | 'frame' | 'static' | 'tag' | 'title' | 'film';

export type Category = 'title' | 'pin' | 'frame' | 'blackout' | 'tag';

export const CATEGORIES: { key: Category; label: string; kind: PreviewKind }[] = [
  { key: 'title', label: 'TITLE', kind: 'title' },
  { key: 'pin', label: 'MAP PIN', kind: 'pin' },
  { key: 'frame', label: 'PHOTO FRAME', kind: 'frame' },
  { key: 'blackout', label: 'BLACKOUT', kind: 'static' },
  { key: 'tag', label: 'TAG', kind: 'tag' },
];

export interface Cosmetic {
  id: string;
  name: string;
  category: Category;
  tint: string;
  /** Where it comes from. Drives the lock label in the loadout. */
  source: 'default' | 'shop' | 'free' | 'paid' | 'bundle';
  cost?: number; // FILM, shop items only
  tier?: number; // season pass items only
}

const C = {
  acid: color.accent,
  cyan: '#9BE8FF',
  orange: '#FF8A5C',
  purple: '#D8B4FF',
  white: '#FFFFFF',
  yellow: '#FFD84D',
  red: '#FF6B5C',
  silver: '#C9C9D4',
  mint: '#7CFFC4',
  pink: '#FF9ECF',
};

export const COSMETICS: Cosmetic[] = [
  // ---- titles ----
  { id: 'title-unseen', name: 'UNSEEN', category: 'title', tint: C.acid, source: 'default' },
  { id: 'title-patient', name: '"PATIENT"', category: 'title', tint: C.acid, source: 'free', tier: 4 },
  { id: 'title-developed', name: '"DEVELOPED"', category: 'title', tint: C.acid, source: 'shop', cost: 300 },
  { id: 'title-overexposed', name: '"OVEREXPOSED"', category: 'title', tint: C.yellow, source: 'paid', tier: 11 },
  { id: 'title-unseen2', name: '"UNSEEN II"', category: 'title', tint: C.cyan, source: 'free', tier: 8 },
  { id: 'title-latent', name: '"LATENT IMAGE"', category: 'title', tint: C.purple, source: 'paid', tier: 15 },
  { id: 'title-stilllife', name: '"STILL LIFE"', category: 'title', tint: C.mint, source: 'free', tier: 24 },
  { id: 'title-vanished', name: '"VANISHED"', category: 'title', tint: C.orange, source: 'paid', tier: 22 },
  { id: 'title-neverfound', name: '"NEVER FOUND"', category: 'title', tint: C.red, source: 'paid', tier: 30 },

  // ---- map pins ----
  { id: 'pin-acid', name: 'ACID DOT', category: 'pin', tint: C.acid, source: 'default' },
  { id: 'pin-negative', name: 'NEGATIVE', category: 'pin', tint: C.white, source: 'shop', cost: 450 },
  { id: 'pin-ghost', name: 'GHOST GRID', category: 'pin', tint: C.cyan, source: 'shop', cost: 600 },
  { id: 'pin-halftone', name: 'HALFTONE', category: 'pin', tint: C.orange, source: 'paid', tier: 5 },
  { id: 'pin-pinhole', name: 'PINHOLE', category: 'pin', tint: C.silver, source: 'free', tier: 16 },
  { id: 'pin-aperture', name: 'APERTURE', category: 'pin', tint: C.mint, source: 'paid', tier: 13 },
  { id: 'pin-burn', name: 'BURN', category: 'pin', tint: C.red, source: 'paid', tier: 25 },

  // ---- photo frames ----
  { id: 'frame-brackets', name: 'BRACKETS', category: 'frame', tint: C.acid, source: 'default' },
  // Frames are the flagship shop category (see Shop.tsx), so the shop needs
  // more than one of them. Priced as a range, since the point of the section
  // is that there is a choice worth making.
  { id: 'frame-darkroom', name: 'DARKROOM', category: 'frame', tint: C.orange, source: 'shop', cost: 400 },
  { id: 'frame-safelight', name: 'SAFELIGHT', category: 'frame', tint: C.red, source: 'shop', cost: 550 },
  { id: 'frame-fixer', name: 'FIXER', category: 'frame', tint: C.mint, source: 'shop', cost: 750 },
  { id: 'frame-contact', name: 'CONTACT SHEET', category: 'frame', tint: C.cyan, source: 'paid', tier: 3 },
  { id: 'frame-redscale', name: 'REDSCALE', category: 'frame', tint: C.red, source: 'paid', tier: 10 },
  { id: 'frame-sprocket', name: 'SPROCKET', category: 'frame', tint: C.silver, source: 'free', tier: 12 },
  { id: 'frame-lightleak', name: 'LIGHT LEAK', category: 'frame', tint: C.yellow, source: 'paid', tier: 18 },
  { id: 'frame-polaroid', name: 'POLAROID', category: 'frame', tint: C.white, source: 'paid', tier: 27 },
  // Bundle-only. Not buyable with FILM at any price, which is the entire
  // reason it converts: see the retired STARTER_BUNDLE note below.
  { id: 'frame-firstlight', name: 'FIRST LIGHT', category: 'frame', tint: C.mint, source: 'bundle' },

  // ---- blackout styles ----
  { id: 'static-default', name: 'STATIC', category: 'blackout', tint: C.silver, source: 'default' },
  { id: 'static-signal', name: 'SIGNAL LOST', category: 'blackout', tint: C.silver, source: 'shop', cost: 550 },
  { id: 'static-grain', name: 'GRAIN', category: 'blackout', tint: C.white, source: 'paid', tier: 8 },
  { id: 'static-fogged', name: 'FOGGED', category: 'blackout', tint: C.cyan, source: 'free', tier: 20 },
  { id: 'static-torn', name: 'TORN NEGATIVE', category: 'blackout', tint: C.orange, source: 'paid', tier: 20 },
  { id: 'static-developing', name: 'DEVELOPING', category: 'blackout', tint: C.pink, source: 'paid', tier: 28 },

  // ---- tag animations ----
  { id: 'tag-shutter', name: 'SHUTTER', category: 'tag', tint: C.acid, source: 'default' },
  { id: 'tag-prism', name: 'PRISM', category: 'tag', tint: C.purple, source: 'shop', cost: 800 },
  { id: 'tag-longexp', name: 'LONG EXPOSURE', category: 'tag', tint: C.purple, source: 'paid', tier: 6 },
  { id: 'tag-strobe', name: 'STROBE', category: 'tag', tint: C.yellow, source: 'paid', tier: 16 },
  { id: 'tag-flash', name: 'FLASH BULB', category: 'tag', tint: C.white, source: 'free', tier: 28 },
  { id: 'tag-double', name: 'DOUBLE EXPOSURE', category: 'tag', tint: C.mint, source: 'paid', tier: 23 },
];

export const byId = (id: string) => COSMETICS.find((c) => c.id === id);

export const categoryKind = (cat: Category): PreviewKind =>
  CATEGORIES.find((c) => c.key === cat)!.kind;

export const SHOP_ITEMS = COSMETICS.filter((c) => c.source === 'shop');

/**
 * Pass length. 50 tiers at 1000 XP was unfinishable: a player doing the daily
 * plus a round earns roughly 300 season XP a day, so 50,000 XP is about 160
 * days against a 70 day season. Someone who buys a pass they cannot complete
 * does not buy the next one.
 *
 * 30 tiers at 500 is about 50 days at the same rate, which finishes inside the
 * season with room for missed days. Revisit once there is real play data.
 */
export const TIER_COUNT = 30;
export const XP_PER_TIER = 500;

// ---------------------------------------------------------------------------
// Season pass: TIER_COUNT tiers, two tracks.
// Cosmetic tiers are derived from the catalog above; the gaps are filled with
// FILM so neither track has dead stretches.
// ---------------------------------------------------------------------------

export interface TierReward {
  name: string;
  kind: PreviewKind;
  tint: string;
  cosmeticId?: string;
}

export interface Tier {
  n: number;
  free?: TierReward;
  paid: TierReward;
  milestone: boolean;
}

const asReward = (c: Cosmetic): TierReward => ({
  name: c.name,
  kind: categoryKind(c.category),
  tint: c.tint,
  cosmeticId: c.id,
});

const film = (amount: number): TierReward => ({
  name: `${amount} FILM`,
  kind: 'film',
  tint: color.accent,
});

// The free track is deliberately sparse. That gap is what the paid track
// sells. Milestones are included so every tenth tier pays out on both.
const FREE_FILM = [2, 5, 11, 14, 17, 23, 26, 29];

function buildTiers(): Tier[] {
  const freeCos = new Map<number, Cosmetic>();
  const paidCos = new Map<number, Cosmetic>();
  for (const c of COSMETICS) {
    if (c.source === 'free' && c.tier) freeCos.set(c.tier, c);
    if (c.source === 'paid' && c.tier) paidCos.set(c.tier, c);
  }

  return Array.from({ length: TIER_COUNT }, (_, i) => {
    const n = i + 1;
    const milestone = n % 10 === 0;

    let free: TierReward | undefined;
    const fc = freeCos.get(n);
    if (fc) free = asReward(fc);
    else if (FREE_FILM.includes(n)) free = film(n >= TIER_COUNT * 0.6 ? 100 : 50);

    // Every paid tier pays out something; a dead row on the track people
    // bought reads as a bug.
    const pc = paidCos.get(n);
    const paid: TierReward = pc
      ? asReward(pc)
      : film(milestone ? 300 : n >= 25 ? 150 : 100);

    return { n, free, paid, milestone };
  });
}

export const TIERS: Tier[] = buildTiers();

/**
 * The first-purchase offer.
 *
 * Shown once, on the results screen of the player's first completed round,
 * and never again. That moment is chosen deliberately: the player has just
 * spent half an hour watching a feed of framed photographs, so they now
 * understand what a frame is and where it is seen. Offering this at install,
 * before any of that means anything, is the standard mistake.
 *
 * Priced at $2.99, inside the band that converts a first-time payer, and
 * anchored against component value. Cosmetic only, like everything else:
 * nothing purchasable may affect whether you win.
 */
/**
 * Retired. The one-time first-purchase offer on the results screen is gone
 * with the rest of the paid SKUs. Kept as a comment rather than deleted
 * silently, because the *timing* argument behind it was the good part and is
 * worth reusing: it appeared after a completed round, when a player had just
 * spent half an hour watching a feed of framed photographs and finally
 * understood what a frame was and where it was seen. If a paid offer ever
 * returns, that is the moment for it, not install.
 */


/**
 * Facts about the season itself, which are the same for every player. Player
 * progress through it is NOT here: it lives on the profile as `seasonXp` and is
 * derived by passState() below.
 *
 * It used to live here as `currentTier: 12`, which meant every account, including
 * a brand new one, opened the app already twelve tiers into a pass it had never
 * played. That was demo dressing that read as a bug, because it was one.
 */
/**
 * Real-money products.
 *
 * **None of these is FILM, and none of them ever can be.** Seeker bidding
 * spends FILM (JoinLobby, "Bid to seek"), so selling FILM would make a role
 * advantage purchasable, and marketing/BRIEF.md 9 lists "never imply anything
 * purchasable helps you win" as a legal line rather than a tone note.
 *
 * What is safe to sell: cosmetics, cosmetic bundles, and pass tiers, because
 * the pass pays out cosmetics only. If a future tier ever pays FILM, tier
 * skips have to come out of the shop.
 */
export interface StoreProduct {
  id: string;
  name: string;
  blurb: string;
  price: string;
  /** Struck-through comparison price, where there is a genuine saving. */
  anchor?: string;
  /** Cosmetic ids granted. */
  grants: string[];
  /** Pass tiers granted, for skips. */
  tiers?: number;
  tag?: string;
}

/**
 * Real-money products, now empty.
 *
 * Every paid SKU that used to live here (the season pass, the darkroom set,
 * two tier skips, and the founder bundle) was removed at Angad's direction:
 * the shop is moving to loot boxes, and the old grid read as a list of things
 * to scroll past rather than anything anyone wanted.
 *
 * **Monetization is now exactly two things**, and the list is deliberately
 * short so that adding a third is a decision rather than a drift:
 *
 *   1. FIRST LIGHT CASE, $4.99, in data/lootboxes.ts.
 *   2. Buying FILM, which is NOT built and is gated behind
 *      `FILM_IS_PURCHASABLE` in the same file, because switching it on turns
 *      every FILM box into a paid random item and changes the product's
 *      regulatory position in several countries at once.
 *
 * See monetization/LOOT-BOXES.md before putting anything back here.
 */
export const STORE: StoreProduct[] = [];


export const SEASON = {
  number: '01',
  name: 'EXPOSURE',
  week: 4,
  weeks: 10,
};



export interface PassState {
  /** 1-based, capped at TIER_COUNT. */
  tier: number;
  /** 0 to 1 through the current tier. */
  progress: number;
  xpInTier: number;
  xpPerTier: number;
  complete: boolean;
}

/** Derives pass position from season XP, so playing actually moves the bar. */
export function passState(seasonXp: number): PassState {
  const capped = Math.max(0, Math.min(seasonXp, TIER_COUNT * XP_PER_TIER));
  const tier = Math.min(TIER_COUNT, Math.floor(capped / XP_PER_TIER) + 1);
  const xpInTier = capped % XP_PER_TIER;
  const complete = capped >= TIER_COUNT * XP_PER_TIER;
  return {
    tier,
    progress: complete ? 1 : xpInTier / XP_PER_TIER,
    xpInTier: complete ? XP_PER_TIER : xpInTier,
    xpPerTier: XP_PER_TIER,
    complete,
  };
}
