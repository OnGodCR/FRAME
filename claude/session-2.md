# FRAME: session 2 handoff

Written 2026-07-29. Read [session-1.md](session-1.md) first: it still describes
the architecture accurately and nothing in it has been invalidated. This file
covers only what changed.

Everything below is **uncommitted** at time of writing. 15 commits in the repo,
23 changed or new files in the working tree.

---

## 1. What this session was

Two things, in order:

1. **Push notifications**, which session 1 listed as item 7 of the core loop.
2. **A research pass on competitor UX, retention, and monetization**, then
   implementing the result. This was the larger half.

The research is written up in [RETENTION.md](../RETENTION.md), which is a
standalone document with sources. Section 8 of it is a shipped/not-shipped
table. This handoff does not repeat it; read that file for the reasoning behind
the product changes summarised here.

---

## 2. Notifications, now real

`mobile/src/engine/notify.ts` is new. Check-in ticks are scheduled as
**on-device local notifications against absolute timestamps**, at the iOS
`timeSensitive` interruption level.

Three decisions worth knowing:

**Locals, not push, for the ticks.** Ticks are deterministic: their timestamps
are fixed the moment the round starts. A local notification fires on time from
a suspended app; a push has to survive APNs, the network, and a sleeping radio.
Remote push is still needed, but only for the things that are *not*
deterministic (a tag, a nerf, an early zone contraction). That path is
`registerForPushToken`, which is inert until an EAS project exists.

**The module is loaded lazily and never enters the web bundle.**
`expo-notifications` has no meaningful web implementation and the dev preview
runs on react-native-web. Guarding at the import rather than at every call site
means the web preview cannot break on it. Verified: no console errors on web,
and the round still runs.

**`cancelAll` cancels tracked identifiers one by one, not
`cancelAllScheduledNotificationsAsync`.** The blunt version would also wipe the
next-round appointment, which has nothing to do with the round that just ended
and is the more valuable of the two. This is easy to "simplify" back into a bug.

The tick timestamps come from `HIDER_CHECKIN_TICKS` in `GameContext.tsx`, which
is now the **single source** for both the scripted timeline and the scheduled
notifications. They previously lived inline in the script. If those two ever
disagree, a notification fires at a moment the engine does not consider a
check-in window, and someone gets eliminated for nothing.

### The entitlement, which will bite someone

`app.json` now declares `com.apple.developer.usernotifications.time-sensitive`.
PRD 10.2 requires time-sensitive alerts, so it has to be there. **The matching
capability must be enabled on the Apple Developer account or the first native
build fails signing** with a confusing error. This is not a new blocker, it
joins the existing Apple Developer Program one, but it will look like a build
system problem rather than an account problem.

Without the entitlement provisioned, iOS quietly downgrades to `active` rather
than failing, so the alert still lands. That is why it was safe to ship now.

---

## 3. Android is now a v1 target

**This supersedes the iOS-only decision in session 1.** Angad has an Android
phone, and iOS-only meant the founder could not playtest their own game. That
blocks the two things that matter most right now: whether a check-in tick fires
from a suspended phone in a pocket, and the 3 / 5 / 10 minute interval playtest
that PRD 14 names as the top product risk. Neither can be answered on a
simulator, because both need a body walking around a city.

`app.json` now has `platforms: ["ios", "android", "web"]` plus a full `android`
block. Verified with `npx expo config --type public`: all three platforms
resolve. The icon pipeline already emitted Android adaptive icon assets, and
`notify.ts` already created an Android channel at `AndroidImportance.MAX`, so
this was cheaper than it looked.

**Permissions are declared explicitly, and so are the blocked ones.**
`READ_MEDIA_IMAGES`, `READ_EXTERNAL_STORAGE`, and `RECORD_AUDIO` are in
`blockedPermissions`. PRD 4.4 is a hard constraint that gallery access is never
requested; on Android a transitive dependency can pull a media permission into
the merged manifest without anyone noticing, and a gallery permission appearing
on the Play listing would contradict a promise the onboarding copy makes
explicitly. Blocking them means the manifest cannot drift.

