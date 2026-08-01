# Hidewire: standing instructions

Read these before doing anything. They apply to the whole repo.

---

## 1. Write a session handoff, every session

**At the end of every session, write a new file in `claude/` named
`session-N.md`, where N is the next unused number.** Never edit or overwrite an
earlier session file: they are a running history, not a single living document.

Check what already exists first:

```bash
ls claude/
```

The file must capture everything a cold reader needs to continue:

- What was built or changed this session, and **why**, especially where a
  judgment call was made that someone might reasonably disagree with.
- What is verified working versus what is written but unproven.
- What broke and how it was fixed, when the bug was subtle enough to recur.
- What is still outstanding, in dependency order.
- What is blocked on Angad, separated from what is blocked on engineering.
- Gotchas that cost real time and will cost it again.

Match the tone and depth of [claude/session-1.md](claude/session-1.md). It is
the reference for what a good handoff looks like. State disagreements with
earlier decisions plainly rather than silently reversing them.

## 2. No em-dashes, anywhere

Standing instruction. Applies to UI copy, code comments, docs, commit messages,
and chat. Use commas, colons, parentheses, or a full stop instead.

Verify before declaring any copy done:

```bash
grep -rnP "\x{2014}" . --exclude-dir=node_modules --exclude-dir=.git
```

That escape is used rather than the literal character so this file passes its
own check.

## 3. The PRD is the authority

[PRD.md](PRD.md) wins whenever another document disagrees with it. Sections
marked **[HARD CONSTRAINT]** are legal or safety requirements and are not
open to engineering convenience. The most important ones in practice:

- **No face detection, ever** (4.5). Whole-image statistics only. No ML
  classifier on human subjects in v1.
- **Live capture only** (4.4). Gallery upload is disabled and no gallery
  permission is ever requested.
- **A seeker cannot read a hider's position between reveal ticks**, enforced at
  the database layer, not in a query (9).
- **Public ground only.** Nothing in the product may route a player onto
  private property, into traffic, or toward another person.

Where a product decision supersedes the PRD, say so explicitly in the session
handoff. Current supersessions:

- Round length is **30 minutes**, not the PRD default of 45.
- **The NEARBY tab crosses "never imply stranger play"**, knowingly. Adults can
  see players nearby and ask to join their game. It is 18+ only, opt in and off
  by default, coarse distance buckets rather than positions, requests rather
  than messaging, with report and block on every row. Anything that widens this
  needs a fresh decision, not an assumption that the line is already gone.
- **iOS and Android are both v1 targets.** Session 1's iOS-only decision is
  reversed: the founder is on Android and could not otherwise playtest, which
  blocked the notification-from-pocket test and the PRD 14 interval playtest.
- **The product is called Hidewire**, on `hidewire.org`, with identifiers
  `org.hidewire.app` and the scheme `hidewire://`. It was FRAME through
  sessions 1 and 2 and those files are left as written, being a history.
- **The age gate is a slider, not a date field.** PRD 3 specifies a blank
  date-of-birth entry and marks it [HARD CONSTRAINT] for COPPA, on the
  reasoning that anything easier is "trivially defeated". Superseded
  deliberately. The slider is built as neutrally as one can be: no starting
  position, a range beginning at 8 so the control does not announce the
  threshold, and nothing marking where the cutoff is. The sticky refusal and
  the three-correction limit are unchanged, and the date of birth is now never
  entered at all, which goes further than PRD 3's promise not to store it.
- **Real money now buys an advantage.** marketing/BRIEF.md 9 lists "never imply
  anything purchasable helps you win" as a legal line. It is no longer true, so
  the claim has to come out of the marketing copy rather than being softened,
  or it becomes a misleading-advertising problem instead of a tone one.

## 4. Read the versioned Expo docs before writing app code

See [mobile/AGENTS.md](mobile/AGENTS.md). Expo has changed; do not write mobile
code from memory of an older SDK.

## 5. Marketing claims that cannot be made

[marketing/BRIEF.md](marketing/BRIEF.md) 9 lists these and they are legal
lines, not tone notes. Never imply face recognition, never imply stranger play,
never depict unsafe hiding, never imply anything purchasable helps you win.
These constrain product design as much as copy: a feature that puts strangers
in contact with each other is out regardless of how it is described.

## 6. Current backlog

Angad's list, 2026-07-30. **Keep this updated as items land**, and write the
detail into the session handoff rather than here. This section is the index, not
the record.

