# PRD — Extreme IRL Hide & Seek (working title: **BLACKOUT**)

**Version:** 1.0
**Status:** Approved for build
**Author:** Angad Kochar
**Build target:** Claude Fable 5
**Date:** July 27, 2026

---

## 0. How to read this document

This is a complete v1 specification. Everything in it is in scope.

Sections marked **[HARD CONSTRAINT]** are non-negotiable legal or safety requirements. If an implementation decision conflicts with a hard constraint, the hard constraint wins and the feature gets cut or redesigned — never the constraint. Do not work around them, do not substitute a "close enough" approach, and do not silently reach for a library that violates one.

Section 16 contains a suggested build order. It is guidance for sequencing work, not a reduction of scope.

---

## 1. Product summary

BLACKOUT is a real-world, phone-mediated game of hide and seek played by a private party of friends across a defined geographic zone. One player is the Seeker; everyone else hides. The distinguishing mechanic is **forced photographic proof of hiding**: every few minutes, every hider must submit a live front-and-back camera capture of where they are, which the Seeker sees immediately. Miss a check-in and you are eliminated. On a slower cadence, the Seeker also receives everyone's GPS coordinates.

Wrapped around that core loop is a persistent progression system — accounts, XP, levels, seasonal battle pass, cosmetics — and a real-world points-of-interest layer that players visit to earn tactical buffs and inflict nerfs.

**One-line pitch:** Hide and seek where hiding well isn't enough — you have to keep proving you're hidden.

---

## 2. Why this exists / competitive positioning

The GPS hide-and-seek category is already occupied. HideZone, Gottcha, GeoHunt, Hide Game, and various Jet Lag companion apps all ship the same core: a lobby code, a map, live or periodic position reveals, a shrinking zone, and a handful of tactical items. That feature set is a commodity, and HideZone in particular executes it well.

BLACKOUT's defensible ground is the **photo check-in mechanic**. No competitor requires periodic photographic proof of concealment. This changes the game in three ways that matter:

1. **It punishes passivity.** In GPS-only games the optimal strategy is to find a good hole and stop moving. Here, every check-in is a new piece of evidence, and a static hider leaks the same background repeatedly.
2. **It generates content.** Photo feeds are shareable, screenshot-able, and funny. GPS dots are not.
3. **It creates a second axis of skill.** Good players learn to compose photos that are technically valid but geographically uninformative.

The second differentiator is that **progression is per-account while matches stay private**. Players level up, bank buffs, and claim POIs across every private match they play. The persistent world lives in the player's profile, not in a shared public lobby. This delivers the retention hook of a persistent-world game without ever placing a stranger in a match with a minor.

**Non-goal:** competing on number of game modes. Ship one excellent mode.

---

## 3. Audience and access model

**Audience:** 13+. Both teens and adults.

**Lobby model: invite-code only. There is no public matchmaking, no stranger discovery, no player search, no open lobbies, and no way to join a party without a code shared out-of-band by someone already in it.** This applies to all users at all ages. **[HARD CONSTRAINT]**

Do not build a matchmaking service, a "nearby games" feature, a public lobby browser, or a friend-discovery-by-location feature. Do not build a global chat. In-party chat only, and only for the duration of a round plus 10 minutes.

**Age gate:** neutral date-of-birth entry at signup (a blank date field, not a "Are you over 13?" yes/no, which is trivially defeated and is not a good-faith gate). Under-13 signups are refused, and the refusal is sticky — store a device-level flag so the user cannot immediately retry with a different birth year. **[HARD CONSTRAINT — COPPA]**

**Store listing:** Age rating 12+/Teen. **Do not enroll in Apple's Kids Category** under any circumstances. **[HARD CONSTRAINT]**

**Launch geography:** United States only for v1. Geo-restrict the store listing. This avoids GDPR, the UK Age Appropriate Design Code, and the EU DSA in the first release. Do not build for international launch; do build so that region-gating is a config value rather than an architectural assumption.

---

## 4. Core gameplay specification

### 4.1 Party creation and lobby

- Any player can host. Host creates a party and receives a **6-character alphanumeric invite code** (unambiguous alphabet: no `0/O`, `1/I/L`).
- Codes expire 4 hours after creation or at round end, whichever comes first.
- Party size: **3–20 players.** Below 3 the game does not work; above 20 the photo feed becomes unreadable.
- Lobby shows: player list with readiness state, host-configurable settings, the play zone on a map, and a persistent **Safety Card** (§7.4) that every player must acknowledge before the host can start.

### 4.2 Host settings

