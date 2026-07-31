# The calibration shoot, step by step

[README.md](README.md) lists what the photos are *for*. This file is the thing
you actually follow while holding a phone. It is written to be done in three
short trips totalling about **50 photos and roughly 45 minutes**, not as one
long project.

If you only ever do one part, **do Trip B and the repeat series**. Everything
else can be approximated. Those two cannot.

---

## 0. Phone setup, five minutes, and it matters more than the shot list

The app does not use your camera app. It uses `expo-camera` at default
settings, with no computational photography of any kind. If you calibrate
against photos your camera app has quietly improved, every threshold comes out
wrong in the same direction: too strict, and honest players get eliminated.

On the Android camera app, before you shoot anything:

- **Night mode / Night Sight: OFF.** This is the big one. Night mode stacks
  several seconds of exposure into one bright, clean image. The app cannot do
  that, so a night-mode photo tells me nothing about what the app will actually
  see at night, which is the single hardest case in the set.
- **Scene optimiser / AI enhancement: OFF.**
- **Motion photo: OFF.**
- **Picture format: JPEG**, not HEIC or RAW.
- **Flash: OFF**, and leave it off all night. The app never fires the flash.
- **Stay in the normal Photo mode.** No Portrait, no Pro, no Panorama.
- Wipe the lens once. A smeared lens is a real failure mode, but I want it in
  `fail/` on purpose rather than contaminating every shot in `pass/`.

Shoot **normally**. Do not brace the phone, do not line the shot up carefully,
do not retake one you did not like. A curated set of nice photographs is the
one thing that would make this whole exercise useless.

---

## 1. Naming, so I can tell the groups apart

Put each photo in the right folder and name it with the scene keyword and a
number:

```
calibration/pass/garage_1.jpg
calibration/pass/garage_1_front.jpg
calibration/fail/thumb_2.jpg
calibration/repeat/still_3.jpg
```

Two rules only:

- The keyword is the **bold word** in the lists below.
- Add `_front` if it was the front (selfie) camera. No suffix means back
  camera.

If the naming falls apart halfway through, do not stop shooting. Unnamed
photos in the right folder are still useful. Photos in the wrong folder are
not, so the folder is the part to get right.

---

## 2. Both cameras, but only where it is cheap

The README says shoot every scene with both cameras. In practice that doubles
a 25 photo job into a 50 photo job and it is why this has not happened yet.

**Shoot the front camera on these six only:**

- `night_nolight`, `night_streetlight`, `dusk` (front cameras are noisier and
  slower, and this is exactly where a false rejection would happen)
- `wall_close` and `garage_door` (the pair that separates a blank surface from
  a real one)
- one `still` from the repeat series

For every other scene the back camera alone is fine.

**One deliberate extra:** take two front-camera shots where **your head fills
most of the frame**, close up, in a dim spot. Name them `headfill_1_front.jpg`
and put them in `pass/`. A player checking in from a tight hiding spot produces
exactly this, and it has genuinely low edge density, so it is the most likely
false rejection in the entire product. I never run face detection on it, that
is a hard constraint, but the whole-image statistics still move and that is
what I am tuning.

---

## 3. Trip A: daylight, about 15 minutes, 14 photos

Go outside in normal daylight. Anywhere with a bit of urban texture.

| # | Shot | Keyword | Folder |
|---|---|---|---|
| 1-2 | An alley, or beside a bin store or dumpster | `alley` | `pass/` |
| 3-4 | Under a stairwell, or under any overhang | `stairwell` | `pass/` |
| 5-6 | Inside a parking garage, mid-level, away from the entrance | `garage` | `pass/` |
| 7-8 | In or behind a bush or hedge, lens partly obstructed by leaves | `bush` | `pass/` |
| 9-10 | Inside a shop, lobby, or station concourse | `indoor` | `pass/` |
| 11-12 | Direct midday sun, pointing roughly toward the bright side | `noon` | `pass/` |
| 13-14 | A large flat garage door or blank wall from **normal standing distance**, three or four metres back | `garage_door` | `pass/` |

Shots 13 and 14 matter more than they look. They are half of a pair: this one
must pass, and the close-up wall in Trip C must fail. The gap between those two
numbers is the entire `entropyMin` and `edgeDensityMin` calibration. If I only
have one side of it I am guessing.

Add front-camera versions of 13 and 14.

---

## 4. Trip B: dusk into dark, about 25 minutes, 14 photos

**This is the trip that matters.** Start about 20 minutes before sunset and
stay out until it is properly dark. Night mode still off.

| # | Shot | Keyword | Folder |
|---|---|---|---|
| 1-3 | Outdoors at dusk, ordinary street, no artificial light on the subject | `dusk` | `pass/` |
| 4-6 | At night, standing under a streetlight | `night_streetlight` | `pass/` |
| 7-10 | At night, **away from any light source.** A park path, a car park corner, a garden. As dark as you can find while still being somewhere safe and public | `night_nolight` | `pass/` |
| 11-12 | At night, in a doorway or recess with light spilling in from one side | `night_edge` | `pass/` |
| 13-14 | The two `headfill` front-camera shots from section 2, taken here in the dark | `headfill` | `pass/` |

Front camera as well for `dusk`, `night_streetlight`, and `night_nolight`.

`night_nolight` is the hardest case in the entire set and the one I am most
likely to get wrong. The current `darkMax` is 15/255, which is a guess. If real
night captures come in below it, then every honest player hiding in the dark,
which is the correct way to play this game, gets a `too_dark` rejection and is
blacked out for doing the right thing. That is the worst failure this product
can have and these four photographs are the only thing standing between the
current code and shipping it.

