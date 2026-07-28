# FRAME

Extreme IRL hide & seek. Hiding isn't enough. Every few minutes you have to
photographically prove you're hidden, and the seeker sees everything.

This repo contains:

- [`PRD.md`](PRD.md), the full v1 product spec (working title BLACKOUT).
- [`mobile/`](mobile), a **playable demo** of the app (React Native + Expo,
  TypeScript), per the PRD's chosen stack.

## Running the demo

```bash
cd mobile
npm install
npx expo start
```

- **iOS simulator / Expo Go:** press `i` (requires an iOS simulator runtime) or
  scan the QR with Expo Go on a phone.
- **Browser:** press `w`, or open the printed localhost URL. Best viewed at an
  iPhone-sized viewport (375×812).

## What the demo covers

The full core loop on a compressed timeline (a "45:00" round plays out in about
4 minutes real time):

1. **Onboarding**, neutral DOB age gate (under-13 refusal is sticky per COPPA
   posture), handle, contextual-permissions explainer.
2. **Home**, level/XP, season pass strip (cosmetics-only messaging), stats,
   host/join. Banner ad slot on home only.
3. **Lobby**, invite code (unambiguous alphabet), zone map, roster, host
   settings, and the **Safety Card gate** (scroll-to-end required before the
   host can start).
4. **Hider round**, stylized zone map, dominant next-check-in countdown, the
   **photo check-in flow** (back → front capture → signal-based validation →
   live in seeker feed), reveal pings, shrinking zone, SOS sheet, offline
   Explainer Card, inventory.
5. **BLACKED OUT**, miss a check-in window and you get the distinct loss state.
6. **Seeker round**, proof feed (newest first), timed reveal pins that fade,
   BLE-gated TAG button ("GPS alone never confirms a tag"), report action on
   every photo.
7. **Results**. PRD scoring formulas, MVP, XP progression, interstitial slot
   note, role-swap into the next round.

## What's simulated

Everything a production build would get from the backend is scripted locally in
`mobile/src/engine/GameContext.tsx` (mock server ticks, other players,
eliminations). The camera is a simulated viewfinder with procedurally generated
"captures" (`ProceduralPhoto`), no camera, location, BLE, or network access is
used. Validation checks (Laplacian variance, luminance, entropy, edge density,
pHash, timestamp) are named per §4.5 of the PRD but animated, not computed.

Per the PRD's hard constraints, the demo's copy and structure deliberately
surface: no face detection anywhere, camera-only capture (no gallery), photos
deleted 24 h after round end, invite-code-only access, always-visible SOS,
offline Explainer Card, and no ads or purchasable advantages in rounds.