| Setting | Options | Default |
|---|---|---|
| Zone radius | 300 m – 10 km | 1 km |
| Zone center | Draggable map pin | Host's current location |
| Round length | 20 – 120 min | 45 min |
| Photo check-in interval | 3 / 5 / 10 min | 5 min |
| Location reveal interval | 5 / 10 / 15 min | 10 min |
| Reveal visibility duration | 15 / 30 / 60 s / permanent | 30 s |
| Seeker count | 1 – 3 | 1 |
| Seeker cooldown | 2 – 10 min | 5 min |
| Shrinking zone | on / off | on |
| Buffs enabled | on / off | on |
| Spectator mode after elimination | on / off | on |

Rural preset: zone 5 km, reveal interval 5 min, reveal duration permanent, round 90 min. Expose this as a one-tap preset — rural play is a settings problem, not a technology problem.

### 4.3 Round start

1. Host starts. Server assigns Seeker(s) uniformly at random from the roster. **Assignment happens server-side and is never transmitted to non-seeker clients.**
2. All players see a 10-second reveal of who the Seeker is.
3. Seeker's screen locks into a full-screen countdown for the cooldown duration. The Seeker's own GPS is recorded during cooldown; if the Seeker moves more than 50 m from their start point before the cooldown expires, they receive a warning, and a second violation adds 60 s to the cooldown.
4. Hiders disperse. Hiders may not leave the zone (§4.7).
5. Round timer starts when the Seeker's cooldown expires.

### 4.4 Photo check-in — the core mechanic

On each interval tick, every living hider receives a high-priority push notification and an in-app alert.

- **Window:** 60 seconds from the tick to submit.
- **Capture:** live in-app camera only. Back camera then front camera, in sequence, in one flow. **Gallery upload is disabled and no gallery permission is requested.** **[HARD CONSTRAINT — anti-cheat + privacy]**
- **Validation:** each capture is checked client-side for immediate feedback and re-validated server-side authoritatively (§4.5).
- **On valid submission:** both images are pushed to the Seeker's feed in real time. Hiders do not see other hiders' photos while alive. Eliminated players in spectator mode see everything.
- **On failed validation:** the player is told which check failed in plain language ("The back camera image is too dark — is the lens covered?") and given a 30-second extension for one retry.
- **On a second failure, or on window expiry with no submission: the player is eliminated.** This is called being **BLACKED OUT** and it is presented as a distinct, more embarrassing loss state than being tagged.
- Seekers do not submit check-ins.

### 4.5 Occlusion and validity detection **[HARD CONSTRAINT — this section defines what you may and may not implement]**

The purpose of this system is to detect a player covering, blocking, or faking their camera. It operates **exclusively on whole-image statistical properties.**

**You must NOT implement, import, call, or depend on:**
- Face detection, face recognition, face landmarking, or face tracking of any kind
- Facial geometry extraction, face embeddings, or face templates
- Vision framework face APIs, ML Kit Face Detection, MediaPipe Face Mesh, `dlib`, `face_recognition`, or equivalents
- Person detection, pose estimation, body segmentation, or gaze tracking
- Any model that produces a persistent per-person identifier from an image

This is a legal constraint, not a preference. The Illinois Biometric Information Privacy Act carries $1,000–$5,000 in statutory damages per violation with a private right of action requiring no proof of harm, applies to Illinois residents regardless of where the company is based, and has repeatedly been applied to features companies framed as "photo tagging" or "content moderation." A face detector in this app is an existential legal risk for zero product benefit.

**What you must implement instead — a signal-based validator:**

| Check | Method | Fail condition |
|---|---|---|
| Blur / smear | Variance of Laplacian | Below tuned threshold |
| Lens covered (dark) | Mean luminance | < 15/255 |
| Lens flooded (light) | Mean luminance | > 240/255 |
| Uniform surface (thumb, pocket, wall) | Shannon entropy of the color histogram | Below tuned threshold |
| Low detail | Edge density (Sobel or Canny pixel ratio) | Below tuned threshold |
| Reused image | Perceptual hash (pHash), compared against that player's last 20 submissions this round | Hamming distance < 6 |
| Stale capture | Capture timestamp vs. server tick time | Outside the 60 s window |
| Not live | Missing or inconsistent capture metadata | Any mismatch |

Thresholds must be configurable server-side without an app release. Ship with conservative values — a false elimination is far worse for retention than a successful cheat.

Run validation on-device first for instant feedback, then re-run server-side as the authority. **Never trust a client-reported pass.**

Do not add a machine-learning classifier in v1. If one is added later, it must be trained and run on image-quality features only, never on human subjects.

### 4.6 Location reveals