`SCHEDULE_EXACT_ALARM` is there because the check-in ticks are exact by
definition. A tick that fires when Android feels like it is not a tick.

### Two things that are now permanent-ish and were guesses

`ios.bundleIdentifier` and `android.package` were both **unset**, which would
have blocked any real build. Both are now `com.frame.app`.

**This is a placeholder and both values are permanent once published to either
store.** Normally they would be reverse-DNS of a domain you own, and the domain
is still an open blocker. Change these **before** the first TestFlight or Play
upload, not after. After is effectively never.

### Known Android risk, not yet verified

Edge-to-edge rendering is **mandatory** from Expo SDK 54 onward, and this is
SDK 57. The Expo and `react-native-edge-to-edge` docs both warn that
`expo-status-bar` uses deprecated APIs under edge-to-edge and can behave
unexpectedly, recommending `SystemBars` from `react-native-edge-to-edge`
instead. `App.tsx` renders `<StatusBar style="light" />` and `expo-status-bar`
is in `plugins`.

This was left alone deliberately rather than refactored on spec. The app is
dark-themed throughout with `userInterfaceStyle: dark`, and every screen already
uses `useSafeAreaInsets`, so the layout should survive. The likely symptom is
just the status bar tint being wrong, which is cosmetic and easy to spot.
**Check it on the first Android run** and swap to `SystemBars` if the bars look
wrong. Do not preemptively rip out `expo-status-bar` without seeing the problem.

Android also needs a **development build** for remote push from SDK 53 onward;
local notifications work in Expo Go. Since the ticks are locals, Expo Go is
enough to test the single most important unproven claim. That is a genuine
upside of adding Android.

---

## 4. Product changes from the research

### Round length is 30 minutes

Angad's call, supersedes the PRD's 45. Driven from `ROUND_DISPLAY_MINUTES` in
`GameContext.tsx`; the lobby default moved to the 30 MIN option.

**This changes the cost arithmetic in [INFRASTRUCTURE.md](../INFRASTRUCTURE.md)
3, which has not been updated.** That doc computes 90 photos per round from a
45-minute round with 5-minute check-ins. At 30 minutes it is closer to 60. The
cost story gets *better*, so nothing is at risk, but the number is now stale.

### Onboarding went from 6 steps to 4

The funnel was seven screens before the home screen, two scroll-to-end gates,
and a mandatory 3-person party before the player experienced the core mechanic
once. Pokemon GO has a player catching something inside 60 seconds.

Removed from the linear funnel:

- **The permissions explainer.** It requested nothing, so it was pure reading
  placed where a new player has the least patience for it. Its copy was always
  right; the placement was wrong. It now renders as `PermissionNote` directly
  above whatever triggers the real system prompt. Currently used for
  notifications in the lobby, above START ROUND. **Location and camera still
  need theirs wired in** at their own prompts.
- **The map tutorial.** Now reference material, reachable from home and from the
  round screen's `?`, as often as anyone wants. The most cited FTUE failure in
  this genre is a tutorial that can never be seen again.

The age gate, legal acceptance, and safety card gate all stayed. They are hard
constraints and were never candidates for removal.

### Solo modes exist

The game structurally could not be played alone, which is a brutal cold start:
someone who installed on their own could not see the core mechanic at all.

**TEST FRAME** is the practice run. 60 seconds, the identical capture sequence,
nothing at stake. You are allowed to let the window lapse on purpose, and it
shows the real blackout screen when you do. That is deliberate: the first time
a player sees BLACKED OUT should not be the first time it has cost them
something.

**DAILY ASSIGNMENT** is one photographic prompt per calendar date, the same for
every player in the world, derived from the date so it needs no server to
agree. `mobile/src/data/assignments.ts`.

It is a **task, not a contest**, and that was Angad's correction to the original
design. It matters: scoring a photograph means either a model looking at it
(forbidden by PRD 4.5) or other players looking at it (a moderation burden
nobody needs). As a task, the validator confirms the capture was real and live,
and that is the entire bar. Completing it pays **+60 XP and +75 FILM**.

