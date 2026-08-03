# Hidewire: session 3 handoff

Written 2026-07-30, same day as session 2 and continuing directly from it. Read
[session-2.md](session-2.md) first for everything about the app itself; this
file covers the backend going live, the onboarding tutorial, and the rename.

**The product is now called Hidewire.** It was FRAME through sessions 1 and 2,
and those two files are left as written rather than retroactively renamed,
because they are a history and not a description of the present.

---

## 1. What this session was

1. **The backend stopped being a design document** (2). Eight migrations
   applied to the live project, RLS actually executed for the first time, and
   two real security holes closed.
2. **An interactive onboarding tutorial** (4), which absorbed TEST FRAME.
3. **The rename to Hidewire and the domain** (5).
4. **A calibration shoot sheet** (3), because the existing README listed
   categories rather than a plan and the photos had not been taken.

---

## 2. The backend is applied and verified

`supabase link` was already authenticated on this machine, which is why this
finally happened: CLAUDE.md had it down as blocked on Angad because the anon key
cannot run DDL, and the CLI can.

### What is applied

| Migration | What it does |
|---|---|
| `0001_core.sql` | Identity, parties, rounds, positions, reveals, check-ins, photos. Written in session 1, applied today. |
| `0002_social.sql` | Friends, requests, referrals, applause, leaderboard. Written in session 2, applied today. |
| `0003_hardening.sql` | **Closes the two holes below.** Adds the columns the client was keeping locally, prices the shop server side, moves every FILM faucet into a function. |
| `0004_rounds.sql` | The server-authoritative round layer. Party lifecycle, seeker bidding, `start_round`, `submit_checkin`, positions and the speed lock, catches, the tick job, round rewards. |
| `0005_storage.sql` | The `captures` bucket, its policies, and a **queued** 24 hour deletion path. |
| `0006_jobs.sql` | pg_cron: the round tick every minute, three retention jobs. |
| `0007_cascades.sql` | Makes an account deletable. Found by 0008. |
| `0008_selftest.sql` | 21 assertions, including PRD 9. **The migration fails if any of them is false.** |

`select frame_selftest();` re-runs the whole conformance suite at any time. It
creates two throwaway auth users, exercises the policies as each, and deletes
them.

### The two things that were actually wrong

Both had been written, reviewed at length, and reasoned about in prose in the
migration headers. Neither was findable by reading.

**`profile_self_rw` let a client write its own FILM balance.** 0002's header
states that "FILM is minted only by the server. The client can never write its
own balance." The policy was `for all using (user_id = auth.uid())`, which
grants UPDATE on **every column of your own row**: `film`, `level`, `xp`,
`owned_cosmetics`. Any signed-in player could have PATCHed their balance to
anything with one curl command.

The lesson is worth keeping because it will recur: **row-level security decides
which rows you may touch and says nothing about which columns.** Closing it
needs a column-level `GRANT`, which is what 0003 section 2 does. Adding a
column to `profiles` from here on does **not** make it writable, which is the
correct default.

`pm_self` had the same shape and let anyone insert themselves into any party by
id, with no knowledge of the code at all.

**Three foreign keys had no `on delete cascade`.** `parties.host_id`,
`catches.seeker_id`, `catches.target_id`. Every other reference to `profiles`
in the schema has one. The effect: **an account that had ever hosted a party
could not be deleted**, because the constraint refused. App Store Review
5.1.1(v) requires in-app account deletion and UK GDPR gives the same right to
every player, including the minors the age gate admits.

Nobody would have found this by reading. It is three missing words across 320
lines, in a table nobody deletes from during normal play. It surfaced the first
time anything actually tried to delete a user, which was the self-test's
teardown, on the fourth attempt to get that migration to pass.

**That is the argument for 0008 existing at all.** Three of the four failures
on the way to a green run were real findings rather than test bugs.

### Design decisions in the new migrations worth defending

**Check-in windows are written at round start, all of them.** `start_round`
computes every window's `window_open` and `window_close` and inserts the rows
immediately. A once-a-minute `pg_cron` pass then produces *exact* outcomes,
because it compares against `window_close` rather than against when it woke up.
This is INFRASTRUCTURE 4's argument implemented; the only thing the coarse
schedule degrades is notification latency, which the client's on-device local
notifications already solve. A player learns they were blacked out up to a
minute late. The verdict itself is exact.