- On each reveal tick, the server pushes the current coordinates of all living hiders to all Seekers.
- Coordinates render as pins on the Seeker's map for the configured visibility duration, then fade.
- Hiders receive a notification that a reveal just occurred ("You've been pinged") so they can react, but are not told what the Seeker sees.
- Location is sampled continuously at low frequency for zone-boundary enforcement, but is **only transmitted to Seekers at reveal ticks.** Between ticks, hider positions never leave the server. This is both a battery optimization and a privacy commitment that should be stated plainly in the privacy policy.

### 4.7 Zone and boundaries

- The zone is a circle. Crossing the boundary triggers a 60-second warning with a countdown and an arrow pointing back inside. Failure to return eliminates the player.
- If shrinking zone is enabled: the zone contracts in three steps during the final third of the round, to 75%, 50%, and 35% of its original radius. Each contraction is announced 60 seconds in advance to all players.
- The zone center stays fixed. Do not implement a randomly-walking zone; it produces unfair outcomes in a game where players move at walking speed.

### 4.8 Tagging and catches

The Seeker catches a hider through a **two-factor proximity confirmation**:

1. **Primary — BLE handshake.** Both devices advertise a rotating round-scoped ephemeral ID over Bluetooth Low Energy. When the Seeker's app detects a hider's ID above an RSSI threshold roughly corresponding to 10–15 m, the Seeker's "TAG" button activates. Pressing it fires a signed tag event with both device IDs.
2. **Fallback — PIN.** If BLE fails (permission denied, hardware unavailable, interference), the Seeker taps "Tag manually," the hider's phone displays a rotating 6-digit code, and the Seeker enters it. This requires the players to be physically face to face, which is the point.

GPS proximity alone must never be sufficient to confirm a tag. GPS is ±5–20 m in cities and is spoofable; a false tag ends someone's round unfairly.

On a successful tag: the hider is eliminated, both players get a confirmation screen, the party is notified, and the hider enters spectator mode if enabled.

### 4.9 Win conditions and scoring

- **Seeker wins** by eliminating every hider (by tag or blackout) before the round timer expires.
- **Hiders win individually** by surviving to the timer. Multiple hiders can win.
- **Round MVP** is awarded to the surviving hider with the highest survival score, or to the Seeker if they cleared the board.

Survival score = (seconds survived ÷ 60) + (5 × check-ins passed) + (10 × POIs claimed during the round) + (25 if the player survived to the timer).

Seeker score = (30 × tags) + (10 × blackouts) + (60 if the board was cleared) + a time bonus of (remaining seconds ÷ 60) if cleared.

### 4.10 Disconnection and edge cases

| Case | Behavior |
|---|---|
| App backgrounded | Round continues. Push notifications drive check-ins. |
| App force-quit | Player has until the next check-in window to return. Miss it, blackout. |
| Phone dies | Blackout at the next missed check-in. Warn at round start (§7.5). |
| Loss of network | Client queues the check-in and uploads on reconnect. If it arrives within the window by server clock, it counts. If not, blackout. |
| Loss of GPS signal | Player's last known position is revealed with a "stale — last seen N min ago" label. Persistent GPS loss for more than two reveal cycles triggers a warning, then elimination, to prevent GPS-disabling as an exploit. |
| Host leaves | Host role transfers to the longest-tenured remaining player. Round continues. |
| Seeker leaves | Round ends. All surviving hiders win. No XP for the departing seeker. |
| Fewer than 2 players remain | Round ends immediately, results computed. |

---

## 5. Progression system

### 5.1 XP and levels

XP is awarded at round end for: survival time, check-ins passed, tags made, blackouts forced, POIs claimed, first-time POI visits, and round completion. A player who quits mid-round forfeits all XP for that round.

Levels 1–50, with a smooth curve reaching level 50 at roughly 80–120 rounds of play. After 50, players enter **Prestige** ranks (I through X) which reset the level bar and grant a persistent badge.

Level unlocks: additional buff inventory slots (2 at level 1, 3 at level 15, 4 at level 30), cosmetic categories, and extended host settings (zones above 5 km and rounds above 90 minutes unlock at level 20 — this also naturally limits new users from setting up unmanageable first games).

### 5.2 Seasonal battle pass

10-week seasons. A free track and a paid track, each with 50 tiers. Tiers advance on total XP earned during the season.

**The paid track contains cosmetics and currency only. It must never contain buffs, buff slots, gameplay modifiers, or anything affecting round outcomes.** **[HARD CONSTRAINT — see §8]**

### 5.3 Cosmetics

Player avatar, map pin style, photo frame border, tag-confirmation animation, blackout screen style, title/flair displayed next to the player's name in lobbies and results.

Cosmetics are purely visual. A cosmetic must never make a player harder or easier to find.

### 5.4 Stats and history

