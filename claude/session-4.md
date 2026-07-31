# Hidewire: session 4 handoff

Written 2026-07-31. This session did not touch the app. It built
**hidewire.org**, the public waitlist site, in the separate `Hidewire-web`
repository (`github.com/OnGodCR/Hidewire-web`, which had no commits before
today). Read [session-3.md](session-3.md) for the state of the app itself.

The brief was `marketing/WAITLIST-BRIEF.md`, which is untracked in this repo and
should be committed alongside this file.

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
