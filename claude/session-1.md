# FRAME: session 1 handoff

Written 2026-07-28. Read this before continuing work on FRAME. It captures
what exists, why it was built the way it was, what is still missing, and what
is blocked on Angad.

Repo state at time of writing: 14 commits, ~8,100 lines of TypeScript across
48 source files, plus SQL, docs, and brand assets.

---

## 1. What FRAME is

Real-world hide and seek for a private group of 3 to 20 friends across a city
zone, typically 1 km. One Seeker, everyone else hides, 45 minutes.

**The differentiator is forced photographic proof.** On a timer, every hider's
phone alerts and they have 60 seconds to take two live captures, back camera
then front, of exactly where they are hiding. Those go to the Seeker's feed
immediately. Miss the window or fail validation and you are **BLACKED OUT**,
which the product deliberately presents as more humiliating than being tagged.

The source spec is [PRD.md](../PRD.md), working title BLACKOUT. It is the
authority; when this document and the PRD disagree, the PRD wins. Sections
marked **[HARD CONSTRAINT]** in it are legal or safety requirements and were
treated as non-negotiable throughout.

Positioning, per PRD §2: the GPS hide-and-seek category is a commodity
(HideZone, Gottcha, Jet Lag companions). The photo mechanic is the defensible
ground. **Lead with it, never with the map.**

---

## 2. What exists and works

A playable demo in `mobile/`, React Native + Expo + TypeScript, running end to
end. Verified by clicking through it repeatedly in the browser pane.

### Screens, in flow order

| Route | State |
|---|---|
| `splash` | Wordmark, corner brackets, flicker on native |
| `dob` | Age gate, full calendar validation, 3 corrections then sticky |
| `legal` | Four key points, full ToS/Privacy in-app, scroll-locked accept |
| `auth` | Google / Apple via Supabase OAuth, guest as a first-class option |
| `handle` | Handle picker |
| `permissions` | Contextual permission explainer, requests nothing |
| `mapTutorial` | Explains the three POI types with the map's own glyphs |
| `home` | Level/XP, season pass strip, loadout, shop entry, Nearby, ad slot |
| `shop` | FILM currency, 6 cosmetics with live purchase, pass product |
| `pass` | 50 tiers, free and paid tracks, auto-scrolls to current tier |
| `loadout` | Hero preview, category tabs, tap-to-equip, locked items show source |
| `join` | 6-char invite code, unambiguous alphabet |
| `lobby` | Code, zone map, roster, **editable** host settings, safety card gate |
| `roleReveal` | Seeker shuffle then HIDE / SEEK |
| `round` (hider) | Full-bleed map, POIs, check-in countdown, SOS, explainer |
| `checkin` | Camera flow, validation sequence, submitted state |
| `round` (seeker) | Proof feed, reveal pins, BLE-gated TAG |
| `blackout` | The loss state |
| `results` | PRD scoring formulas, MVP, XP, role swap |

### Systems that are genuinely real, not simulated

- **Landmarks and streets.** `scripts/ingest-pois.mjs` pulls live OpenStreetMap
  data via Overpass and applies the PRD §6.1 placement filters. On downtown
  Seattle: 7,309 raw elements → 1,002 named candidates → **310 rejected by the
  25 m exclusion buffer** → 32 balanced POIs. Verified live in Times Square,
  which returned Duffy Square and 49th Street.
- **Location-driven world.** The app resolves landmarks around the player's
  real position at runtime, with the baked Seattle set as offline fallback.
- **Opening hours drive gameplay.** Tapping Seattle Art Museum in the evening
  shows `CLOSED RIGHT NOW` and disables interaction, straight from OSM data.
- **The §4.5 validator.** Real Laplacian variance, mean luminance, histogram
  entropy, Sobel edge density, and a 64-bit DCT pHash. 26 tests pass.
- **Map camera.** Full-bleed, follows the player, pinch and button zoom,
  compass heading cone from the magnetometer.
- **Supabase auth.** Google OAuth confirmed working end to end.
- **Persistence.** Progression survives restart via AsyncStorage.

### Still simulated