### Bugs

- [x] **Daily assignment paid out twice / marked done incorrectly.** The payout
      called `setProfile` inside a `setDaily` updater, nested inside a `setSolo`
      updater. React may invoke an updater more than once, so FILM could be paid
      twice. Now a plain effect. See session-2 13.
- [x] **Round clock jumped 7 to 8 seconds per tick.** It was scaled by
      `DEMO_SPEED`. The round clock is now real time, 1 second per second.
- [x] **Map default zoom.** Corrected twice: it now opens *closer* (2.6), not
      wider. The first attempt read the request backwards.

### Quick wins

- [x] **Home screen restructured into five tabs.** NEARBY, SOCIAL, GAME,
      STORE, PROFILE, Clash Royale shaped with GAME in the middle. The Game tab
      holds only identity, missions, host, join, and the ad. See session-2 14.
- [x] **Missions.** Three a day on the Game tab; finishing all three pays 100
      FILM.
- [x] **Host a round / Join with code moved above the fold**, before progression.
- [x] **Season pass shortened.** 50 tiers at 1000 XP was unfinishable inside a
      10 week season. Now 30 tiers at 500 XP.
- [x] **Reset progress** control, so a device can be returned to a true new
      account without clearing app data by hand.

### Not started, roughly in dependency order

- [x] **The backend exists.** Migrations 0001 to 0008 are applied to the live
      project. Schema, RLS, the server-authoritative round layer, storage
      policies, and four pg_cron jobs. See section 7 and session-3. **The
      client still does not call any of it**, which is now the gap.
- [ ] **Daily assignment design.** Current prompts are too menial and not
      engaging enough. Needs a middle ground between "photograph a doorway" and
      something with real pull. Think about stakes, variety, and a reason to
      care beyond the FILM. **Blocked on Angad**, it is a product call.
- [x] **Interactive onboarding tutorial.** Five-step funnel now ends in a
      four-beat tutorial that each beat requires an action for. TEST FRAME was
      absorbed into it and no longer exists as a Solo card. See session-3.
- [ ] **Wire the client to the backend.** `data/social.repo.ts` is the seam and
      already has the right shapes; `GameContext.tsx` is the harder one.
- [x] **Global leaderboard**, ranked on XP. Global and friends scopes.
- [x] **Friends tab.** Add by friend code and QR, invite in one tap. Report and
      block on every row. See session-2 14.
- [x] **Share the daily capture with friends**, BeReal shaped, with applause.
- [x] **Referral system.** Codes, 500 FILM each, shared task track.
- [x] **Shop expansion.** Bundles and tier skips. A pre-existing "1,000 FILM for
      $2.99" SKU was **removed**: seeker bidding spends FILM, so selling it was
      pay-to-win.

### New capability

- [x] **NEARBY tab.** Games and players around you, **18+ only**. See the
      supersession note in section 3: this crosses a legal line deliberately and
      is built to the narrowest reading that still delivers it.

### Standing constraints these must respect

Every item above is still bound by section 3 and section 5. In particular:

- A friends list and a shared feed must never become **stranger** contact.
  Friend codes are fine; discovery of people you do not know is not.
- The age gate means minors are on this platform. Any social surface needs
  report and block from the first commit, not later.
- **There is exactly one currency and it is called FILM.** If a note, a ticket,
  or a conversation says "link", "coins", or anything else, it means FILM.
  Never introduce a second currency without saying so explicitly.
- ~~FILM is **earned, never sold**, while seeker bidding exists.~~
  **Superseded 2026-08-01.** FILM is now sold, in packs, and the shop sells a
  $4.99 loot box containing items that change how a round plays. Both were
  deliberate calls. Two consequences follow and neither is optional:
  **seeker bidding is now winnable with money**, so it either comes out or the
  product accepts that; and every FILM loot box is now a *paid* random item in
  the jurisdictions that test for indirect purchase, which is most of them.
  See [monetization/LOOT-BOXES.md](monetization/LOOT-BOXES.md) sections 1 and 3.
- Applause and referral grants are FILM faucets and are capped for that reason.
  See section 6.1.

## 6.1 FILM economy, current numbers

Single source of truth is `ECONOMY` in `mobile/src/data/economy.ts`. Change it
there, not in screens.

