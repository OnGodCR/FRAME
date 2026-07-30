import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { color, font, radius, space } from '../theme';
import { Brackets, Btn, Label, Mono } from '../components/ui';
import { ProceduralPhoto } from './ProceduralPhoto';
import {
  CameraStage,
  CAMERA_SUPPORTED,
  ensureCameraPermission,
  type CameraStageHandle,
  type Shot,
} from './CameraStage';
import { checkCapture } from '../validation/decode';
import type { FailureCode, Verdict } from '../validation/signals';
import { fmtClock } from '../engine/GameContext';

// ---------------------------------------------------------------------------
// The back-then-front capture, the validation readout, and the submitted state.
//
// Shared by every mode that captures: the in-round check-in, the TEST FRAME
// practice run, and the daily assignment. They differ only in their framing
// copy and what happens on success, so all of that is props. The sequence
// itself must stay identical everywhere, because the whole point of practice
// is that it rehearses the real thing exactly.
//
// Still procedurally generated, not a real camera. Wiring expo-camera in here
// changes this one file and every mode gets it at once.
// ---------------------------------------------------------------------------

export type CaptureStep = 'back' | 'front' | 'validating' | 'failed' | 'done';

/**
 * Display rows, mapped to the FailureCode each one detects. When a real
 * capture is analysed these light up from the actual verdict rather than a
 * timer, so a row saying PASS means that check genuinely passed.
 */
const CHECKS: { name: string; codes: FailureCode[] }[] = [
  { name: 'LAPLACIAN VARIANCE', codes: ['blurred'] },
  { name: 'MEAN LUMINANCE', codes: ['too_dark', 'too_bright'] },
  { name: 'HISTOGRAM ENTROPY', codes: ['uniform_surface'] },
  { name: 'EDGE DENSITY', codes: ['low_detail'] },
  { name: 'pHASH · LAST 20', codes: ['reused_image'] },
  { name: 'CAPTURE TIMESTAMP', codes: ['stale_capture'] },
];

/** PRD 4.4: one retry, with a 30 second extension, then elimination. */
const RETRY_EXTENSION = 30;

export interface CaptureSequenceProps {
  /** Small label above the timer. */
  eyebrow: string;
  /** Optional assignment text, shown over the viewfinder. */
  prompt?: string | null;
  /** Seconds left, or null for a run with no deadline. */
  remaining: number | null;
  /** Fires the instant validation passes, before the player taps anything. */
  onValidated: () => void;
  doneTitle: string;
  doneNote: string;
  doneCta: string;
  onDone: () => void;
  /** Shown on the validating screen. Practice says so, plainly. */
  validatingNote?: string;
  /** pHashes from this player's recent submissions, for the reuse check. */
  recentHashes?: bigint[];
  /** Called when the player takes their one retry, with the extension seconds. */
  onRetry?: (extraSeconds: number) => void;
}