Everything else. `mobile/src/engine/GameContext.tsx` scripts the entire round
on a compressed timeline: a "45:00" round plays in about 4 minutes. The other
five players are bots. Check-in photos are procedurally generated abstract
images (`ProceduralPhoto.tsx`), never a real camera. The validator exists but
is not yet wired to real captures.

---

## 3. Key files

```
mobile/src/
  theme.ts                 palette, fonts, spacing. Start here.
  engine/
    GameContext.tsx        the demo engine. All scripted round behaviour.
    WorldContext.tsx       location request and POI loading
    persist.ts             AsyncStorage
    useHeading.ts          compass
  data/
    poiRules.ts            PRD 6.1 filters, SHARED with the ingest script
    worldSource.ts         Overpass fetch, marked as not-production-shape
    catalog.ts             cosmetics + 50 pass tiers, single source of truth
    legal.ts               ToS and Privacy, also rendered to legal/*.md
    world.json             baked offline fallback (Seattle)
  validation/
    signals.ts             the real 4.5 validator
    signals.test.mjs       26 tests, run with node directly
  components/
    ZoneMap.tsx            the map camera
    MapCamera.tsx          zoom controls and pinch
    motion.tsx             FadeIn, PressScale, CountUp
supabase/migrations/0001_core.sql   schema + RLS
brand/build-icons.mjs               regenerates every icon from one SVG
scripts/ingest-pois.mjs             POI ingest, imports poiRules.ts directly
```

**Node 25 strips TypeScript natively**, which is why `ingest-pois.mjs` can
import `poiRules.ts` with no build step. That is deliberate: the placement
filters must never drift between the offline bake and the live fetch.

---

## 4. Decisions worth knowing, and why

These were judgment calls. If you disagree, disagree knowingly.

**Positions have no seeker-facing SELECT policy at all.** PRD §9 requires that
a seeker cannot read a hider's position between reveal ticks *at the database
layer*. Rather than filter in the query, `positions` is readable only by its
owner, full stop. Seekers read a separate `reveals` table that the tick worker
writes, carrying a coordinate snapshot rather than a foreign key, so there is
no path back to the live track. This is the single most important line in the
schema.

**The DOB itself is never stored.** Only `age_bracket`. The game needs the
bracket for the ads rule; holding a birthdate adds risk for no benefit.

**Age gate allows 3 corrections, then sticks.** The PRD wants a sticky refusal.
Angad wanted typos to be correctable. Unlimited retries turn the gate into a
guessing game, so 3 is the middle ground.

**Playgrounds are excluded from POIs** even though §6.1 does not name them.
This game routes teenagers to coordinates; sending them where small children
play is the same class of error as the school exclusion.

**Only beacons are labelled on the map by default.** Labelling all 32 POIs was
the clutter Angad flagged. Everything else earns a caption past 3.2x zoom.

**Map zoom has buttons as well as pinch.** One-handed play while walking is the
normal case and a pinch needs two hands.

**The app icon has no wordmark.** iOS prints the app name under the icon
already, and at 44px the letters were an unreadable smear.

**Web stays in `platforms`** even though v1 is iOS-only, purely so the dev
preview keeps serving a bundle. Setting `['ios']` alone breaks it.

**No em-dashes anywhere.** Standing instruction from Angad. Applies to UI copy,
comments, docs, and chat. Check with `grep -rnP "\x{2014}" .` before declaring
copy done. That escape is used rather than the literal character so this file
passes its own check.

---

## 5. Bugs found and fixed this session

Worth recording because several were subtle.

1. **Safety card could never be acknowledged.** It was a React Native `Modal`
   whose inner `ScrollView` would not scroll, so the scroll-to-end gate never
   unlocked and the round could never start. Replaced with an in-tree overlay.
2. **Shop overflowed horizontally.** The pass card's text column had no flex
   constraint, so long copy pushed the price off the edge and made the entire
   page horizontally scrollable. Fixed with `flex: 1, minWidth: 0`.
3. **Check-in counted only on "Return to hiding".** Lingering on the
   confirmation screen could black you out after a valid submission. Now
   registers the moment validation passes.
