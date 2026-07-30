# FRAME: UX, retention, and monetization

Research pass, 2026-07-29. Competitors and adjacent apps, what they do in
common, and what FRAME should actually change. Priority order is UI/UX first
(does the player understand how to play), then retention, then money.

Sources are linked inline. Where this document and [PRD.md](PRD.md) disagree on
a **[HARD CONSTRAINT]**, the PRD wins.

> **Status, 2026-07-29.** Everything in the "do first" list of section 7 is
> built, plus the daily assignment and the first-purchase bundle. See section 8
> for exactly what shipped and what is still open. The default round is now
> **30 minutes**, not 45, which supersedes the PRD default and changes the
> photo-volume arithmetic in [INFRASTRUCTURE.md](INFRASTRUCTURE.md) 3 (roughly
> 60 photos per round rather than 90, so the cost story gets better).

---

## 1. The apps studied, and why each one

| App | Why it matters to FRAME |
|---|---|
| **BeReal** | Nearly the same core mechanic: a timer fires, you have ~2 minutes, front and back camera, no retakes. The closest analogue that exists. |
| **Pokemon GO** | The reference for teaching a location-based game to a cold player, and for monetizing one. |
| **HideZone / Gottcha / Zone Hunt** | The direct GPS hide-and-seek category. Commodity, per PRD 2. |
| **Jet Lag: Hide & Seek Mapper** | Companion-app model. Shows the audience exists and is underserved. |
| **Duolingo** | The reference implementation of streaks, appointment mechanics, and session-end hooks. |
| **Fortnite / Clash Royale battle passes** | Why the pass is the conversion instrument, not the shop. |

---

## 2. What they all have in common

Six patterns recur in every single one of them.

**1. Time to core mechanic is measured in seconds, not screens.** A new
Pokemon GO player catches their first Pokemon within about 60 seconds of
opening the app, with no instruction manual. The game shows rather than tells.
Permissions and profile data are requested *after* the player has felt the core
loop, not before.

**2. The core loop is playable alone on day one.** Every app on that list
gives a solo player something real to do the first time they open it. Social
depth is a second-session feature, never a first-session requirement.

**3. Teaching is progressive and contextual, not front-loaded.** The rule that
keeps coming up: teach only the mechanics needed for the next minute of play.
Teaching too much too early drops retention because the player feels tested
before they feel rewarded. Opt-in explanations, surfaced at the moment of use,
are remembered better than a predictable up-front sequence.

**4. Retention is layered, never a single hook.** Duolingo stacks streaks,
leaderboards, achievements, social, and notifications so each reinforces the
others. A single hook is fragile.

**5. The session does not end at the end of the session.** The moment a round
finishes is the highest-leverage retention surface in the product, and it is
used to schedule the next one.

**6. Monetization is cosmetic, visible, and pass-shaped.** The battle pass is
the conversion instrument because it monetizes *time* rather than content: high
perceived value at a low entry price (typically about $10), which turns
non-payers into recurring payers and lifts DAU at the same time.

---

## 3. The BeReal warning, which is the most important finding here

FRAME's differentiator is a forced dual-camera capture on a timer. That is
BeReal's mechanic. BeReal went from roughly **73 million MAU in August 2022 to
about 33 million by March 2023**, and at peak hype only about **9% of active
Android users opened it daily**. Lots of trial, very little habit.

The diagnosed causes, and how FRAME sits against each:

| BeReal's failure | FRAME's position |
|---|---|
| The timer fired at 3am, in meetings, at random. It became an obligation. | **Much better.** FRAME's timer only fires inside a 45-minute session the player deliberately started. This is FRAME's single biggest structural advantage over BeReal and it should be stated in marketing. |
| Novelty without iteration. The mechanic never deepened. | **Unproven.** FRAME has buffs, POIs, and a pass, but they are a UI shell today. |
| The capture was a performance with no game attached. Nothing was at stake. | **Better.** FRAME attaches elimination to it. Stakes are the point. |
| Nothing to do between posts. | **Risk.** A hider who found a good spot has ~5 dead minutes per cycle. |

The actionable read: FRAME's version of the mechanic is defensible precisely
because it is **bounded, opted-into, and consequential**. Protect those three
properties. The moment a check-in feels like an interruption rather than a
thrill, FRAME becomes BeReal. PRD 14 already names this as the top product
risk, and the 3 / 5 / 10 minute interval playtest is still the only thing that
answers it.

---

