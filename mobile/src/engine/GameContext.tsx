import {
  loadProfile,
  saveProfile,
  loadAuth,
  saveAuth,
  loadDaily,
  saveDaily,
  loadSeen,
  saveSeen,
  loadFriends,
  saveFriends,
  loadApplause,
  saveApplause,
  loadReferral,
  saveReferral,
  clearAll,
  FRESH_SEEN,
  type Seen,
} from './persist';
import * as notify from './notify';
import { TEST_MODE, TIME_SCALE } from '../config';
import { passState, XP_PER_TIER, type PassState, type StoreProduct } from '../data/catalog';
import {
  FRESH_DAILY,
  DAILY_REWARD,
  assignmentFor,
  completeDaily as advanceDaily,
  isDailyOpen,
  dayIndex,
  type DailyState,
  type Assignment,
} from '../data/assignments';
import {
  ECONOMY,
  FRESH_APPLAUSE,
  applausePayout,
  creditApplause,
  type ApplauseWallet,
} from '../data/economy';
import {
  FRESH_FRIENDS,
  FRESH_REFERRAL_PROGRESS,
  FRIEND_CODE_LENGTH,
  findByCode,
  makeFriendCode,
  normaliseCode,
  type FriendsState,
  type ReferralProgress,
} from '../data/friends';
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from 'react';

// ---------------------------------------------------------------------------
// FRAME demo engine.
// Everything a real deployment would get from the server (ticks, reveals,
// eliminations, other players) is scripted here on a compressed timeline so a
// full round is experienceable in a few minutes. Timers the player sees are
// rendered from a scaled "round clock" so the UI reads like a real 30:00 round.
// ---------------------------------------------------------------------------

export type Route =
  | 'splash'
  | 'dob'
  | 'legal'
  | 'auth'
  | 'handle'
  | 'mapTutorial'
  | 'home'
  | 'shop'
  | 'pass'
  | 'loadout'
  | 'join'
  | 'lobby'
  | 'roleReveal'
  | 'round'
  | 'checkin'
  | 'blackout'
  | 'results'
  | 'solo'
  | 'soloRun'
  | 'friends'
  | 'leaderboard';

export type Role = 'hider' | 'seeker';
export type PlayerState = 'alive' | 'tagged' | 'blackout';

export interface Bot {
  id: string;
  name: string;
  state: PlayerState;
  pos: { x: number; y: number }; // normalized 0..1 map coords
}

export interface TickerEvent {
  id: number;
  text: string;
  tone: 'info' | 'accent' | 'danger' | 'warn';
}

export interface RevealPin {
  id: string;
  name: string;
  pos: { x: number; y: number };
  bornAt: number; // elapsed seconds
  ttl: number;
}

export interface FeedPhoto {
  id: number;
  name: string;
  seedBack: number;
  seedFront: number;
  checkinIndex: number;
  at: number; // elapsed
}

export interface CheckinState {
  index: number;
  openedAt: number;
  deadline: number; // elapsed seconds
  submitted: boolean;
}

export interface RoundState {
  role: Role;
  elapsed: number;
  totalReal: number; // real seconds the demo round lasts
  zoneScale: number;
  shrinkWarnUntil: number | null;
  bots: Bot[];
  ticker: TickerEvent[];
  checkin: CheckinState | null;
  checkinsPassed: number;
  reveals: RevealPin[];
  photos: FeedPhoto[];
  proximity: number; // 0..1, seeker BLE signal to nearest hider
  proximityTarget: string | null;
  tags: string[];
  pingFlashUntil: number | null;
  outcome: null | 'survived' | 'blackout' | 'cleared' | 'timeup' | 'left';
}

/**
 * Solo modes. Neither needs a party, a server, or anyone else to be awake.
 *
 * 'test'  TEST FRAME. The practice run. A real 60 second window and the real
 *         capture sequence, so the first time a player feels that timer is not
 *         also the first time their survival depends on it. Letting it expire
 *         is allowed and shows them the blackout state once, deliberately.
 * 'daily' The daily assignment. One prompt, shared worldwide, no timer, pays
 *         XP and FILM. See data/assignments.ts.
 */
export type SoloMode = 'test' | 'daily';

export interface SoloState {
  mode: SoloMode;
  elapsed: number;
  /** Seconds allowed, or null for an untimed run. */
  window: number | null;
  outcome: 'pending' | 'passed' | 'expired';
}

/** The practice window matches the real one so the rehearsal is honest. */
export const TEST_FRAME_WINDOW = 60;

export interface Equipped {
  title: string;
  pin: string;
  frame: string;
  blackout: string;
  tag: string;
}

export interface Auth {
  kind: 'google' | 'apple' | 'guest';
  email: string | null;
}