Persistent per-player: rounds played, win rate as hider, win rate as seeker, longest survival, total distance covered, check-in success rate, tags made, times blacked out, POIs claimed, current streak.

Match history retains results and stats for 90 days. **Photos are excluded from match history and are deleted per §7.6.**

---

## 6. World layer — POIs, buffs, and nerfs

### 6.1 POI data sourcing **[HARD CONSTRAINT on placement]**

Source POIs from **Overture Maps Foundation** data. It has permissive licensing suitable for commercial use and reasonable global coverage. OpenStreetMap is the fallback, but note that ODbL's share-alike provisions have real implications for any derived geodata you produce. Do not use the Google Places API as a POI store — its terms restrict caching beyond 30 days and require display on a Google map.

**POIs may only be placed on locations whose source data classifies them as publicly accessible:** parks, plazas, public transit stations, libraries, museums, monuments, retail storefronts, and similar. Build an ingestion pipeline that filters on these categories.

**POIs must never be placed on or within 25 m of:**
- Any feature tagged residential, apartment, private, gated, or agricultural
- Schools (any hours), hospitals, medical facilities, places of worship
- Airports, government buildings, courthouses, police and fire stations, military installations
- Railway tracks, rail rights-of-way, highway shoulders, bridges, tunnels, construction sites
- Cemeteries, funeral homes
- Bars, liquor stores, cannabis dispensaries, casinos, adult establishments

Where the source data carries opening hours, **POIs are inactive outside those hours.** A park POI does not exist at 2 a.m.

Ship a **POI complaint form** reachable from the app and from a public web page, with a committed removal SLA of 15 days. Removals must be executable without an app release. This mirrors the remedies Niantic agreed to in the Pokémon Go nuisance settlement and is the single cheapest piece of litigation insurance available to this product.

### 6.2 POI types

| Type | Function | Cooldown |
|---|---|---|
| **Cache** | Grants one random buff item from the appropriate pool | 30 min per player |
| **Beacon** | Claimable. Grants the holder passive XP while held. Claim is contested — anyone who visits takes it. | None |
| **Waystation** | Clears all active nerfs on the visiting player and grants a small XP bonus | 20 min per player |

Interacting with a POI requires being within 30 m and holding still for 5 seconds. **Interaction is disabled while the speed lock (§7.1) is active.**

### 6.3 Buffs — hider pool

| Item | Effect |
|---|---|
| **Ghost Ping** | Skip one location reveal entirely. You do not appear on the Seeker's map that cycle. |
| **Static** | Your next reveal renders as a 200 m radius circle instead of a point. |
| **Decoy** | Place a false position marker anywhere within 400 m of yourself. It appears on the Seeker's map for one reveal cycle, indistinguishable from a real ping. |
| **Grace** | Extends one photo check-in window by 90 seconds. Usable reactively, after the tick fires. |
| **Second Wind** | One-time revival if you black out from a missed check-in. Does not work against a tag. |

### 6.4 Buffs — seeker pool

| Item | Effect |
|---|---|
| **Sweep** | Immediate off-cycle reveal of the single nearest living hider. |
| **Thermal** | For 60 seconds, a compass arrow shows the direction — not the distance — to the nearest hider. |
| **Echo** | Shows where one specific hider was 5 minutes ago. |
| **Pressure** | Forces an extra photo check-in from all hiders within the next 2 minutes. |
| **Lockdown** | Contracts the zone by 20% immediately. Once per round. |

### 6.5 Nerfs

Nerfs are inflicted on hiders, either by a Seeker spending an item or by a hider triggering a hazard.

| Item | Effect |
|---|---|
| **Exposure** | The target's next photo is shown to the Seeker with a coarse geohash (roughly 150 m precision) attached. |
| **Interference** | The target's buffs are disabled for 5 minutes. |
| **Spotlight** | The target is revealed on the map as a live point for 15 seconds. |
| **Short Leash** | The target's photo check-in interval halves for one cycle. |

### 6.6 Economy rules **[HARD CONSTRAINT]**

- Buffs and nerfs are earned through play only. **They are never purchasable with real money, never in the paid battle pass track, and never granted by rewarded video.**
- Inventory is capped by level (2–4 slots). A full inventory means new pickups are refused, forcing spend-to-collect decisions.
- One use per item per round.
- Global 90-second cooldown between any two item uses by the same player, to prevent burst combos.
- Buffs carry across rounds. Unused items persist in inventory.

### 6.7 Design note on POI risk

The POI layer creates a physical incentive for players — including 13-year-olds — to travel to specific real-world coordinates. This is precisely the mechanic that generated the Pokémon Go trespass and nuisance litigation. The placement restrictions in §6.1 and the safety systems in §7 are not optional polish; they are the mitigations that make this layer shippable at all.

