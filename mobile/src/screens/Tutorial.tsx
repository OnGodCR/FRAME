import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { color, font, radius, space, REDUCED_MOTION } from '../theme';
import { Body, Brackets, Btn, Label, Mono } from '../components/ui';
import { FadeIn, PressScale } from '../components/motion';
import { CaptureSequence } from '../components/CaptureSequence';
import { ProceduralPhoto } from '../components/ProceduralPhoto';
import { PermissionNote } from './Onboarding';
import { useGame, PRACTICE_WINDOW, fmtClock } from '../engine/GameContext';
import { ECONOMY } from '../data/economy';

// ---------------------------------------------------------------------------
// The interactive tutorial.
//
// This replaces TEST FRAME, which used to be a card on the Solo hub. The
// practice run itself is unchanged and is beat 3 below; what changed is where
// it sits. As an optional card it was the single most important thing in the
// product placed somewhere a new player had no reason to tap, and the data on
// this genre is consistent: a player who has not performed the core mechanic
// inside the first couple of minutes does not come back to look for it.
//
// Four beats, and **every one of them requires the player to do something.**
// That is the whole design constraint. A tutorial the player reads is a
// tutorial the player skips, so there is no beat here that advances on a
// Continue button alone:
//
//   1. THE ZONE     drag yourself inside the boundary
//   2. THE WINDOW   beat a countdown, or watch yourself get blacked out
//   3. PROVE IT     the real capture sequence, the real validator
//   4. THE SEEKER   flip your own frames over to see what the seeker sees
//
// Beat 2 is deliberately allowed to fail, and failing it shows the real
// BLACKED OUT screen. The first time a player sees that screen should not be
// the first time it has cost them a round, which was the original argument for
// TEST FRAME and is the reason it survives here rather than being cut.
//
// **It is repeatable.** Reachable from Profile at any time. The most cited
// first-run failure in this genre is a tutorial that can never be seen again,
// which is also why the map explainer was pulled out of the funnel in session 2
// rather than deleted.
// ---------------------------------------------------------------------------

type Beat = 'zone' | 'window' | 'capture' | 'seeker';

const BEATS: Beat[] = ['zone', 'window', 'capture', 'seeker'];

/**
 * The tutorial's check-in window, in seconds.
 *
 * **Deliberately not 60**, and deliberately labelled as compressed on screen.
 * The point of this beat is the feeling of a deadline arriving, and making
 * someone stand still for a full minute to learn that teaches nothing extra.
 * The real capture in beat 3 uses the honest PRACTICE_WINDOW, so the number a
 * player actually rehearses against is the real one.
 */
const DEMO_WINDOW = 10;