## 4. UI/UX: does the player know how to play

This is the biggest section because it is the biggest gap.

### 4.1 The problem: FRAME's first-time experience is inverted

Current path from install to first check-in:

```
splash → dob (1/6) → legal (2/6, scroll-to-end gate) → auth (3/6)
      → handle (4/6) → permissions explainer (5/6) → map tutorial (6/6)
      → home → host → lobby → safety card (scroll-to-end gate)
      → role reveal → round → first check-in
```

That is **seven screens before the home screen**, two separate scroll-to-end
gates, and a mandatory 3-person party, all before the player has once
experienced the thing the entire product is about. Compare to catching a
Pokemon in 60 seconds.

Worse, it currently cannot be completed alone at all. FRAME needs 3 to 20
people in one city at one time. A player who installs on their own literally
cannot see the core mechanic.

**Two of those screens are non-negotiable.** The age gate (PRD 3) and the legal
acceptance (PRD 7.8) are hard constraints and stay where they are. The safety
card gate (PRD 7) stays too. Everything else is movable.

### 4.2 The single highest-leverage change: a solo dry run

Add a **90-second solo round** that a new player can run immediately, alone,
before any party exists.

- One check-in tick, real camera, real validator, real pass or fail.
- No other players, no map, no zone. Just the mechanic.
- Ends on the real feedback: "That passed. In a real round the seeker just got
  both of those photos."
- Reachable again from home forever, labelled as practice.

This does four things at once: it teaches the mechanic by doing rather than
reading, it makes the app meaningful for a solo installer, it produces the
first "I get it" moment inside a minute, and it gives you a place to fail
safely so the first real blackout is not the first time the validator has ever
said no. It also doubles as the calibration harness once real photos exist.

### 4.3 Make the explainer screens contextual instead of linear