The prompt list has rules written into the file and they are not decoration:
achievable on public ground in any city, never routes anyone onto private
property or into traffic, and never asks for a person as the subject.

Uses the local calendar date, not UTC, and derives the day index from Y/M/D
components rather than the raw timestamp, so a daylight-saving shift cannot skip
or repeat a day.

**Reward payout is guarded on `isDailyOpen`** inside the state updater, so a
second run on the same day cannot pay twice whatever route the player took.

### The capture flow was extracted

`mobile/src/components/CaptureSequence.tsx` is new. The in-round check-in,
TEST FRAME, and the daily assignment all render the same component. Practice
that differs from the real thing is not practice.

`CheckinFlow.tsx` is now a 25-line wrapper. **When `expo-camera` gets wired in,
it goes in `CaptureSequence` and every mode gets it at once.**

### The results screen is a retention surface now

It previously showed a score and offered two exits. Every app studied uses this
moment to schedule the next session.

- **Rematch is the primary action.** The party exists and the roster is known,
  so this is the cheapest retention feature available.
- **A next-round appointment** with a real local reminder, via
  `notify.scheduleRoundReminder`. For a game that needs three other people free
  simultaneously, the reason a second round never happens is almost never that
  the player forgot. It is that nobody agreed a time.
- **The first-purchase bundle**, below.

### Monetization: one offer, one moment

`STARTER_BUNDLE` in `catalog.ts`. FIRST LIGHT, $2.99, anchored against $8.98,
containing a frame that is **not purchasable with FILM at any price** plus 600
FILM.

Shown **once**, on the results screen after a completed round, never on
install. That moment is chosen deliberately: the player has just spent half an
hour watching a feed of framed photographs, so they finally understand what a
frame is and where it is seen. There was no first-purchase offer at all before.

`redeemBundle` applies the frame, the FILM, and the equip in **one** state
update. Doing it as three separate actions meant a bundle could half-apply. It
also equips the frame immediately, because the whole pitch is that other people
see it.

**Frames are now the flagship shop category** rather than one tab of five. Every
check-in photo a hider sends wears theirs and the seeker sees every one, so it
is the highest impression-count cosmetic in the product by a wide margin. They
are previewed wrapped around an actual capture, not as an abstract swatch. Two
more shop frames were added because a flagship section with one product argues
against itself.

`Cosmetic.source` gained a `'bundle'` value. The loadout shows those as
BUNDLE ONLY rather than pointing at a shop page that will never sell it.

---

## 5. Verified versus written

**Verified by clicking through the preview**, with no console or server errors:

- The 4-step funnel, landing on home directly from the handle screen.
- The daily assignment end to end. XP moved 58% to 64%, FILM 1,250 to 1,325,
  streak started, card flipped to a done state.
- The 30-minute round. Clock read 26:24 of 30:00; lobby default reads 30 MIN;
  results scored survival against the new length.
- The `PermissionNote` appearing above START ROUND.
- Blackout into results, the three booking chips (booked TONIGHT · 19:00), and
  the FIRST LIGHT offer rendering with its anchor price.
- The frames section with in-context previews.
- Check-in 04 still opening at the identical tick after the refactor.

**Written but not proven on a device:** everything notification-related. The
web preview exercises the no-op path only. Nothing has confirmed that a real
tick fires from a suspended iPhone, and that is the single claim the entire
mechanic rests on. **Test this first on a real device.**

Typecheck clean. Validator still 26/26.

---

## 6. Still outstanding

In rough dependency order. Session 1's list still stands; these are additions
and changes to it.

1. **Test notifications on a real device.** See above.
2. **Real camera** (`expo-camera`), into `CaptureSequence`. Still the highest
   value engineering item, and now it lands in three modes at once.
3. **Wire `PermissionNote` to the location and camera prompts.** Only
   notifications is done.
4. **Live Activity / Dynamic Island** for the round timer. Needs a native
   widget extension and the Apple program. PRD 10.2 calls this the single
   highest-value platform feature, and it is a safety feature as much as a UX
   one because it keeps players from walking while staring at a screen.