export interface Profile {
  handle: string;
  level: number;
  xp: number; // 0..1 through current level
  prestige: number;
  /**
   * Soft currency. Cosmetics only, and **earned only**.
   *
   * FILM must never become purchasable with real money while seeker bidding
   * exists (see `bidSeeker`), because that would turn a role advantage into
   * something you can buy. marketing/BRIEF.md 9 lists "never imply anything
   * purchasable helps you win" as a legal line, not a tone note.
   */
  film: number;
  /** Drives season pass tier. See passState() in data/catalog.ts. */
  seasonXp: number;
  owned: string[];
  equipped: Equipped;
  paidPass: boolean;
}

/**
 * What a real new account looks like. Level 1, nothing earned, nothing owned
 * beyond the defaults that every account has.
 *
 * FILM starts at zero deliberately. The daily assignment pays 75, the cheapest
 * shop item is 300, so the shop becomes reachable in about four days of showing
 * up. That is the intended habit loop and handing over a pile of currency at
 * install would remove the only reason to come back on day two.
 */
export const FRESH_PROFILE: Profile = {
  handle: '',
  level: 1,
  xp: 0,
  prestige: 0,
  film: 0,
  seasonXp: 0,
  owned: ['title-unseen', 'pin-acid', 'frame-brackets', 'static-default', 'tag-shutter'],
  equipped: {
    title: 'title-unseen',
    pin: 'pin-acid',
    frame: 'frame-brackets',
    blackout: 'static-default',
    tag: 'tag-shutter',
  },
  paidPass: false,
};

/**
 * A mid-progression account, purely so the pass, loadout, and shop screens can
 * be reviewed with something in them. Off by default: this used to be the
 * initial state for everyone, which meant a new install opened at level 7 with
 * 1,250 FILM and twelve tiers of a pass it had never played.
 *
 * Flip DEMO_SEED to true to get it back for screenshots. Never ship it true.
 */
const DEMO_SEED = false && TEST_MODE;

const SEEDED_PROFILE: Profile = {
  ...FRESH_PROFILE,
  level: 7,
  xp: 0.58,
  film: 1250,
  seasonXp: 11_420,
  owned: [...FRESH_PROFILE.owned, 'title-patient'],
};

/**
 * Applies XP and rolls levels. Shared so every award path behaves the same.
 * Season XP accumulates alongside, which is what actually advances the pass.
 */
function withXp(p: Profile, n: number): Profile {
  let xp = p.xp + n;
  let level = p.level;
  while (xp >= 1) {
    xp -= 1;
    level += 1;
  }
  return { ...p, xp, level, seasonXp: p.seasonXp + Math.round(n * 1000) };
}

const HIDER_BOTS: Bot[] = [
  { id: 'maya', name: 'MAYA', state: 'alive', pos: { x: 0.3, y: 0.34 } },
  { id: 'dev', name: 'DEV', state: 'alive', pos: { x: 0.68, y: 0.28 } },
  { id: 'jules', name: 'JULES', state: 'alive', pos: { x: 0.62, y: 0.66 } },
  { id: 'ari', name: 'ARI', state: 'alive', pos: { x: 0.38, y: 0.72 } },
];
export const SEEKER_BOT = { id: 'kai', name: 'KAI' };

/** Default round length. 30 minutes, not 45: a shorter round means more rounds
 *  per session, more results screens, and a lower bar to saying yes to one. */
export const ROUND_DISPLAY_MINUTES = 30;
export const ROUND_DISPLAY_SECONDS = ROUND_DISPLAY_MINUTES * 60;
/**
 * How long a demo round actually takes in real seconds. The displayed clock is
 * scaled from this up to ROUND_DISPLAY_SECONDS, so the round clock visibly runs
 * about 7x faster than a wall clock. That is intentional (a reviewer should not
 * have to stand outside for half an hour to see the whole arc) but it was
 * completely unlabelled, which reads as a bug.
 *
 * Two things fix that: DEMO_SPEED is now surfaced in the round UI, and a round
 * can be started at real time instead.
 */
/**
 * The round now runs in real time: one displayed second per real second.
 *
 * It used to compress 30 display minutes into 250 real seconds, which made the
 * clock jump 7 to 8 seconds per tick and read as a broken timer. Everything on
 * the timeline is therefore authored in real seconds now, and the check-in
 * ticks sit at the honest 5 minute spacing from PRD 4.2 rather than at
 * scaled-down stand-ins.
 *
 * The cost is that watching a whole round takes 30 minutes, which is correct
 * for a player and slow for a reviewer. That is what DEV_TIME_SCALE is for.
 */
const ROUND_REAL_SECONDS = ROUND_DISPLAY_SECONDS;

/**
 * Development-only clock multiplier. 1 is real time and is what ships.
 *
 * Raise it to skim a full round quickly while working on the round screens.
 * It scales the tick interval, not the timeline, so the clock still counts
 * down one displayed second at a time and the check-in window keeps its real
 * duration relative to everything else.
 */
export const DEV_TIME_SCALE = TIME_SCALE;

