# Hidewire: session 4 handoff

Written 2026-07-31, extended 2026-08-01. This session did not change the app.
It built **hidewire.org**, the public waitlist site, in the separate
`Hidewire-web` repository (`github.com/OnGodCR/Hidewire-web`, which had no
commits before today). Read [session-3.md](session-3.md) for the state of the
app itself.

The brief was `marketing/WAITLIST-BRIEF.md`, which is untracked in this repo and
should be committed alongside this file.

**Read section 9 first if you are picking this up cold.** The site was built to
the brief, then rebuilt on Angad's feedback the same day. Sections 1 to 8
describe the first version; section 9 says what changed and why, and it is the
version that exists now.

---

## 1. What exists now

Three routes, static, no framework, and **no npm dependencies at all**, runtime
or build. `build.mjs` is 300 lines of Node standard library.

```
/            the waitlist page
/terms       Terms of Service, rendered from a copy of legal/TERMS.md
/privacy     Privacy Policy, rendered from a copy of legal/PRIVACY.md
/api/waitlist   a Cloudflare Pages Function, the only server-side code
```

The whole home page is **33 KB over the wire** including both typefaces:
3.4 KB HTML, 3.7 KB CSS, 1.4 KB JS gzipped, plus 25 KB of subset woff2.

### Verified working

Driven in a real browser against the preview server:

- The five form states, checked by submitting through the live DOM: empty,
  malformed, new address, already on the list, server error. Each one changes
  the status text and its color, and only the success case clears the field.
- The endpoint itself has **ten tests** (`npm test`, stubbed database) covering
  the status mapping, lowercasing, the honeypot, a missing key, an unexpected
  database status, the no-JavaScript HTML path, and an assertion that the only
  key sent upstream is `email`.
- Both legal pages render every clause, with the wording unchanged. Compared
  against the source text after conversion.
- One `h1`, headings in document order, both inputs labelled, one each of
  `main`, `header`, `footer`, `nav`.
- Zero third-party network requests, zero console messages.
- Contrast measured in-page: `dim` on `bg` is 7.09:1, accent button 16.77:1.
- Mobile at 375 and desktop at 1280, plus the skip link and focus rings.

### Written but unproven

- **The deployment.** Nothing is deployed and no DNS points anywhere. The
  Cloudflare Pages project does not exist yet and neither does the Supabase
  table.
- **The live database call.** `functions/api/waitlist.js` is tested against a
  stubbed `fetch`, not against Supabase. The first real signup is the first
  real test of the URL, the key, and the 409-on-duplicate behaviour.

## 2. The backend the form posts to, and why it has that shape

The browser posts to `/api/waitlist` on the **same origin**. A Cloudflare Pages
Function forwards the address to Supabase with a service role key that exists
only as a server-side secret.

The obvious cheaper design is to let the browser call Supabase directly with the
anon key. That was rejected: a direct call is a third-party request from a
visitor's device to `*.supabase.co`, which logs their IP, on a page whose whole
argument is that it contacts nobody. The extra hop is the point.

What is stored is **the address and the time**. Not the IP, not the user agent,
not a referrer, not a country. Cloudflare hands all of those to the function on
`request.cf` and the function deliberately never reads them. `db/waitlist.sql`
has one table with three columns and a comment saying so.

Counting signups is `select count(*) from waitlist_signups`, which is the
brief's answer to "no analytics".

### To make it live

