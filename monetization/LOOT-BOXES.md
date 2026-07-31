# Loot boxes: regulation, design, and the two numbers that decide it

Written 2026-07-31. Companion to `mobile/src/data/lootboxes.ts`, which holds the
odds as data and throws at startup if any table does not sum to 1.

Read sections 1 and 2 before building anything. They are the two places where
the design as requested does not do what it is meant to do, and both are
fixable, but not by writing more code.

---

## 1. What this crosses, stated plainly

Three constraints in this repo are described in their own files as legal lines
rather than preferences. The requested design crosses all three. That is a
decision the founder is entitled to make, and this section exists so it is made
on purpose rather than discovered later.

| Constraint | Where it is written | What the new design does |
|---|---|---|
| **FILM is earned, never sold** | CLAUDE.md 6, `Profile.film` | Selling FILM is the second monetization avenue |
| **Nothing purchasable helps you win** | marketing/BRIEF.md 9 | The $4.99 box contains items that change a round |
| **Seeker bidding stays fair only while FILM is unsellable** | session-2 8 | Bought FILM can win the seeker auction |

The third is the one that gets missed. Seeker bidding spends FILM, so the moment
FILM is purchasable, **the seeker role is for sale**. Session 2 deleted a
"1,000 FILM for $2.99" SKU for exactly this reason. If FILM goes on sale, either
bidding comes out, or the product accepts that the role goes to whoever paid.

There is also a marketing consequence, and it is the awkward kind. BRIEF.md 9
does not say "avoid implying that purchases help you win", it says do not make
the claim because it is false. Once it is true, any existing copy saying
otherwise has to come down, or it becomes a misleading-advertising problem
rather than a tone problem. `marketing/BRIEF.md`, `README.md`, and the tutorial
copy all currently make the promise.

**`FILM_IS_PURCHASABLE` in `lootboxes.ts` is `false`.** Everything else is built
around it. Switching it on is one boolean and it changes the regulatory
position of every box in the game, for the reason in section 3.

---

## 2. The arithmetic problem, which is bigger than the legal one

The defence of this design is that the 10,000 FILM box has **better** elite odds
than the paid box: 25% against 20%. Nothing is purchase-only, so nothing is
pay-to-win.

That defence does not survive contact with the earn rate.

**What a player earns per day**, from `ECONOMY` and `claim_round_reward`:

| Player | Sources | FILM/day |
|---|---|---|
| Casual | daily assignment only | 100 |
| Regular | daily plus the mission sweep | 200 |
| Heavy | daily, sweep, full applause cap, and a complete round every day | 525 |

**What the boxes cost in days:**

| Box | Casual | Regular | Heavy |
|---|---|---|---|
| 1,000 | 10 days | 5 days | 2 days |
| 3,000 | 30 days | 15 days | 6 days |
| 5,000 | 50 days | 25 days | 10 days |
| 10,000 | 100 days | 50 days | 19 days |

**What one elite item costs**, expected, at a 25% roll:

| Route | Cost |
|---|---|
| Vault box, casual player | **400 days** |
| Vault box, regular player | **200 days** |
| Vault box, heavy player | **76 days** |
| First Light Case | **$24.95** |

A season is ten weeks. Every FILM route to an elite item is longer than the
season it would be used in, and the heavy figure assumes somebody plays a full
round every single day, which is a game that needs three other people free
simultaneously.

**So in practice the elite items are cash-only, and the better-odds defence is
technically true and materially false.** A regulator, an app store reviewer, or
a journalist would do this arithmetic in about four minutes.

### Four ways to fix it, in order of how much I would recommend them

1. **Raise the FILM faucets five to ten times.** The current rates were set when
   the only sink was a 300 to 800 FILM cosmetic. A 10,000 FILM box is a
   different economy and the faucets were never re-tuned for it. This is the
   smallest change to the design and the largest change to the outcome.
2. **Add a pity counter.** Guarantee an elite item every N boxes of a tier and
   publish N alongside the odds. It bounds the worst case, which is the thing
   published odds do not do, and it is now standard in the markets that regulate
   this hardest.
3. **Drop the box prices** to roughly a fifth of the current tiers.
4. **Keep elite items out of the paid box.** Cleanest by far, and it makes the
   pay-to-win question disappear entirely, at the cost of the paid box being the
   thing that was specifically asked for.