let tickerId = 0;
const ev = (text: string, tone: TickerEvent['tone'] = 'info'): TickerEvent => ({
  id: ++tickerId,
  text,
  tone,
});

function freshRound(role: Role): RoundState {
  return {
    role,
    elapsed: 0,
    totalReal: ROUND_REAL_SECONDS,
    zoneScale: 1,
    shrinkWarnUntil: null,
    bots: HIDER_BOTS.map((b) => ({ ...b, state: 'alive', pos: { ...b.pos } })),
    ticker: [],
    checkin: null,
    checkinsPassed: 0,
    reveals: [],
    photos: [],
    proximity: 0,
    proximityTarget: null,
    tags: [],
    pingFlashUntil: null,
    outcome: null,
  };
}

// --- scripted timelines -----------------------------------------------------

type Script = Record<number, (r: RoundState) => void>;

/** PRD 4.4: 60 seconds from the tick to submit. Real seconds now that the
 *  round clock is real time, so this is the actual specified window. */
const CHECKIN_WINDOW = 60;

/**
 * The hider's check-in ticks, as elapsed real seconds into the round.
 *
 * Single source of truth: the scripted timeline below and the local
 * notifications scheduled in `startRound` both derive from this. They must
 * never drift, because a notification firing at a moment the engine does not
 * agree is a check-in window is exactly the bug that gets someone eliminated
 * for nothing. When server state replaces this engine, these become the
 * `window_open` timestamps the server writes at round start.
 */
export const HIDER_CHECKIN_TICKS = [
  { index: 1, at: 5 * 60 },
  { index: 2, at: 10 * 60 },
  { index: 3, at: 15 * 60 },
  { index: 4, at: 20 * 60 },
  { index: 5, at: 25 * 60 },
] as const;

const hiderScriptAuthored: Script = {
  6: (r) => r.ticker.unshift(ev('MAYA passed check-in 03')),
  14: (r) => r.ticker.unshift(ev('BEACON at Fountain Plaza claimed by JULES')),
  72: (r) => {
    r.pingFlashUntil = 80;
    r.ticker.unshift(ev("Reveal tick · you've been pinged", 'warn'));
  },
  92: (r) => {
    const dev = r.bots.find((b) => b.id === 'dev')!;
    dev.state = 'tagged';
    r.ticker.unshift(ev('DEV was tagged by KAI', 'danger'));
  },
  108: (r) => {
    r.shrinkWarnUntil = 138;
    r.ticker.unshift(ev('Zone contracts to 75% in 0:60', 'warn'));
  },
  138: (r) => {
    r.zoneScale = 0.75;
    r.shrinkWarnUntil = null;
    r.ticker.unshift(ev('Zone contracted · 750 m radius', 'warn'));
  },
  204: (r) => {
    const ari = r.bots.find((b) => b.id === 'ari')!;
    ari.state = 'blackout';
    r.ticker.unshift(ev('ARI was BLACKED OUT · missed check-in', 'danger'));
  },
  222: (r) => r.ticker.unshift(ev('JULES used GHOST PING', 'accent')),
};

// Opening each check-in window is generated rather than written out, so the
// timeline and the scheduled notifications cannot disagree.
/**
 * The ambient script was authored against the old 250 second compressed round.
 * Now that the clock is real time, those beats are stretched across the full
 * 30 minutes so the round does not fire everything in its first four minutes
 * and then go silent. Rescaling preserves the authored pacing rather than
 * requiring every key to be rewritten by hand.
 */
const AUTHORED_ROUND_SECONDS = 250;

function rescale(s: Script): Script {
  const scale = ROUND_REAL_SECONDS / AUTHORED_ROUND_SECONDS;
  const out: Script = {};
  for (const key of Object.keys(s)) {
    out[Math.round(Number(key) * scale)] = s[Number(key)];
  }
  return out;
}


let photoId = 0;
const feed = (r: RoundState, botId: string, idx: number) => {
  const b = r.bots.find((x) => x.id === botId)!;
  if (b.state !== 'alive') return;
  r.photos.unshift({
    id: ++photoId,
    name: b.name,
    seedBack: (r.elapsed + 1) * 97 + botId.length * 13,
    seedFront: (r.elapsed + 1) * 131 + botId.length * 7,
    checkinIndex: idx,
    at: r.elapsed,
  });
};

const revealAll = (r: RoundState, ttl = 30) => {
  r.bots
    .filter((b) => b.state === 'alive')
    .forEach((b) =>
      r.reveals.push({
        id: `${b.id}-${r.elapsed}`,
        name: b.name,
        pos: { ...b.pos },
        bornAt: r.elapsed,
        ttl,
      }),
    );
};

