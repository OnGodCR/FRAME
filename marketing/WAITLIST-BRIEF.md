# Prompt: build hidewire.org, the waitlist page

Paste everything below this line as the opening message to the agent building
the site. It is written to be self-contained: an agent reading only this file,
plus the four repo files it names, should be able to ship without seeing the
app.

---

## The job

Build the public website for **Hidewire** at `hidewire.org`. It is a single
static site with three routes and one job: collect waitlist signups without
promising anything the product cannot do.

```
/            the waitlist page
/terms       the Terms of Service
/privacy     the Privacy Policy
```

Ship it as a static build (plain HTML/CSS/JS, or Astro/Eleventy if you prefer a
generator). No framework is required and none is expected. It has to work with
JavaScript disabled apart from the signup form itself.

## What Hidewire is, in one line

Hide and seek for adults and teenagers, played across a real city, where hiding
well is not enough, because every few minutes your phone makes you photograph
where you are hiding and sends it to the person hunting you.

## The 30 second version, for the page copy

A private group of 3 to 20 friends starts a round with an invite code. One
person is the Seeker. Everyone else scatters across a zone, typically a
kilometre across, and has to survive 30 minutes.

The twist is the **check-in**. On a timer the group agrees in advance, every
hider's phone goes off and they have 60 seconds to take two live photos, back
camera then front camera, of exactly where they are hiding. Those photos go
straight to the Seeker's feed. Miss the window, or fail the validity checks,
and you are **BLACKED OUT**: eliminated, publicly, in a way the game treats as
more humiliating than simply being caught.

Meanwhile the Seeker gets everyone's position, but only on a slow timer and
only for a few seconds at a time. The zone shrinks in the last third.

Read [BRIEF.md](BRIEF.md) for the full positioning, the voice, and the audience
before writing a word of copy. Read its section 9 twice.

## Read these four files first

| File | Why |
|---|---|
| [`marketing/BRIEF.md`](BRIEF.md) | Positioning, voice, audience, and section 9, the claims that are legally off-limits. |
| [`legal/TERMS.md`](../legal/TERMS.md) | The Terms. Publish as `/terms`. |
| [`legal/PRIVACY.md`](../legal/PRIVACY.md) | The Privacy Policy. Publish as `/privacy`. |
| [`mobile/src/theme.ts`](../mobile/src/theme.ts) | The exact palette and type stack. Do not invent new brand colours. |

## Brand

Taken from the app, and the site must look like the same product.

```
bg          #0A0A0C      surface     #121215      surface2   #1A1A1F
line        #232329      lineBright  #2E2E36
text        #F4F4F2      dim         #9A9AA3      faint      #5C5C66
accent      #C8FF2E      accentDim   #5E7A0E
danger      #FF4438      warn        #FFB020
```

- **Dark only.** There is no light theme in the product and there should not be
  one on the site.
- **Display type: Space Grotesk**, Bold for headings, Medium for subheads.
- **Body and all small caps type: IBM Plex Mono**, Regular / Medium / SemiBold.
  The app uses mono for nearly all supporting text, with wide letter spacing on
  anything set in caps. Match that.
- **Self-host both fonts.** Do not load Google Fonts from a CDN: the Privacy
  Policy has to be true, and a font CDN is a third-party request that logs the
  visitor's IP on every page view.
- **The corner-bracket motif is the logo lockup.** Four acid-coloured
  right-angle brackets around the wordmark, as if framing a shot. See
  `Brackets` in `mobile/src/components/ui.tsx`. The wordmark is `HIDEWIRE`,
  uppercase, wide tracking.
- Accent is used sparingly and always means "this is the thing to act on". If
  everything is acid green, nothing is.

## The waitlist page

One screen of real content, then supporting sections. In order:

1. **The lockup and the line.** `HIDING ISN'T ENOUGH. PROVE IT.` is the app's
   own splash copy and should be the hero.
2. **The signup form.** Email only. One field, one button. No name, no age, no
   city, no "how did you hear about us". Every extra field is data you then
   have to justify in the Privacy Policy and protect forever.
3. **How a round works**, the three-beat explanation above. Consider showing
   the check-in as the centrepiece, because it is the only thing about this
   game nobody has seen before.
4. **What it is not**, stated plainly. This section is unusual and it should
   stay: it is where the safety and privacy posture becomes a feature rather
   than fine print. Cover: invite codes only and never strangers, no face
   recognition of any kind, photos are deleted 24 hours after the round, and
   the seeker role cannot be bought.