5. **Shareable round artifact.** Needs a view-capture dependency and a decision
   about what the image contains. This is the acquisition loop, not just
   retention: growth is necessarily word of mouth inside existing friend groups.
6. **Contextual first-sight POI callouts.** The legend being permanently
   reachable was the more important half and is done. Teaching each pin type
   the first time one appears on the map is still worth doing.
7. **Streak freeze.** The weekly streak is tracked and displayed but there is no
   freeze. RETENTION.md 5.2 is explicit that a streak a player cannot protect is
   a churn trigger, not a retention mechanic. Do not leave this half-built.
8. **Season pass pacing.** 50 tiers is Fortnite-shaped and Fortnite is played
   daily by a solo player. If a real engaged FRAME player manages one or two
   rounds a week they will finish nowhere near 50, and someone who cannot
   complete a pass does not buy the next one. Needs playtest data.
9. **LONG EXPOSURE**, designed and not built. Solo endurance: unpredictable
   pings, dual capture each time, enforced relocation between captures via pHash
   plus GPS displacement, streak leaderboard, zero contact with any other
   player. It is the strongest remaining use of the validator, and it is
   **blocked on calibration photos** in a way nothing else is, because the mode
   *is* the reuse threshold. Building it before those photos exist means
   inventing the number the whole mode is made of.

Everything in session 1 section 7 that was not touched this session is still
open, notably the schema, the second migration, replacing the demo engine with
server state, and all four PRD 7 safety systems.

---

## 7. What is blocked on Angad

Unchanged from session 1, and **calibration photos are now blocking more than
they were**. They gate the validator thresholds, and they additionally gate
LONG EXPOSURE entirely. The `repeat/` series is the one that matters most: it
decides whether honest players who stand still get eliminated, and that number
cannot be derived synthetically.

Also still open: applying the schema, the Expo Go redirect, the Apple Developer
Program (now also needed for the time-sensitive entitlement), a domain, an
attorney, and the 3 / 5 / 10 minute interval playtest.

Angad was walked through the calibration shooting process at the end of this
session. `calibration/pass/`, `calibration/fail/`, and `calibration/repeat/`
now exist as empty directories so there is somewhere to drop them.

---

## 8. Second pass on Angad's review

### The fake progression was a bug, not a browser artifact

A new install opened at **level 7, 1,250 FILM, season pass tier 12**, with
free-track cosmetics already claimed. That was demo dressing hardcoded as the
initial state, and it read as a bug because it was one.

`FRESH_PROFILE` is now what a real account looks like: level 1, zero XP, zero
FILM, defaults only. The old values live in `SEEDED_PROFILE` behind
`DEMO_SEED = false`, for screenshots. **Never ship it true.**

More importantly, **season tier was a module constant** (`SEASON.currentTier`)
read directly by three screens, so the pass could not progress at all. It is now
`profile.seasonXp` plus a `passState()` derivation in catalog.ts, and `withXp`
accumulates season XP alongside level XP. The pass bar now actually moves when
you play, which it never did.

FILM starting at zero is deliberate: the daily pays 75, the cheapest cosmetic is
300, so the shop is about four days of showing up away. Handing over a pile at
install removes the only reason to come back on day two.

### The assignment prompts were dangerous and I wrote them

Angad caught this and was right. The first list included **"the view from as
high as you can legally stand"** and **"the narrowest gap you can find"**.
Those are competitive instructions to climb and to squeeze into somewhere
precarious. "Legally" is not the constraint that stops someone falling. In a
game that routes teenagers to real coordinates that is a serious mistake, not a
tone problem.

The rule now written into `assignments.ts`: **no superlative that rewards
physical risk.** Never "as high as", "the narrowest", "the deepest". A
superlative is an instruction to keep going, and a prompt needs an obvious
stopping point.

