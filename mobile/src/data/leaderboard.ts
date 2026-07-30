import { DIRECTORY, type Friend } from './friends';

// ---------------------------------------------------------------------------
// Leaderboard, ranked on XP.
//
// There is no server (CLAUDE.md 7), so the global board is a fixed local
// ladder with the player slotted in by XP. That is honest for a demo and the
// shape is what the server will return, so swapping the source later is a data
// change rather than a UI change.
//
// **Handles only. No location, no photos, no way to contact anyone.** A global
// board is the one place in the product where a player is visible to strangers,
// so it exposes the absolute minimum: a name they chose and a number. Anything
// that would let a stranger find or message someone belongs in the friends
// system, behind a code, or nowhere.
// ---------------------------------------------------------------------------

export interface LeaderRow {
  id: string;
  handle: string;
  level: number;
  xp: number;
  you?: boolean;
}

/**
 * A plausible global ladder. Deterministic so the ranking does not reshuffle
 * every render, which would make the player's own position feel meaningless.
 */
const GLOBAL_LADDER: LeaderRow[] = [
  { id: 'g1', handle: 'NOCTURNE', level: 41, xp: 40_820 },
  { id: 'g2', handle: 'HALFLIGHT', level: 38, xp: 37_460 },
  { id: 'g3', handle: 'VESPER', level: 35, xp: 34_910 },
  { id: 'g4', handle: 'GRAIN', level: 31, xp: 30_770 },
  { id: 'g5', handle: 'SILVERHALIDE', level: 28, xp: 27_340 },
  { id: 'g6', handle: 'DODGE', level: 25, xp: 24_100 },
  { id: 'g7', handle: 'BURNIN', level: 22, xp: 21_650 },
  { id: 'g8', handle: 'STOPBATH', level: 19, xp: 18_220 },
  { id: 'g9', handle: 'FIXER', level: 17, xp: 16_050 },
  { id: 'g10', handle: 'SAFELIGHT', level: 14, xp: 13_480 },
  { id: 'g11', handle: 'CONTACT', level: 11, xp: 10_260 },
  { id: 'g12', handle: 'PINHOLE', level: 8, xp: 7_380 },
  { id: 'g13', handle: 'LATENT', level: 5, xp: 4_120 },
  { id: 'g14', handle: 'OVEREXPOSED', level: 3, xp: 2_050 },
];

export type Scope = 'global' | 'friends';

/**
 * Builds a ranked board with the player inserted in their real position.
 *
 * The player row is always returned even when it falls outside the visible
 * slice, because a leaderboard that cannot show you your own rank is not
 * telling you the thing you opened it for.
 */
export function buildBoard(
  scope: Scope,
  me: { handle: string; level: number; xp: number },
  friends: Friend[],
): { rows: LeaderRow[]; myRank: number } {
  const pool: LeaderRow[] =
    scope === 'global'
      ? GLOBAL_LADDER
      : friends
          .filter((f) => !f.blocked)
          .map((f) => ({ id: f.id, handle: f.handle, level: f.level, xp: f.xp }));

  const mine: LeaderRow = {
    id: 'me',
    handle: me.handle || 'YOU',
    level: me.level,
    xp: me.xp,
    you: true,
  };

  const rows = [...pool, mine].sort((a, b) => b.xp - a.xp);
  return { rows, myRank: rows.findIndex((r) => r.you) + 1 };
}

/** Total pool size the rank is out of, for "12th of 40,000" style copy. */
export function poolSize(scope: Scope, friendCount: number): number {
  return scope === 'global' ? GLOBAL_LADDER.length + 1 : friendCount + 1;
}

export { DIRECTORY };
