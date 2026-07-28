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
  source: 'default' | 'shop' | 'free' | 'paid';
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
  { id: 'title-patient', name: '"PATIENT"', category: 'title', tint: C.acid, source: 'free', tier: 11 },
  { id: 'title-developed', name: '"DEVELOPED"', category: 'title', tint: C.acid, source: 'shop', cost: 300 },
  { id: 'title-overexposed', name: '"OVEREXPOSED"', category: 'title', tint: C.yellow, source: 'paid', tier: 15 },
  { id: 'title-unseen2', name: '"UNSEEN II"', category: 'title', tint: C.cyan, source: 'free', tier: 16 },
  { id: 'title-latent', name: '"LATENT IMAGE"', category: 'title', tint: C.purple, source: 'paid', tier: 24 },
  { id: 'title-stilllife', name: '"STILL LIFE"', category: 'title', tint: C.mint, source: 'free', tier: 28 },
  { id: 'title-vanished', name: '"VANISHED"', category: 'title', tint: C.orange, source: 'paid', tier: 35 },
  { id: 'title-neverfound', name: '"NEVER FOUND"', category: 'title', tint: C.red, source: 'paid', tier: 50 },

  // ---- map pins ----
  { id: 'pin-acid', name: 'ACID DOT', category: 'pin', tint: C.acid, source: 'default' },
  { id: 'pin-negative', name: 'NEGATIVE', category: 'pin', tint: C.white, source: 'shop', cost: 450 },
  { id: 'pin-ghost', name: 'GHOST GRID', category: 'pin', tint: C.cyan, source: 'shop', cost: 600 },
  { id: 'pin-halftone', name: 'HALFTONE', category: 'pin', tint: C.orange, source: 'paid', tier: 10 },
  { id: 'pin-pinhole', name: 'PINHOLE', category: 'pin', tint: C.silver, source: 'free', tier: 22 },
  { id: 'pin-aperture', name: 'APERTURE', category: 'pin', tint: C.mint, source: 'paid', tier: 20 },
  { id: 'pin-burn', name: 'BURN', category: 'pin', tint: C.red, source: 'paid', tier: 40 },

  // ---- photo frames ----
  { id: 'frame-brackets', name: 'BRACKETS', category: 'frame', tint: C.acid, source: 'default' },
  { id: 'frame-darkroom', name: 'DARKROOM', category: 'frame', tint: C.orange, source: 'shop', cost: 400 },
  { id: 'frame-contact', name: 'CONTACT SHEET', category: 'frame', tint: C.cyan, source: 'paid', tier: 9 },
  { id: 'frame-redscale', name: 'REDSCALE', category: 'frame', tint: C.red, source: 'paid', tier: 14 },
  { id: 'frame-sprocket', name: 'SPROCKET', category: 'frame', tint: C.silver, source: 'free', tier: 19 },
  { id: 'frame-lightleak', name: 'LIGHT LEAK', category: 'frame', tint: C.yellow, source: 'paid', tier: 30 },
  { id: 'frame-polaroid', name: 'POLAROID', category: 'frame', tint: C.white, source: 'paid', tier: 44 },

  // ---- blackout styles ----
  { id: 'static-default', name: 'STATIC', category: 'blackout', tint: C.silver, source: 'default' },
  { id: 'static-signal', name: 'SIGNAL LOST', category: 'blackout', tint: C.silver, source: 'shop', cost: 550 },
  { id: 'static-grain', name: 'GRAIN', category: 'blackout', tint: C.white, source: 'paid', tier: 13 },
  { id: 'static-fogged', name: 'FOGGED', category: 'blackout', tint: C.cyan, source: 'free', tier: 25 },
  { id: 'static-torn', name: 'TORN NEGATIVE', category: 'blackout', tint: C.orange, source: 'paid', tier: 33 },
  { id: 'static-developing', name: 'DEVELOPING', category: 'blackout', tint: C.pink, source: 'paid', tier: 47 },

  // ---- tag animations ----
  { id: 'tag-shutter', name: 'SHUTTER', category: 'tag', tint: C.acid, source: 'default' },
  { id: 'tag-prism', name: 'PRISM', category: 'tag', tint: C.purple, source: 'shop', cost: 800 },
  { id: 'tag-longexp', name: 'LONG EXPOSURE', category: 'tag', tint: C.purple, source: 'paid', tier: 12 },
  { id: 'tag-strobe', name: 'STROBE', category: 'tag', tint: C.yellow, source: 'paid', tier: 26 },
  { id: 'tag-flash', name: 'FLASH BULB', category: 'tag', tint: C.white, source: 'free', tier: 31 },
  { id: 'tag-double', name: 'DOUBLE EXPOSURE', category: 'tag', tint: C.mint, source: 'paid', tier: 38 },
];

export const byId = (id: string) => COSMETICS.find((c) => c.id === id);

export const categoryKind = (cat: Category): PreviewKind =>
  CATEGORIES.find((c) => c.key === cat)!.kind;

export const SHOP_ITEMS = COSMETICS.filter((c) => c.source === 'shop');

// ---------------------------------------------------------------------------
// Season pass: 50 tiers, two tracks.
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
const FREE_FILM = [2, 5, 8, 10, 12, 17, 20, 21, 27, 30, 34, 37, 40, 42, 46, 49, 50];

function buildTiers(): Tier[] {
  const freeCos = new Map<number, Cosmetic>();
  const paidCos = new Map<number, Cosmetic>();
  for (const c of COSMETICS) {
    if (c.source === 'free' && c.tier) freeCos.set(c.tier, c);
    if (c.source === 'paid' && c.tier) paidCos.set(c.tier, c);
  }

  return Array.from({ length: 50 }, (_, i) => {
    const n = i + 1;
    const milestone = n % 10 === 0;

    let free: TierReward | undefined;
    const fc = freeCos.get(n);
    if (fc) free = asReward(fc);
    else if (FREE_FILM.includes(n)) free = film(n >= 30 ? 100 : 50);

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

export const SEASON = {
  number: '01',
  name: 'EXPOSURE',
  week: 4,
  weeks: 10,
  currentTier: 12,
  tierProgress: 0.42,
  xpInTier: 420,
  xpPerTier: 1000,
};