1. Run `db/waitlist.sql` against the Supabase project.
2. Create a Pages project on the repo. Build `npm run build`, output `dist`.
3. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` as encrypted variables on
   both production and preview.
4. Point the domain at it.

If the variables are missing the form reports an error and logs one, rather
than silently dropping signups.

## 3. The privacy gap, which is the one thing blocking launch

**`legal/PRIVACY.md` does not describe the waitlist.** It covers email
addresses collected through Google or Apple sign-in inside the app. An address
typed into a website before the app exists is a different collection, for a
different purpose, in a different table.

The brief said to flag this rather than quietly add a vendor, so it was flagged
and not papered over. `Hidewire-web/LEGAL-GAPS.md` carries a proposed clause,
ready to paste into `legal/PRIVACY.md` once a human has read it. The site
meanwhile says the honest thing next to the button: one email, what it is for,
not sold, not shared, and how to have it deleted.

One trap in the proposed wording: it promises deletion when the beta opens.
**If that sentence is adopted, something has to actually delete the rows.** A
retention promise with no job behind it is worse than no promise at all.

`LEGAL-GAPS.md` also records four smaller things, none of which were changed:
`support@frame.game` on a site called hidewire.org, Terms section 7 saying
outright that it will change, British spelling in the legal text against
American on the site, and the 30 versus 45 minute round length.

## 4. Where the copy came close to a section 9 line

Three places. Worth reading, because the same three will come up again in every
piece of marketing.

**"Not a way to meet strangers"** is the one that needed the most care. The
brief says to state "invite codes only and never strangers". But CLAUDE.md
section 3 records that **the NEARBY tab knowingly crosses that line**: adults,
opted in, off by default, can see games nearby and ask to join. Writing "you
can only play with people you invite" would have been a claim the shipped app
contradicts, which is worse than saying less.

The published line is: *"A round starts from an invite code you send to your own
group. There is no matchmaking, and nobody is put into your game
automatically."* Both halves are true of the app as built, including NEARBY,
which is request-based and opt-in rather than matchmaking. **If NEARBY ever
widens, this sentence has to be revisited before the app ships, not after.**

**"Not private, and not permanent"** leads with the uncomfortable half on
purpose: your photos go to the Seeker, and the page says so before it says
anything reassuring. The 24 hour deletion and the "never enters match history"
promise follow. Reversing that order would have read as burying it.

**The check-in illustration is drawn, not photographed.** Two empty framed
rectangles with a hatched fill and a countdown, built in CSS. That sidesteps the
stock-photography trap in section 9 entirely: there is no image on this site of
a person hiding anywhere, so there is nothing to accidentally depict someone
crouched beside a road or on private property. It is also why the page has no
`og:image`; generating one means drawing it, and it should not be a photo.

Everything else was straightforward. The face recognition paragraph names the
actual measurements (brightness, blur, entropy, edge detail) rather than saying
"we respect your privacy", because the specific version is both more convincing
and harder to accidentally overstate.

## 5. Two judgment calls someone might disagree with

**Headings are set in IBM Plex Mono, not Space Grotesk.** The brief said
"Display type: Space Grotesk Bold for headings". `mobile/src/theme.ts` says the
opposite, in a comment block explaining that the app deliberately moved to mono
for everything including headings and kept Space Grotesk for three things that
are objects rather than text: the wordmark, large glanceable numerals, and the
BLACKED OUT screen. The brief also said the site must look like the same
product, and theme.ts is the newer decision, so the site follows theme.ts.
Space Grotesk appears in exactly two places: the HIDEWIRE wordmark and the
`00:47` countdown. **If this is wrong, it is one variable in `styles.css`.**

**The site says the round is 30 minutes.** PRD and BRIEF both say 45. CLAUDE.md
section 3 records 30 as the current product decision, and the app does 30.

## 6. Things that will cost time again

- **`preview_start` only reads `.claude/launch.json` from the primary working
  directory.** A config in the additional working directory is ignored. A
  `hidewire-web` entry was added to **this repo's** `.claude/launch.json`
  pointing at the other repo with `--prefix`. That file now has an entry for a
  project that is not in this repo, which looks wrong and is not.
- **The fonts were subset with `pyftsubset`**, installed into the scratchpad
  with pip, from the TTFs already sitting in `mobile/node_modules`. Latin plus
  a little punctuation takes three faces from 359 KB of TTF to 25 KB of woff2.
  The command is not committed anywhere: the woff2 files are committed instead,
  with their OFL licenses, because regenerating them needs Python tooling that
  is not otherwise a dependency of anything. If a fourth weight is ever needed,
  `pip install "fonttools[woff]" brotli` and run `pyftsubset` with
  `--flavor=woff2`.
- **`build.mjs` fails the build on an em-dash in the output**, and on any
  reference to a font CDN, Google Analytics, Tag Manager, Facebook, jsDelivr, or
  unpkg. It also refuses to parse a legal document containing a list, a table,
  or a code block, rather than silently dropping it. If someone adds a bulleted
  list to `legal/TERMS.md`, **the site build will fail** and the parser needs
  extending. That is deliberate: a legal document that silently loses a clause
  is the worse failure.
- **The legal Markdown is copied into the web repo**, at `content/terms.md` and
  `content/privacy.md`. They are byte-for-byte copies today. **Nothing keeps
  them in sync.** Editing `legal/` here does not change the site. A sync script
  or a submodule would fix it and neither was worth it for two files.

## 7. Outstanding, in dependency order

1. **Decide the waitlist privacy clause** (section 3). Blocked on Angad, and it
   blocks publishing the site.
2. Create the Supabase table and the Pages project, set the two secrets, point
   DNS. Blocked on Angad: it needs account access.
3. Send one real signup through and confirm the row lands and a second attempt
   answers "already on the list".
4. `/what-is-this`, the explainer a player can show a police officer or a
   security guard. The app has an offline version in `RoundChrome.tsx` and its
   QR code already points at `frame.game/what-is-this`, which **does not
   exist**. Either build it at hidewire.org and change the QR caption, or build
   it at frame.game. App Review will ask.
5. The POI complaint form, with the 15 day commitment the privacy policy
   already promises. Also an App Review requirement.
6. An `og:image`. Drawn, not photographed, per section 4 above.

Items 4 and 5 are why the build takes a `DOCS` array: a text page is one
Markdown file and one line in `build.mjs`.

## 8. Nothing in the app changed

No fixtures were added, so `TEST-FIXTURES.md` is untouched. The web repo has one
fake thing in it, a stubbed `/api/waitlist` used by the local preview server so
the form's states can be exercised without a database. It lives in `tools/`,
which is never deployed, and it is documented in that repo's README.

The only edit to this repo is the extra entry in `.claude/launch.json` described
in section 6.

---

## 9. The rebuild, same day

Angad's verdict on the first version: **"ugly and there's too much text."** Six
changes, all of them made. What follows is what changed, and the two places
where doing exactly what was asked would have created a problem.

### 9.1 What was asked, and what it looks like now

| Asked | Done |
|---|---|
| Remove "what it is not" | Gone. |
| Real screenshots in "how a round works", with animation | Three real captures of the app, driven out of a real round. Scroll reveals and a live countdown. |
| Emphasize the waitlist reward | Second thing in the hero, under the form. |
| Make it landscape | Two column at every section, desktop first. |
| Remove the email fine print | Gone. |
| The lede is too much, make it vague | "The future of getting outside with your friends." |

The layout question was the one that needed asking, and the answer was
**"the primary version is the desktop version"**, with a mobile version that
still works. So the hero is a two column landscape screen, the three beats are
alternating landscape rows, and everything stacks below 60rem.

### 9.2 The screenshots are real, and getting them was the whole afternoon

`Hidewire-web/tools/capture-shots.mjs` exports the app as a static web build,
drives a real Chrome through the **entire onboarding funnel**, hosts a round,
fills the party, acknowledges the safety card, starts the round, and waits out
a real five minute check-in window. Every image on the site came out of it.

Four things cost real time and will again:

- **The Bash tool cannot reach the preview servers.** They live in the harness
  and are invisible to a process started from a shell, so the first plan
  (point Puppeteer at `localhost:8095`) was dead on arrival. The fix is
  `npx expo export --platform web`, then serve the export to Chrome through
  request interception. No server, so nothing has to be reachable.
- **The export has to be `--dev`.** A production export refuses to boot with
  fixtures on, and without fixtures a party cannot reach three players.
- **The splash always routes into onboarding.** Seeding `localStorage` with a
  signed-in account skips nothing, so the script walks the funnel for real,
  including a **touch** tap on the age slider: it is built on the React Native
  responder system, and a synthetic mouse click does not move it.
- **Every tap in the lobby needs to be verified, not assumed.** It is a long
  scrolling view with a sticky footer, and a tap issued while it settles lands
  on whatever used to be there. `tapUntil` retries until the screen proves the
  tap landed. Three separate runs died on this before the helper existed.

### 9.3 Two places where the honest thing beat the asked-for thing

**The check-in screen is not photographed.** It is the one screen the whole
game is about, so it was the obvious thing to capture. On web the viewfinder is
a **procedural stand-in** (`CameraStage` falls back to `ProceduralPhoto`
because expo-camera has no useful web path). A screenshot of it would have put
an invented photo on a marketing page and presented it as somebody's real
check-in. `TEST-FIXTURES.md` exists to stop exactly that.

What the site shows instead is what happened when the headless player let the
window close: **BLACKED OUT**. Real screen, real round, no fake photograph, and
it carries the stakes better than a viewfinder would have. If a real check-in
screenshot is wanted, it has to come off a phone, which means Angad taking it.

**The lobby screenshot has one element hidden.** `ADD TEST PLAYERS` is only
there because `TEST_MODE` is on and does not exist in a shipping build. The
capture script hides it for that one frame and restores it immediately. That
makes the screenshot **more** representative of the real app, not less, but it
is a doctored screenshot and that is worth knowing. Everything else in all
three images is untouched.

### 9.4 The page now makes a promise it did not make before

"Everyone on this list gets a link to an exclusive in-game reward the day
Hidewire drops. Cosmetic, one time, and never offered again."

The word **cosmetic** is load bearing and should not be edited out for
brevity. A waitlist reward that affects a round is an advantage handed out for
an email address, which is the same problem as selling FILM, and
`marketing/BRIEF.md` section 9 rules it out. `LEGAL-GAPS.md` section 1a records
the three things that have to be true at launch for the promise to be kept, one
of which is that **something has to actually exist to send**.

There is also a quiet collision worth naming: the proposed privacy clause says
waitlist addresses are deleted when the beta opens, and the hero promises an
email when the game drops. Both can be true only if the email goes first.

### 9.5 What removing "what it is not" costs

The site no longer says anywhere that photos go to the Seeker, that there is no
face detection, that nothing purchasable helps you win, or that a round is
invite-code only. Angad's reason was that he does not want to promise anything
about the future, which is a reasonable call for a pre-launch page.

The rules in `BRIEF.md` section 9 are prohibitions on what may be **claimed**,
not requirements to claim anything, so saying less is safe. But the section was
also the page's best answer to a parent, a journalist, or an app reviewer
asking what this thing does with photographs of teenagers. When the app is
closer to shipping, it should come back as **statements about what the app
does**, checked against the app, rather than as promises.

### 9.6 One real bug, found by testing the thing the brief asked for

The reveal animation hid every section at `opacity: 0` and let JavaScript
reveal them. **With scripting off, that is not a static page, it is a blank
one**, and the brief says the site has to work with JavaScript disabled apart
from the form.

The fix is the standard one and worth remembering: `motion.js` loads in the
head **without defer** and its first act is to set a class on the document.
Every rule that hides anything is scoped to that class. No script, old browser,
or reduced motion means the class never appears and nothing is ever hidden.
There is also a 2.5 second failsafe, because a tab that is never composited
never fires an intersection callback, which is exactly what happens in a
headless or backgrounded browser.

Verified by rendering the built page with scripting disabled and comparing it
against the scripted render.

### 9.7 State of it

Verified with a real Chrome against the built output, at 1440x900 and 390x844:
hero, all three beats, the closing block, the footer, and both legal pages. The
ten endpoint tests still pass. The em-dash check is clean across the repo.

The page is now about **450 KB** built, of which 400 KB is three PNG
screenshots at 3x. They are not compressed or resized yet, and that is the
first thing to do if the page ever feels slow: `sips` on this machine can write
PNG and JPEG but not WebP, so either resize to 2x with `sips -Z` or add a real
encoder.

Everything in section 7 is still outstanding, unchanged: the privacy clause,
the Supabase table, the Pages project, DNS, `/what-is-this`, and the POI
complaint form.

---

## 10. Second rebuild, 2026-08-02

Angad again, five changes. The site is now a **scroll experience** rather than a
stack of sections, modelled on royal-pop-website.vercel.app: one phone stays
pinned while the copy moves past it and the screen inside it changes.

### 10.1 The scroller

Four steps: the lobby, the drop, the hunt, the check-in. Four real screenshots,
one per step, swapped under a sticky phone. The reference site does it by
fixing every section and cross-fading on scroll offset; this does it with an
IntersectionObserver and no scroll arithmetic at all, which is far less
fragile.

Two things that took a while to get right and will break again if touched:

- **The observer watches the copy, not the panel.** A panel is a full screen
  tall, so it enters the band long before its words do, and the phone would
  change while the previous step was still being read.
- **The band moves with the phone.** Centred phone on desktop, so the band is
  the middle of the viewport; pinned to the top on mobile, so the band moves
  down under it. The first mobile attempt had paragraphs sliding across the
  screenshot at 20% opacity, which reads as a rendering fault.

There is also a CSS ordering trap: the mobile override of `.panel-copy` opacity
has the same specificity as the desktop rule, so it only works because it comes
later in the file. Moving it back up the stylesheet silently breaks mobile.

### 10.2 Type: the site and the app now disagree, on purpose

Angad said the type was hard to read. It was: everything was IBM Plex Mono,
because `theme.ts` made mono the app's base face and section 5 of this handoff
followed it.

The site is now **Space Grotesk** at 400 and 700, with IBM Plex Mono kept for
the letterspaced caps label only. That is the split `marketing/BRIEF.md` asked
for in the first place. Mono at paragraph length on a 1440 pixel screen is a
different problem from mono in a 390 pixel app, and the site should be readable
before it is consistent with the app.

### 10.3 The mark is on the page now

`brand/frame-mark.svg`, fetched from the app repo on GitHub to confirm it
matched the local copy, with the background plate stripped so it sits on any
surface. It is in the header and the footer. The CSS bracket frame that used to
box the wordmark is gone: the mark already has viewfinder brackets in it and
two sets read as a mistake.

### 10.4 "Cosmetic, one time, and never offered again" was removed

Angad's call, as clutter. `LEGAL-GAPS.md` section 1a records it, because the
constraint has not gone anywhere even though the sentence has: a waitlist
reward that affects a round is an advantage handed out for an email address,
which BRIEF section 9 rules out. **The page no longer says the reward is
cosmetic, so the reward itself has to be.**

### 10.5 The duplicate signup bug was in the dev stub

Angad entered his address twice and was told he was added twice. Worth being
precise about what was broken, because the headline reading of it is wrong:

**Nothing is deployed.** There is no Supabase table and no Pages project, so
what he tested was `tools/serve.mjs`, the local preview stub, which was
stateless and returned `added` for everything except two hardcoded addresses.
The real endpoint was never wrong about this.

Both halves are now fixed:

- The stub keeps a small file of addresses it has seen, so a second signup
  answers `known` locally exactly as it will in production. Verified in a
  browser: same address twice, and again in upper case, all three answering
  correctly.
- The real endpoint no longer trusts HTTP 409 alone to mean "duplicate". It
  also treats a Postgres `23505` in the response body as one, because PostgREST
  has reported unique violations under different statuses across versions, and
  a repeat signup surfacing as a server error is a bad first impression on the
  one interaction this page has. Two new tests cover it: twelve passing.

### 10.6 Still true

Nothing about the deployment has changed. The privacy clause, the Supabase
table, the Pages project, DNS, `/what-is-this` and the POI form are all still
outstanding, and the first real signup is still the first real test of the
database path.

The page is now about **710 KB** built, of which roughly 500 KB is four
screenshots at 3x. Compressing them properly still needs an encoder this
machine does not have.
