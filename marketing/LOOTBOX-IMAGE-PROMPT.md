# Nano Banana prompt: the Hidewire loot box

The still comes first; the animation is planned around it, so the still has to
be built so it can move later. Section 3 is the part that matters for that and
it is the part most easily skipped.

---

## 1. The prompt

Paste this as-is.

> A single hero product render of a sealed metal film canister, floating
> centred against a near-black void. Photographic darkroom equipment aesthetic,
> not fantasy, not a treasure chest.
>
> The canister is a squat cylindrical 35mm film tin, brushed gunmetal with
> visible machining marks and a faint scuff along one edge, sealed with a
> matte black lid. A thin seam of intense acid-yellow-green light escapes from
> under the lid all the way around, as if the container is holding light in
> rather than storing an object. That escaping light is the only light source
> in the image: it throws a tight glow onto the top edge of the canister and
> fades to nothing within a short distance, leaving the background pure black.
>
> Four sharp right-angle corner brackets in the same acid-yellow-green frame
> the canister, one at each corner, floating clear of it, like a camera
> viewfinder marking a shot. The brackets are thin, hard-edged, and perfectly
> square. They do not touch the canister.
>
> The label wrapped around the canister is blank matte black with fine mono
> typography implied but unreadable, no legible words.
>
> Studio product photography, single dramatic rim light, deep shadow, subtle
> film grain over the whole image, slight chromatic aberration at the edges of
> the glow. Colour palette strictly limited to near-black, cool grey metal, and
> one acid-yellow-green accent. No other colours. No gold, no purple, no blue,
> no rainbow, no sparkles, no gems, no coins, no confetti, no treasure chest,
> no fantasy ornament.
>
> Centred composition, square 1:1, generous empty space around the subject,
> object occupying roughly 60 percent of the frame. Photorealistic, sharp
> focus, high detail.

**Accent colour:** `#C8FF2E`. Nano Banana will not take a hex reliably, so the
prompt describes it. Check the output against that value and regenerate if it
drifts warm or lime.

---

## 2. The four tiers

Same prompt, one substitution each, so the set reads as one family. Generate the
base first and get it right before doing the variants.

| Box | Swap into the prompt |
|---|---|
| DEVELOPING TRAY, 1,000 | "plain steel canister, matte and slightly dull, the escaping light seam thin and dim" |
| CONTACT SHEET, 3,000 | "the canister wrapped in a band of exposed film negative strip, sprocket holes catching the light" |
| SILVER RESERVE, 5,000 | "polished silver canister with a mirror finish reflecting the glow, seam brighter and wider" |
| VAULT NEGATIVE, 10,000 | "heavy blackened steel canister with a recessed rotary lock ring, the light seam intense and pulsing white-hot at its brightest points" |
| FIRST LIGHT CASE, paid | "the lid partially lifted, a single hard blade of acid light cutting upward out of the gap into the darkness above" |

FIRST LIGHT is the only one that opens. It is the only paid box, and it should
be the only one that looks like it is already giving something up.

---

## 3. Build it so it can move

The animation is next and these choices are expensive to retrofit.

- **Ask for the canister dead centre**, on its own, with clear space all round.
  A composition that crops the object cannot be rotated or scaled later.
- **Get a version on true black**, not near-black. `#000000` composites onto
  the app background without a visible plate edge. Ask for a transparent
  background too if the tool will give one.
- **Generate the closed and open states of FIRST LIGHT from the same seed**, so
  the lid is the only thing that changes. That difference is the whole opening
  animation.
- **Keep the glow as a separate concern.** Ideally get one pass with the seam
  unlit. The glow then becomes a layer that can be animated on its own, which is
  how the box gets a breathing idle without re-rendering anything.
- **Square, and at least 2048px.** It has to survive a full-bleed reveal on a
  tall phone.

The intended animation, so the still can be judged against it: slow breathing
pulse on the light seam at rest, then on open the seam flares, the lid lifts and
tilts away, the corner brackets snap outward, and the item rises out of the
light. Roughly 1.2 seconds.

---

## 4. Things to reject

Regenerate rather than accept any of these. The first three are brand, the last
two are legal.

- Anything that reads as a **treasure chest, crate, or present**. This is a
  photographic product, and the entire visual language is darkroom equipment.
- **Any second accent colour.** The palette is black, grey metal, and acid.
- **Legible text**, which image models get wrong and which would then have to
  be localised.
- **Slot machine, casino, dice, or jackpot imagery.** Loot boxes carry a live
  regulatory question about whether they are gambling, and volunteering the
  visual association is a bad idea in a product that 13 year olds can install.
  See [monetization/LOOT-BOXES.md](../monetization/LOOT-BOXES.md).
- **Anything implying a guaranteed or spectacular reward**, like an overflowing
  container or a golden burst. The odds are published; the art should not
  contradict them.

---

## 5. Where it goes

Store tab, at `mobile/assets/boxes/<box-id>.png`, matching the ids in
`mobile/src/data/lootboxes.ts`. Register it in
[TEST-FIXTURES.md](../TEST-FIXTURES.md) if a placeholder ships before the final
art, per CLAUDE.md 7.1.

The odds table has to be reachable from wherever this image appears, **before**
the purchase, not after. Apple has required that since 2017 and Google Play
since 2019.