The list is now mostly **destination prompts**, which was Angad's idea and is a
better shape than anything in the original: "get as close as you can to an ice
cream shop", with the live distance to the nearest match shown. It is the safest
possible daily task because the optimal play is walking along a pavement to a
shop, which is what the game wants people doing anyway. It reuses the OSM
category data already loaded, via `nearestMatch()`.

`nearestMatch` matches loosely (substring both directions) because OSM category
tags are inconsistent: an ice cream place can be `ice_cream`, `ice_cream;cafe`,
or `confectionery`. Being strict here would make the task read as broken in most
of the world. It returns **null** rather than a fallback distance, because a
made-up number would send someone walking toward nothing.

### Shared captures are party-scoped, not public

Angad asked to let people see each other's assignment photos. Built, and
deliberately scoped to **the existing party only**. That is not the same feature
as a global feed and the difference is not cosmetic:

- The splash screen says PRIVATE PARTIES ONLY, and marketing/BRIEF.md 9 lists
  "never imply stranger play" as a legal line.
- The age gate means minors are on this platform. A worldwide photo feed
  containing minors needs proactive moderation, not a report button, and App
  Store 1.2 requires filtering plus a published contact before a UGC feed can
  ship at all.
- Assignment photos are pictures of where somebody physically is. Showing those
  to strangers is location disclosure however it is framed.

Report and block are in from the first commit rather than bolted on later,
because a feed without them is not shippable and deferring that work only moves
it. **If a global feed is genuinely wanted, it is a moderation project, not a
scope change**, and it needs a decision about minors before any code.

### Seeker bidding

Highest bid takes the seeker role and pays, instead of the server rolling for
it. The winner **spends** the FILM, so it is a currency sink and wanting to seek
is a preference rather than an advantage.

**The constraint that makes this safe: FILM is earned, never sold.** There is no
FILM IAP and there must not be one while bidding exists, because selling FILM
would turn a role advantage into something purchasable and breach the marketing
brief's hardest line. That reasoning is written on `Profile.film` so it is found
by anyone who later considers a currency pack.

### The round clock races, and a real-time mode is not a one-liner

The demo compresses 30 display minutes into 250 real seconds, so the clock runs
at **7.2x**. That was intentional and completely unlabelled, which reads as a
bug. Both round screens now show `DEMO PACE · 7.2× REAL TIME` under the clock.

I started building a real-time option and **backed it out**, which is worth
recording so nobody re-attempts it casually. The script timeline is authored in
compressed seconds while `CHECKIN_WINDOW` is in real seconds. Stretching the
clock also stretches the check-in window to about five minutes, quietly breaking
the one mechanic that has to stay exact. Doing it properly means separating the
script clock from the wall clock and tracking which script keys have already
fired, in an engine slated for replacement by server state. Labelled now,
deferred deliberately.

### Presets and the map legend

Ten dials is a lot for a first-time host, and the only preset was buried in an
`APPLY RURAL PRESET` link at the bottom where nobody found it. There are now
three named presets (CITY, SPRINT, RURAL) shown **above** the dials, each saying
what it changes, with the active one highlighted and a CUSTOM state once a dial
is touched.

The map legend went from a small text link to a real card on the home screen.

### A monetization note on sponsored destinations

Angad's observation that destination prompts are sponsorable is correct and it is
the most natural revenue idea in the product so far: a sponsored prompt is
advertising, not pay-to-win, so it does not touch the "nothing purchasable helps
you win" line at all.

Two constraints to design against before selling any of it, recorded in
RETENTION.md: the age bracket is already stored for the ads rule, so **sponsored
prompts must respect it** rather than going to every account; and a paid prompt
needs **disclosure**, since an undisclosed sponsored task aimed partly at minors
is an FTC problem rather than a taste problem.

## 9. The camera is real, and so is the validator

`expo-camera`, `expo-image-manipulator`, and `jpeg-js` are installed and wired.
This closes session 1's items 4 and 5 in one pass.

