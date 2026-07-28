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
// rendered from a scaled "round clock" so the UI reads like a real 45:00 round.
// ---------------------------------------------------------------------------

export type Route =
  | 'splash'
  | 'dob'
  | 'legal'
  | 'auth'
  | 'handle'
  | 'permissions'
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
  | 'results';

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
  film: number; // soft currency, cosmetics only
  owned: string[];
  equipped: Equipped;
  paidPass: boolean;
}

const HIDER_BOTS: Bot[] = [
  { id: 'maya', name: 'MAYA', state: 'alive', pos: { x: 0.3, y: 0.34 } },
  { id: 'dev', name: 'DEV', state: 'alive', pos: { x: 0.68, y: 0.28 } },
  { id: 'jules', name: 'JULES', state: 'alive', pos: { x: 0.62, y: 0.66 } },
  { id: 'ari', name: 'ARI', state: 'alive', pos: { x: 0.38, y: 0.72 } },
];
export const SEEKER_BOT = { id: 'kai', name: 'KAI' };

export const ROUND_DISPLAY_SECONDS = 45 * 60;
const ROUND_REAL_SECONDS = 250;

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

const CHECKIN_WINDOW = 45; // real seconds ≙ "0:60" in fiction; close enough for demo

const hiderScript: Script = {
  6: (r) => r.ticker.unshift(ev('MAYA passed check-in 03')),
  14: (r) => r.ticker.unshift(ev('BEACON at Fountain Plaza claimed by JULES')),
  20: (r) => {
    r.checkin = { index: 4, openedAt: 20, deadline: 20 + CHECKIN_WINDOW, submitted: false };
  },
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
  150: (r) => {
    r.checkin = { index: 5, openedAt: 150, deadline: 150 + CHECKIN_WINDOW, submitted: false };
  },
  204: (r) => {
    const ari = r.bots.find((b) => b.id === 'ari')!;
    ari.state = 'blackout';
    r.ticker.unshift(ev('ARI was BLACKED OUT · missed check-in', 'danger'));
  },
  222: (r) => r.ticker.unshift(ev('JULES used GHOST PING', 'accent')),
};

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

const seekerScript: Script = {
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
  equip: (slot: keyof Equipped, id: string) => void;
}

const Ctx = createContext<Game | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [route, setRoute] = useState<Route>('splash');
  const [profile, setProfile] = useState<Profile>({
    handle: '',
    level: 7,
    xp: 0.58,
    prestige: 0,
    film: 1250,
    // Defaults, plus the free-track cosmetics already claimed by tier 12.
    owned: [
      'title-unseen',
      'pin-acid',
      'frame-brackets',
      'static-default',
      'tag-shutter',
      'title-patient',
    ],
    equipped: {
      title: 'title-unseen',
      pin: 'pin-acid',
      frame: 'frame-brackets',
      blackout: 'static-default',
      tag: 'tag-shutter',
    },
    paidPass: false,
  });
  const [round, setRound] = useState<RoundState | null>(null);
  const [nextRole, setNextRole] = useState<Role>('hider');
  const [auth, setAuth] = useState<Auth | null>(null);
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
    }, 1000);
    return () => clearInterval(id);
  }, [round?.outcome, round == null, route]);

  // react to outcomes
  useEffect(() => {
    if (!round?.outcome) return;
    if (round.outcome === 'blackout') {
      go('blackout');
    } else if (round.outcome !== 'left') {
      go('results');
    }
  }, [round?.outcome]);

  const startRound = useCallback(
    (role?: Role) => {
      const r = role ?? nextRole;
      setNextRole(r);
      setRound(freshRound(r));
      go('roleReveal');
    },
    [nextRole, go],
  );

  // Fires the moment validation passes. The window can expire while the
  // player is still looking at the confirmation screen, and that must not
  // count against them.
  const submitCheckin = useCallback(() => {
    setRound((r) => {
      if (!r || !r.checkin) return r;
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
    setRound(null);
    go('home');
  }, [go]);

  const finishRound = useCallback(() => {
    setNextRole((prev) => (round?.role === 'hider' ? 'seeker' : 'hider'));
    setRound(null);
  }, [round?.role]);

  const addXp = useCallback((n: number) => {
    setProfile((p) => {
      let xp = p.xp + n;
      let level = p.level;
      while (xp >= 1) {
        xp -= 1;
        level += 1;
      }
      return { ...p, xp, level };
    });
  }, []);

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
        equip,
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

/** Display round clock: scales the compressed real timeline to a 45:00 fiction. */
export function roundClock(r: RoundState): string {
  const frac = Math.max(0, 1 - r.elapsed / r.totalReal);
  return fmtClock(frac * ROUND_DISPLAY_SECONDS);
}