---

## 7. Safety systems **[HARD CONSTRAINT — entire section]**

### 7.1 Speed lock

If the device's sustained speed exceeds **10 mph for 30 continuous seconds**, gameplay suspends: a full-screen overlay appears reading "You appear to be in a vehicle. BLACKOUT is a walking game." Check-in windows pause and extend, POI interaction is disabled, and the player's position stops updating for reveal purposes. Gameplay resumes 20 seconds after speed drops below the threshold.

Players cannot dismiss this overlay. Include a "passenger" appeal that unlocks the map view read-only but never re-enables check-ins or POI interaction.

### 7.2 Geofenced exclusion zones

The following are hard-blocked as play areas — a host cannot set a zone whose center falls inside one, and gameplay suspends for any player who enters one:

Airports and airport property, hospitals and emergency facilities, schools during school hours, government and military facilities, courthouses, police and fire stations, railway tracks and rights-of-way, highways and their shoulders, active construction sites, and any location on a maintained blocklist.

The blocklist must be server-side and updatable without an app release.

### 7.3 The Explainer Card

A single tap from any in-round screen opens a full-screen, high-contrast card that reads, in large type, something to the effect of: *"I'm playing a mobile game called BLACKOUT. It's a app-based game of hide and seek with friends. I'm not filming you and I'm not recording audio. If I'm somewhere I shouldn't be, please tell me and I'll leave."* Include a QR code to a public explainer page.

**This card must render entirely offline** — no network calls, no remote assets. Its most likely use is in front of a police officer or a security guard in a place with no signal.

### 7.4 The Safety Card and consent gate

Before the host can start a round, every player must scroll through and acknowledge a Safety Card covering: stay on public property, do not enter private property or restricted areas, do not play near traffic, do not run, obey all laws, and stop playing if anyone asks you to. Acknowledgment is logged per player per round.

Do not make this dismissible with a single tap at the top. Require a scroll to the bottom.

### 7.5 SOS and exit

A persistent, always-visible **SOS** control in-round with two actions:
- **Leave round** — removes the player immediately, notifies the party, no XP penalty, no "quitter" flag. Leaving must never be socially punished by the product.
- **Emergency** — surfaces the device's native emergency dialer, ends the round for that player, and notifies the party with the player's last position.

The SOS control must never be obscured by an ad, a modal, or an animation.

### 7.6 Photo handling

- Encrypted at rest in object storage. Access exclusively through short-lived signed URLs scoped to the round.
- Visible only to Seekers during the round, plus spectators if that host setting is enabled.
- **Automatically and permanently deleted 24 hours after round end.** Implement as a scheduled job with a verifiable audit log, not as a soft-delete flag.
- Not downloadable, not shareable outside the app, not included in match history.
- Screenshot detection where the platform permits it, with a notice to the party (deterrent, not enforcement).
- **Report and block** available on every photo and every player, per Apple's user-generated content requirements. Reports route to a moderation queue with a committed 24-hour review window. Blocked players cannot join a party the blocking player is in.

### 7.7 Battery warning

At round start, if battery is below 40%, show a blocking warning: this game uses continuous GPS, camera, and push, and a 45-minute round will consume roughly 30–40% of a charge. Running out of battery mid-round means elimination.

### 7.8 Legal posture

Terms of Service must include an assumption-of-risk acknowledgment and a limitation-of-liability clause. Have these reviewed by an actual attorney before public launch. This document is not legal advice and neither is anything generated from it.

---

## 8. Monetization

### 8.1 Advertising

- **Never during an active round.** No interstitial, no banner, no rewarded prompt from round start to results screen. A player may be walking down a street. **[HARD CONSTRAINT]**
- **Banner:** home and lobby screens only. Standard adaptive banner, anchored bottom, never overlapping the SOS control or a primary action.
- **Interstitial:** post-round results screen only. Skippable, with a visible and adequately sized close control. Frequency-capped to once every three completed rounds, with a 3-minute minimum gap.
- **Rewarded video:** fully opt-in, from the shop and the battle pass screen. Grants soft currency or battle pass XP. **Never grants buffs, nerfs, or any gameplay advantage.**
- Provider: Google AdMob via `react-native-google-mobile-ads`.

**Minor advertising restriction [HARD CONSTRAINT]:** any account whose stored date of birth places the user under 18 must receive **non-personalized, contextual ads only**. Set the non-personalized-ads flag on every ad request for these accounts, and do not present the App Tracking Transparency prompt to them. A growing set of state privacy laws — including Connecticut's amended CTDPA and the Texas SCOPE Act — restrict targeted advertising to known 13–17 year olds, and Apple independently prohibits behavioral advertising based on data from minors. This must be enforced server-side in the ad configuration the client receives, not client-side where it could be tampered with.

