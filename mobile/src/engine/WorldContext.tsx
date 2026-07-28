import React, { createContext, useCallback, useContext, useState } from 'react';
import { World } from '../data/poiRules';
import { BAKED_WORLD, WorldStatus, loadWorld, worldOf } from '../data/worldSource';

interface WorldCtx {
  status: WorldStatus;
  world: World;
  /** Ask for location and pull the real landmarks around the player. */
  request: (radiusM?: number) => void;
  busy: boolean;
}

const Ctx = createContext<WorldCtx | null>(null);

export function WorldProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<WorldStatus>({ state: 'idle' });

  // Never called on mount. PRD 10.2 is explicit that a cold location prompt at
  // launch is the biggest drop-off in the funnel, so every entry point into
  // this is a deliberate user action.
  const request = useCallback((radiusM = 1000) => {
    setStatus((s) => (s.state === 'locating' || s.state === 'loading' ? s : s));
    loadWorld(radiusM, setStatus);
  }, []);

  const busy = status.state === 'locating' || status.state === 'loading';

  return (
    <Ctx.Provider value={{ status, world: worldOf(status), request, busy }}>
      {children}
    </Ctx.Provider>
  );
}

export function useWorld(): WorldCtx {
  const c = useContext(Ctx);
  if (!c) return { status: { state: 'idle' }, world: BAKED_WORLD, request: () => {}, busy: false };
  return c;
}