export function CaptureSequence({
  eyebrow,
  prompt,
  remaining,
  onValidated,
  doneTitle,
  doneNote,
  doneCta,
  onDone,
  validatingNote = 'Re-validated server-side. A client-reported pass is never trusted.',
  recentHashes,
  onRetry,
}: CaptureSequenceProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [step, setStep] = useState<CaptureStep>('back');
  const [passed, setPassed] = useState(0);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [retried, setRetried] = useState(false);
  const seeds = useMemo(
    () => ({ back: Date.now() % 100000, front: (Date.now() % 100000) + 31 }),
    [],
  );
  const shots = useRef<{ back: Shot | null; front: Shot | null }>({ back: null, front: null });
  const stage = useRef<CameraStageHandle>(null);
  const flash = useRef(new Animated.Value(0)).current;
  const scan = useRef(new Animated.Value(0)).current;

  // Camera permission, asked here rather than at launch because this is the
  // first moment it is genuinely needed. PRD 10.2: a cold prompt on the splash
  // screen is the biggest drop-off in the funnel.
  const [camAllowed, setCamAllowed] = useState<boolean | null>(
    CAMERA_SUPPORTED ? null : true,
  );
  useEffect(() => {
    if (!CAMERA_SUPPORTED) return;
    let live = true;
    ensureCameraPermission().then((ok) => {
      if (live) setCamAllowed(ok);
    });
    return () => {
      live = false;
    };
  }, []);

  // live viewfinder scanline
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(scan, {
        toValue: 1,
        duration: 2600,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  // Validation. On a real capture this runs PRD 4.5 against actual pixels and
  // the readout reflects the real verdict. On web there is no camera, so the
  // rows advance on a timer and always pass: the web preview is for reviewing
  // the flow, not for judging photographs.
  useEffect(() => {
    if (step !== 'validating') return;
    let live = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPassed(0);

    const reveal = CHECKS.map((_, i) =>
      setTimeout(() => {
        if (!live) return;
        setPassed(i + 1);
        Haptics.selectionAsync();
      }, 320 * (i + 1)),
    );

    const settle = (v: Verdict | null) => {
      if (!live) return;
      setVerdict(v);
      if (!v || v.pass) {
        setStep('done');
        onValidated();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        setStep('failed');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    };

    const minimumBeat = 320 * CHECKS.length + 400;
    const uri = shots.current.back?.uri ?? null;

    if (!CAMERA_SUPPORTED || !uri) {
      const t = setTimeout(() => settle(null), minimumBeat);
      return () => {
        live = false;
        reveal.forEach(clearTimeout);
        clearTimeout(t);
      };
    }

    // Analyse the back frame. It is the one that shows the hiding place; the
    // front frame proves a person is behind the phone and is checked server
    // side where the thresholds differ.
    const started = Date.now();
    checkCapture(uri, { recentHashes, capturedAt: started })
      .then((v) => {
        // Never finish faster than the readout can be read. A verdict that
        // flashes past is worse than one that takes an extra beat.
        const wait = Math.max(0, minimumBeat - (Date.now() - started));
        setTimeout(() => settle(v), wait);
      })
      .catch(() =>
        setTimeout(
          () =>
            settle({
              pass: false,
              failures: [],
              signals: null as never,
              message: 'That frame could not be read. Take it again.',
            }),
          minimumBeat,
        ),
      );

    return () => {
      live = false;
      reveal.forEach(clearTimeout);
    };
  }, [step]);

  const capture = async () => {
    const which = step === 'back' ? 'back' : 'front';
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    flash.setValue(1);
    Animated.timing(flash, { toValue: 0, duration: 320, useNativeDriver: true }).start();

    const shot = stage.current
      ? await stage.current.capture()
      : { uri: null, seed: seeds[which] };
    shots.current[which] = shot;

    setStep(which === 'back' ? 'front' : 'validating');
  };

  /** Retry after a failed check. One only, per PRD 4.4. */
  const retry = () => {
    setRetried(true);
    setVerdict(null);
    shots.current = { back: null, front: null };
    onRetry?.(RETRY_EXTENSION);
    setStep('back');
  };

  const finderW = width - space(10);
  const finderH = finderW * 1.25;

  /** Which readout rows the verdict actually failed. Empty when it passed. */
  const failedRows = useMemo(() => {
    const set = new Set<number>();
    if (!verdict || verdict.pass) return set;
    CHECKS.forEach((c, i) => {
      if (c.codes.some((code) => verdict.failures.includes(code))) set.add(i);
    });
    return set;
  }, [verdict]);

  if (step === 'back' || step === 'front') {
    const isBack = step === 'back';
    return (
      <View style={[styles.screen, { paddingTop: insets.top + space(3) }]}>
        <View style={styles.header}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Label tone="accent">{eyebrow}</Label>
            {/* An untimed run leaves this slot empty rather than announcing
                the absence of a timer in the same display size the countdown
                uses. Nothing to count down is not a headline. */}
            {remaining != null ? (
              <Text style={styles.deadline}>{fmtClock(remaining)}</Text>
            ) : (
              <Mono style={styles.untimed}>TAKE YOUR TIME</Mono>
            )}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Label tone={isBack ? 'text' : 'faint'}>1 · Back</Label>
            <Label tone={isBack ? 'faint' : 'text'} style={{ marginTop: 3 }}>
              2 · Front
            </Label>
          </View>
        </View>

        {prompt ? (
          <View style={styles.promptBar}>
            <Mono style={styles.promptText}>{prompt}</Mono>
          </View>
        ) : null}

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Brackets size={22} thickness={2} inset={-8} tint={color.accent}>
            <View
              style={{
                width: finderW,
                height: finderH,
                borderRadius: radius.sm,
                overflow: 'hidden',
              }}
            >
              <CameraStage
                ref={stage}
                facing={isBack ? 'back' : 'front'}
                width={finderW}
                height={finderH}
                seed={isBack ? seeds.back : seeds.front}
              />
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.scanline,
                  {
                    transform: [
                      {
                        translateY: scan.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, finderH],
                        }),
                      },
                    ],
                  },
                ]}
              />
              <View style={styles.liveTag}>
                <View style={styles.liveDot} />
                <Mono style={{ fontSize: 9, letterSpacing: 1.5, color: '#FFF' }}>
                  LIVE · {isBack ? 'BACK' : 'FRONT'} CAMERA
                </Mono>
              </View>
              <Animated.View
                pointerEvents="none"
                style={[StyleSheet.absoluteFill, { backgroundColor: '#FFF', opacity: flash }]}
              />
            </View>
          </Brackets>
          <Mono
            style={{
              fontSize: 10,
              color: color.faint,
              marginTop: space(4),
              letterSpacing: 1,
              paddingHorizontal: space(6),
              textAlign: 'center',
            }}
          >
            GALLERY DISABLED · CAPTURE IS LIVE OR IT DOESN'T COUNT
          </Mono>
        </View>

        <View style={{ alignItems: 'center', paddingBottom: insets.bottom + space(6) }}>
          <Pressable
            onPress={capture}
            style={({ pressed }) => [styles.shutter, pressed && { transform: [{ scale: 0.92 }] }]}
          >
            <View style={styles.shutterInner} />
          </Pressable>
        </View>
      </View>
    );
  }

  // No camera, no check-in. Say why plainly rather than showing a black
  // rectangle, and never offer a gallery fallback: PRD 4.4 makes live capture
  // a hard constraint, so there is genuinely no other way through.
  if (camAllowed === false) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + space(3), padding: space(6) }]}>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Label tone="danger">Camera blocked</Label>
          <Text style={styles.h1}>FRAME cannot check you in without the camera.</Text>
          <Mono style={{ fontSize: 12, color: color.dim, marginTop: space(4), lineHeight: 19 }}>
            Check-ins are live capture only. There is no gallery option, by design:
            a photo you already had proves nothing about where you are now.
          </Mono>
          <Mono style={{ fontSize: 11, color: color.faint, marginTop: space(4), lineHeight: 17 }}>
            Enable the camera for FRAME in your phone settings, then come back.
          </Mono>
        </View>
        <View style={{ paddingBottom: insets.bottom + space(4) }}>
          <Btn title="Back" variant="outline" onPress={onDone} />
        </View>
      </View>
    );
  }

  // PRD 4.4: name the failed check in plain language and offer exactly one
  // retry with an extension. A second failure, or the window closing, is a
  // blackout. Telling someone only "invalid" is how you lose a player who
  // did nothing wrong except point at a dark wall.
  if (step === 'failed') {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + space(3), padding: space(6) }]}>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Label tone="danger">Not accepted</Label>
          <Text style={styles.h1}>{verdict?.message ?? 'That frame did not pass.'}</Text>
          <View style={{ marginTop: space(5) }}>
            {CHECKS.filter((_, i) => failedRows.has(i)).map((c) => (
              <View key={c.name} style={styles.checkRow}>
                <Mono style={{ fontSize: 12, color: color.text, letterSpacing: 1, flex: 1 }}>
                  {c.name}
                </Mono>
                <Mono style={{ fontSize: 11, color: color.danger }}>FAIL</Mono>
              </View>
            ))}
          </View>
          <Mono style={{ fontSize: 11, color: color.dim, marginTop: space(5), lineHeight: 17 }}>
            {retried
              ? 'No retries left. The window is still open until the timer runs out.'
              : `One retry, plus ${RETRY_EXTENSION} seconds. Point somewhere with more light and detail.`}
          </Mono>
        </View>
        <View style={{ paddingBottom: insets.bottom + space(4), gap: space(2) }}>
          {!retried && <Btn title="Retake" onPress={retry} />}
          <Btn
            title={retried ? 'Back to the round' : 'Give up on this one'}
            variant="outline"
            onPress={onDone}
          />
        </View>
      </View>
    );
  }

  if (step === 'validating') {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + space(3), padding: space(6) }]}>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Label tone="accent">Validating</Label>
          <Text style={styles.h1}>Signal checks only.{'\n'}No faces. Ever.</Text>
          <View style={{ marginTop: space(6) }}>
            {CHECKS.map((c, i) => (
              <View key={c.name} style={styles.checkRow}>
                <Mono
                  style={{
                    fontSize: 12,
                    color: i < passed ? color.text : color.faint,
                    letterSpacing: 1,
                    flex: 1,
                  }}
                >
                  {c.name}
                </Mono>
                <Mono
                  style={{
                    fontSize: 11,
                    color:
                      i < passed
                        ? failedRows.has(i)
                          ? color.danger
                          : color.accent
                        : color.faint,
                  }}
                >
                  {i < passed ? (failedRows.has(i) ? 'FAIL' : 'PASS') : '····'}
                </Mono>
              </View>
            ))}
          </View>
          <Mono style={{ fontSize: 10, color: color.faint, marginTop: space(5), lineHeight: 16 }}>
            {validatingNote}
          </Mono>
        </View>
      </View>
    );
  }

  const thumbW = (width - space(14)) / 2;
  return (
    <View style={[styles.screen, { paddingTop: insets.top + space(3), padding: space(6) }]}>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Label tone="accent">Submitted</Label>
        <Text style={styles.h1}>{doneTitle}</Text>
        <View style={{ flexDirection: 'row', gap: space(2), marginTop: space(6) }}>
          {(['back', 'front'] as const).map((which) => {
            const shot = shots.current[which];
            return (
              <View key={which} style={styles.thumbWrap}>
                {shot?.uri ? (
                  <Image
                    source={{ uri: shot.uri }}
                    style={{ width: thumbW, height: thumbW * 1.2 }}
                    resizeMode="cover"
                  />
                ) : (
                  <ProceduralPhoto
                    seed={seeds[which]}
                    width={thumbW}
                    height={thumbW * 1.2}
                    variant={which}
                  />
                )}
                <Mono style={styles.thumbCaption}>{which.toUpperCase()}</Mono>
              </View>
            );
          })}
        </View>
        <Mono style={{ fontSize: 10, color: color.faint, marginTop: space(4), lineHeight: 16 }}>
          {doneNote}
        </Mono>
      </View>
      <View style={{ paddingBottom: insets.bottom + space(4) }}>
        <Btn title={doneCta} onPress={onDone} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.black },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: space(5),
    gap: space(3),
  },
  deadline: {
    fontFamily: font.display,
    fontSize: 34,
    color: color.text,
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  untimed: {
    fontSize: 11,
    letterSpacing: 1.4,
    color: color.faint,
    marginTop: space(2),
  },
  promptBar: {
    marginHorizontal: space(5),
    marginTop: space(3),
    borderLeftWidth: 2,
    borderLeftColor: color.accent,
    paddingLeft: space(3),
  },
  promptText: {
    fontSize: 13,
    lineHeight: 20,
    color: color.text,
    letterSpacing: 0.5,
  },
  h1: {
    fontFamily: font.display,
    fontSize: 28,
    lineHeight: 34,
    color: color.text,
    marginTop: space(2),
  },
  scanline: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(200,255,46,0.22)',
  },
  liveTag: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: color.danger },
  shutter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 3,
    borderColor: color.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: color.accent,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space(2.5),
    borderBottomWidth: 1,
    borderBottomColor: color.line,
  },
  thumbWrap: {
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  thumbCaption: {
    fontSize: 9,
    letterSpacing: 1.5,
    color: color.dim,
    textAlign: 'center',
    paddingVertical: 5,
    backgroundColor: color.surface,
  },
});
