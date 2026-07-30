// ---------------------------------------------------------------------------
// Friends.
//
// **Friend codes only. There is no discovery, no suggestions, no search.**
// marketing/BRIEF.md 9 lists "never imply stranger play" as a legal line, and
// the age gate means minors are on this platform. A code you deliberately hand
// to somebody is consent; a list of nearby strangers is not, and no amount of
// UI copy makes it one.
//
// There is no server (CLAUDE.md 7), so the list lives in AsyncStorage and the
// "other players" are local fixtures. The shapes here are the ones the server
// will need, so wiring them up later is a data-source swap rather than a
// rewrite.
// ---------------------------------------------------------------------------

/**
 * Unambiguous alphabet, same as the invite codes. No O/0, no I/1/L, because
 * these get read aloud and typed by hand.
 */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const FRIEND_CODE_LENGTH = 8;

/** A friend code is display-only; it never encodes anything about the player. */
export function makeFriendCode(rand: () => number = Math.random): string {
  let out = '';
  for (let i = 0; i < FRIEND_CODE_LENGTH; i++) {
    out += CODE_ALPHABET[Math.floor(rand() * CODE_ALPHABET.length)];
  }
  return out;
}

/**
 * Normalises typed input: case and spacing only.
 *
 * An earlier version also "fixed" confusable characters by mapping O and I
 * onto other letters. That was actively wrong: it rewrote perfectly valid
 * codes into different ones, so a correctly typed code failed to match. The
 * alphabet already excludes the confusable characters, so there is nothing
 * left to disambiguate and the safe thing is to touch the input as little as
 * possible.
 */
export function normaliseCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, FRIEND_CODE_LENGTH);
}

export interface Friend {
  id: string;
  handle: string;
  code: string;
  level: number;
  /** Total season XP, for the friends leaderboard. */
  xp: number;
  /** Whether they have posted today's capture. */
  postedToday: boolean;
  /** Whether this player has already applauded them today. */
  applauded?: boolean;
  /** Local-only moderation state. */
  blocked?: boolean;
  reported?: boolean;
}

export interface FriendsState {
  /** This player's own code, generated once and then stable. */
  myCode: string;
  friends: Friend[];
  /** Codes of people this player referred or was referred by. */
  referredBy: string | null;
  referrals: string[];
}

/**
 * People who exist to be findable by code in the demo. Nobody appears in the
 * friends list until their code is deliberately entered.
 */
export const DIRECTORY: Friend[] = [
  { id: 'kai', handle: 'KAI', code: 'KAY2XQ7M', level: 9, xp: 8420, postedToday: true },
  { id: 'maya', handle: 'MAYA', code: 'MAYA5TRW', level: 12, xp: 11930, postedToday: true },
  { id: 'dev', handle: 'DEV', code: 'DEV77KPZ', level: 6, xp: 5210, postedToday: false },
  { id: 'jules', handle: 'JULES', code: 'JUKE3NBH', level: 15, xp: 14680, postedToday: true },
  { id: 'ari', handle: 'ARI', code: 'ARN9WQDF', level: 4, xp: 3140, postedToday: false },
];

export const FRESH_FRIENDS: FriendsState = {
  myCode: '',
  friends: [],
  referredBy: null,
  referrals: [],
};

/** Looks up a code in the directory. Exact match only, after normalising. */
export function findByCode(code: string): Friend | null {
  const c = code.toUpperCase();
  return DIRECTORY.find((f) => f.code === c) ?? null;
}

/**
 * The referral task track. Shared between the two players in a pair, which is
 * the point: it is a reason to play together rather than a reason to spam
 * codes at strangers.
 */
export interface ReferralTask {
  key: string;
  label: string;
  target: number;
}

export const REFERRAL_TASKS: ReferralTask[] = [
  { key: 'dailies', label: 'Daily assignments completed', target: 3 },
  { key: 'wins', label: 'Rounds won', target: 3 },
  { key: 'together', label: 'Games played together', target: 10 },
];

export type ReferralProgress = Record<string, number>;

export const FRESH_REFERRAL_PROGRESS: ReferralProgress = {
  dailies: 0,
  wins: 0,
  together: 0,
};
