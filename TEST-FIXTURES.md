# FRAME: test fixtures and simulated data

**Everything in this document is fake.** It exists so the app can be reviewed
without a backend, without four friends, and without a real camera. None of it
survives contact with a server.

Keep this current. When you add a fixture, add it here in the same commit.
When you replace one with real data, strike it here in the same commit.

Related: [CLAUDE.md](CLAUDE.md) 7 explains that there is no backend at all, which
is why so much of this exists.

---

## 1. How to spot a fixture in the app

Two conventions, both deliberate:

- **Simulated players are tagged `TEST`** in the lobby roster. A simulated name
  must never be able to pass for a person.
- **Nothing simulated arrives on its own.** The lobby starts empty and fills
  only when the host taps ADD TEST PLAYERS. This is a hard rule: unbidden
  arrivals read as stranger matchmaking, which the splash screen and
  marketing/BRIEF.md 9 both rule out.

---

## 2. Fixture inventory

| What | Where | Replaced by |
|---|---|---|
| Simulated party members | `SIM_SCHEDULE`, `screens/JoinLobby.tsx` | Realtime party channel |
| Bot hiders and the seeker | `HIDER_BOTS`, `SEEKER_BOT`, `engine/GameContext.tsx` | Real round rosters |
| The whole round timeline | `hiderScriptAuthored`, `seekerScriptAuthored`, `engine/GameContext.tsx` | Server tick worker |
| Invite code `7KFMQ2` | `partyCode`, `engine/GameContext.tsx` | Server-issued party codes |
| Friend directory | `DIRECTORY`, `data/friends.ts` | `profiles` table lookup by code |
| Global leaderboard ladder | `GLOBAL_LADDER`, `data/leaderboard.ts` | Ranked query on season XP |
| Friend feed captures | `ProceduralPhoto` seeds in `screens/Friends.tsx` | R2 photo URLs |
| Seeker proof feed photos | `round.photos`, `engine/GameContext.tsx` | Real uploads |
| All camera output on web | `components/CameraStage.tsx` fallback | Nothing: native uses the real camera |
| Rival seeker bid | `RIVAL_BID`, `screens/JoinLobby.tsx` | Real bids from the party |
| Baked Seattle world | `data/world.json` | Live Overpass fetch, already works |

---

## 3. Friend codes that resolve in this build

Entering any other code correctly returns "No player with that code".

| Code | Handle | Level | Season XP | Posted today |
|---|---|---|---|---|
| `KAY2XQ7M` | KAI | 9 | 8,420 | yes |
| `MAYA5TRW` | MAYA | 12 | 11,930 | yes |
| `DEV77KPZ` | DEV | 6 | 5,210 | no |
| `JUKE3NBH` | JULES | 15 | 14,680 | yes |
| `ARN9WQDF` | ARI | 4 | 3,140 | no |

These double as referral codes.

**Codes use a restricted alphabet** (`ABCDEFGHJKMNPQRSTUVWXYZ23456789`): no
I, L, O, 0, or 1, because codes get read aloud and typed by hand. An earlier
version of `normaliseCode` tried to "correct" confusable characters and instead
rewrote valid codes into different ones, so a correctly typed code failed to
match. It now only uppercases and strips punctuation. **Any fixture code must
use only alphabet characters** or it can never be entered successfully.

---

## 4. Your own friend code

Generated once per install and stored locally. It is random, so it differs on
every device and after every RESET PROGRESS. It resolves for nobody, because
the directory above is the only lookup that exists.

---

## 5. Simulated party arrivals

`SIM_SCHEDULE` in `screens/JoinLobby.tsx`, in seconds after ADD TEST PLAYERS:

| Offset | Name |
|---|---|
| 0 s | KAI (the seeker bot) |
| 1 s | MAYA |
| 2 s | DEV |
| 3 s | JULES |
| 4 s | ARI |

Each is READY two seconds after arriving. Minimum party is 3, maximum 6.

---

## 6. The round is entirely scripted

There is no opponent. `engine/GameContext.tsx` runs a fixed script:

- **Check-ins** fire at 5, 10, 15, 20, and 25 minutes, the real PRD 4.2 spacing.
  The window is 60 real seconds.
- **Ambient events** (a bot passing a check-in, a beacon being claimed, a zone
  contraction) were authored against an older 250 second compressed round and
  are **rescaled at module load** to spread across the full 30 minutes. See
  `rescale()`.
- **The seeker's BLE proximity** ramps on a timer, not on real Bluetooth.
- **Tagging** always succeeds when proximity is high enough.

`DEV_TIME_SCALE` speeds the clock up for review. **It ships at 1** and must
stay there.

---

## 7. Progression fixtures

`DEMO_SEED` in `engine/GameContext.tsx` is **false** and must ship false.

When true it starts an account at level 7 with 1,250 FILM and a partly
completed pass, purely so those screens can be screenshotted with content in
them. It was previously the default for every account, which meant a brand new
install opened twelve pass tiers into a season it had never played. That read
as a bug because it was one.

A real new account is `FRESH_PROFILE`: level 1, zero XP, zero FILM, default
cosmetics only.

---

## 8. Purchases are not real

No payment provider is wired up. Every price is display text and every buy
button grants immediately, for free.

- `STORE` in `data/catalog.ts`: pass, cosmetic bundles, tier skips.
- `STARTER_BUNDLE`: the one-time first-purchase offer.

**None of these sells FILM, and none of them ever can.** Seeker bidding spends
FILM, so selling it makes a role advantage purchasable. A "1,000 FILM for
$2.99" SKU existed here before bidding was added and was removed for exactly
this reason.

---

## 9. Photos

Every image in the app is `ProceduralPhoto`, a seeded abstract generator, in
these places:

- The seeker's proof feed.
- The friend feed captures.
- The web camera fallback, since `expo-camera` needs a physical device.

**On a real device the check-in camera is real** and the validator runs on
real pixels. See `components/CameraStage.tsx` and `validation/decode.ts`.

The validator's thresholds are still **placeholders** and have never been
tuned against a real photograph. That is what `calibration/` is for, and until
those photos exist, expect the validator to reject valid captures.

---

## 10. Before any public build

- [ ] `DEMO_SEED` is false
- [ ] `DEV_TIME_SCALE` is 1
- [ ] `ADD TEST PLAYERS` is removed or gated behind a dev flag
- [ ] `DIRECTORY` is replaced by a real profile lookup
- [ ] `GLOBAL_LADDER` is replaced by a real ranked query
- [ ] `RIVAL_BID` is replaced by real bids
- [ ] Store buttons are wired to a real payment provider
- [ ] Validator thresholds are calibrated against real photos
- [ ] `ios.bundleIdentifier` and `android.package` are changed off the
      `com.frame.app` placeholder, which is permanent once published