**Supabase Storage, not R2, for now.** INFRASTRUCTURE 1 picks R2 and that is
still right at scale, because a seeker pulls every hider's photo and egress is
the cost that grows. It is not right today: R2 needs an account and four
credentials that do not exist, and until they do there is nowhere for a
photograph to go, which blocks testing the check-in loop on a real phone. The
client never builds a URL and `photos.storage_path` holds an opaque key, so the
swap is changing where the key is redeemed.

**The photo path is `<round_id>/<user_id>/<checkin>-<camera>.jpg` and the order
matters.** The seeker's read policy has to answer "is this caller a seeker in
the round this object belongs to" from the object name alone, because storage
policies cannot join into game tables.

**Deletions are queued, not assumed.** Deleting the `photos` row does not remove
the object: only the Storage API can. Dropping rows and writing an audit record
would leave the actual photographs in a bucket while the audit trail claimed
otherwise, which is worse than having no job, because it makes an unfounded
claim auditable. `pending_object_deletions` records attempts and errors.

**`drain_object_deletions` is inert until one secret exists.** It needs the
service_role key, which bypasses every policy in the schema and does not belong
in a chat window. Two lines to run in the SQL editor are in 0005's header.

**The shop is priced server side.** Prices lived only in `data/catalog.ts`, so
any purchase call had to take the price from the client. `cosmetics` mirrors the
catalog and `purchase_cosmetic` reads the cost from the table, never from its
arguments. **Keep the two in sync**; if they disagree the server wins and the
shop shows a price the player is not charged, which is the right way round.

**`day_is_plausible`.** The daily reward and mission sweep take a day index
from the client, because `dayIndex()` is the local calendar date. A client that
could name any day could claim the daily a thousand times, so it is bounded to
the server's day plus or minus one: wide enough for every timezone, narrow
enough to be worthless.

**The age bracket now defaults to `13_17`, not `18_plus`.** It gates the NEARBY
tab. An account whose bracket was never established should not be treated as an
adult by default, which is the direction the original default was wrong in.

**Functions are executable by PUBLIC unless revoked.** Postgres grants EXECUTE
to everyone on every new function and PostgREST exposes them at `/rpc/<name>`.
A SECURITY DEFINER function taking a target user as an argument is therefore a
privilege escalation: `apply_xp(p_user, p_frac)` left open would have let any
player hand themselves fifty levels. **Every function meant for a client takes
no user argument and reads `auth.uid()` itself.** The ones that take one are
revoked, in 0003 section 8.

### What the backend still does not do

- **The client calls none of it.** This is now the single biggest gap and it is
  bigger than it looks: `social.repo.ts` is a clean seam and will be easy,
  `GameContext.tsx` is a scripted local engine with normalised 0..1 bot
  positions and is a rewrite rather than a rewiring.
- **No server-side revalidation of pixels.** `submit_checkin` judges the window
  against the server clock and the signals against server-held thresholds. That
  is more than the client used to be trusted for and less than PRD 9 requires.
  It needs a worker that can decode a JPEG.
- **`validator_thresholds` is a table with placeholder values in it.** PRD 4.5
  wants them servable without an app release, which is why it is a table. They
  are still guesses until the calibration set exists.

---

## 3. The calibration shoot sheet

[calibration/HOW-TO-SHOOT.md](../calibration/HOW-TO-SHOOT.md) is new. Angad
said plainly that he did not understand what to photograph, and re-reading
`calibration/README.md` he was right: it lists categories and rules, not a
plan, and it silently implies about 80 photographs by asking for both cameras
on every scene.

The new file is three trips and a series, about 50 photos and 45 minutes, with
the both-cameras requirement cut down to the six scenes where a front camera
actually changes the statistics.

**One thing in it is new information rather than reorganisation: Night mode has
to be off.** The app uses `expo-camera` with no computational photography. A
night-mode photograph stacks several seconds of exposure into a bright, clean
image that the app can never produce, so calibrating `darkMax` against one
would set the threshold in the most dangerous direction: too strict, so honest
players hiding in the dark get eliminated for playing correctly. The old README
never mentioned it.

`calibration/.gitignore` blocked everything except `README.md`, so the new file
was invisible to git until the allowlist was extended. Worth knowing if another
document is ever added there.

---

## 4. The onboarding tutorial, and the end of TEST FRAME

### What changed

The funnel is now **5 steps**: DOB, legal, account, handle, tutorial. The
tutorial has four beats and **every one of them requires the player to do
something.** That was the design constraint, not a nice-to-have: a tutorial the
player reads is a tutorial the player skips.

