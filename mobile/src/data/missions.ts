import { ECONOMY } from './economy';
import { dayIndex } from './assignments';

// ---------------------------------------------------------------------------
// Daily missions.
//
// The one thing on the Game tab that answers "what do I do now". Everything
// else on that tab is either identity or the two play buttons; missions carry
// the whole job of directing a player, which is why they sit immediately under
// the name bar.
//
// **Completing every mission in a day pays a bonus.** That is what turns three
// separate small asks into one thing worth finishing, and it is the only
// reason to do the last one when you have already had the FILM from the first
// two.
//
// Missions are derived, not stored. Each one reads existing state (has this
// player practised, is the daily assignment done, have they finished a round)
// rather than keeping a parallel copy that can drift out of sync with it.
// ---------------------------------------------------------------------------

/** Paid once per day for finishing every mission. */
export const MISSION_SWEEP_BONUS = 100;

export interface MissionInput {
  practised: boolean;
  dailyDone: boolean;
  finishedRound: boolean;
  roundsToday: number;
  applaudedToday: boolean;
}

export interface Mission {
  key: string;
  label: string;
  /** What tapping it should open. */
  goto: 'solo' | 'lobby' | 'social';
  done: boolean;
  /** Paid on completion of this individual mission, on top of the sweep. */
  film: number;
}

/**
 * Today's missions.
 *
 * Deliberately three, not eight. A list long enough to scroll stops being a
 * direction and becomes a chore list, which is the thing the home screen was
 * already guilty of.
 */
export function missionsFor(input: MissionInput): Mission[] {
  return [
    {
      key: 'checkin',
      label: input.practised ? 'Run a practice check-in' : 'Try your first check-in',
      goto: 'solo',
      done: input.practised,
      film: 0,
    },
    {
      key: 'assignment',
      label: "Do today's assignment",
      goto: 'solo',
      done: input.dailyDone,
      film: ECONOMY.dailyCheckin.film,
    },
    {
      key: 'round',
      label: input.finishedRound ? 'Play a round' : 'Play your first round',
      goto: 'lobby',
      done: input.roundsToday > 0,
      film: 0,
    },
  ];
}

export function allDone(ms: Mission[]): boolean {
  return ms.length > 0 && ms.every((m) => m.done);
}

/** Per-day mission bookkeeping. Only tracks what is not derivable elsewhere. */
export interface MissionState {
  day: number;
  roundsToday: number;
  applaudedToday: boolean;
  /** Whether the all-missions bonus has already been paid today. */
  sweepPaid: boolean;
}

export const FRESH_MISSIONS: MissionState = {
  day: -1,
  roundsToday: 0,
  applaudedToday: false,
  sweepPaid: false,
};

/** Rolls the counters over when the calendar day changes. */
export function forToday(m: MissionState, now: Date = new Date()): MissionState {
  const today = dayIndex(now);
  if (m.day === today) return m;
  return { day: today, roundsToday: 0, applaudedToday: false, sweepPaid: false };
}