**`components/CameraStage.tsx`** is the viewfinder. Native gets a real
`CameraView`; web falls back to `ProceduralPhoto` so the browser preview, which
is where most review happens, keeps working. Loaded lazily on native for the
same reason `notify.ts` is: keeping the native module out of the web bundle
entirely beats importing it and guarding every call site. There is no gallery
path in the component and no media permission is requested, because PRD 4.4 is
a hard constraint and the onboarding copy promises it explicitly.

**`validation/decode.ts`** is the part that matters. The pipeline is
capture, downscale to 256 px, JPEG decode to RGBA, flatten to grayscale, then
straight into the existing `validate()`. **The validator now runs on real
pixels**, which it never has before.

Three decisions worth knowing:

- **256 px analysis edge.** A full 12 MP frame is roughly 36 MB of RGBA and
  takes seconds to decode in JS, which is unusable inside a 60 second window.
  Every signal being measured (blur, exposure, entropy, edge density) is
  scale-tolerant, and the pHash runs on a 32x32 DCT regardless, so the
  downscale costs accuracy nothing and buys an order of magnitude in speed.
- **Base64 is decoded by hand.** `Buffer` and `atob` are not reliably present
  in React Native, so `base64ToBytes` is 20 lines with no dependency rather
  than a polyfill.
- **A frame that cannot be decoded fails.** The safe default when we cannot see
  the image is not to accept it.

**PRD 4.4's retry flow now exists**, and did not before. A failed capture names
the failing check in plain language from the real `Verdict.message`, shows which
rows failed, and offers exactly one retry with a 30 second extension. The
validating readout is driven by the actual verdict, so a row saying PASS means
that check genuinely passed rather than that a timer elapsed.

**All of this is unverified on a device.** It typechecks, the web fallback is
confirmed working, and the Android bundle compiles, but no real photograph has
been through it. Expect the thresholds to be wrong: they are still the
placeholder values, which is exactly what the calibration photos are for. The
first real test will probably reject valid captures.

### eas.json

Added, with development, preview, and production profiles. The development and
preview profiles produce an APK with `distribution: internal`, which is what
makes `npx eas-cli build --profile development --platform android` work first
try instead of erroring on a missing config.

### Expo Go on Android does not come from the Play Store

Worth writing down because it cost time and looks like a broken phone. Expo Go
for SDK 57 on Android is **not** distributed through the Play Store; the store
build tracks an older SDK, so "update to the latest version" does not fix
"unsupported SDK". The matching client is Expo Go 57.0.2, published as an APK
on Expo's own `expo/expo-go-releases` GitHub repo. The URL comes from
`https://api.expo.dev/v2/versions/latest` under `sdkVersions['57.0.0']
.androidClientUrl`, which is the reliable way to find it rather than guessing.

Uninstall the Play Store copy first: signatures differ and installing over it
fails with a confusing "App not installed".

## 10. First-run experience, second pass

Research on empty states says the common failure is a **dead end**: a screen
with no explanation and no call to action. FRAME had exactly that. A brand new
level 1 account with zero FILM landed on a home screen showing an empty season
pass, a default loadout, a shop it could not afford, and two buttons that both
need friends it does not have yet.

Two changes, both straight out of the research:

- **A START HERE card**, shown until the player has practised once. It names
  the mechanic in one sentence and offers exactly one next step, the 60 second
  test frame. One action, not a menu.
- **Progressive disclosure.** The pass, loadout, and shop are hidden until the
  first capture. They are meaningless before there is any progress in them, and
  three dead cards buried the one thing a new player should actually do. They
  appear about 60 seconds in.

Plus a three step checklist (try a check-in, do today's assignment, play a
round with friends) that disappears once complete rather than becoming a
permanent chore list. It deliberately ends at playing with friends and not at
anything purchasable.

## 11. Third pass on Angad's review

Backlog now lives in [CLAUDE.md](../CLAUDE.md) 6 so a future agent inherits it.
Tick items there as they land; the reasoning goes here.

### The honest answer to "is the backend connected"

**No, and nothing in the client has ever talked to a database.** Verified by
grep: there is not a single `.from()`, insert, or select anywhere in
`mobile/src`. Supabase appears only in `AuthGate.tsx`, purely for OAuth
sign-in. `0001_core.sql` has never been applied.