### 8.2 Purchases

- **Season Pass** — paid battle pass track. Cosmetics and soft currency only.
- **Cosmetic bundles** — direct purchase.
- **Soft currency** — purchasable, spendable on cosmetics only.

**Any real-money purchase permanently disables all advertising on that account.** Not for a season, not for 30 days — permanently. State this clearly at the point of purchase; it is a meaningful part of the value proposition.

**Nothing purchasable may affect round outcomes.** In a game played with physical bodies in physical space, a purchasable advantage creates a real incentive to take real risks. This is both an ethical line and a regulatory one. **[HARD CONSTRAINT]**

Implement purchases through **RevenueCat** to avoid hand-rolling receipt validation across two stores.

### 8.3 Expectation setting

Ad revenue at small scale is negligible — expect single-digit dollars per month below a few thousand daily actives. Build the monetization plumbing once, correctly, and do not tune it until the game has traction. The battle pass has far better unit economics but requires a sustained content cadence to be worth running.

---

## 9. Anti-cheat **[HARD CONSTRAINT — the game has no value without this]**

The most common criticism of apps in this category is that cheating is trivial. Mock location on Android is one developer-settings toggle away. Retrofitting anti-cheat is dramatically harder than building it in.

| Vector | Mitigation |
|---|---|
| Mock / spoofed GPS | Android: `Location.isFromMockProvider()` plus **Play Integrity API** device attestation. iOS: **App Attest** and **DeviceCheck**. Reject attested-fail devices from ranked play entirely. |
| Modified client | Play Integrity / App Attest on every session, re-attested hourly during a round. |
| Clock manipulation | **All timers, ticks, windows, and deadlines are server-authoritative.** The client never reports elapsed time; it only renders a countdown derived from a server timestamp. |
| Reused / pre-shot photos | pHash comparison against the player's last 20 submissions in-round (§4.5), plus capture-timestamp validation against the server tick. |
| Gallery uploads | No gallery permission requested; in-app camera capture only. |
| Teleporting / implausible movement | Server-side plausibility check: flag any position delta implying sustained speed above 30 mph outside the speed-lock exemption, or any discontinuous jump. Three flags in a round removes the player and voids their XP. |
| False tags | BLE proximity handshake or in-person PIN required (§4.8). GPS proximity alone never confirms a tag. |
| API abuse | Rate limits on every endpoint. Row-level security on all tables. A client may only ever read the state its role in the round entitles it to. |
| Seeker peeking at hider data | **Enforce at the database layer, not the UI layer.** A hider's position between reveal ticks must not be readable by a seeker's session under any query. |

---

## 10. Technical architecture

### 10.1 Stack

| Layer | Choice | Rationale |
|---|---|---|
| Client | **React Native + Expo**, TypeScript | Cross-platform, reuses existing JS skill, first-class camera/location/notification modules |
| Backend | **Supabase** — Postgres + **PostGIS**, Realtime, Auth, Storage, Edge Functions | PostGIS makes radius queries, zone containment, and nearest-neighbor math trivial; single vendor; row-level security enforces the anti-cheat rules in §9 |
| Game tick worker | Node service on **Railway** or **Fly.io** | Owns check-in ticks, reveal ticks, zone contractions, blackout evaluation, and timeouts. Must be a persistent process, not a cron job — sub-minute precision matters |
| Maps | `react-native-maps` (native Apple/Google) | Free and simple for v1. MapLibre + Protomaps is the migration path if tile costs become real |
| Push | Expo Notifications → APNs/FCM | Check-in alerts must be high-priority / time-sensitive |
| BLE | `react-native-ble-plx` | Tag confirmation |
| Image validation | `sharp` server-side; on-device via `expo-image-manipulator` + a small native module for Laplacian variance | No ML dependency |
| Ads | AdMob via `react-native-google-mobile-ads` | |
| IAP | **RevenueCat** | Cross-store receipt validation |
| Analytics | **PostHog** | Self-hostable; must be configured to collect no behavioral data from under-18 accounts beyond essential product telemetry |
| Errors | **Sentry** | |

### 10.2 The single biggest technical risk

**iOS background execution and battery.** iOS aggressively suspends backgrounded apps. This game requires:

- **"Always" location permission**, which is scrutinized in App Review and is a significant install-funnel drop-off. Request it with a clear, specific purpose string, and only at the moment the user first joins a round — never at first launch.
- Background location updates with `pausesLocationUpdatesAutomatically = false` and the appropriate background modes declared.
- Time-sensitive push notifications for check-in ticks, since the app may be suspended when a tick fires.
- **Live Activities / Dynamic Island** for the round timer and next check-in countdown. This is the single highest-value platform feature for this app — it keeps the round state visible without the player holding the phone up, which is both better UX and materially safer.