const seekerScriptAuthored: Script = {
  4: (r) => r.ticker.unshift(ev('Check-in tick 01 sent to all hiders')),
  8: (r) => feed(r, 'maya', 1),
  12: (r) => feed(r, 'jules', 1),
  16: (r) => feed(r, 'ari', 1),
  20: (r) => feed(r, 'dev', 1),
  32: (r) => {
    revealAll(r);
    r.ticker.unshift(ev('Reveal tick · 4 positions on map', 'accent'));
  },
  56: (r) => {
    const ari = r.bots.find((b) => b.id === 'ari')!;
    ari.state = 'blackout';
    r.ticker.unshift(ev('ARI was BLACKED OUT · missed check-in', 'danger'));
  },
  70: (r) => feed(r, 'maya', 2),
  74: (r) => feed(r, 'jules', 2),
  78: (r) => feed(r, 'dev', 2),
  82: (r) => {
    r.proximityTarget = 'maya';
    r.ticker.unshift(ev('BLE signal detected nearby', 'accent'));
  },
  128: (r) => {
    revealAll(r);
    r.ticker.unshift(ev('Reveal tick', 'accent'));
  },
  150: (r) => feed(r, 'jules', 3),
  154: (r) => feed(r, 'dev', 3),
  170: (r) => {
    const dev = r.bots.find((b) => b.id === 'dev')!;
    if (dev.state === 'alive') {
      dev.state = 'blackout';
      r.ticker.unshift(ev('DEV was BLACKED OUT · lens covered', 'danger'));
    }
  },
  182: (r) => {
    if (r.bots.find((b) => b.id === 'jules')!.state === 'alive') {
      r.proximityTarget = 'jules';
      r.ticker.unshift(ev('BLE signal detected nearby', 'accent'));
    }
  },
};

const hiderScript: Script = rescale(hiderScriptAuthored);
const seekerScript: Script = rescale(seekerScriptAuthored);

// Check-in windows are added after the rescale because they are already
// authored in real seconds, at the honest 5 minute spacing from PRD 4.2.
for (const tick of HIDER_CHECKIN_TICKS) {
  hiderScript[tick.at] = (r) => {
    r.checkin = {
      index: tick.index,
      openedAt: tick.at,
      deadline: tick.at + CHECKIN_WINDOW,
      submitted: false,
    };
  };
}

function stepRound(r: RoundState): RoundState {
  const next: RoundState = {
    ...r,
    elapsed: r.elapsed + 1,
    bots: r.bots.map((b) => ({ ...b, pos: { ...b.pos } })),
    ticker: [...r.ticker],
    reveals: [...r.reveals],
    photos: [...r.photos],
    checkin: r.checkin ? { ...r.checkin } : null,
    tags: [...r.tags],
  };
  const t = next.elapsed;

  // gentle drift so the world feels alive
  next.bots.forEach((b, i) => {
    if (b.state !== 'alive') return;
    b.pos.x += Math.sin(t / 9 + i * 2.1) * 0.0012;
    b.pos.y += Math.cos(t / 11 + i * 1.3) * 0.0012;
  });

  const script = next.role === 'hider' ? hiderScript : seekerScript;
  script[t]?.(next);

  // expire reveals
  next.reveals = next.reveals.filter((p) => t - p.bornAt < p.ttl);

  // seeker BLE proximity ramp
  if (next.role === 'seeker' && next.proximityTarget) {
    const target = next.bots.find((b) => b.id === next.proximityTarget);
    if (target && target.state === 'alive') {
      next.proximity = Math.min(1, next.proximity + 0.045);
    } else {
      next.proximity = 0;
      next.proximityTarget = null;
    }
  } else if (next.role === 'seeker') {
    next.proximity = Math.max(0, next.proximity - 0.2);
  }

  // hider check-in window expiry → blacked out
  if (
    next.role === 'hider' &&
    next.checkin &&
    !next.checkin.submitted &&
    t >= next.checkin.deadline
  ) {
    next.outcome = 'blackout';
  }

  next.ticker = next.ticker.slice(0, 5);

  // round end
  if (t >= next.totalReal && !next.outcome) {
    if (next.role === 'hider') next.outcome = 'survived';
    else {
      const remaining = next.bots.filter((b) => b.state === 'alive').length;
      next.outcome = remaining === 0 ? 'cleared' : 'timeup';
    }
  }
  return next;
}

// --- context ----------------------------------------------------------------