So "is a new account treated as new" has an odd answer: accounts do not exist.
All state is device-local `AsyncStorage`, and a new account just means a device
with no stored state. Signing in with Google authenticates a person and stores
nothing about them. Two phones share nothing. Written up as CLAUDE.md 7 because
the app looks like it has a backend and does not.

### Why the daily looked already done

Two separate things, and only one was a code bug.

**The artifact:** the daily was completed in the browser preview during
testing, on the same origin, so `localStorage` carried it over. Nothing in the
app marked it done on its own.

**The real bug, now fixed:** the payout called `setProfile` from inside a
`setDaily` updater, nested inside a `setSolo` updater. React may invoke an
updater more than once, and a side effect in there can therefore run twice, so
the FILM could be paid twice. Updaters must stay pure. The payout is now a
plain effect in `exitSolo`, still guarded by `isDailyOpen`.

Also added **RESET PROGRESS** on home. With no server, the only other way to
get a true new account was clearing app data by hand, which is easy to get
wrong and easy to mistake for a bug.

### The round clock

It was scaled by `DEMO_SPEED`, compressing 30 minutes into 250 seconds, so each
tick moved the display 7 to 8 seconds. That is gone. The clock is real time
now: `roundClock` is simply `totalReal - elapsed`, and the timeline is authored
in real seconds.

Consequences worth knowing:

- **Check-in ticks moved to the honest PRD 4.2 spacing**, every 5 minutes, five
  per round, replacing the two scaled stand-ins at 20 s and 150 s.
- `CHECKIN_WINDOW` is now **60 seconds**, the actual PRD 4.4 figure, rather
  than 45 seconds standing in for a fictional 60.
- The ambient script was authored against the old 250 second round, so it is
  **rescaled** at module load rather than rewritten by hand, preserving its
  pacing across the full 30 minutes.
- `DEV_TIME_SCALE` exists for skimming a round while working. It ships at 1.

**Not fully verified.** The clock counts down one second at a time, confirmed
(1740, 1739, 1738 with no skips). But in the headless browser pane it advances
at roughly half wall time. A raw `setInterval(1000)` in the same page fires at
a true 1 Hz, so it is not plain timer throttling; it may be React scheduling in
a hidden tab, or a genuine halving. **Attempts to instrument it were defeated
by bundle caching, so this is unresolved.** Check it on a device: if the clock
runs at half speed there too, it is a real bug and the suspect is the round
interval effect being torn down and recreated.

### Everything else in that pass

- **Host a round and Join with code moved above** the progression cards. The
  two things a returning player came to do were below three cards about
  cosmetics.
- **Map opens at `DEFAULT_ZOOM = 1.15`** rather than 2. At 2 most of the zone
  and most POIs were off screen, and a hider needs to see where they can run to
  more than they need detail underfoot.
- **Season pass cut from 50 tiers at 1000 XP to 30 at 500.** A player doing the
  daily plus a round earns roughly 300 season XP a day, so the old track was
  about 160 days against a 70 day season: literally unfinishable, and someone
  who cannot complete a pass does not buy the next one. Cosmetic tier numbers
  were remapped across the shorter track rather than dropped, so no reward was
  lost.
- **A TDZ crash was caught and fixed** while doing that: `TIERS` is built at
  module load and referenced `TIER_COUNT`, which was declared 70 lines later.
  `tsc` cannot see this; it only fails at runtime. The constants moved above.

### Still not started

The large features are untouched and specified in CLAUDE.md 6: global
leaderboard, friends tab with codes and QR, sharing the daily capture with
applause, referrals, and shop expansion. **The daily assignment redesign is
also still open**: the current prompts are too menial, which Angad is right
about, and that needs a design pass rather than another list of nouns.

Every one of those is bound by the constraints in CLAUDE.md 6: friend codes but
never stranger discovery, report and block on any social surface from the first
commit, and watch the FILM supply, because applause and referral grants are new
faucets that devalue every shop price if they run hot.