Budget real engineering time here. It is the most likely source of "the app doesn't work" reviews.

**Battery mitigation:** sample location at the coarsest accuracy that supports zone enforcement (roughly 100 m) between reveal ticks, and request high accuracy only in the 10 seconds surrounding a tick. Do not stream position continuously.

### 10.3 Data model

```
users              id, created_at, dob, age_bracket (13_17 | 18_plus), 
                   handle, attestation_status, ads_disabled, banned
profiles           user_id, level, xp, prestige, equipped_cosmetics, 
                   inventory_slots, lifetime_stats
parties            id, code, host_id, settings jsonb, state, created_at, 
                   expires_at
party_members      party_id, user_id, joined_at, ready, safety_ack_at
rounds             id, party_id, started_at, ends_at, state, 
                   zone geography(POINT), zone_radius_m, settings snapshot
round_players      round_id, user_id, role (seeker|hider), state 
                   (alive|tagged|blackout|left), eliminated_at, score
positions          round_id, user_id, geog geography(POINT), 
                   accuracy_m, recorded_at, speed_mps
                   -- write-heavy; partition by round, purge at round end
reveals            id, round_id, tick_index, revealed_at, visible_until
checkins           id, round_id, user_id, tick_index, window_open, 
                   window_close, submitted_at, status, failure_reason
photos             id, checkin_id, camera (front|back), storage_path, 
                   phash, validation_scores jsonb, delete_after
catches            id, round_id, seeker_id, target_id, method (ble|pin), 
                   confirmed_at, rssi
pois               id, geog geography(POINT), type, source_id, 
                   category, opening_hours, active, removed_reason
poi_interactions   poi_id, user_id, round_id, interacted_at, reward_item_id
poi_claims         poi_id, holder_id, claimed_at
items              id, kind (buff|nerf), pool (hider|seeker), effect_key, 
                   rarity
inventory          user_id, item_id, quantity
item_uses          round_id, user_id, item_id, used_at, target_id
seasons            id, starts_at, ends_at, tier_definitions jsonb
pass_progress      user_id, season_id, xp, tiers_claimed, paid_track
purchases          user_id, product_id, platform, revenuecat_id, 
                   purchased_at
reports            id, reporter_id, target_user_id, photo_id, reason, 
                   state, resolved_at
blocks             blocker_id, blocked_id, created_at
poi_complaints     id, poi_id, submitted_at, contact, resolved_at
audit_deletions    entity, entity_id, deleted_at, job_id
```

All tables carry row-level security. The `positions` table in particular must have a policy making a hider's rows unreadable by any seeker session except through the reveal-materialized view.

### 10.4 Realtime channels

- `round:{id}:public` — round state, timer, zone changes, eliminations, announcements. All participants.
- `round:{id}:seeker` — reveals, photo feed, buff effects. Seekers only, enforced by RLS.
- `round:{id}:player:{uid}` — personal check-in ticks, nerf notifications, warnings.
- `party:{id}:lobby` — roster, settings, readiness.

---

## 11. Screens

**Onboarding:** splash → neutral DOB entry → handle creation → permissions explainer (location, camera, notifications, Bluetooth, each requested contextually rather than up front) → home.

**Home:** level and XP bar, season pass progress, Play button (Host / Join), stats summary, shop entry, banner ad slot.

**Join:** 6-character code entry.

**Lobby:** map with zone, roster with readiness, host settings panel, Safety Card gate, start button.

**Round — Hider:** map (own position, zone, POIs), countdown to next check-in as the dominant element, time remaining, inventory drawer, SOS control, Explainer Card button.

**Check-in flow:** full-screen camera, back capture → front capture → validating → submitted. Countdown always visible. Failure states with specific, plain-language guidance.

**Round — Seeker:** map (own position, zone, POIs, revealed pins with fade timers), photo feed as a scrollable side panel with newest first, countdown to next reveal, TAG button (state-dependent on BLE proximity), inventory drawer, SOS.

**Spectator:** full map, all positions, full photo feed.

**Results:** win/loss, survival timeline, score breakdown, XP earned, pass progress, MVP, interstitial ad slot (per §8.1).

**Profile:** stats, match history, cosmetics, prestige.

**Shop:** season pass, cosmetic bundles, currency, rewarded video entry.

---

## 12. Analytics and success metrics

