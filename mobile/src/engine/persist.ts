import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Auth, Profile } from './GameContext';

// Local persistence for progression. Guests keep everything here and nowhere
// else, which is the promise the auth screen makes. Signed-in players will
// have this act as a cache in front of the server once the backend exists.

const KEY = 'frame.profile.v1';
const AUTH_KEY = 'frame.auth.v1';
const AGE_KEY = 'frame.agegate.v1';

/** Only the durable parts. Anything derived is recomputed on load. */
type Saved = Pick<
  Profile,
  'handle' | 'level' | 'xp' | 'prestige' | 'film' | 'owned' | 'equipped' | 'paidPass'
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

export async function clearAll() {
  try {
    await AsyncStorage.multiRemove([KEY, AUTH_KEY]);
  } catch {}
}