## 12. Bug found and fixed: the scroll gates could lock a player out

Angad hit this on a wide viewport: the legal gate's button stayed on
SCROLL TO THE END forever and the app could not be entered.

**Both scroll-to-end gates could become impossible to satisfy.** When the
content fits inside the viewport there is nothing to scroll, so `onScroll` never
fires and `reachedEnd` never flips. The player is locked out permanently. This
affects [LegalGate.tsx](../mobile/src/screens/LegalGate.tsx), which blocks the
entire app, and the `SafetyOverlay` in
[JoinLobby.tsx](../mobile/src/screens/JoinLobby.tsx), which blocks starting any
round.

Both already had a fits-entirely guard, and **the guard did not work**:

```js
onContentSizeChange={(_, h) => {
  if (viewerH > 0 && h <= viewerH + 8) setReachedEnd(true);
}}
```

`onContentSizeChange` and `onLayout` fire in an order React Native does not
guarantee, and in practice content size arrives first. So `viewerH` was still 0,
the condition was skipped, and nothing ever re-evaluated it. The guard read as
correct in review and was dead code at runtime.

Fixed by holding both measurements in state and comparing them in an effect, so
it re-runs whenever either value lands, in either order:

```js
useEffect(() => {
  if (viewerH > 0 && contentH > 0 && contentH <= viewerH + 8) setReachedEnd(true);
}, [viewerH, contentH]);
```

Verified both directions, which is the part that matters: at 420x1500 the legal
gate now reads I AGREE immediately, and at 375x812 it still reads SCROLL TO THE
END and still requires a real scroll. A fix that just satisfied the gate
unconditionally would have quietly removed a consent requirement.

**This is the third time this class of bug has appeared.** Session 1 fixed the
safety card when its `Modal` would not scroll at all. Any future scroll-gated
consent needs both cases tested: content overflowing, and content fitting.

**Adding Android made this urgent rather than cosmetic.** Portrait orientation
is locked, so on a phone the content always overflows. But an unfolded foldable
or an Android tablet has the room to fit it, and there was no iOS equivalent
because `supportsTablet` is false. Shipping Android without this fix would have
meant a permanently unusable app on those devices.

## 13. New gotchas

- **Browser pane coordinates are NOT 2x, contrary to session 1 gotcha 2.** The
  tool reports `Screenshot size: 375x812` while the returned image is 750x1624.
  Clicking at the *image's* pixel coordinates misses. Click by `ref` from
  `read_page` instead.
- **`ref` clicks only work at the standard presets.** At a custom viewport
  (420x1500, 1380x1610) the screenshot is downscaled and the tool's click
  coordinates stop matching CSS pixels, so clicks land nowhere and the app looks
  frozen. It is not frozen. Drive it with a dispatched DOM click instead:

  ```js
  (()=>{const a=[...document.querySelectorAll('div')].filter(e=>e.innerText==='ENTER');
  const t=a[a.length-1];
  ['pointerdown','mousedown','pointerup','mouseup','click']
    .forEach(k=>t.dispatchEvent(new MouseEvent(k,{bubbles:true,cancelable:true})));})()
  ```

  This cost real time. It looked exactly like a broken button.
- **`javascript_tool` shares one scope across calls**, so `const els = ...`
  twice throws `Identifier 'els' has already been declared`. Wrap every snippet
  in an IIFE.
- **A React error leaves the tree unmounted and every later click does nothing.**
  Check `read_console_messages` before assuming a click target is at fault, and
  reload after any caught component error.
- **`scroll` frequently times out with "The Browser pane is currently hidden"
  even though the scroll actually happened.** Screenshot afterwards to confirm
  rather than retrying, or the same scroll gets applied twice.
- **`scroll` needs a prior screenshot** in the same session before it accepts a
  `coordinate`, and `scroll_amount` caps at 10.
- **Scroll-to-end gates need real scroll events.** `scroll_to` on a ref moves
  the view without tripping the gate's `onScroll`.
- Session 1's note that Metro does not watch files on this machine is still
  true and still costs a restart per change.