**Instrument from day one:**
- Funnel: install → account → permissions granted (each, separately — location "Always" will be the cliff) → first round joined → first round completed
- Check-in success rate, by interval setting and by attempt number
- Validation failure rate by check type — this is how you tune the thresholds in §4.5
- Round completion rate vs. abandonment, and the point of abandonment
- Median rounds per party per week
- Battery consumed per round, self-reported at results
- D1 / D7 / D30 retention
- Ad viewability and rewarded-video opt-in rate
- Time from party creation to round start (if this exceeds 5 minutes, the lobby is too complicated)

**v1 success criteria:**
- Check-in success rate above 90% for engaged players. Below this, the core mechanic is too punishing or the validator is too strict.
- Round completion rate above 70%.
- Median party plays 2+ rounds in a session. One-and-done means the loop isn't fun.
- Fewer than 1% of rounds trigger an SOS or a safety report.

---

## 13. Explicit non-goals for v1

Do not build: public lobbies, matchmaking, stranger discovery, friend search by location, global chat, voice chat, AR overlays, additional game modes, a web client, clans or guilds, tournaments, spectator streaming, international localization, or anything under Apple's Kids Category.

---

## 14. Known risks

| Risk | Severity | Mitigation |
|---|---|---|
| The photo mechanic is an attention tax that makes the game phone-facing rather than physical | **High — this is the core product risk** | Configurable interval; Live Activities so the countdown is visible without unlocking; playtest 3 vs. 5 vs. 10 minutes with real groups before scaling |
| iOS background execution kills reliability | High | §10.2; extensive on-device testing across iOS versions |
| Battery drain ends rounds early | High | §10.2 sampling strategy; §7.7 warning |
| "Always" location permission tanks the install funnel | High | Contextual request timing; clear purpose string |
| A player is injured or trespasses | High | §7 in full; ToS; insurance before any real scale |
| POI data places a node on private property | Medium | §6.1 filtering; complaint form with 15-day SLA |
| App Review rejection over location + camera + minors | Medium | Lead the review notes with the safety systems in §7; provide a demo account and a video of a round |
| Cheating undermines trust | Medium | §9 |
| Market is already served by HideZone et al. | Medium | Lead all marketing with the photo mechanic, not the map |

---

## 15. Open items to resolve during build

1. Final tuning values for every threshold in §4.5. These must come from real captures in varied lighting, not from guesses.
2. Whether hiders should see a count of how many hiders remain alive. Leaning yes — it creates tension without leaking position.
3. Whether **Decoy** is too strong at 400 m. Playtest.
4. Whether spectator mode should show the photo feed. It may spoil more than it entertains.
5. Sound design for the check-in tick. It needs to be audible from a pocket and distinct from a normal notification.

---

## 16. Suggested implementation sequence

This does not reduce scope. It is a build order that keeps the project runnable at every stage.

1. Auth, age gate, profiles, database schema with RLS.
2. Party creation, invite codes, lobby, host settings.
3. Server tick worker with server-authoritative timers.
4. Location tracking, zone enforcement, reveal ticks, map rendering.
5. **Check-in flow and the validator (§4.5).** The heart of the product — get this right before anything else is polished.
6. BLE tagging with PIN fallback.
7. Win conditions, scoring, results screen.
8. Safety systems (§7) — before any external testing, not after.
9. Anti-cheat and device attestation (§9).
10. XP, levels, stats, match history.
11. POI ingestion pipeline with the §6.1 exclusion filters, then POI interaction.
12. Buffs, nerfs, inventory, economy.
13. Battle pass, cosmetics, shop.
14. Ads and IAP.
15. Analytics, Sentry, moderation queue, POI complaint form and public page.
16. App Review preparation: demo account, review notes leading with safety, privacy nutrition labels, privacy policy, ToS.

---

## 17. Hard constraint index

For quick reference, the constraints that may not be traded away:

1. No face detection, facial geometry, or biometric processing of any kind (§4.5)
2. Invite-code-only access; no public lobbies or stranger discovery (§3)
3. 13+ age gate with sticky refusal; never the Kids Category (§3)
4. Non-personalized ads only for under-18 accounts; no ATT prompt to minors (§8.1)
5. No ads during an active round (§8.1)
6. Nothing purchasable affects round outcomes (§6.6, §8.2)
7. Speed lock above 10 mph (§7.1)
8. POI placement restrictions and exclusion geofences (§6.1, §7.2)
9. Offline-capable Explainer Card (§7.3)
10. Always-accessible SOS (§7.5)
11. Photos deleted 24 hours after round end, with an audit log (§7.6)
12. Camera capture only; no gallery access (§4.4)
13. All timers server-authoritative (§9)
14. GPS proximity alone never confirms a tag (§4.8)