| Beat | The action |
|---|---|
| THE ZONE | Drag your pin inside the boundary. NEXT stays disabled until you are inside. |
| THE WINDOW | A countdown opens and you have to beat it. Miss it and the real BLACKED OUT screen appears, with a retry. |
| PROVE IT | The real `CaptureSequence`. Real 60 second window, back then front, the real PRD 4.5 validator on real pixels. |
| THE SEEKER | Your own two frames in a seeker's feed, tap to flip. |

**TEST FRAME no longer exists as a Solo card.** Beat 3 *is* TEST FRAME,
unchanged in substance. `SoloMode` is gone, `SoloState` lost `window` and its
`expired` outcome, and `TEST_FRAME_WINDOW` is now `PRACTICE_WINDOW`.

### Why it moved rather than being duplicated

As an optional card it was the single most important thing in the product
sitting where a new player had no reason to tap. Session 2 added a START HERE
card pointing at it, which was treating the symptom.

### Things that are deliberate and will look like oversights

**Beat 2's window is 10 seconds, not 60, and says so on screen.** The point of
that beat is the feeling of a deadline arriving, and making someone stand still
for a full minute to learn that teaches nothing extra. Beat 3 uses the honest
60, so the number a player actually rehearses against is the real one. The
compression is labelled because session 2 already learned that an unlabelled
scaled clock reads as a bug.

**Beat 2 is allowed to fail, and failing it is the point.** It shows the real
blackout screen. The first time somebody sees that screen should not be the
first time it has cost them a round. That was the original argument for TEST
FRAME and it is why the practice run survived the move rather than being cut.

**Beat 3 is individually skippable.** "I'll do this outside." A player doing
onboarding indoors at night, or one who declined the camera, must not be
trapped in the funnel. This repo has already shipped one gate that could lock a
player out of the whole app (session-2 15), and being unable to finish the
tutorial is a worse outcome than not having done it.

**`tutorialDone` is separate from `practised`.** Because of the above, a player
can finish the tutorial without having practised. Conflating them would either
let a skipper be treated as having done a check-in, or block the funnel on the
skippable beat.

**The tutorial is replayable**, from Profile, "How to play". The most cited
first-run failure in this genre is a tutorial that can never be seen again,
which is why session 2 pulled the map explainer out of the funnel rather than
deleting it.

### A bug this surfaced, found while verifying

`nextAfterAuth()` in `AuthGate.tsx` returned `'home'` whenever a handle already
existed. The moment the tutorial became a step *after* the handle, that meant
**a player who quit partway through onboarding and came back never saw the
tutorial at all**, and neither did a guest who reached the auth screen from the
shop or friends wall. They landed on the home screen having never performed a
check-in, which is exactly the cold start the tutorial exists to prevent. It now
checks the two conditions separately.

### The mission that had to change

Mission 1 was "Try your first check-in", derived from `seen.practised`. Once
every player performs a capture during onboarding, that mission is permanently
ticked before the list is first seen. It is replaced by **"Applaud a friend's
capture"**, which reads `applaudedToday`: a field `MissionInput` was already
carrying and nothing consumed.

---

## 5. The rename, and the domain

`hidewire.org` is registered. `frame.com`, `.co`, and `.app` were taken and
`.gg` was quoted at $30k.

**Bundle identifiers are now `org.hidewire.app`**, reverse DNS of a domain that
is actually owned, replacing the `com.frame.app` placeholder. Session 2 flagged
that these are permanent once published to either store, so doing this before
the first upload cost nothing. **This is now settled and should not be touched
again.**

**The URL scheme changed from `frame://` to `hidewire://`.** That is the deep
link `Linking.createURL('auth-callback')` builds, so **the Supabase Auth
redirect allow-list has to use the new scheme.** It was already an open item;
it is now an open item with a different value in it.

### What was and was not renamed

The word "frame" is also a game concept: the cosmetic category, the photo
frames that are the flagship shop section, "both frames would now be in the
seeker's feed". A blind replace would have broken the product's own vocabulary,
so every replacement was made explicitly.

**Not renamed, on purpose:**

- **`claude/session-1.md` and `session-2.md`.** They are a running history.
- **The applied migrations.** Their comments say FRAME. Editing a migration
  that has already run makes the file disagree with what was applied, for a
  cosmetic gain.
- **`PRD.md`**, which still carries the working title BLACKOUT in its own
  header and predates all of this.

