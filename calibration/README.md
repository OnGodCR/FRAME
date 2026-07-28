# Validator calibration photos

Drop photos in here. **AirDrop from your phone straight to this folder** — no
cloud upload needed, I read them off disk. Nothing in here is committed to git
(these are photos of real places, and the `.gitignore` blocks everything but
this file).

```
calibration/
  pass/     photos that SHOULD be accepted
  fail/     photos that SHOULD be rejected
  repeat/   same-spot series — see §3, this one is easy to skip and shouldn't be
```

## 0. Rules that matter more than the shot list

- **Straight from the camera app.** Not screenshots, not re-saved, not sent
  through WhatsApp/Instagram/iMessage — those recompress and destroy exactly the
  high-frequency detail the blur and edge-density checks measure. AirDrop,
  a USB cable, or Google Drive all preserve the original.
- **Keep EXIF.** I need the capture timestamp, and exposure/ISO helps a lot for
  tuning the dark threshold. AirDrop preserves it; some upload paths strip it.
- **Both cameras.** Shoot each scene with the back camera *and* the front
  camera. Front cameras have different sensors, wider apertures, and more noise.
  A front-camera shot where your head fills the frame has genuinely low edge
  density, which is the exact shape of a false rejection I need to guard
  against. (I never run face detection — that's a hard constraint — but the
  whole-image statistics still shift, and that's what I'm tuning.)
- **Don't clean up the set.** Blurry, awkward, badly framed real shots are the
  data. A curated set of nice photos teaches me nothing.
- Note which phone in the filename or just tell me. Different sensors, different
  noise floors.

## 1. `fail/` — should be rejected

These teach the thresholds where the floor is. ~3 each:

- Thumb or finger fully over the lens
- Phone face-down in a pocket / bag (shoot blind)
- Pointed at a blank interior wall, close up
- Pointed straight up at open sky
- A photo **of a screen** showing another photo (the re-shoot cheat)
- Deliberate motion blur — whip the phone while the shutter fires
- Completely dark room, lights off

## 2. `pass/` — should be accepted

Real hiding spots. **The dim ones are the whole point** — that's where a naive
luminance threshold eliminates someone who did nothing wrong, and it is the
single worst failure this product can have. ~4 each:

- Behind a dumpster or in an alley, daytime
- Under a stairwell
- Inside a parking garage (usually dim and evenly lit — a nasty case)
- In or behind a bush / hedge
- **Dusk, outdoors** ← critical
- **Night, under a streetlight** ← critical
- **Night, away from any light** ← the hardest case in the entire set
- Bright direct noon sun (tests the *over*-exposure ceiling)
- Indoors in a shop or lobby
- Against a large flat surface like a garage door or wall, but at a normal
  distance — this should pass where the close-up wall shot fails, and the gap
  between those two is what I'm looking for

## 3. `repeat/` — the one people skip, and shouldn't

This calibrates the **pHash reuse check**, and without it I will either let
cheaters resubmit old photos or eliminate honest players who stood still.

Pick one spot and, without walking anywhere:

1. Take **4 photos over ~2 minutes**, standing basically still. Small natural
   drift only — this is what an honest player who found a good spot actually
   does.
2. Take **3 more from the same spot** but turned 30–45° each time.
3. Then walk ~20 m and take **2 more**.

Name them so I can tell the groups apart — `still_1..4`, `turn_1..3`,
`moved_1..2` is plenty.

The PRD sets the reuse threshold at Hamming distance < 6. I need to measure
what "same spot, didn't move" actually scores. If honest consecutive check-ins
land under 6, that threshold eliminates innocent players and has to move.

## 4. How much

Roughly **50–70 photos total**. Quantity per condition matters more than the
total — five night shots are worth more than twenty daytime ones, because the
daytime cases are never in doubt.

If you only have time for part of it, do this in order:
**`repeat/` first**, then the night/dusk entries in `pass/`, then `fail/`.
Everything else I can reason about; those three I can't.
