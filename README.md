# FRAME

Extreme IRL hide and seek. Hiding isn't enough. Every few minutes you have to
photographically prove you're hidden, and the seeker sees everything.

Miss the window and you are **BLACKED OUT**, which the product deliberately
presents as more humiliating than being tagged.

---

## Repo map

| Path | What it is |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | **Read first.** Standing instructions, current backlog, hard constraints. |
| [`PRD.md`](PRD.md) | The full v1 spec. Authority whenever docs disagree. |
| [`TEST-FIXTURES.md`](TEST-FIXTURES.md) | Register of everything fake, and how to switch it off. |
| [`RETENTION.md`](RETENTION.md) | Competitor UX research and the resulting product changes. |
| [`INFRASTRUCTURE.md`](INFRASTRUCTURE.md) | Cost posture and the tick worker design. |
| [`claude/`](claude) | Session handoffs, in order. Start at the highest number. |
| [`mobile/`](mobile) | The app. React Native, Expo SDK 57, TypeScript. |
| [`supabase/migrations/`](supabase/migrations) | Schema. **Neither migration has been applied yet.** |
| [`calibration/`](calibration) | Where the validator calibration photos go. Still empty. |

---

## Running it

```bash
cd mobile && npx expo start
```

- **Browser:** press `w`. Best at an iPhone viewport, 375x812.
- **Android device:** Expo Go for SDK 57 is **not on the Play Store**. Install
  the APK from Expo's own releases, then enter the `exp://` URL manually.
  See [`claude/session-2.md`](claude/session-2.md) for the exact link.
- **iOS:** needs the Apple Developer Program, which is still an open blocker.

Turn off every fixture with one flag:

```bash
EXPO_PUBLIC_TEST_MODE=false npx expo start
```

---

## What the app does today

### Structure

Five buckets behind a bottom tab bar, with the game in the middle:

| Tab | Holds |
|---|---|
| **NEARBY** | Games near you and the POI list. **18+ only.** |
| **SOCIAL** | Friends, friend codes and QR, referrals, leaderboard. |
| **GAME** | Missions, host a round, join with code. Nothing else. |
| **STORE** | Season pass, shop. |
| **PROFILE** | Level, XP, cosmetics owned, settings. |

The Game tab deliberately holds four things: identity, missions, the two play
buttons, and the ad slot. Everything else lives in a bucket, because a home
screen can only answer "what do I do now" if it isn't also answering "what can
I buy" at the same time.

### The core loop

1. **Onboarding**, 4 steps. Neutral DOB gate (under-13 refusal sticks after 3
   corrections), legal acceptance, account or guest, handle. The date of birth
   is never stored, only which side of 18 you're on.
2. **Missions**, three a day. Finishing all three pays 100 FILM.
3. **Solo**, playable alone from the first minute: TEST FRAME practice and the
   DAILY ASSIGNMENT, one prompt shared worldwide.
4. **Lobby**, invite code, zone map, named presets, seeker bidding, and the
   safety card gate.
5. **Round**, 30 minutes, real time. Full-bleed map, check-ins every 5 minutes
   with a 60-second window, reveal pings, shrinking zone, SOS.
6. **Check-in**, the real camera on device: back then front, decoded and run
   through the PRD 4.5 validator on actual pixels, with one retry on failure.
7. **Results**, rematch, a next-round appointment with a local reminder, and a
   one-time first-purchase offer.

### What's real

- **Landmarks and streets** from live OpenStreetMap, filtered by the PRD 6.1
  placement rules.
- **The validator**, running on real pixels: Laplacian variance, mean
  luminance, histogram entropy, Sobel edge density, and a 64-bit DCT pHash.
  26 tests pass.
- **Check-in notifications**, scheduled as on-device locals at the iOS
  time-sensitive level, so they fire from a pocket.
- **The camera**, via `expo-camera` on a physical device.
- **Supabase auth**, Google OAuth verified end to end.

### What isn't

There is **no backend**. Not a single database call exists in the client;
Supabase is used only for sign-in. All state is device-local. Two phones share
nothing, so friends, the leaderboard, and parties are local fixtures.

Full register in [`TEST-FIXTURES.md`](TEST-FIXTURES.md), which also lists the
one flag that turns all of it off.

---

## Hard constraints

These are legal and safety lines, not preferences. [`PRD.md`](PRD.md) marks
them **[HARD CONSTRAINT]**; [`marketing/BRIEF.md`](marketing/BRIEF.md) 9 lists
the claims that cannot be made.

- **No face detection, ever.** Whole-image statistics only.
- **Live capture only.** No gallery, and no gallery permission is requested.
  Android blocks the media permissions outright so the manifest cannot drift.
- **A seeker cannot read a hider's position between reveal ticks**, enforced in
  the database rather than in a query.
- **Public ground only.** Nothing may route a player onto private property,
  into traffic, or toward another person. This is why the daily assignment
  prompts have no superlatives: "as high as you can" is an instruction to climb.
- **FILM is earned, never sold**, for as long as seeker bidding spends it.
- **No stranger discovery**, with one deliberate exception below.

### The one supersession

The **NEARBY** tab lets adults see other players nearby and ask to join their
game. That crosses the "never imply stranger play" line and is a product
decision taken knowingly. It is built to the most conservative reading that
still delivers it: 18+ only, opt in and off by default, coarse distance
buckets rather than positions, requests rather than messaging, and report and
block on every row.

---

## Open blockers

Roughly in order of how much they hold up.

1. **Apply the migrations.** `0001_core.sql` then `0002_social.sql`, via the
   Supabase SQL editor. Nothing is genuinely multiplayer until then.
2. **Calibration photos** into [`calibration/`](calibration). The validator
   runs on placeholder thresholds and has never seen a real photograph. The
   `repeat/` series decides whether honest players get eliminated for standing
   still, and it cannot be derived synthetically.
3. **Test a check-in notification from a pocket** on a real Android phone.
   This is the single unproven claim the whole mechanic rests on.
4. **Apple Developer Program**, $99/yr. Needed for TestFlight, Sign in with
   Apple (mandatory alongside Google under Guideline 4.8), and the
   time-sensitive notification entitlement.
5. **A domain.** Four public URLs are App Review requirements: explainer page,
   POI complaint form, privacy policy, terms.
6. **An attorney** for the liability language. The drafts in
   [`legal/`](legal) are substantive but explicitly unreviewed.
7. **Change the app identifiers.** `com.frame.app` is a placeholder and is
   permanent once published to either store.

---

## Commands

```bash
node mobile/src/validation/signals.test.mjs
```

```bash
node brand/build-icons.mjs
```

```bash
node scripts/ingest-pois.mjs --lat 47.6062 --lon -122.3321 --radius 1000 --label "Downtown Seattle"
```

The Metro file watcher does not pick up edits on this machine. Every code
change needs a full dev server restart.
