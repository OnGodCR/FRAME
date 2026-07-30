# FRAME: standing instructions

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
- **iOS and Android are both v1 targets.** Session 1's iOS-only decision is
  reversed: the founder is on Android and could not otherwise playtest, which
  blocked the notification-from-pocket test and the PRD 14 interval playtest.

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
- [x] **Map opened too zoomed in.** Default camera zoom lowered.

### Quick wins

- [x] **Host a round / Join with code moved above the fold**, before progression.
- [x] **Season pass shortened.** 50 tiers at 1000 XP was unfinishable inside a
      10 week season. Now 30 tiers at 500 XP.
- [x] **Reset progress** control, so a device can be returned to a true new
      account without clearing app data by hand.

### Not started, roughly in dependency order

- [ ] **The backend does not exist.** See section 7 below. Nothing else in this
      list is genuinely multiplayer until it does.
- [ ] **Daily assignment design.** Current prompts are too menial and not
      engaging enough. Needs a middle ground between "photograph a doorway" and
      something with real pull. Think about stakes, variety, and a reason to
      care beyond the FILM.
- [ ] **Global leaderboard**, ranked on XP.
- [ ] **Friends tab.** Add by unique friend code and QR. Invite to a game in one
      tap instead of the friend typing a room code.
- [ ] **Share the daily capture with friends**, BeReal shaped. Applaud a
      friend's post to give them 25 FILM.
- [ ] **Referral system.** Codes entered at signup, 500 FILM each, plus a shared
      task track (3 daily assignments, 3 wins, 10 games together).
- [ ] **Shop expansion** for more microtransactions.

### Standing constraints these must respect

Every item above is still bound by section 3 and section 5. In particular:

- A friends list and a shared feed must never become **stranger** contact.
  Friend codes are fine; discovery of people you do not know is not.
- The age gate means minors are on this platform. Any social surface needs
  report and block from the first commit, not later.
- FILM is **earned, never sold**, while seeker bidding exists. Applaud rewards
  and referral grants are new FILM faucets: watch the total supply, because
  inflating it devalues every price in the shop.

## 7. There is no backend yet

Worth stating plainly because the app looks like it has one and does not.

- **No database calls exist anywhere in the client.** Supabase is used only for
  OAuth sign-in. There is not a single `.from()`, insert, or select.
- **All state is device-local `AsyncStorage`.** Progression, the daily streak,
  and milestones live only on that phone.
- **`supabase/migrations/0001_core.sql` has never been applied.**
- Two people on two phones therefore share nothing. Parties, rosters, and the
  photo feeds are simulated locally.

So a "new account" is only new if that device has no stored state. Signing in
with Google authenticates a person and stores nothing about them.

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