| Source | Pays | Notes |
|---|---|---|
| Daily check-in | **500 FILM + 100 XP** | Once per day. |
| All three missions | **500 FILM** | Once per day, on top of what each mission pays. |
| Rewarded video | **250 FILM** | 30 seconds. **Capped at 4 a day**, so ads pay 1,000 against 1,100 from playing. Playing must always pay more; preserve that ordering through any retune. |
| Applause received | **20 FILM** | From another player applauding your capture. |
| Applause received, daily cap | **100 FILM** | Roughly five applauds. Past the cap people can still applaud, it just stops paying, so the social signal survives without the faucet running. |
| Referral, both sides | **2,500 FILM** | One time, per pair. The referrer must be level 2, and at this size that guard is load-bearing. |

**The server's numbers are the ones that count.** `mobile/src/data/economy.ts`
mirrors them so the UI can render a price without a round trip, but every grant
is applied in a SECURITY DEFINER function in `0009_economy.sql`. If the two
disagree, the migration wins.

The cap exists because a group of friends mutually applauding would otherwise
mint more FILM per day than playing does, which devalues every price in the
shop.

## 7. The backend exists, the client does not use it

Worth stating precisely, because both halves are true and it is easy to read
either one alone and be wrong.

**What is real, as of session 3:**

- Migrations **0001 through 0008 are applied** to the live Supabase project.
- Row-level security is enforced and has been **executed**, not just written.
  `0008_selftest.sql` asserts 21 properties, including the PRD 9 constraint,
  and the migration fails if any of them is false.
- The round layer is server-authoritative: `start_round` writes every check-in
  window's exact open and close timestamp up front, and a one-minute `pg_cron`
  job resolves them. See INFRASTRUCTURE 4.
- FILM, XP, levels, and cosmetic ownership are **not writable by any client**.
  Column-level grants make that true regardless of RLS. Every economy change
  goes through a SECURITY DEFINER function.
- Photo storage, its policies, and a queued 24 hour deletion path exist.

**What is not:**

- **The client makes no database calls.** `data/social.repo.ts` has the live
  branches written and they are unreachable, because `isLive()` needs a signed
  in session and the OAuth redirect is still unconfigured. `GameContext.tsx` is
  still the scripted local demo engine.
- So two phones still share nothing, and progression still lives in
  device-local `AsyncStorage`.
- Server-side revalidation of photo pixels does not exist. `submit_checkin`
  judges the window against the server clock and the signals against
  server-held thresholds, which is more than the client used to be trusted for
  and less than PRD 9 finally requires.

**Two things that were wrong and are now fixed**, recorded because reading the
files did not reveal either:

- `profile_self_rw` granted UPDATE on **every column** of your own row. Any
  signed-in player could have set their own FILM balance with one request. RLS
  chooses rows, not columns; closing it needed a column-level GRANT.
- `parties.host_id` and both `catches` columns referenced `profiles` without
  `on delete cascade`, so **any account that had ever hosted a party could not
  be deleted**. App Store 5.1.1(v) requires in-app account deletion.

## 7.05 Turning test mode off

**Set `TEST_MODE` to `false` in `mobile/src/config.ts`.** One boolean, one
file, and every fixture in the app goes with it. Or without editing code:
`EXPO_PUBLIC_TEST_MODE=false npx expo start`.

`assertProductionSafe()` throws at startup if fixtures are enabled in a
production bundle, so the mistake fails loudly rather than shipping.

**Any new fixture must be gated by that flag**, or the flag is a lie.

## 7.06 Guests cannot use account features

Shop, FILM, season pass, friends, leaderboard, and referrals all require an
account. This is enforced in the schema, not the client: every social table
keys off `profiles`, which keys off `auth.users`, so a guest has no row to own
anything with and every policy fails on `auth.uid() is null`.

`components/AccountGate.tsx` wraps those routes so the app explains itself
rather than failing mysteriously. It is not the security boundary.

## 7.1 Record every fixture

**[TEST-FIXTURES.md](TEST-FIXTURES.md) is the register of everything fake in
the app.** Simulated players, scripted rounds, fake friend codes, placeholder
prices, procedural photos.

When you add a fixture, add it there **in the same commit**. When you replace
one with real data, strike it there in the same commit. It ends with a
pre-launch checklist; anything that must not ship enabled belongs on it.

Two conventions that are not optional:

- Simulated players are visibly tagged. A fake name must never be able to pass
  for a person.
- Nothing simulated arrives on its own. A fixture appears because someone asked
  for it, never by a timer.

## 8. Useful commands

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