- **Permissions explainer (5/6):** delete it as a step. It requests nothing, so
  it is pure reading. Its content should appear attached to each actual
  permission prompt, which is what the screen already promises ("Each
  permission is requested in context") but the funnel does not do.
- **Map tutorial (6/6):** move it onto the map. The content is good and it
  already uses the map's real glyphs, which is exactly right. But it is
  currently a wall of text shown before the player has ever seen a map. Teach
  each POI type the first time one is actually on screen, as a one-line
  dismissible callout. Keep the full legend behind the `?` button that already
  exists on the round screen.

That removes two screens from the funnel without losing any information.

### 4.4 Fix the dead time inside a round

A hider who has found a spot has several minutes of nothing between ticks.
That is where phones come out and the game stops being physical. Give them
something to do that keeps their head up:

- A live "next check-in in 2:40" countdown that is glanceable, ideally in a
  **Live Activity / Dynamic Island** (PRD 10.2 already calls this the single
  highest-value platform feature, and it is also a safety feature since it
  keeps players from staring at a screen while walking).
- Surface the nearest unclaimed POI as a soft objective, so there is always a
  reason to reposition.

### 4.5 Smaller UX wins

- **Let the tutorial be replayable.** Pokemon GO's most-cited FTUE failure is
  that its onboarding can never be seen again. FRAME's map tutorial is already
  a separate route, so this is nearly free.
- **Show the check-in flow before the round, not during.** The first time a
  player sees the camera sequence should not be the 60 seconds their survival
  depends on.
- **Name the failure honestly and early.** BLACKED OUT is a great loss state.
  Show a player what it looks like once, in the dry run, so the threat is
  concrete rather than abstract.

---

## 5. Retention

Benchmarks for competitive multiplayer / live-service: **D1 40 to 50%, D7 20 to
30%, D30 10 to 15%**. General mobile averages are far lower (roughly 25 to 33%
D1, 6 to 14% D7, 1 to 7% D30), and competitive social games are expected to beat
them. Those are the numbers to instrument against.

D1 is a question about whether onboarding was clear and the core loop was
understood. D7 is a question about habit formation and social depth. That maps
exactly onto sections 4 and 5 here.

### 5.1 The results screen is currently a dead end

It shows XP, MVP, and offers exactly two exits: next round, or home. This is
the highest-leverage retention surface in the entire product and it is doing
almost nothing. Every app studied uses this moment to schedule the next
session. Add:

- **Rematch with the same party, one tap.** The party already exists, the
  roster is already known. This is the cheapest retention feature available and
  it should be the primary button.
- **A scheduled next round.** "Same crew, Friday 7pm" writes a calendar-shaped
  appointment and a push. This is the appointment mechanic, and for a game that
  structurally requires other humans it matters far more than it does for a
  solo game.
- **One shareable artifact.** The round produced 90 photos and a story. Give
  the player one image worth sending to the group chat. For a game whose growth
  is necessarily word-of-mouth inside existing friend groups, this is the
  acquisition loop, not just a retention feature.

### 5.2 Streaks, carefully

Duolingo's streak works by weaponizing loss aversion, and it roughly doubles
daily retention. But a daily streak is wrong for FRAME: the game needs 3+
people and 45 minutes, so a daily requirement is unachievable and would punish
players for their friends' schedules.

Use a **weekly** cadence instead ("played a round this week"), and ship the
equivalent of a streak freeze from day one. A streak the player cannot control
is a churn trigger, not a retention mechanic.

### 5.3 Notifications now actually work

As of this session the check-in ticks are scheduled as on-device local
notifications with the iOS time-sensitive interruption level, so they break
through Focus and fire even when the app is suspended. That was a hard
prerequisite for the mechanic working with the phone in a pocket. See
`mobile/src/engine/notify.ts`.

The re-engagement notifications (a friend started a round, your party is
waiting) are the remaining half, and they need the server and remote push.

---

## 6. Monetization

### 6.1 What FRAME already gets right

Cosmetics only. Nothing purchasable affects whether you win. That is both the
legally required position (see [marketing/BRIEF.md](marketing/BRIEF.md) 9) and,
per the current research, the commercially better one: the trend has moved away
from aggressive tactics toward optional purchases that respect player time,
and those see higher long-term revenue.

The pass at **$4.99** is priced below the typical $10 battle pass, which is a
reasonable choice for an unproven app and sits inside the **$1.01 to $5**
band that converts a first-time payer best.

### 6.2 The photo frame is the hero SKU and is currently priced like a sundry

FRAME has five cosmetic slots: title, map pin, photo frame, blackout, tag.
They are merchandised as equals. They are not equals.

**The photo frame is the only cosmetic that every other player sees, repeatedly,
in the one place everybody is looking.** Each round pushes roughly 90 photos
into the seeker's feed, each one wearing the hider's frame. That is the highest
impression-count surface in the product by an enormous margin. In a game whose
entire identity is photographic proof, the frame around the proof is the
status object.

Actions:
- Merchandise frames as the flagship category, not one tab of five.
- Put the best frames on the paid pass track and at shop top billing.
- Show frames in context, wrapped around an actual feed photo, never as an
  abstract swatch.

### 6.3 There is no first-purchase offer at all

This is the clearest gap. The research is consistent: the way you convert a
non-payer is a **time-limited starter bundle at an anchored discount**, priced
in the $1 to $5 range, whose value pays off over continued play.

Recommend:
- A **first-round starter bundle**, roughly $2.99, containing one exclusive
  frame plus a FILM grant. Anchored against its component value.
- Triggered **on the results screen after the player's first completed round**,
  not on install. They have just watched a feed full of framed photos and now
  understand exactly what a frame is for. That is the moment the product has
  taught them the value of the thing being sold.
- Limited window, because time-limited rewards raise spend meaningfully.

### 6.4 Pass pacing has to match how often this game is actually played

50 tiers is Fortnite-shaped, and Fortnite is played daily by a solo player.
FRAME needs three friends and 45 minutes. If a realistic engaged player manages
one or two rounds a week, they will finish nowhere near 50 tiers, and a player
who buys a pass and cannot complete it does not buy the next one.

Either shorten the track, raise per-round tier yield, or lengthen the season.
This needs the playtest data before it can be set correctly, but it should be
set deliberately rather than inherited from a genre with a different play
frequency.

### 6.5 Sponsored destination prompts

The daily assignment is now mostly **destination** prompts: "get as close as you
can to an ice cream shop", with live distance to the nearest real match. That
shape is sponsorable, and it is the most natural revenue idea in the product.

It is also clean against the hardest constraint. A sponsored prompt is
advertising, not pay-to-win, so it does not touch "nothing purchasable helps you
win" at all. Nobody gets a gameplay edge because a chain paid to be today's
destination.

Two things to design in before selling any of it:

- **Respect the age bracket.** It is already stored for the ads rule (and the
  date of birth deliberately is not). A sponsored prompt must honour it rather
  than going to every account, or the ads policy is being enforced in one place
  and ignored in another.
- **Disclose it.** An undisclosed paid task delivered to an audience that
  includes minors is an FTC problem, not a taste problem. A small SPONSORED
  label costs nothing and settles it.

The natural unit is a category, not a brand: sell "ice cream" for a day rather
than one chain, so the task still resolves for players nowhere near a sponsor
location. That keeps the prompt honest in cities the sponsor is not in, which is
also what stops the feature from feeling like an ad.

### 6.6 Ads

The home screen carries an AdMob banner slot. A banner is the lowest-value ad
format and it costs the app its premium feel at exactly the screen where the
player decides whether this product is serious.

Prefer **rewarded video for FILM**, opt-in, never during a round (which the
current slot already promises). Cosmetic currency only, never anything that
touches gameplay, which keeps it on the right side of both the PRD and the
marketing constraints. Revisit the banner once there is data on what it
actually earns, because it is probably not worth what it costs in feel.

---

## 7. Prioritized actions

Ordered by leverage per unit of work.

### Do first (UX, unblocked, no server needed)

1. **Solo 90-second dry run.** Highest leverage change in this document. Fixes
   time-to-mechanic, solo cold start, and validator familiarity at once.
   Depends on the real camera work.
2. **Rematch button on the results screen.** Cheapest retention win available.
3. **Cut the permissions explainer from the funnel**, move its copy onto the
   real prompts.
4. **Move the map tutorial onto the map** as first-sight contextual callouts,
   keep the full legend behind the existing `?`.
5. **Make the tutorial replayable from home.**

### Do next (needs server or camera)

6. **Live Activity / Dynamic Island** round timer. Safety feature and UX
   feature simultaneously.
7. **Scheduled next round** plus the push that goes with it.
8. **Shareable round artifact.**
9. **First-purchase starter bundle** on the post-first-round results screen.
10. **Re-merchandise frames** as the flagship cosmetic category.

### Decide with playtest data

11. Check-in interval (3 / 5 / 10 min). Already the top PRD risk.
12. Season pass length and tier pacing against real play frequency.
13. Weekly streak cadence and the freeze allowance.
14. Whether the home banner ad earns more than it costs in feel.

---

## 8. What shipped, 2026-07-29

### Built and verified in the preview

| Change | Where |
|---|---|
| Round default 45 → **30 minutes**, single constant | `ROUND_DISPLAY_MINUTES` in `engine/GameContext.tsx` |
| **Onboarding cut from 6 steps to 4.** Permissions explainer removed from the funnel, map tutorial removed from the funnel | `screens/Onboarding.tsx`, `App.tsx` |
| Permission copy moved to the point of request, as `PermissionNote` | `screens/Onboarding.tsx`, used in `screens/JoinLobby.tsx` |
| Map legend now **replayable** from home and the round `?` | `screens/Home.tsx`, `screens/MapTutorial.tsx` |
| **TEST FRAME** practice run, 60 s window, real sequence, practice blackout | `screens/Solo.tsx` |
| **DAILY ASSIGNMENT**, one global prompt per calendar date, pays XP + FILM | `data/assignments.ts`, `screens/Solo.tsx` |
| Capture flow extracted so every mode rehearses the identical sequence | `components/CaptureSequence.tsx` |
| **Rematch** as the primary results action | `screens/Endings.tsx` |
| **Next-round appointment** with a local reminder | `notify.scheduleRoundReminder`, `screens/Endings.tsx` |
| **First-purchase bundle**, once, after a completed round | `STARTER_BUNDLE` in `data/catalog.ts`, `screens/Endings.tsx` |
| Frames promoted to flagship shop category, previewed in context | `screens/Shop.tsx` |
| Check-in ticks as time-sensitive local notifications | `engine/notify.ts` |

### Deliberately not built yet

- **Live Activity / Dynamic Island.** Needs a native widget extension and the
  Apple Developer Program. Still the highest-value platform feature per PRD
  10.2, and still a safety feature as much as a UX one.
- **Shareable round artifact.** Needs a view-capture dependency and a decision
  about what the image actually contains.
- **Contextual first-sight POI callouts on the map.** The legend is now
  reference material reachable any time, which was the more important half.
  Teaching each pin type at first sight is still worth doing.
- **Weekly streak surfacing beyond the solo card.** The streak is tracked and
  shown, but there is no freeze mechanic yet, and section 5.2 says do not ship
  a streak the player cannot protect.
- **LONG EXPOSURE.** Designed, not built. Endurance mode against the validator:
  unpredictable pings, dual capture each time, enforced relocation between
  them via pHash plus GPS displacement, streak-based global leaderboard, no
  contact with any other player. It is the strongest remaining use of the
  validator and it is also the mode that most needs real calibration photos
  first, since the entire mode is the reuse threshold.

### Notes for whoever picks this up

- The daily assignment pays **XP and FILM**, using the existing currencies. If
  a separate energy resource is wanted instead, that is a new economy and
  should be designed as one rather than bolted onto `DAILY_REWARD`.
- `TEST_FRAME_WINDOW` is 60 s to match the real window. If PRD 4.4's window
  changes, change both or the rehearsal stops being honest.
- The tick times in `HIDER_CHECKIN_TICKS` are the single source for both the
  scripted timeline and the scheduled notifications. Do not let those diverge.
- `app.json` now declares the iOS time-sensitive entitlement, which **needs the
  matching capability enabled on the Apple account** or the first native build
  will fail signing.

## Sources

- [Teardown: Pokemon GO first time user experience, Chameleon](https://www.chameleon.io/blog/ux-teardown-pokemon-go-takes-over-the-world)
- [The UX of Pokemon GO, Fluid UI](https://blog.fluidui.com/the-ux-of-pokemon-go/)
- [Beyond the Hype: A UX Reality Check on Pokemon Go, UXPin](https://www.uxpin.com/studio/blog/beyond-hype-ux-reality-check-pokemon-go/)
- [BeReal Post-Mortem: What the Data Tells Us About Why It Failed](https://dev.to/bravo24/bereal-post-mortem-what-the-data-tells-us-about-why-it-failed-and-what-comes-next-339p)
- [Novelty Without Iteration: Why User Fatigue Led to the Downfall of BeReal](https://medium.com/@avafonss/novelty-without-iteration-how-user-fatigue-led-to-the-downfall-of-bereal-697ba1ef37cc)
- [BeReal Business Breakdown, Contrary Research](https://research.contrary.com/company/bereal)
- [How Does Pokemon Go Make Money? A Deep Dive, Juego Studio](https://www.juegostudio.com/blog/pokemon-go-revenue)
- [Pokemon GO Statistics 2026, Udonis](https://www.blog.udonis.co/mobile-marketing/mobile-games/pokemon-go)
- [Best practices for implementing IAP starter packs, PocketGamer.biz](https://pocketgamer.biz/comment-and-opinion/64530/best-practices-starter-bundles)
- [Pricing Starter Packs, Deconstructor of Fun](https://www.deconstructoroffun.com/blog/2024/4/8/free-to-play-starter-pack-pricing-when-conversion-is-king-we-may-price-too-low)
- [From Player to Payer: Cracking First-Purchase Conversion](https://blog.solar-engine.com/en-blog/docs/From-Player-to-Payer-The-Guide-to-Cracking-FirstPurchase-Conversion-in-Mobile-Games)
- [Hooked on rewards: The psychology behind battle passes](https://g2g.news/gaming/hooked-on-rewards-the-psychology-behind-battle-passes-in-free-to-play-games/)
- [Duolingo Streaks: How the Mechanic Drives 2x Daily Retention](https://duolingo.deconstructoroffun.com/mechanics/streaks)
- [Streak Design: 4 Rules Behind Duolingo's Loop, Yu-kai Chou](https://yukaichou.com/gamification-study/master-the-art-of-streak-design-for-short-term-engagement-and-long-term-success/)
- [The True Drivers Of D1, D7, And D30 Retention In Gaming, Solsten](https://solsten.io/blog/d1-d7-d30-retention-in-gaming)
- [Mobile Game Retention Benchmarks 2026, Segwise](https://segwise.ai/blog/mobile-gaming-app-user-retention-strategies)
- [Best Practices For Mobile Game Onboarding, AC&A](https://adriancrook.com/best-practices-for-mobile-game-onboarding/)
- [Progressive disclosure in onboarding](https://usertourkit.com/blog/progressive-disclosure-onboarding)
- [HideZone: IRL GPS Hide & Seek](https://play.google.com/store/apps/details?id=com.hidezone.hidezone&hl=en)
- [Gottcha - IRL Hide and Seek](https://apps.apple.com/app/gottcha-hide-and-seek/id6446601497)
- [Jet Lag: Hide & Seek Mapper](https://play.google.com/store/apps/details?id=com.wztlei.jetlaghideandseek)
