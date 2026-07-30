// ---------------------------------------------------------------------------
// The FILM economy, in one place.
//
// There is exactly ONE currency and it is called FILM. Anything anywhere that
// says "link" or "coins" means FILM.
//
// FILM is **earned, never sold**, for as long as seeker bidding exists
// (JoinLobby, "Bid to seek"). The shop may sell cosmetics and pass tiers for
// real money. It must never sell FILM, because bidding would immediately turn
// that into a purchasable advantage, and marketing/BRIEF.md 9 lists "never
// imply anything purchasable helps you win" as a legal line.
//
// Every faucet below is capped or once-only. That is deliberate: a group of
// five friends applauding each other every morning would otherwise mint more
// FILM per day than actually playing does, which devalues every price in the
// shop and quietly undermines the thing the shop is for.
// ---------------------------------------------------------------------------

export const ECONOMY = {
  /** The daily check-in. XP is 0..1 through a level; 0.1 is 100 XP. */
  dailyCheckin: { film: 100, xp: 0.1 },

  /** What the RECEIVER earns when somebody applauds their capture. */
  applauseFilm: 20,

  /**
   * Most FILM a player can earn from applause in one day, roughly five.
   *
   * Past the cap applause still registers and still shows: the point is the
   * social signal, and silently refusing to let friends clap for you would be
   * a worse product than simply not paying for it.
   */
  applauseDailyCap: 100,

  /** Referral bonus, paid to BOTH sides, once per pair. */
  referralFilm: 500,
} as const;

/** Applause state, per local day. Reset when the day index changes. */
export interface ApplauseWallet {
  /** dayIndex the counter belongs to. */
  day: number;
  /** FILM already earned from applause today. */
  earned: number;
}

export const FRESH_APPLAUSE: ApplauseWallet = { day: -1, earned: 0 };

/**
 * How much FILM an incoming applaud actually pays, given today's total.
 * Returns 0 once the cap is reached, which is not an error state.
 */
export function applausePayout(w: ApplauseWallet, today: number): number {
  const earned = w.day === today ? w.earned : 0;
  const room = Math.max(0, ECONOMY.applauseDailyCap - earned);
  return Math.min(ECONOMY.applauseFilm, room);
}

export function creditApplause(
  w: ApplauseWallet,
  today: number,
  amount: number,
): ApplauseWallet {
  const earned = w.day === today ? w.earned : 0;
  return { day: today, earned: earned + amount };
}