interface Game {
  route: Route;
  go: (r: Route) => void;
  profile: Profile;
  setHandle: (h: string) => void;
  auth: Auth | null;
  setAuth: (a: Auth) => void;
  partyCode: string;
  round: RoundState | null;
  nextRole: Role;
  startRound: (role?: Role) => void;
  submitCheckin: () => void;
  tag: () => void;
  leaveRound: () => void;
  finishRound: () => void;
  addXp: (n: number) => void;
  purchase: (id: string, costFilm: number) => boolean;
  buyPass: () => void;
  redeemBundle: (frameId: string, film: number) => void;
  /** Deducts FILM. Used by seeker bidding, which is a sink, not a purchase. */
  spendFilm: (n: number) => void;
  /** Real-money store purchase. Grants cosmetics and pass tiers, never FILM. */
  buyProduct: (p: StoreProduct) => void;
  equip: (slot: keyof Equipped, id: string) => void;
  // --- solo ---
  solo: SoloState | null;
  startSolo: (mode: SoloMode) => void;
  passSolo: () => void;
  exitSolo: () => void;
  daily: DailyState;
  dailyAssignment: Assignment;
  dailyOpen: boolean;
  // --- milestones and retention ---
  seen: Seen;
  markSeen: (patch: Partial<Seen>) => void;
  /** Wipes local progression back to a new account. See CLAUDE.md 7. */
  resetProgress: () => void;
  /**
   * Whether this session may use account-only features: shop, FILM, friends,
   * leaderboard, referrals.
   *
   * Guests cannot. That is not a product preference, it is what the schema
   * enforces: every social table keys off `profiles`, which keys off
   * `auth.users`, so a guest has no row to own anything with. The client hides
   * these surfaces so the app reads honestly; the database would refuse
   * regardless. See supabase/migrations/0002_social.sql.
   */
  hasAccount: boolean;
  // --- social ---
  friends: FriendsState;
  /** Adds by code. Returns why it failed, or null on success. */
  addFriend: (code: string) => string | null;
  removeFriend: (id: string) => void;
  blockFriend: (id: string) => void;
  reportFriend: (id: string) => void;
  /** Applauds a friend's capture. Returns FILM paid, which may be 0 at cap. */
  applaud: (id: string) => number;
  /** FILM earned from applause today, and the cap. */
  applauseToday: { earned: number; cap: number };
  /** Enters a referral code. Returns why it failed, or null on success. */
  redeemReferral: (code: string) => string | null;
  referralProgress: ReferralProgress;
  /** Season pass position, derived from profile.seasonXp. */
  pass: PassState;
  /** Books a local reminder for the next round with this party. */
  scheduleNextRound: (when: Date) => void;
}