4. **POI projection was wrong.** Landmarks 1 km out rendered outside the zone
   ring. The projection maps a 0.5 offset to the zone radius; the render was
   using a different scale.
5. **Map labels never rendered.** A sized child inside a zero-size `Pressable`
   does not lay out on react-native-web. Labels became their own layer.
6. **DOB accepted anything.** `02/30/1799` passed. Now full calendar validation.
7. **No URL scheme.** `Linking.createURL` had nothing to build against, so the
   OAuth redirect would not have resolved in a standalone build.
8. **Season pass had dead tiers.** Rows 43 and 48 were empty on both tracks,
   which reads as a bug on the track someone paid for.

**Three validator test failures were bad fixtures, not bad code.** The LCG's
low bits cycled too fast to be noise; two "different" test scenes shared
identical structure; and one test asserted that shifting a synthetic sine wave
by a pixel should barely move the pHash. That last claim is simply wrong about
photographs, so it was deleted rather than tuned into passing, and the real
question was handed to the calibration photos.

---

## 6. Credentials and config state

- **Supabase project:** `https://cldrgsggfqneisjkwmxw.supabase.co`
- Keys live in `mobile/.env`, gitignored. Anon key only. **The service_role key
  has never been shared and should not be pasted into chat.**
- **Google OAuth: enabled and verified working.** The full handoff was traced:
  Supabase redirects to Google with the correct client ID, Google returns 302
  to its sign-in page with `scope=email profile`.
- **Apple sign-in: not enabled.** Needs the paid Apple program. Note that
  Apple Guideline 4.8 requires Sign in with Apple if any other third-party
  sign-in is offered on iOS, so this is mandatory before submission.
- **Schema not applied.** `0001_core.sql` is written but not run. Applying it
  needs the SQL editor or service_role; the anon key cannot run DDL.

---

## 7. What still needs building

Roughly in dependency order.

### Blocking everything else

1. **Apply the schema.** Paste `supabase/migrations/0001_core.sql` into the
   Supabase SQL editor. Then verify RLS actually holds by attempting a
   seeker-session read of another player's `positions` row and confirming it
   returns nothing.
2. **A second migration** for the world and economy layer: `pois`,
   `poi_interactions`, `poi_claims`, `items`, `inventory`, `item_uses`,
   `seasons`, `pass_progress`, `purchases`, `reports`, `blocks`,
   `poi_complaints`.
3. **Replace the demo engine with server state.** `GameContext.tsx` is the
   seam. Party creation, invite codes, roster, and round lifecycle move to
   Supabase with Realtime for the lobby and round channels.

### The core loop

4. **Real camera.** `expo-camera` is not installed. The check-in flow's UI is
   done; it needs actual capture, then compression, then a presigned upload.
5. **Wire the validator to real pixels.** `signals.ts` is written and tested.
   It needs pixel data from a real capture, which on device means decoding the
   JPEG. Run it client-side for instant feedback, then **re-run server-side as
   the authority**. PRD §9: never trust a client-reported pass.
6. **Tick scheduling.** Write exact `window_open` and `window_close` timestamps
   at round start, then a `pg_cron` job evaluates closed windows. See
   [INFRASTRUCTURE.md](../INFRASTRUCTURE.md) §4 for why a coarse job still
   produces exact verdicts.
7. **Push notifications.** `expo-notifications`, plus on-device scheduled local
   notifications for the deterministic ticks. Without this the mechanic does
   not work when the phone is in a pocket, which is the normal case.
8. **Photo upload to R2.** Presigned PUT direct from client, server never
   proxies bytes. Plus the 24-hour deletion job writing `audit_deletions`.

### Safety systems, all PRD §7 hard constraints, none built

9. **Speed lock.** Suspend above 10 mph sustained for 30 seconds.
10. **Geofenced exclusion zones.** Server-side blocklist, updatable without an
    app release.
11. **Battery warning** below 40% at round start.
12. **POI complaint form** plus a public web page, 15-day removal SLA.

### Then

