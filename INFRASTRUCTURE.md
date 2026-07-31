# Hidewire infrastructure plan

What it takes to turn the demo into a real app, on a stack that costs $0/month
until there are real players on it.

Free-tier terms change. Every figure below was accurate as of early 2026 and
should be re-checked against each vendor's current page before you commit.

---

## 1. The short version

| Layer | Choice | Cost at beta scale |
|---|---|---|
| Database, auth, realtime | **Supabase** free tier | $0 |
| Photo storage | **Cloudflare R2** | $0 (10 GB, **no egress fees ever**) |
| Position uplink | Plain **HTTPS POST**, no socket | $0 (~51 MB/mo per 1,000 rounds) |
| Check-in / reveal alerts | **Expo Push** → APNs/FCM | $0, unlimited |
| Game tick worker | **Supabase pg_cron** + exact DB timestamps | $0 |
| Maps | Apple Maps on iOS (free); MapLibre + OpenFreeMap on Android | $0 |
| POI data | **Overture Maps** bulk download, ingested once | $0 |
| Errors / analytics | Sentry + PostHog free tiers | $0 |

The only unavoidable real money is **Apple's $99/yr developer program** (and
$25 once for Google Play). Nothing else needs to cost anything until you are
past a few hundred daily players.

---

## 2. Cheapest way to move GPS

**The headline: GPS is not a cost problem. It is ~1% of your free bandwidth
allowance. Do not architect around it.**

A position fix is about 110 bytes of JSON:

```json
{"round":"uuid","lat":47.6062,"lon":-122.3321,"acc":65,"t":1753660800,"spd":1.2}
```

Call it ~600 bytes on the wire once you count HTTP/2 headers, TLS, and the
response. At one fix every 3 minutes:

- **53 KB** per 45-minute round for a party of six
- **51 MB/month** across a thousand rounds

Against Supabase's 5 GB monthly egress that is roughly 1%. You could sample ten
times more often and still not notice.

### The three decisions that actually matter

**1. Use a plain HTTPS POST, not a realtime socket.**
This is the whole answer to "cheapest." Free tiers meter *concurrent
connections*, not kilobytes. Supabase Realtime allows ~200 simultaneous
connections. A socket held open for 45 minutes to deliver 15 tiny messages burns
one of those 200 slots the entire time and drains battery keeping the radio
warm. A POST every few minutes uses a connection for ~200 ms and releases it.
Reserve the realtime socket for the seeker's live feed while the app is
actually in the foreground, and let everyone else be stateless.

**2. Piggyback the position on the check-in upload.**
Hiders already POST every 5 minutes to submit their check-in. Attach the current
position to that same request and the separate position POST disappears
entirely for most of the round. You only need standalone position posts for
seekers (who never check in) and to cover gaps when the check-in interval is set
to 10 minutes.

**3. Push down, don't poll down.**
The client never asks "is there a tick yet?" Check-in alerts, reveal pings, and
eliminations arrive as push notifications. Expo Push sits on top of APNs and
FCM, all three are free with no volume cap, and a suspended app can still be
woken by them, which is the only way the check-in mechanic works at all when
someone's phone is in their pocket.

### Battery, which is the real cost

Money is not the constraint here; a dead phone ending someone's round is. Per
PRD §10.2: coarse accuracy (~100 m, which is enough for zone-boundary
enforcement) between ticks, and request high accuracy only in the ~10 seconds
around a tick. On iOS use significant-location-change monitoring rather than
continuous updates when the app is backgrounded.

---

## 3. Where the photos live

**Cloudflare R2.** This is the one place where vendor choice makes a large
difference, and it is not close.

Free tier: 10 GB storage, 1M writes/month, 10M reads/month, and the part that
matters most: **zero egress charges, permanently**. R2's entire pitch is that it
does not bill for bandwidth out. Every other object store (S3, Supabase
Storage, GCS) charges per GB downloaded, and the seeker downloads *every photo
every hider submits*. That is the single largest data flow in the product.

### The numbers

A 45-minute round, 5-minute check-ins, 5 hiders = **90 photos per round**
(9 check-ins × 2 cameras × 5 hiders).

| Approach | Per round | Rounds before 5 GB egress |
|---|---|---|
| Full-size only (~200 KB) | 17.6 MB | ~291 |
| Thumbnail in feed, full on tap | 6.2 MB | ~832 |
| Thumbnails only (~30 KB) | 2.6 MB | ~1,941 |