const Ctx = createContext<Game | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [route, setRoute] = useState<Route>('splash');
  const [profile, setProfile] = useState<Profile>(DEMO_SEED ? SEEDED_PROFILE : FRESH_PROFILE);
  const [round, setRound] = useState<RoundState | null>(null);
  const [nextRole, setNextRole] = useState<Role>('hider');
  const [auth, setAuth] = useState<Auth | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [solo, setSolo] = useState<SoloState | null>(null);
  const [daily, setDaily] = useState<DailyState>(FRESH_DAILY);
  const [seen, setSeen] = useState<Seen>(FRESH_SEEN);
  const [friends, setFriends] = useState<FriendsState>(() => ({
    ...FRESH_FRIENDS,
    myCode: makeFriendCode(),
  }));
  const [applause, setApplause] = useState<ApplauseWallet>(FRESH_APPLAUSE);
  const [referralProgress, setReferralProgress] =
    useState<ReferralProgress>(FRESH_REFERRAL_PROGRESS);

  // Progression survives a restart. Guests have nowhere else for it to live.
  useEffect(() => {
    let live = true;
    (async () => {
      const [savedProfile, savedAuth, savedDaily, savedSeen, savedFriends, savedApplause, savedReferral] =
        await Promise.all([
          loadProfile(),
          loadAuth(),
          loadDaily(),
          loadSeen(),
          loadFriends(),
          loadApplause(),
          loadReferral(),
        ]);
      if (!live) return;
      if (savedProfile) setProfile((p) => ({ ...p, ...savedProfile }));
      if (savedAuth) setAuth(savedAuth);
      if (savedDaily) setDaily(savedDaily);
      if (savedSeen) setSeen(savedSeen);
      // Keep the generated code if the saved state predates having one.
      if (savedFriends) {
        setFriends((f) => ({ ...savedFriends, myCode: savedFriends.myCode || f.myCode }));
      }
      if (savedApplause) setApplause(savedApplause);
      if (savedReferral) setReferralProgress(savedReferral);
      setHydrated(true);
    })();
    return () => {
      live = false;
    };
  }, []);

  // Skip the first write so hydration does not immediately overwrite itself.
  useEffect(() => {
    if (hydrated) saveProfile(profile);
  }, [profile, hydrated]);

  useEffect(() => {
    if (auth) saveAuth(auth);
  }, [auth]);

  useEffect(() => {
    if (hydrated) saveDaily(daily);
  }, [daily, hydrated]);

  useEffect(() => {
    if (hydrated) saveSeen(seen);
  }, [seen, hydrated]);

  useEffect(() => {
    if (hydrated) saveFriends(friends);
  }, [friends, hydrated]);

  useEffect(() => {
    if (hydrated) saveApplause(applause);
  }, [applause, hydrated]);

  useEffect(() => {
    if (hydrated) saveReferral(referralProgress);
  }, [referralProgress, hydrated]);

  // --- social ---------------------------------------------------------------

  /**
   * Adds a friend by code. Codes only: there is no search and no suggestions,
   * because a code you hand somebody is consent and a list of nearby strangers
   * is not (marketing/BRIEF.md 9, and the age gate means minors are here).
   */
  const addFriend = useCallback(
    (raw: string): string | null => {
      const code = normaliseCode(raw);
      if (code.length < FRIEND_CODE_LENGTH) return 'That code is too short.';
      if (code === friends.myCode) return 'That is your own code.';
      if (friends.friends.some((f) => f.code === code)) return 'Already friends.';
      const found = findByCode(code);
      if (!found) return 'No player with that code.';
      setFriends((f) => ({ ...f, friends: [...f.friends, { ...found }] }));
      return null;
    },
    [friends.myCode, friends.friends],
  );

  const removeFriend = useCallback((id: string) => {
    setFriends((f) => ({ ...f, friends: f.friends.filter((x) => x.id !== id) }));
  }, []);

  /** Block is permanent and also removes them from every social surface. */
  const blockFriend = useCallback((id: string) => {
    setFriends((f) => ({
      ...f,
      friends: f.friends.map((x) => (x.id === id ? { ...x, blocked: true } : x)),
    }));
  }, []);

  const reportFriend = useCallback((id: string) => {
    setFriends((f) => ({
      ...f,
      friends: f.friends.map((x) => (x.id === id ? { ...x, reported: true } : x)),
    }));
  }, []);

  /**
   * Applauds a friend's capture. Returns the FILM the RECEIVER would earn.
   *
   * Past the daily cap this returns 0 and the applause still registers. That
   * is deliberate: the social signal is the point, and refusing to let friends
   * clap for each other would be a worse product than simply not paying for it.
   *
   * In this build the player is applauding others, so no FILM lands on their
   * own balance. The cap is tracked against what they RECEIVE, which the demo
   * simulates on their own posts.
   */
  const applaud = useCallback(
    (id: string): number => {
      const today = dayIndex();
      const payout = applausePayout(applause, today);
      setFriends((f) => ({
        ...f,
        friends: f.friends.map((x) => (x.id === id ? { ...x, applauded: true } : x)),
      }));
      if (payout > 0) {
        setApplause((w) => creditApplause(w, today, payout));
        setProfile((p) => ({ ...p, film: p.film + payout }));
      }
      return payout;
    },
    [applause],
  );

  /** Referral, once per account, paying both sides. */
  const redeemReferral = useCallback(
    (raw: string): string | null => {
      const code = normaliseCode(raw);
      if (friends.referredBy) return 'You have already used a referral code.';
      if (code === friends.myCode) return 'That is your own code.';
      const found = findByCode(code);
      if (!found) return 'No player with that code.';
      setFriends((f) => ({
        ...f,
        referredBy: code,
        friends: f.friends.some((x) => x.id === found.id)
          ? f.friends
          : [...f.friends, { ...found }],
      }));
      setProfile((p) => ({ ...p, film: p.film + ECONOMY.referralFilm }));
      return null;
    },
    [friends.referredBy, friends.myCode],
  );
  const routeRef = useRef(route);
  routeRef.current = route;

  const go = useCallback((r: Route) => setRoute(r), []);

  // 1 Hz logical clock while a round is live
  useEffect(() => {
    if (!round || round.outcome) return;
    const inRound =
      route === 'round' || route === 'checkin' || route === 'roleReveal';
    if (!inRound) return;
    const id = setInterval(() => {
      setRound((r) => (r && !r.outcome ? stepRound(r) : r));
    }, 1000 / TIME_SCALE);
    return () => clearInterval(id);
  }, [round?.outcome, round == null, route]);

  // react to outcomes
  useEffect(() => {
    if (!round?.outcome) return;
    // The round is over however it ended. Any tick still pending would fire
    // into a game that no longer exists.
    notify.cancelAll();
    if (round.outcome === 'blackout') {
      go('blackout');
    } else if (round.outcome !== 'left') {
      go('results');
    }
  }, [round?.outcome]);

  // PRD 4.6: a hider is told a reveal happened so they can react, but never
  // what the seeker actually sees. Reveal ticks are server-driven and so
  // cannot be scheduled ahead like check-ins; in the demo the scripted
  // timeline stands in for that push.
  const pingedAt = round?.role === 'hider' ? round.pingFlashUntil : null;
  useEffect(() => {
    if (pingedAt == null) return;
    notify.pingReveal();
  }, [pingedAt]);

  // --- solo modes ----------------------------------------------------------

  // 1 Hz clock for a timed solo run. Only TEST FRAME has a window; the daily
  // assignment is something you do on a walk and rushing it teaches nothing.
  useEffect(() => {
    if (!solo || solo.window == null || solo.outcome !== 'pending') return;
    if (route !== 'soloRun') return;
    const id = setInterval(() => {
      setSolo((s) => {
        if (!s || s.window == null || s.outcome !== 'pending') return s;
        const elapsed = s.elapsed + 1;
        return {
          ...s,
          elapsed,
          outcome: elapsed >= s.window ? 'expired' : 'pending',
        };
      });
    }, 1000);
    return () => clearInterval(id);
  }, [solo?.outcome, solo == null, solo?.window, route]);

  const startSolo = useCallback(
    (mode: SoloMode) => {
      setSolo({
        mode,
        elapsed: 0,
        window: mode === 'test' ? TEST_FRAME_WINDOW : null,
        outcome: 'pending',
      });
      go('soloRun');
    },
    [go],
  );

  const passSolo = useCallback(() => {
    setSolo((s) => (s && s.outcome === 'pending' ? { ...s, outcome: 'passed' } : s));
    setSeen((s) => ({ ...s, practised: true }));
  }, []);

  /**
   * Leaving the run. A passed daily assignment pays out here rather than at
   * validation time, so that a player who backs out mid-sequence is not
   * credited, and so the payout can never be applied twice.
   */
  /**
   * Leaving the run. A passed daily assignment pays out here rather than at
   * validation time, so that a player who backs out mid-sequence is not
   * credited.
   *
   * The payout deliberately does NOT live inside a state updater. It used to
   * call setProfile from inside a setDaily updater nested in a setSolo updater,
   * and React is free to invoke an updater more than once, which could pay the
   * FILM twice. Updaters must stay pure; side effects go here, guarded by the
   * same isDailyOpen check so a second run on the same day still pays nothing.
   */
  const exitSolo = useCallback(() => {
    const s = solo;
    if (s && s.mode === 'daily' && s.outcome === 'passed' && isDailyOpen(daily)) {
      setDaily((d) => (isDailyOpen(d) ? advanceDaily(d) : d));
      setProfile((p) => withXp({ ...p, film: p.film + DAILY_REWARD.film }, DAILY_REWARD.xp));
    }
    setSolo(null);
    go('home');
  }, [go, solo, daily]);

  /**
   * Wipes local progression back to a genuinely new account.
   *
   * There is no server (see CLAUDE.md 7), so "new account" means "this device
   * has no stored state". Without this the only way to test a first run is
   * clearing app data by hand, and on web it means clearing site storage, which
   * is easy to get wrong and easy to mistake for a bug.
   */
  const resetProgress = useCallback(async () => {
    await clearAll();
    setProfile(FRESH_PROFILE);
    setDaily(FRESH_DAILY);
    setSeen(FRESH_SEEN);
    setRound(null);
    setSolo(null);
    setAuth(null);
    go('splash');
  }, [go]);

  const markSeen = useCallback(
    (patch: Partial<Seen>) => setSeen((s) => ({ ...s, ...patch })),
    [],
  );

  /** A local reminder, so "same crew, Friday" survives closing the app. */
  const scheduleNextRound = useCallback((when: Date) => {
    notify.scheduleRoundReminder(when);
  }, []);

  const startRound = useCallback(
    (role?: Role) => {
      const r = role ?? nextRole;
      setNextRole(r);
      setRound(freshRound(r));
      go('roleReveal');

      // Contextual permission, at the first round rather than at launch, and
      // only for the role that actually receives ticks. Seekers do not submit
      // check-ins (PRD 4.4), so there is nothing to alert them about yet.
      if (r !== 'hider') {
        notify.cancelAll();
        return;
      }
      // The round clock starts now, so the windows are known now. Schedule the
      // whole round up front: this is the entire point of the mechanic working
      // with the phone in a pocket.
      const startedAt = Date.now();
      (async () => {
        const granted = await notify.ensurePermission();
        if (!granted) return;
        await notify.scheduleTicks(
          HIDER_CHECKIN_TICKS.map((t) => ({
            index: t.index,
            opensAt: new Date(startedAt + t.at * 1000),
            closesAt: new Date(startedAt + (t.at + CHECKIN_WINDOW) * 1000),
          })),
        );
      })();
    },
    [nextRole, go],
  );

  // Fires the moment validation passes. The window can expire while the
  // player is still looking at the confirmation screen, and that must not
  // count against them.
  const submitCheckin = useCallback(() => {
    let submittedIndex: number | null = null;
    setRound((r) => {
      if (!r || !r.checkin) return r;
      submittedIndex = r.checkin.index;
      return {
        ...r,
        checkin: null,
        checkinsPassed: r.checkinsPassed + 1,
        ticker: [
          ev(`Check-in 0${r.checkin.index} submitted · visible to seeker`, 'accent'),
          ...r.ticker,
        ],
      };
    });
    // Telling someone who already submitted that they are 20 seconds from
    // being blacked out is worse than sending nothing at all.
    if (submittedIndex !== null) notify.cancelTick(submittedIndex);
  }, []);

  const tag = useCallback(() => {
    setRound((r) => {
      if (!r || !r.proximityTarget) return r;
      const bots = r.bots.map((b) =>
        b.id === r.proximityTarget ? { ...b, state: 'tagged' as PlayerState } : b,
      );
      const name = r.bots.find((b) => b.id === r.proximityTarget)?.name ?? '';
      const remaining = bots.filter((b) => b.state === 'alive').length;
      return {
        ...r,
        bots,
        tags: [...r.tags, r.proximityTarget],
        proximity: 0,
        proximityTarget: null,
        ticker: [ev(`TAG CONFIRMED · ${name} eliminated`, 'accent'), ...r.ticker],
        outcome: remaining === 0 ? 'cleared' : r.outcome,
      };
    });
  }, []);

  const leaveRound = useCallback(() => {
    notify.cancelAll();
    setRound(null);
    go('home');
  }, [go]);

  const finishRound = useCallback(() => {
    notify.cancelAll();
    setNextRole((prev) => (round?.role === 'hider' ? 'seeker' : 'hider'));
    setRound(null);
    setSeen((s) => (s.finishedRound ? s : { ...s, finishedRound: true }));
  }, [round?.role]);

  const addXp = useCallback((n: number) => setProfile((p) => withXp(p, n)), []);

  const setHandle = useCallback(
    (h: string) => setProfile((p) => ({ ...p, handle: h })),
    [],
  );

  const purchase = useCallback((id: string, costFilm: number) => {
    let ok = false;
    setProfile((p) => {
      if (p.owned.includes(id) || p.film < costFilm) return p;
      ok = true;
      return { ...p, film: p.film - costFilm, owned: [...p.owned, id] };
    });
    return ok;
  }, []);

  const buyPass = useCallback(
    () => setProfile((p) => ({ ...p, paidPass: true })),
    [],
  );

  /**
   * The first-purchase bundle. One update rather than a purchase plus a grant
   * plus an equip, so a bundle can never half-apply. Equips the frame on the
   * spot: the whole pitch is that other players see it, so leaving it sitting
   * unequipped in the loadout would undercut the thing that was just sold.
   */
  const redeemBundle = useCallback((frameId: string, film: number) => {
    setProfile((p) =>
      p.owned.includes(frameId)
        ? p
        : {
            ...p,
            film: p.film + film,
            owned: [...p.owned, frameId],
            equipped: { ...p.equipped, frame: frameId },
          },
    );
  }, []);

  const spendFilm = useCallback(
    (n: number) => setProfile((p) => ({ ...p, film: Math.max(0, p.film - n) })),
    [],
  );

  /**
   * Applies a store purchase in one update.
   *
   * Grants cosmetics and pass tiers. **Never FILM**: seeker bidding spends
   * FILM, so selling it would make a role advantage purchasable. Tier skips
   * are safe only because every pass tier pays a cosmetic.
   */
  const buyProduct = useCallback((prod: StoreProduct) => {
    setProfile((p) => {
      const owned = [...new Set([...p.owned, ...prod.grants])];
      const seasonXp = p.seasonXp + (prod.tiers ?? 0) * XP_PER_TIER;
      return {
        ...p,
        owned,
        seasonXp,
        paidPass: p.paidPass || prod.id === 'store-pass' || prod.id === 'store-founder',
      };
    });
  }, []);

  const equip = useCallback((slot: keyof Equipped, id: string) => {
    setProfile((p) =>
      p.owned.includes(id) ? { ...p, equipped: { ...p.equipped, [slot]: id } } : p,
    );
  }, []);

  return (
    <Ctx.Provider
      value={{
        route,
        go,
        profile,
        setHandle,
        auth,
        setAuth,
        partyCode: '7KFMQ2',
        round,
        nextRole,
        startRound,
        submitCheckin,
        tag,
        leaveRound,
        finishRound,
        addXp,
        purchase,
        buyPass,
        redeemBundle,
        spendFilm,
        buyProduct,
        equip,
        solo,
        startSolo,
        passSolo,
        exitSolo,
        daily,
        dailyAssignment: assignmentFor(),
        dailyOpen: isDailyOpen(daily),
        seen,
        markSeen,
        resetProgress,
        hasAccount: auth != null && auth.kind !== 'guest',
        friends,
        addFriend,
        removeFriend,
        blockFriend,
        reportFriend,
        applaud,
        applauseToday: {
          earned: applause.day === dayIndex() ? applause.earned : 0,
          cap: ECONOMY.applauseDailyCap,
        },
        redeemReferral,
        referralProgress,
        pass: passState(profile.seasonXp),
        scheduleNextRound,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useGame(): Game {
  const g = useContext(Ctx);
  if (!g) throw new Error('useGame outside provider');
  return g;
}

export function fmtClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${m}:${ss.toString().padStart(2, '0')}`;
}

/** Time left in the round. Real seconds, counting down one at a time. */
export function roundClock(r: RoundState): string {
  return fmtClock(Math.max(0, r.totalReal - r.elapsed));
}