13. BLE tagging with PIN fallback (`react-native-ble-plx`).
14. Anti-cheat: App Attest, mock-location detection, plausibility checks.
15. Buffs and nerfs actually doing something. Currently a UI shell.
16. Ads (AdMob), IAP (RevenueCat), analytics (PostHog), errors (Sentry).
17. Moderation queue for reports, 24-hour review commitment.

---

## 8. What is needed from Angad

### Blocking right now

- **Calibration photos** into `calibration/`. This is the single biggest
  blocker. The validator runs on placeholder thresholds that cannot be tuned
  without real captures. Do the `repeat/` series first: it decides whether
  honest players who stand still get eliminated, and that number cannot be
  derived synthetically. See [calibration/README.md](../calibration/README.md).
- **Add the Expo Go redirect** to Supabase → Auth → URL Configuration:
  `exp://<lan-ip>:8090/--/auth-callback`. Without it Google sign-in will not
  return to the app during development.
- **Apply the schema** (see §7.1 above).

### Before testers

- **Apple Developer Program, $99/yr.** Needed for TestFlight and for Sign in
  with Apple, which is mandatory alongside Google on iOS.
- **A domain.** Four public URLs are App Review requirements: explainer page
  (the offline card's QR points at it), POI complaint form, privacy policy,
  terms.
- **An attorney** for the liability and assumption-of-risk language.
  `legal/TERMS.md` and `legal/PRIVACY.md` are substantive drafts, explicitly
  not reviewed. PRD §7.8 is unambiguous about this.
- **Trademark search** on the name.

### Only Angad can answer

- **Playtest 3 vs 5 vs 10 minute check-in intervals with real groups.** PRD §14
  names this as the top product risk: the photo mechanic may be an attention
  tax that makes this a phone game instead of a physical one. No amount of
  engineering answers that.
- Whether to keep the 3-correction cap on the age gate.
- Launch city, which now only matters for POI pre-baking and marketing.

---

## 9. Cost posture

Full detail in [INFRASTRUCTURE.md](../INFRASTRUCTURE.md). The short version:

- **GPS is not a cost problem.** ~53 KB per round for six players, ~51 MB/month
  across a thousand rounds. Use plain HTTPS POST, not a realtime socket: free
  tiers meter concurrent connections, not kilobytes.
- **Photos are the entire cost story.** 90 per round, and the seeker downloads
  every one. **Cloudflare R2 charges zero egress, permanently**, which is why
  it wins over S3 or Supabase Storage by a wide margin.
- Free tier realistically carries several hundred daily players. First upgrade
  is Supabase Pro at $25/mo, triggered by concurrent realtime connections.
- Only unavoidable cost is Apple's $99/yr.

---

## 10. Marketing

[marketing/BRIEF.md](../marketing/BRIEF.md) is a self-contained handoff for a
marketing agent. [marketing/CAROUSELS.md](../marketing/CAROUSELS.md) has 50
concepts with hooks and arcs, plus the Nano Banana Pro master prompt.

The one thing to carry forward: **§9 of the brief lists claims that cannot be
made.** Never imply face recognition (invites a biometric privacy claim under
BIPA), never imply stranger play, never depict unsafe hiding, never imply
anything purchasable helps you win. These are legal lines, not tone notes.

---

## 11. Gotchas for the next session

- **The Metro file watcher does not pick up edits on this machine.** Every code
  change needs a full dev server restart. Budget for it.
- **Browser pane coordinates are 2x.** Screenshots come back at 750x1624 for a
  375x812 viewport. Click at the screenshot's coordinates, not the CSS ones.
- **Entrance animations mean the first screenshot after navigation is often
  blank.** Wait 2 to 3 seconds before capturing or you will chase a phantom bug.
- **Scroll gestures over the map are interpreted as pinch zoom** on web, which
  is useful for testing zoom and confusing if you expect a page scroll.
- Run the validator tests with `node mobile/src/validation/signals.test.mjs`.
  No test runner is installed; Node executes the TypeScript directly.
- Regenerate icons with `node brand/build-icons.mjs`. Never hand-edit the PNGs.
- Re-bake POIs with
  `node scripts/ingest-pois.mjs --lat X --lon Y --radius 1000 --label "Name"`.