On R2 the egress column is irrelevant, you are never billed for it. That is
why it wins. But **generate the thumbnail anyway**: the seeker's feed is a
horizontal strip of small cards, and shipping 200 KB originals into a strip
that displays them at 62×78 px is wasteful of the player's cellular data even
when it is free for you.

Storage stays small because of the PRD's own rule: photos are deleted 24 hours
after round end, so storage is a rolling window, not a growing pile. At ten
rounds a day that is about **170 MB live at any moment** against a 10 GB
allowance.

### How the flow should work

1. Client asks your API for a **presigned PUT URL** (R2 is S3-compatible).
2. Client uploads the image bytes **directly to R2**. Your server never touches
   the file, so you are not paying for compute to proxy megabytes.
3. Server records the row in `photos`, runs the §4.5 validator against the
   object, and stores the pHash and scores.
4. Seeker reads through **short-lived presigned GET URLs** scoped to the round,
   which is exactly what PRD §7.6 requires.

### The 24-hour deletion

Two layers, because the PRD demands a *verifiable* audit log and not just a
lifecycle rule:

- An **R2 bucket lifecycle rule** as the backstop that catches anything the job
  misses.
- A **Cloudflare Worker on a Cron Trigger** (free tier includes cron) that does
  explicit deletes and writes a row to `audit_deletions` for each one. This is
  the layer you can point at in an App Review response or a privacy audit.

---

## 4. The game tick worker, for free

The PRD calls for a persistent Node process because sub-minute precision
matters. Persistent compute is the hardest thing to get free. Railway and
Fly.io both effectively ended their free tiers, and Render's free web services
spin down after 15 minutes idle, which is fatal for a timer.

**There is a way around it that costs nothing and is arguably more correct.**

Tick times are deterministic. When a round starts at T0 with a 5-minute
interval, every window's open and close time is known at that instant. So write
them into the database as exact timestamps at round start:

```
checkins(round_id, user_id, tick_index, window_open, window_close, status)
```

Now a **coarse** job can produce **exact** outcomes. A `pg_cron` job running
once a minute asks "which windows closed since I last ran, with no valid
submission?" and blacks those players out. The verdict is exact because it
compares against `window_close`, not against when the job happened to run. The
only thing degraded by the coarse schedule is *notification latency*, and you
fix that separately: the client schedules on-device local notifications for the
known tick times at round start, so the alert fires to the second.

This stays honest about PRD §9's server-authority rule. The local notification
is only the *alarm*. Whether a submission counts is decided server-side against
the server's own `window_close` timestamp, and a tampered client clock changes
nothing.

Dynamic events shift the schedule: a Grace buff extending a window, a Pressure
item forcing an off-cycle check-in, the speed lock pausing a round. These
go out as real push notifications from an Edge Function at the moment they
happen, so they don't wait for the next cron pass.

**When you outgrow this:** move to a real persistent worker on an **Oracle
Cloud Always Free** ARM VM (4 cores / 24 GB RAM, genuinely free forever, though
capacity in popular regions can be hard to get) or a **GCP e2-micro** always-free
instance. Both run a small Node tick loop indefinitely at no cost. Do this when
notification latency, not correctness, starts bothering playtesters.

---

## 5. Maps, without a Google bill

`react-native-maps` uses **Apple Maps on iOS with no API key and no cost**. If
you launch iOS-first this is a non-issue.

Android is where it gets murky: it falls back to Google Maps, which needs a
billing-enabled key. Google restructured Maps pricing in 2025 into
Essentials/Pro/Enterprise tiers with monthly free call allowances; mobile SDK
*map display* has historically been unmetered, but I would not build a plan on
that without you confirming current terms in the console.

The durable free path is **MapLibre + OpenFreeMap**, a free, no-key,
donation-funded tile server, or self-hosting a **Protomaps `.pmtiles`** file.
The pmtiles trick pairs beautifully with the R2 decision above: it is one large
file served by range requests, and R2 charges nothing for egress. A single
metro area is a few hundred megabytes, well inside the free 10 GB. A whole-US
basemap would not fit, which is fine, you are launching in one city.

Given the PRD's stylized-map aesthetic (the demo already renders its own map
from primitives rather than showing photorealistic tiles), MapLibre with a
custom dark style is also the better *design* answer, not just the cheaper one.

---

## 6. Where the free tier actually breaks