**The splash wordmark needed a size change**, not just a string swap. HIDEWIRE
is eight characters where FRAME was five; at the old 56pt with 10pt tracking it
overflowed a 375pt screen and collided with the corner brackets. It is now 38/6.
The brackets are the constant in that lockup, not the point size.

### The waitlist page

[marketing/WAITLIST-BRIEF.md](../marketing/WAITLIST-BRIEF.md) is a complete
prompt for another agent to build `hidewire.org`: the waitlist page plus `/terms`
and `/privacy` from the existing drafts.

Two constraints in it are load-bearing rather than preferences. **No analytics,
no pixels, no third-party embeds, and self-hosted fonts**, because the audience
includes 13 to 17 year olds and because a font CDN logs a visitor's IP on every
page view, which would make the privacy policy untrue. And **the legal drafts
must keep their unreviewed-by-a-lawyer notice** on the live pages until that
review happens.

---

## 5.5 One typeface

The app ran two families at roughly a 50/50 split: Space Grotesk on anything
headline-shaped (61 call sites) and IBM Plex Mono on everything else (54). A
single screen could change voice three times between its title and its
footnote, and neither face was doing a job the other could not.

**IBM Plex Mono is now the base for everything, headings included.** Angad's
call, and the right one: it is the voice the product already had, an instrument
readout rather than a consumer game.

Done in `theme.ts` rather than across 27 files. `font.display` and
`font.displayMed` still exist and now point at mono weights, so every call site
keeps its intent ("this is a heading") without any of them changing. Sizes,
weights, and letter-spacing were deliberately left alone: family only, so there
are no layout shifts to review alongside the swap.

Four exceptions stay in Space Grotesk, behind their own tokens:

| Token | Used by | Why |
|---|---|---|
| `font.wordmark` | The HIDEWIRE lockup | It is a logo, not text. |
| `font.numeral` | Round clock, check-in countdown, level, score total | Mono is even-width by definition, which is right for a table and wrong for a number the size of your hand. |
| `font.blackout` | BLACKED OUT | The one screen in the game that is purely a piece of typography. |

If you are reaching for `wordmark` or `numeral` anywhere else, use `display`.

Verified at 375x812: no truncation, no overflow, no console errors. Mono is
wider than Space Grotesk at the same point size, so the tutorial's heading now
wraps to two lines where it used to fit on one. That is the expected cost of a
family-only swap and it reads fine.

---

## 6. Verified versus written

### Verified in the browser preview

- The full 5-step funnel from a cleared store, landing on the tutorial.
- Beat 1: pin starts outside in red, drag inside turns it acid, the copy flips
  to INSIDE THE ZONE, NEXT enables.
- Beat 2: the wait, the window opening at 0:10, the countdown, and the real
  BLACKED OUT screen on expiry with both exits.
- The HIDEWIRE wordmark inside the brackets at 375x812.
- Missions reading "Applaud a friend's capture" on a fresh account.
- Typecheck clean throughout. Validator 26/26.

### Verified against the live database

- All eight migrations applied.
- `frame_selftest()`: **21 checks passed**, including a seeker session reading
  **0 rows** from `positions` while the hider read its own. PRD 9 has now been
  executed rather than reasoned about.
- Anon reads: `profiles` returns `[]`, `lookup_friend_code` raises "sign in
  required".

### Not verified

- **Beats 3 and 4 have not been run**, because beat 3 needs a camera and the
  preview is `react-native-web`. The component is `CaptureSequence`, which
  session 2 verified in its other two callers, so the risk is in the wrapper
  and the timer rather than the sequence.
- **Nothing has run on a device.** Unchanged from session 2 and still the
  largest gap in the project.
- **No client has ever called the new backend**, so no RPC has been exercised
  through PostgREST with a real JWT. The self-test exercised them in-database
  with simulated claims, which is not the same thing.

### The scroll gate had never worked on web

Recorded because it is the fourth fix to this class of bug and the first that
explains why the previous one did not take.

Session 2 added a fits-entirely guard so a viewport the content fits in would
satisfy the consent gate automatically, since `onScroll` never fires when there
is nothing to scroll. **On react-native-web that guard never ran.** RN Web's
ScrollView forwards neither `onLayout` nor `onContentSizeChange`, so both
measurements stayed at 0 and the `contentH > 0` condition was never true.
Confirmed by logging: `viewer=0 content=0`.

