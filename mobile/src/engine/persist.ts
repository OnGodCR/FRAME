import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Auth, Profile } from './GameContext';
import type { DailyState } from '../data/assignments';
import type { FriendsState, ReferralProgress } from '../data/friends';
import type { ApplauseWallet } from '../data/economy';

// Local persistence for progression. Guests keep everything here and nowhere
// else, which is the promise the auth screen makes. Signed-in players will
// have this act as a cache in front of the server once the backend exists.

const KEY = 'frame.profile.v1';
const AUTH_KEY = 'frame.auth.v1';
const AGE_KEY = 'frame.agegate.v1';
const DAILY_KEY = 'frame.daily.v1';
const SEEN_KEY = 'frame.seen.v1';
const FRIENDS_KEY = 'frame.friends.v1';
const APPLAUSE_KEY = 'frame.applause.v1';
const REFERRAL_KEY = 'frame.referral.v1';

/** Only the durable parts. Anything derived is recomputed on load. */
type Saved = Pick<
  Profile,
  | 'handle'
  | 'level'
  | 'xp'
  | 'prestige'
  | 'film'
  | 'seasonXp'
  | 'owned'
  | 'equipped'
  | 'paidPass'
>;

export async function loadProfile(): Promise<Partial<Profile> | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

export async function saveProfile(p: Profile) {
  const saved: Saved = {
    handle: p.handle,
    level: p.level,
    xp: p.xp,
    prestige: p.prestige,
    film: p.film,
    seasonXp: p.seasonXp,
    owned: p.owned,
    equipped: p.equipped,
    paidPass: p.paidPass,
  };
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(saved));
  } catch {
    // Losing a write is survivable; the next one will carry the same state.
  }
}

export async function loadAuth(): Promise<Auth | null> {
  try {
    const raw = await AsyncStorage.getItem(AUTH_KEY);
    return raw ? (JSON.parse(raw) as Auth) : null;
  } catch {
    return null;
  }
}

export async function saveAuth(a: Auth) {
  try {
    await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(a));
  } catch {}
}

/**
 * The age gate outcome, per PRD 3. Stored on the device rather than the
 * account so clearing an account does not reset it.
 */
export async function loadAgeGate(): Promise<{ refusedCount: number } | null> {
  try {
    const raw = await AsyncStorage.getItem(AGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function saveAgeGate(refusedCount: number) {
  try {
    await AsyncStorage.setItem(AGE_KEY, JSON.stringify({ refusedCount }));
  } catch {}
}

/** Daily assignment progress. Survives restart or the streak is meaningless. */
export async function loadDaily(): Promise<DailyState | null> {
  try {
    const raw = await AsyncStorage.getItem(DAILY_KEY);
    return raw ? (JSON.parse(raw) as DailyState) : null;
  } catch {
    return null;
  }
}

export async function saveDaily(d: DailyState) {
  try {
    await AsyncStorage.setItem(DAILY_KEY, JSON.stringify(d));
  } catch {}
}

/**
 * One-off milestones: has this player finished a round, run a practice
 * capture, seen the map legend. Drives what the home screen offers and when
 * the first-purchase bundle is allowed to appear.
 */
export interface Seen {
  practised: boolean;
  finishedRound: boolean;
  starterOffered: boolean;
}

export const FRESH_SEEN: Seen = {
  practised: false,
  finishedRound: false,
  starterOffered: false,
};

export async function loadSeen(): Promise<Seen | null> {
  try {
    const raw = await AsyncStorage.getItem(SEEN_KEY);
    return raw ? { ...FRESH_SEEN, ...(JSON.parse(raw) as Partial<Seen>) } : null;
  } catch {
    return null;
  }
}

export async function saveSeen(s: Seen) {
  try {
    await AsyncStorage.setItem(SEEN_KEY, JSON.stringify(s));
  } catch {}
}

/** Generic JSON slot. The friends, applause, and referral state are all just
 *  serialisable objects, so they do not each need a bespoke pair of functions. */
async function loadJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

async function saveJson(key: string, value: unknown) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export const loadFriends = () => loadJson<FriendsState>(FRIENDS_KEY);
export const saveFriends = (v: FriendsState) => saveJson(FRIENDS_KEY, v);

export const loadApplause = () => loadJson<ApplauseWallet>(APPLAUSE_KEY);
export const saveApplause = (v: ApplauseWallet) => saveJson(APPLAUSE_KEY, v);

export const loadReferral = () => loadJson<ReferralProgress>(REFERRAL_KEY);
export const saveReferral = (v: ReferralProgress) => saveJson(REFERRAL_KEY, v);

export async function clearAll() {
  try {
    await AsyncStorage.multiRemove([
      KEY,
      AUTH_KEY,
      DAILY_KEY,
      SEEN_KEY,
      FRIENDS_KEY,
      APPLAUSE_KEY,
      REFERRAL_KEY,
    ]);
  } catch {}
}