Take more than four if you pass more dark spots. There is no such thing as too
many of these.

---

## 5. Trip C: the fail set, about 10 minutes, indoors, 15 photos

These can all be done at home in one sitting. They teach the validator where
the floor is, and without them it has no idea what a cheat looks like.

| # | Shot | Keyword | Folder |
|---|---|---|---|
| 1-2 | Thumb or finger completely covering the lens | `thumb` | `fail/` |
| 3-4 | Phone face down in a pocket or a bag, shoot blind | `pocket` | `fail/` |
| 5-6 | A blank interior wall **close up**, 20 to 30 cm away, filling the frame | `wall_close` | `fail/` |
| 7-8 | Pointed straight up at open sky, nothing else in frame | `sky` | `fail/` |
| 9-11 | A photo **of a screen** showing another photo. Put an image up on your laptop and photograph the laptop. This is the re-shoot cheat and it is the one people will actually try | `screen` | `fail/` |
| 12-13 | Deliberate motion blur. Whip the phone sideways as the shutter fires | `motion` | `fail/` |
| 14-15 | Completely dark room, lights off, curtains shut | `dark_room` | `fail/` |

Front camera on `wall_close` as well.

The `screen` shots are the most valuable three in this folder. Photographing a
screen is the cheapest possible cheat, and moire plus backlight give it a very
distinctive signature, but only if I have examples of it.

---

## 6. The repeat series, about 5 minutes, 9 photos

**This is the one people skip and it is the one I cannot work around.** It
calibrates the pHash reuse check, and there is no way to derive it
synthetically because it depends entirely on how much a real phone's output
drifts when a real person stands still.

Pick one spot, ideally one you would actually hide in, and do not walk anywhere
until step 3.

1. **Stand basically still and take 4 photos over about 2 minutes.** Lower the
   phone between each one. Small natural drift only. This is what an honest
   player who found a good spot does. Name them `still_1` to `still_4`.
2. **From the same spot, turn 30 to 45 degrees between each** and take 3 more.
   Name them `turn_1` to `turn_3`.
3. **Walk about 20 metres, then take 2 more.** Name them `moved_1` and
   `moved_2`.

Front camera on one of the `still` shots.

What this decides: `phashMinDistance` is currently 6, which is a guess. Set it
too low and someone can resubmit a photo they took ten minutes ago. Set it too
high and the `still_1` to `still_4` series reads as the same image, and a
player who found a genuinely good hiding spot and sensibly stayed in it gets
rejected for reusing a photo. The distance between the `still` group and the
`moved` group is literally the number I need.

Do this series **twice** if you can, once in daylight and once at night. Name
the second set `still_n_1` and so on. Sensor noise at night moves the hash much
more than it does in daylight, and if I only calibrate on the easy case the
night threshold will be wrong.

---

## 7. Getting them onto the Mac without wrecking them

**This step can silently ruin the whole shoot**, so it is worth the two
minutes.

Every one of these destroys the photo for calibration purposes:

- WhatsApp, iMessage, Instagram, Signal, Messenger. All recompress hard and
  strip EXIF.
- Google Photos, and anything that says "optimise storage".
- Screenshotting a photo instead of copying it.
- Sharing "as a photo" rather than "as a file" from any app.

These are all fine:

- **USB cable.** Plug the phone into the Mac, allow file transfer on the phone,
  copy from `DCIM/Camera`. Nothing touches the bytes.
- **Google Drive**, uploading the actual files, then downloading them on the
  Mac. Drive does not recompress.
- **`adb pull`** if you have platform tools installed.

Then drop them into `calibration/pass`, `calibration/fail`, and
`calibration/repeat`. Nothing in those folders is committed to git; the
`.gitignore` blocks everything except the two markdown files, because these are
photographs of real places you have been.

---

## 8. The checklist

Print this, or just tick it off in your head.

- [ ] Night mode, scene optimiser, motion photo, flash all off. Format JPEG.
- [ ] Trip A, daylight, 14 photos into `pass/`
- [ ] Trip B, dusk to dark, 14 photos into `pass/`, including four in real
      darkness
- [ ] Trip C, indoors, 15 photos into `fail/`, including three of a screen
- [ ] Repeat series, 9 photos into `repeat/`, named `still` / `turn` / `moved`
- [ ] Repeat series again at night if you can
- [ ] Front camera versions of `dusk`, `night_streetlight`, `night_nolight`,
      `wall_close`, `garage_door`, one `still`, and the two `headfill` shots
- [ ] Transferred by cable or Drive, not by a messaging app
- [ ] Tell me which phone it was. Different sensors have different noise
      floors and I will tune per device if I have to.

---

## 9. What happens after you drop them in

I read every file off disk, run each one through the real decode and
`computeSignals()` pipeline, and print a table of `meanLuminance`,
`blurVariance`, `entropy`, `edgeDensity` for the whole set. Then the thresholds
are chosen as the widest gap that separates `pass/` from `fail/`, biased
deliberately toward letting a cheat through rather than eliminating an honest
player, because a false elimination is unrecoverable and a false accept costs
one round.

The `repeat/` series gets its own pass: Hamming distances within `still`,
within `turn`, and between `still` and `moved`, which gives `phashMinDistance`
directly.

If the set turns out not to separate cleanly, that is a genuine finding rather
than a failure, and it means a signal needs replacing rather than retuning. I
would rather learn that from 50 photographs now than from players later.