| Constraint | Free ceiling | What that means for Hidewire |
|---|---|---|
| Supabase Realtime concurrent | ~200 connections | ~33 six-player parties live at once |
| Supabase egress | 5 GB/mo | Thousands of rounds (photos bypass this via R2) |
| Supabase Postgres | 500 MB | Very far away; `positions` is the only write-heavy table, and it purges at round end |
| R2 storage | 10 GB | ~58× your rolling need at 10 rounds/day |
| Supabase MAU | 50,000 | Not a real constraint |
| **Project inactivity** | **Pauses after ~1 week idle** | **The one that will actually bite you**, a Supabase free project pauses if untouched; keep a weekly ping or expect a cold start before a playtest |

Realistically the free stack carries you to **several hundred daily players**.
The first upgrade you will need is Supabase Pro at $25/month, and it will be
triggered by concurrent realtime connections, not by storage or bandwidth.

---

## 7. What I need from you

### Accounts to create (I'll need the keys)

| Service | Cost | What I need from it |
|---|---|---|
| Supabase | Free | Project URL, `anon` key, `service_role` key |
| Cloudflare | Free | Account ID, R2 bucket name, S3-compatible API token |
| Expo / EAS | Free tier | Account login, or an access token |
| **Apple Developer Program** | **$99/yr** | Team ID + App Store Connect access |
| Google Play Console | $25 once | Only if Android is in scope for v1 |
| AdMob | Free | App ID + ad unit IDs, not needed until you want ads live |
| RevenueCat | Free under $2.5k/mo revenue | API keys, not needed until IAP is real |
| Sentry / PostHog | Free tiers | DSN / project key |

You can defer the last three entirely. The first three are needed before any
backend work is meaningful.

### Decisions only you can make

1. **iOS-only for v1?** This roughly halves the work. Apple Maps free, no
   Google key, one store review, one background-execution model to fight. I'd
   recommend yes.
2. **Launch city.** POI ingestion and map tiles are both scoped to a region.
   Pick one metro area.
3. **Pay the $99 now, or test on your own devices first?** Free provisioning
   gives you 7-day builds on your own hardware. Real testers need TestFlight,
   which needs the paid program. Reasonable to defer until the check-in loop
   feels good.
4. **The name.** The PRD says BLACKOUT; I built it as Hidewire because the photo
   mechanic is the differentiator and "blackout" is already the name of the
   *loss state* inside the game. Both names have existing games on the stores, so
   do a trademark search before you print anything.
5. **Domain.** You need a public URL for the explainer page (the QR code on the
   offline Explainer Card points at it), the POI complaint form, the privacy
   policy, and the ToS. All four are App Review requirements.
6. **A lawyer for the ToS and privacy policy.** PRD §7.8 flags this and it is
   correct. Assumption-of-risk and limitation-of-liability language for a game
   that sends teenagers to physical locations is not something to generate.

### Something I need you to physically go do

**Shoot the validator calibration set.** PRD §15.1 says the §4.5 thresholds
must come from real captures, not guesses, and it is right, a false
elimination is the single worst bug this product can have. I need maybe 40–60
photos from an actual phone camera:

- **Should fail:** thumb over the lens, phone in a pocket, pointed at a blank
  wall, pointed at the sky, a photo of a screen, deliberate motion blur, a
  pitch-dark room.
- **Should pass:** genuinely good hiding spots, behind a dumpster, under a
  stairwell, inside a parking garage, in a bush, at dusk, at night under a
  streetlight, in bright noon sun, indoors in a shop.

The night and dusk cases are the ones that will make or break the tuning, and
they are exactly where a naive luminance threshold falsely eliminates someone
who did nothing wrong. Take them in the kind of places you'd actually hide.

### What's already decided and needs nothing from you

Overture Maps POI data is a free bulk download that I ingest once and filter
against the §6.1 exclusion rules locally. The exclusion geofences (schools,
hospitals, airports, rail) come from the same dataset. No account, no key, no
ongoing cost.

---

## 8. Build order from here

The demo has no backend at all, every server behavior is scripted in
`mobile/src/engine/GameContext.tsx`. Turning it real, in the order that keeps
the app runnable at each step:

1. Supabase project, schema from PRD §10.3, row-level security policies. The
   RLS work is not optional polish. §9 says a seeker must not be able to read
   a hider's position between reveal ticks *at the database layer*, and that is
   far easier to build in now than to retrofit.
2. Auth + the age gate, with the sticky under-13 refusal stored device-side.
3. Party creation, invite codes, lobby, host settings, replacing the scripted
   roster.
4. Position uplink (the plain POST above) and zone enforcement.
5. **The check-in flow and the validator.** The heart of it. This is where the
   calibration photos get used.
6. Tick scheduling, push notifications, blackout evaluation.
7. Everything after that follows the PRD's own §16 sequence.

Steps 1–6 are what make it a game. Everything past that is content.
