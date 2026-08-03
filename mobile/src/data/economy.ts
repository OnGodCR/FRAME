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
// imply anything purchasable helps you win" as a legal line. Superseded: FILM
// is sold, and the paid box contains items that change a round. What survives
// is narrower and enforced in the database, in 0010_monetization.sql: seeker
// bids may spend only FILM that was earned, so the role itself is not for sale.
//
// Every faucet below is capped or once-only. That is deliberate: a group of
// five friends applauding each other every morning would otherwise mint more
// FILM per day than actually playing does, which devalues every price in the
// shop and quietly undermines the thing the shop is for.
// ---------------------------------------------------------------------------

export const ECONOMY = {
  /** The daily check-in. XP is 0..1 through a level; 0.1 is 100 XP. */
  dailyCheckin: { film: 500, xp: 0.1 },

  /** Finishing all three of the day's missions. */
  missionSweep: 500,

  /**
   * Rewarded video. 250 FILM for a 30 second view.
   *
   * **The cap is the whole design.** At 250 per 30 seconds this pays 500 FILM a
   * minute, which is far and away the highest rate in the game, and uncapped it
   * would be the only sensible way to earn: a player would sit in a menu
   * watching adverts rather than walking around a city, which is the opposite
   * of the product. Four a day puts the ad ceiling at 1,000 FILM against 1,100
   * from actually playing, so playing still pays better. That ordering is the
   * point and it should survive any retune.
   *
   * Not yet wired to an ad network. See TEST-FIXTURES.md.
   */
  rewardedAd: { film: 250, seconds: 30, dailyCap: 4 },

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

  /**
   * Paid once, for finishing the onboarding tutorial.
   *
   * **This is the starting balance, and it is earned rather than handed over.**
   * A new account still opens on zero, and the 1,000 arrives the moment the
   * player has actually performed a check-in, which is the difference between a
   * gift and a first paycheck. Guests get it too: the tutorial is not gated on
   * an account, so neither is the reward for finishing it.
   */
  tutorialGrant: 1000,

  /** Referral bonus, paid to BOTH sides, once per pair. */
  referralFilm: 2500,
} as const;

/** Rewarded-ad state, per local day. Same shape as the applause wallet. */
export interface AdWallet {
  /** dayIndex the counter belongs to. */
  day: number;
  /** Views already paid today. */
  views: number;
}

export const FRESH_ADS: AdWallet = { day: -1, views: 0 };

/** Whether another rewarded view will pay. Past the cap it pays nothing. */
export function adViewsLeft(w: AdWallet, today: number): number {
  const views = w.day === today ? w.views : 0;
  return Math.max(0, ECONOMY.rewardedAd.dailyCap - views);
}

export function creditAdView(w: AdWallet, today: number): AdWallet {
  const views = w.day === today ? w.views : 0;
  return { day: today, views: views + 1 };
}

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