The effect: on a wide or tall viewport the legal gate reads SCROLL TO THE END
forever and **the entire app is unreachable**. Same for the safety card and
starting a round.

Both gates now share `components/useScrollGate.ts`, which keeps the native
callback path and measures the DOM node on web, polling briefly because fonts
and the FadeIn animations change the content height after first paint. Verified
at 768x1024: the gate reads I AGREE immediately.

### The preview pane's click coordinates change space mid-session

This cost more time than any bug in the code. `computer{action:"screenshot"}`
reports a "Screenshot size" that is sometimes CSS pixels (375x812) and sometimes
the raw image (750x1624), and it switches without warning, often after a resize
or a server restart. Clicks are interpreted in whichever space the **last**
screenshot reported.

The symptom is not an error. Clicks land silently in the wrong place and the app
looks frozen or unresponsive, which is exactly what session 2 gotcha 16
described from the other direction. Hours went into treating a coordinate
mismatch as a broken drag handler.

**Take a screenshot immediately before any click, read the reported size, and
use that space.** Do not carry coordinates across a resize, a reload, or a
server restart.

### One thing worth recording about the preview pane

Session 2 could not resolve why the round clock advances at roughly half wall
time in the headless preview. The tutorial's countdown does the same thing: 11
seconds of wall time moved it from 0:10 to 0:04.

That is a second, independent instance, and it narrows the suspect list.
Session 2 established that a raw `setInterval(1000)` in the same page runs at a
true 1 Hz. Both slow clocks are `setInterval` **driving React state**. So the
common factor is React's scheduling in a backgrounded pane, not the round
engine. **It is very likely a preview artefact and not a bug**, but it still has
to be checked against a watch on a real phone before that is assumed.

---

## 7. Still outstanding

### Blocked on Angad

1. **Calibration photos.** Now with instructions.
   [HOW-TO-SHOOT.md](../calibration/HOW-TO-SHOOT.md).
2. **Test a check-in notification from a pocket** on the Android phone.
3. **The 3 / 5 / 10 minute interval playtest**, PRD 14's top product risk.
4. **The Supabase Auth redirect**, now `hidewire://auth-callback`.
5. **The service_role key into Vault**, two lines, in 0005's header. Until then
   photo objects are queued for deletion and never deleted.
6. **Apple Developer Program**, $99/yr.
7. **An attorney** for the liability language.
8. **Cloudflare R2**, when Supabase Storage becomes the wrong answer.
9. **The daily assignment redesign.** A product call, not engineering.

### Engineering, in dependency order

1. **Wire `social.repo.ts` to the live functions.** The seam exists and the
   shapes already match.
2. **Replace `GameContext.tsx` with server state.** The big one.
3. **Photo upload** to the `captures` bucket, then server-side revalidation.
4. **Run the tutorial's beats 3 and 4 on a device.**
5. **The safety systems**, all PRD 7 hard constraints. `post_position` now
   implements the speed lock server side; the client does not surface it.
   Geofenced exclusion zones, the battery warning, the POI complaint form, and
   the moderation queue are all still unbuilt.
6. **Streak freeze**, still half-built and still a churn trigger.
7. **Live Activity / Dynamic Island**, LONG EXPOSURE, the shareable artifact.

---

## 8. Gotchas added this session

- **`reset role` in a migration does not restore the migration role.** The
  Supabase CLI applies migrations through a temporary login role that is a
  *member* of the owner rather than the owner. `RESET ROLE` returns to the bare
  login role, which drops privileges instead of restoring them. Capture
  `current_user` and `set local role` back to it explicitly.
- **plpgsql variables that share a name with a column of any table in the
  statement raise "column reference is ambiguous"**, and qualifying with the
  function name does not always save you. Prefix them: `v_round`, `v_party`.
- **`get diagnostics x = row_count` takes no expression.** `x = x + row_count`
  is a syntax error; assign then add.
- **A CASE returning two unknown literals resolves to `text`**, and `text` does
  not implicitly cast to an enum on INSERT. Cast the CASE explicitly.
- **Postgres grants EXECUTE on new functions to PUBLIC.** See section 2.
- **zsh does not word-split unquoted variables**, so `for x in $list` iterates
  once over the whole string. Use an array.
- **`supabase db dump` needs Docker**, which is not running here. `db push`
  does not, so schema verification has to go through PostgREST or a self-test
  rather than a dump.
- The Metro watcher still does not pick up edits on this machine, and the
  preview pane's `scroll` still times out while having worked. Both unchanged
  from session 2.