5. **Footer** with links to `/terms`, `/privacy`, and a contact address.

## Claims that are legally off-limit

`BRIEF.md` section 9 is the authority and it is not a style guide, it is a list
of things that create real exposure. The short version:

- **Never imply the app recognises faces or identifies people.** It does not
  and cannot: the photo checks measure brightness, blur, entropy, and edge
  detail on the whole image. Saying otherwise invites a biometric privacy claim
  under BIPA and its equivalents.
- **Never imply you can play with strangers.** Invite code only.
- **Never depict or suggest** trespassing, hiding on private property, hiding
  near roads or train tracks, or playing in a vehicle. No stock photography of
  someone crouched behind a car on a road, however good it looks.
- **Do not claim that nothing purchasable affects a round.** That was true and
  is not any more. What is still true and worth saying: the seeker role cannot
  be bought, because bidding spends only earned FILM; utility items are capped
  at one use per round; and nothing is purchase-only.
- **Never promise the photos are private.** They go to the Seeker. Say so
  plainly. What you can promise is that they are deleted 24 hours after the
  round ends and never enter match history.
- **Never use surveillance framing.** The game is consensual and the photos are
  of places, not people. Keep the language there.

One more, specific to a waitlist page: **do not put a launch date on it.** There
isn't one.

## The legal pages

Convert `legal/TERMS.md` and `legal/PRIVACY.md` to styled HTML. Requirements:

- **Do not rewrite the substance.** Convert the Markdown, restyle it, and leave
  the wording alone. If something reads badly, flag it in your summary rather
  than editing it.
- Keep a visible **"last updated"** date and a stable anchor id on every
  heading, so a specific clause can be linked to.
- Both files carry a banner in the repo saying they are drafts that have not
  been reviewed by a lawyer. **Keep an equivalent notice visible on the live
  pages** until that review has happened. Publishing an unreviewed policy while
  implying it is settled is worse than publishing it honestly.
- Long legal text needs to be readable: cap the measure around 70 characters,
  and give it a table of contents.

## The signup form, and the privacy trap in it

The audience includes **13 to 17 year olds**. That is a deliberate product
decision and it constrains this page more than anything else on it.

- **No analytics, no tracking pixels, no third-party embeds, no ad network
  tags.** Not Google Analytics, not Meta Pixel, not a heatmap tool. If signup
  numbers are needed, count them server side from the signups themselves.
- **No cookie banner, because there should be no cookies to consent to.** If you
  find yourself needing a consent banner, you have added something that should
  come back out instead.
- Whatever backend stores the emails, the Privacy Policy must already describe
  it. If it does not, say so in your summary rather than quietly adding a
  vendor.
- The form needs a plain sentence next to the button saying what the email will
  be used for and that it will not be sold or shared. One sentence, not a
  disclosure blob.
- Handle the empty, invalid, duplicate, and success states. A form that silently
  does nothing on a duplicate signup reads as broken.

## Accessibility and performance

- Real semantic HTML. One `h1`, headings in order, a labelled form input, a
  `main` landmark, visible focus rings.
- Colour contrast: `dim` on `bg` is fine for body text, `faint` is not. Use
  `faint` only for genuinely secondary marks.
- Respect `prefers-reduced-motion` on anything that animates.
- Should load fast on a phone on mobile data. No web fonts beyond the two
  families, no hero video, no bundle over a couple of hundred KB.

## Two things also needed on this domain, later

Not part of this job, but design the site so they can be added without a
redesign. Both are Apple App Review requirements before the app can ship:

- **A POI complaint form**, where a business or property owner can ask to have
  a location removed from the game, with a stated 15 day removal commitment.
- **A public explainer page** that a police officer or a security guard can be
  shown by a player who has been stopped and asked what they are doing. The app
  already has an in-round version of this in
  `mobile/src/components/RoundChrome.tsx`; the web version should say the same
  thing.

## House style

- **No em-dashes anywhere**, in copy, comments, or commit messages. Use commas,
  colons, parentheses, or a full stop. This is a standing rule across the whole
  repo and it is checked.
- British or American spelling, pick one and hold it. The app currently mixes,
  so American is the safer default for a US launch.
- Sentence case for headings, not Title Case. Caps are reserved for the mono
  labels.

## What to hand back

The site, plus a short summary covering: what you built, anything in the legal
Markdown that you think needs a human to look at it, any place where the copy
came close to one of the section 9 lines and how you steered around it, and the
exact backend the form posts to.