export function Tutorial() {
  const { go, markSeen, profile, seen, claimTutorialGrant } = useGame();
  const insets = useSafeAreaInsets();
  const [beat, setBeat] = useState<Beat>('zone');
  // BLACKED OUT is the one screen in the product that owns the whole display.
  // Leaving the step counter sitting above it turns the most dramatic moment in
  // the game into a form field, so a beat can ask for the chrome to get out of
  // the way.
  const [chrome, setChrome] = useState(true);

  const index = BEATS.indexOf(beat);
  const replay = seen.tutorialDone;

  const finish = () => {
    // Paid before the flag is set, because the grant is guarded on that flag.
    claimTutorialGrant();
    markSeen({ tutorialDone: true });
    go('home');
  };

  const next = () => {
    const i = BEATS.indexOf(beat);
    if (i >= BEATS.length - 1) finish();
    else setBeat(BEATS[i + 1]);
  };

  // The capture beat renders full bleed and owns the whole screen, so it sits
  // outside the chrome rather than inside it.
  if (beat === 'capture') {
    return <CaptureBeat onPass={next} onSkip={next} />;
  }

  return (
    <View style={styles.screen}>
      {chrome && (
      <View style={{ paddingTop: insets.top + space(4), paddingHorizontal: space(6) }}>
        <View style={styles.headRow}>
          <Label>{replay ? 'How to play' : 'Step 5 of 5'}</Label>
          {!replay && index === 0 && (
            <PressScale onPress={finish}>
              <Mono style={styles.skip}>SKIP</Mono>
            </PressScale>
          )}
          {replay && (
            <PressScale onPress={() => go('home')}>
              <Mono style={styles.skip}>CLOSE</Mono>
            </PressScale>
          )}
        </View>
        <View style={styles.dots}>
          {BEATS.map((b, i) => (
            <View
              key={b}
              style={[
                styles.dot,
                i === index && styles.dotOn,
                i < index && styles.dotDone,
              ]}
            />
          ))}
        </View>
      </View>
      )}

      {beat === 'zone' && <ZoneBeat onDone={next} />}
      {beat === 'window' && <WindowBeat onDone={next} onChrome={setChrome} />}
      {beat === 'seeker' && (
        <SeekerBeat handle={profile.handle} reward={replay ? 0 : ECONOMY.tutorialGrant} onDone={finish} />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Beat 1: the zone
// ---------------------------------------------------------------------------

/**
 * Drag your pin inside the boundary.
 *
 * Teaches the one spatial rule that governs the whole round, by making the
 * player perform it once rather than reading it. Uses the built-in responder
 * system rather than a gesture library, because this has to work identically in
 * the browser preview, which is where most review of this app happens.
 */
function ZoneBeat({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [landed, setLanded] = useState(false);

  const centre = { x: box.w / 2, y: box.h / 2 };
  const zoneR = Math.min(box.w, box.h) * 0.34;

  // Start outside, and far enough out that the intended action is obvious
  // without an arrow pointing at it.
  useEffect(() => {
    if (box.w > 0 && !pos) {
      setPos({ x: box.w - space(9), y: box.h - space(9) });
    }
  }, [box.w, box.h]);

  const distance = pos
    ? Math.hypot(pos.x - centre.x, pos.y - centre.y)
    : Infinity;
  const inside = distance <= zoneR;

  useEffect(() => {
    if (inside && !landed) {
      setLanded(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (!inside && landed) {
      setLanded(false);
    }
  }, [inside]);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: space(6), paddingTop: space(4) }}>
        <Text style={styles.h1}>Stay inside the zone.</Text>
        <Body style={styles.lede}>
          The round happens inside a circle the host sets. Step outside it and the
          countdown to elimination starts.
        </Body>
      </View>

      <View
        style={styles.stage}
        onLayout={(e) =>
          setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })
        }
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(e) =>
          setPos({ x: e.nativeEvent.locationX, y: e.nativeEvent.locationY })
        }
        onResponderMove={(e) =>
          setPos({ x: e.nativeEvent.locationX, y: e.nativeEvent.locationY })
        }
      >
        {box.w > 0 && (
          <>
            <View
              pointerEvents="none"
              style={[
                styles.zoneRing,
                {
                  left: centre.x - zoneR,
                  top: centre.y - zoneR,
                  width: zoneR * 2,
                  height: zoneR * 2,
                  borderRadius: zoneR,
                  borderColor: inside ? color.accent : color.lineBright,
                  backgroundColor: inside ? 'rgba(200,255,46,0.07)' : 'transparent',
                },
              ]}
            />
            <Mono
              pointerEvents="none"
              style={[
                styles.zoneLabel,
                { top: centre.y - zoneR - 18, left: centre.x - zoneR },
              ]}
            >
              PLAY ZONE
            </Mono>
            {pos && (
              <View
                pointerEvents="none"
                style={[
                  styles.pin,
                  {
                    left: pos.x - 11,
                    top: pos.y - 11,
                    borderColor: inside ? color.accent : color.danger,
                    backgroundColor: inside ? color.accent : 'transparent',
                  },
                ]}
              />
            )}
          </>
        )}
      </View>

      <View style={{ paddingHorizontal: space(6), paddingBottom: insets.bottom + space(6) }}>
        <Mono style={[styles.instruction, inside && { color: color.accent }]}>
          {inside ? 'INSIDE THE ZONE. THAT IS WHERE YOU PLAY.' : 'DRAG YOUR PIN INSIDE THE CIRCLE'}
        </Mono>
        <Btn title="Next" disabled={!inside} onPress={onDone} style={{ marginTop: space(4) }} />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Beat 2: the window
// ---------------------------------------------------------------------------

/**
 * A countdown the player can genuinely miss.
 *
 * Missing it is not a dead end and it is not punished. It shows the real
 * BLACKED OUT screen and offers another go, which is the entire argument the
 * old TEST FRAME card was built on: the first time somebody sees that screen
 * should not be the first time it has actually cost them something.
 */
function WindowBeat({
  onDone,
  onChrome,
}: {
  onDone: () => void;
  onChrome: (visible: boolean) => void;
}) {
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<'waiting' | 'open' | 'hit' | 'missed'>('waiting');
  const [left, setLeft] = useState(DEMO_WINDOW);
  const pulse = useRef(new Animated.Value(0)).current;

  // A short beat before the window opens, so the alert arrives rather than
  // being there when the screen loads. A check-in you were already looking at
  // is not the thing being taught.
  useEffect(() => {
    if (state !== 'waiting') return;
    const t = setTimeout(() => {
      setState('open');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }, 1600);
    return () => clearTimeout(t);
  }, [state]);

  useEffect(() => {
    if (state !== 'open') return;
    setLeft(DEMO_WINDOW);
    const id = setInterval(() => {
      setLeft((n) => {
        if (n <= 1) {
          clearInterval(id);
          setState('missed');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          return 0;
        }
        return n - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [state]);

  useEffect(() => {
    onChrome(state !== 'missed');
    return () => onChrome(true);
  }, [state]);

  useEffect(() => {
    if (state !== 'open' || REDUCED_MOTION) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 620, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 620, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [state]);

  if (state === 'missed') {
    return (
      <View style={styles.blackScreen}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={styles.blackoutTitle}>BLACKED{'\n'}OUT</Text>
          <View style={styles.blackoutBar} />
          <Mono style={styles.blackoutNote}>THE WINDOW CLOSED WITH NO SUBMISSION.</Mono>
          <Mono style={[styles.blackoutNote, { color: color.faint, marginTop: space(3) }]}>
            IN A REAL ROUND THAT IS THE END OF YOUR GAME.{'\n'}THIS ONE COST YOU NOTHING.
          </Mono>
        </View>
        <View style={{ padding: space(6), paddingBottom: insets.bottom + space(6), gap: space(2) }}>
          <Btn title="Try that again" onPress={() => setState('waiting')} />
          <Btn title="I get it, move on" variant="outline" onPress={onDone} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: space(6), paddingTop: space(4) }}>
        <Text style={styles.h1}>Every 5 minutes, prove it.</Text>
        <Body style={styles.lede}>
          A window opens on a timer. You get 60 seconds to photograph where you are
          hiding. Miss it and you are out, wherever you are.
        </Body>
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        {state === 'waiting' && (
          <FadeIn>
            <Mono style={styles.waiting}>NEXT CHECK-IN INCOMING…</Mono>
          </FadeIn>
        )}

        {state === 'open' && (
          <>
            <Brackets size={20} thickness={2} inset={-14} tint={color.danger}>
              <Text style={styles.bigClock}>{fmtClock(left)}</Text>
            </Brackets>
            <Mono style={styles.compressed}>
              COMPRESSED FOR THIS TUTORIAL · THE REAL WINDOW IS {PRACTICE_WINDOW} SECONDS
            </Mono>
            <Animated.View
              style={{
                marginTop: space(8),
                transform: [
                  { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) },
                ],
              }}
            >
              <PressScale
                haptic="medium"
                onPress={() => {
                  setState('hit');
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }}
              >
                <View style={styles.checkinBtn}>
                  <Text style={styles.checkinLabel}>CHECK IN</Text>
                </View>
              </PressScale>
            </Animated.View>
          </>
        )}

        {state === 'hit' && (
          <FadeIn>
            <View style={{ alignItems: 'center', paddingHorizontal: space(6) }}>
              <Text style={styles.caught}>Caught it.</Text>
              <Mono style={styles.caughtNote}>
                THAT IS THE WHOLE LOOP. HIDE, GET PINGED, PROVE IT, REPEAT.
              </Mono>
            </View>
          </FadeIn>
        )}
      </View>

      <View style={{ paddingHorizontal: space(6), paddingBottom: insets.bottom + space(6) }}>
        {state === 'hit' ? (
          <Btn title="Now do it for real" onPress={onDone} />
        ) : (
          <Mono style={styles.instruction}>
            {state === 'open' ? 'TAP CHECK IN BEFORE THE CLOCK RUNS OUT' : 'WAIT FOR IT'}
          </Mono>
        )}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Beat 3: the real capture
// ---------------------------------------------------------------------------

/**
 * The old TEST FRAME, unchanged in substance and moved here.
 *
 * A real PRACTICE_WINDOW countdown, the real back-then-front sequence, and the
 * real PRD 4.5 validator running on real pixels. Practice that differs from the
 * real thing is not practice, which is why this renders CaptureSequence rather
 * than a mock of it.
 *
 * **Skippable, on purpose.** A player doing this indoors at night, or one who
 * declined the camera, must not be trapped in onboarding. Being unable to get
 * past the tutorial is a worse outcome than not having done it, and this repo
 * has already shipped one gate that could lock a player out of the whole app
 * (session-2 15).
 */
function CaptureBeat({ onPass, onSkip }: { onPass: () => void; onSkip: () => void }) {
  const { markSeen } = useGame();
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<'brief' | 'run' | 'expired'>('brief');
  const [left, setLeft] = useState(PRACTICE_WINDOW);
  const passed = useRef(false);

  useEffect(() => {
    if (phase !== 'run') return;
    const id = setInterval(() => {
      setLeft((n) => {
        if (n <= 1) {
          clearInterval(id);
          if (!passed.current) setPhase('expired');
          return 0;
        }
        return n - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [phase]);

  if (phase === 'brief') {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + space(6) }]}>
        <View style={{ flex: 1, paddingHorizontal: space(6) }}>
          <Label tone="accent">Beat 3 of 4</Label>
          <Text style={styles.h1}>Your first real check-in.</Text>
          <Body style={styles.lede}>
            Back camera, then front. {PRACTICE_WINDOW} seconds, exactly like a real
            round. Nothing is at stake here, so let the timer run out on purpose if
            you want to see what that costs.
          </Body>
          <Mono style={styles.brief}>
            THE BACK FRAME SHOWS YOUR HIDING PLACE.{'\n'}
            THE FRONT FRAME PROVES SOMEBODY IS BEHIND THE PHONE.{'\n'}
            NEITHER IS SCORED. NEITHER IS RUN THROUGH FACE DETECTION, EVER.
          </Mono>
          <View style={{ marginTop: space(6) }}>
            <PermissionNote perm="camera" />
          </View>
        </View>
        <View style={{ padding: space(6), paddingBottom: insets.bottom + space(6), gap: space(2) }}>
          <Btn title="Open the camera" onPress={() => setPhase('run')} />
          <Btn title="I'll do this outside" variant="ghost" onPress={onSkip} />
        </View>
      </View>
    );
  }

  if (phase === 'expired') {
    return (
      <View style={styles.blackScreen}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={styles.blackoutTitle}>BLACKED{'\n'}OUT</Text>
          <View style={styles.blackoutBar} />
          <Mono style={styles.blackoutNote}>THE WINDOW CLOSED WITH NO SUBMISSION.</Mono>
          <Mono style={[styles.blackoutNote, { color: color.faint, marginTop: space(3) }]}>
            THIS ONE COST YOU NOTHING.
          </Mono>
        </View>
        <View style={{ padding: space(6), paddingBottom: insets.bottom + space(6), gap: space(2) }}>
          <Btn
            title="Try again"
            onPress={() => {
              setLeft(PRACTICE_WINDOW);
              setPhase('run');
            }}
          />
          <Btn title="Move on" variant="outline" onPress={onSkip} />
        </View>
      </View>
    );
  }

  return (
    <CaptureSequence
      eyebrow="First check-in"
      remaining={left}
      onValidated={() => {
        passed.current = true;
        markSeen({ practised: true });
      }}
      validatingNote="Practice run. The same checks, none of the consequences."
      doneTitle="That would have counted."
      doneNote="IN A REAL ROUND BOTH FRAMES WOULD NOW BE IN THE SEEKER'S FEED."
      doneCta="See what the seeker sees"
      onDone={onPass}
      onRetry={(extra) => setLeft((n) => n + extra)}
    />
  );
}

// ---------------------------------------------------------------------------
// Beat 4: the seeker
// ---------------------------------------------------------------------------

/**
 * The stakes, and the only cosmetic argument the product ever needs to make.
 *
 * Every check-in a hider sends is seen by the seeker, wearing that hider's
 * frame. That makes frames the highest impression-count cosmetic in the game by
 * a wide margin, and it is why they are the flagship shop category. Showing it
 * once, here, does more than the shop screen can.
 */
function SeekerBeat({
  handle,
  reward,
  onDone,
}: {
  handle: string;
  reward: number;
  onDone: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [flipped, setFlipped] = useState(false);
  const seeds = useMemo(() => ({ back: 4402, front: 8821 }), []);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: space(6), paddingTop: space(4) }}>
        <Text style={styles.h1}>The seeker sees everything.</Text>
        <Body style={styles.lede}>
          Every frame you send lands in their feed within seconds. They cannot see
          where you are between reveals, but they can see what is behind you.
        </Body>
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space(6) }}>
        <PressScale onPress={() => setFlipped((f) => !f)} haptic="light">
          <View style={styles.feedCard}>
            <View style={styles.feedHead}>
              <Mono style={styles.feedWho}>{handle || 'YOU'}</Mono>
              <Mono style={styles.feedTick}>CHECK-IN 1 · PASSED</Mono>
            </View>
            <View style={{ flexDirection: 'row', gap: space(2), padding: space(3) }}>
              <View style={styles.feedShot}>
                <ProceduralPhoto seed={seeds.back} width={112} height={132} variant="back" />
                <Mono style={styles.feedCap}>BACK</Mono>
              </View>
              <View style={styles.feedShot}>
                <ProceduralPhoto seed={seeds.front} width={112} height={132} variant="front" />
                <Mono style={styles.feedCap}>FRONT</Mono>
              </View>
            </View>
            <View style={styles.feedFoot}>
              <Mono style={styles.feedFootText}>
                {flipped
                  ? 'THE FRAME AROUND IT IS YOURS. EVERY PLAYER IN THE ROUND SEES IT.'
                  : 'TAP TO SEE WHY ANYONE BUYS A FRAME'}
              </Mono>
            </View>
          </View>
        </PressScale>

        <Mono style={styles.seekerNote}>
          A SEEKER NEVER READS YOUR POSITION BETWEEN REVEALS.{'\n'}
          THAT IS ENFORCED IN THE DATABASE, NOT IN THE APP.
        </Mono>
      </View>

      <View style={{ paddingHorizontal: space(6), paddingBottom: insets.bottom + space(6) }}>
        <Btn
          title="Start playing"
          sub={reward > 0 ? `+${reward.toLocaleString()} FILM FOR FINISHING` : undefined}
          onPress={onDone}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  blackScreen: { flex: 1, backgroundColor: color.black },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  skip: { fontSize: 11, letterSpacing: 1.6, color: color.faint },
  dots: { flexDirection: 'row', gap: space(2), marginTop: space(3) },
  dot: {
    flex: 1,
    height: 2,
    backgroundColor: color.line,
  },
  dotOn: { backgroundColor: color.accent },
  dotDone: { backgroundColor: color.accentDim },
  h1: {
    fontFamily: font.display,
    fontSize: 30,
    lineHeight: 36,
    color: color.text,
    marginTop: space(3),
    letterSpacing: -0.5,
  },
  lede: { color: color.dim, marginTop: space(3), lineHeight: 22 },
  stage: {
    flex: 1,
    margin: space(6),
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    overflow: 'hidden',
  },
  zoneRing: { position: 'absolute', borderWidth: 2, borderStyle: 'dashed' },
  zoneLabel: { position: 'absolute', fontSize: 9, letterSpacing: 1.6, color: color.faint },
  pin: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
  },
  instruction: {
    fontSize: 10,
    letterSpacing: 1.4,
    color: color.faint,
    textAlign: 'center',
    lineHeight: 16,
  },
  waiting: { fontSize: 12, letterSpacing: 2, color: color.faint },
  bigClock: {
    fontFamily: font.numeral,
    fontSize: 72,
    color: color.text,
    fontVariant: ['tabular-nums'],
  },
  compressed: {
    fontSize: 9,
    letterSpacing: 1.3,
    color: color.faint,
    marginTop: space(5),
    textAlign: 'center',
    paddingHorizontal: space(6),
    lineHeight: 14,
  },
  checkinBtn: {
    paddingHorizontal: space(10),
    paddingVertical: space(4),
    borderRadius: radius.md,
    backgroundColor: color.accent,
  },
  checkinLabel: {
    fontFamily: font.monoSemi,
    fontSize: 14,
    letterSpacing: 2.5,
    color: color.onAccent,
  },
  caught: { fontFamily: font.display, fontSize: 34, color: color.accent },
  caughtNote: {
    fontSize: 10,
    letterSpacing: 1.4,
    color: color.faint,
    marginTop: space(4),
    textAlign: 'center',
    lineHeight: 16,
  },
  brief: {
    fontSize: 10,
    letterSpacing: 1.2,
    color: color.faint,
    lineHeight: 18,
    marginTop: space(6),
  },
  blackoutTitle: {
    fontFamily: font.blackout,
    fontSize: 64,
    lineHeight: 66,
    letterSpacing: 6,
    color: color.text,
    textAlign: 'center',
  },
  blackoutBar: { width: 120, height: 3, backgroundColor: color.danger, marginTop: space(5) },
  blackoutNote: {
    fontFamily: font.monoMed,
    fontSize: 11,
    lineHeight: 18,
    letterSpacing: 1.2,
    color: color.dim,
    textAlign: 'center',
    marginTop: space(5),
  },
  feedCard: {
    borderWidth: 1,
    borderColor: color.lineBright,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    overflow: 'hidden',
  },
  feedHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space(3),
    paddingTop: space(3),
  },
  feedWho: { fontFamily: font.monoSemi, fontSize: 12, letterSpacing: 1.6, color: color.text },
  feedTick: { fontSize: 9, letterSpacing: 1.2, color: color.accent },
  feedShot: { borderWidth: 1, borderColor: color.accent, borderRadius: radius.sm, overflow: 'hidden' },
  feedCap: {
    fontSize: 9,
    letterSpacing: 1.5,
    color: color.dim,
    textAlign: 'center',
    paddingVertical: 4,
    backgroundColor: color.surface2,
  },
  feedFoot: {
    borderTopWidth: 1,
    borderTopColor: color.line,
    paddingHorizontal: space(3),
    paddingVertical: space(2.5),
  },
  feedFootText: { fontSize: 9, letterSpacing: 1.2, color: color.faint, lineHeight: 14 },
  seekerNote: {
    fontSize: 9,
    letterSpacing: 1.2,
    color: color.faint,
    textAlign: 'center',
    marginTop: space(6),
    lineHeight: 15,
  },
});