None of these is implemented. They are a product call.

---

## 3. Regulation, as of July 2026

### The one that changes everything: PEGI, June 2026

On 12 March 2026 PEGI announced its largest ratings reform in over a decade,
introducing "interactive risk categories" that fold monetisation into the age
rating itself. **From June 2026, any game selling paid random items receives a
minimum PEGI 16 rating.** It applies to newly submitted games, which Hidewire
is.

Hidewire's age gate admits 13 year olds. A paid loot box therefore either makes
the game 16+ across Europe, cutting off 13 to 15 year olds entirely, or the paid
random items have to not exist for those players.

### Why selling FILM makes every box a paid box

Belgium's test is whether a box can be bought into with real currency **directly
or indirectly**. Buying a premium currency with money and then spending it on a
box is the indirect case, and it is explicitly covered.

So the four FILM boxes are not paid random items today, and they all become paid
random items the moment `FILM_IS_PURCHASABLE` is true. They would inherit the
PEGI 16 floor, the regional blocks, and every disclosure obligation below. **The
1,000 FILM box would be a gambling product in Belgium.**

### By jurisdiction

| Where | Position | What it means here |
|---|---|---|
| **Belgium** | Paid loot boxes are prohibited and enforced, with criminal fines reported up to €800,000. Lost Ark, Diablo Immortal, and Pokémon TCG Pocket are all blocked there. | No paid random items. Direct purchase only. |
| **Netherlands** | The 2022 Raad van State ruling overturned the regulator's ban, so paid boxes are lawful again. But the consumer regulator fined Epic over €1.1m in 2024 on in-game purchase practices, and the Netherlands is pushing for an explicit ban in the EU Digital Fairness Act. | Lawful, but treat as Belgium. Building the gate for one country and not its neighbour saves nothing. |
| **EU generally** | The Digital Fairness Act may carry an explicit ban. Not expected to land before 2026 closes. | Assume it is coming. |
| **Apple** | Odds must be disclosed before purchase. Required since December 2017. | Blocking for App Review. |
| **Google Play** | Same requirement since 2019. | Blocking for Play. |
| **China** | Statutory probability disclosure, a public probability page, and a 90-day transaction log. | Out of scope for launch. |
| **South Korea** | Probability disclosure is law and is actively enforced. | Out of scope for launch. |
| **Brazil** | Courts have required probability disclosure and blocking minors, with individual compensation available to affected minors. | The under-18 gate below covers this. |
| **UK** | No ban. Industry self-regulation, with pressure toward parental controls. | Covered by the under-18 gate. |

### The design response

**Nobody under 18 is offered a random item, in any country.**

That is stricter than any single jurisdiction demands, and it is the one
recommendation here I would push hardest. It resolves PEGI, Brazil, and the
direction every regulator is moving, in one rule. The age bracket is already on
the profile for the NEARBY gate, so it costs nothing to enforce. Under-18
accounts get the direct-purchase storefront instead: identical items, fixed
prices, no randomness.

`boxAvailability()` in `lootboxes.ts` implements the age gate and the regional
block. `NO_PAID_RANDOM_ITEMS` lists Belgium and the Netherlands.

**Two things that gate is not**, and both need building:

- It reads a country code that nothing currently supplies. Store storefront
  country is the right source, not IP and not GPS, because the storefront is
  what actually governs the transaction.
- It is a client-side check. The real enforcement belongs in the same place
  every other economy rule went in migration 0003: a server function that
  refuses, so a modified client cannot open a box it is not entitled to.

---

## 4. What is built

`mobile/src/data/lootboxes.ts`, data only. No UI, no opening flow, no purchase.

**Five boxes.** Odds verified to sum to exactly 1; `assertOdds()` throws at
module load otherwise, because a published probability that does not add up is
a false statement made before a purchase in a category where disclosure is a
legal requirement.

| Box | Price | Common | Uncommon | Rare | Elite |
|---|---|---|---|---|---|
| DEVELOPING TRAY | 1,000 FILM | 70% | 25% | 5% | 0% |
| CONTACT SHEET | 3,000 FILM | 45% | 38% | 16% | 1% |
| SILVER RESERVE | 5,000 FILM | 25% | 40% | 32% | 3% |
| VAULT NEGATIVE | 10,000 FILM | 5% | 30% | 40% | **25%** |
| FIRST LIGHT CASE | $4.99 | 0% | 30% | 50% | **20%** |

**Twelve utility items**, five of them elite. These are the first things in
Hidewire that are not cosmetic. Three rules keep the blast radius bounded:

- **Information and time, never movement.** Nothing rewards walking faster,
  going further, or being anywhere in particular. PRD 7 is still a hard
  constraint and an item that made someone hurry would breach it. Every effect
  is a clock or a piece of knowledge.
- **One use per player per round**, via `MAX_UTILITY_PER_ROUND`. The gap between
  a paying and a non-paying player has a ceiling, and the ceiling is one use.
- **Nothing is purchase-only.** Every elite item is reachable from a FILM box,
  subject to section 2 being fixed.

The elite five: DARKROOM (two reveal ticks pass without showing you), DECOY (one
reveal shows you up to 150 m off), LONG LENS (see the seeker once, for ten
seconds), FIXER (survive one missed window), TIGHTEN (bring the next zone
contraction forward).

**Duplicate protection.** Duplicates refund FILM by rarity. Without it the
published odds mislead in practice, because a player holding most of the pool
has a materially worse real outcome than the table implies.

---

## 5. Not built, and needed before this can ship

1. **The server side.** Opening a box has to be a SECURITY DEFINER function that
   rolls the outcome, checks age and region, debits FILM, and grants the item in
   one transaction. Everything in migration 0003 exists because the client
   cannot be trusted with the economy, and a client-side roll is worse than a
   client-side price.
2. **The odds screen**, reachable before purchase, showing per-item
   probabilities. Apple and Google both require it.
3. **A country code source**, from the store storefront.
4. **The direct-purchase storefront** for under-18 and blocked regions. Items
   and bundles exist in the data; the screen does not.
5. **The receipt path** for the $4.99 box. There is no payment provider yet.
6. **Odds in the store listing metadata**, and the ESRB "Includes Random Items"
   interactive element.
7. **A decision on seeker bidding**, per section 1.
8. **Somewhere for the stranded pass cosmetics to go.** Removing the paid track
   left fifteen paid-track cosmetics with no route to a player. The boxes are
   the obvious home, and they need it: as built, the boxes contain twelve
   utility items and **no cosmetics at all**, which makes every roll a gameplay
   item and pushes the design further toward pay-to-win rather than less. Adding
   the cosmetics to the common and uncommon bands would dilute the utility
   drops, which is the correct direction. It also matches the request for
   "special cosmetics that affect your gameplay" in the 10,000 box, which the
   current data does not implement: nothing in `UTILITY_ITEMS` is a cosmetic.

---

## Sources

- [PEGI launches interactive risk categories; overhauls age ratings for loot boxes (Reed Smith)](https://www.reedsmith.com/articles/pegi-launches-interactive-risk-categories-overhauls-age-ratings-for-loot-boxes-in-game-spending-and-communication-features/)
- [All games with loot boxes to be rated minimum PEGI 16 (VGC)](https://www.videogameschronicle.com/news/all-games-with-loot-boxes-in-them-will-be-rated-minimum-pegi-16-starting-this-summer/)
- [Lootbox Regulation 2026: EU, UK and US compliance for studios](https://blog.promise.legal/lootbox-regulation-2026-game-studios/)
- [Loot box laws by jurisdiction](https://blog.promise.legal/loot-box-laws-game-developers/)
- [Loot boxes in games: an overview of recent developments (Franssen Tolboom)](https://www.franssentolboom.nl/en/loot-boxes-an-overview-of-recent-developments/)
- [Are loot boxes legal in Belgium?](https://gamblingclub.be/en/are-loot-boxes-legal-in-belgium/)
- [Apple requires disclosure of odds for loot boxes (Fenwick)](https://www.fenwick.com/insights/publications/apple-now-requires-disclosure-of-loot-box-odds)
- [Google Play now requires disclosure of loot box odds (Fenwick)](https://www.fenwick.com/insights/publications/google-play-now-requires-disclosure-of-loot-box-odds)
- [Compliance with loot box probability disclosure law in South Korea (ScienceDirect)](https://www.sciencedirect.com/science/article/pii/S0001691825008030)
- [Loot box regulation worldwide](https://www.1d3.com/blog/loot-box-regulation-worldwide)
