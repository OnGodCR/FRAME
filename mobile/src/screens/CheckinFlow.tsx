import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
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
import { ProceduralPhoto } from '../components/ProceduralPhoto';
import { fmtClock, useGame } from '../engine/GameContext';

type Step = 'back' | 'front' | 'validating' | 'done';

const CHECKS = [
  { name: 'LAPLACIAN VARIANCE', desc: 'blur / smear' },
  { name: 'MEAN LUMINANCE', desc: 'lens covered or flooded' },
  { name: 'HISTOGRAM ENTROPY', desc: 'uniform surface' },
  { name: 'EDGE DENSITY', desc: 'low detail' },
  { name: 'pHASH · LAST 20', desc: 'reused image' },
  { name: 'CAPTURE TIMESTAMP', desc: 'inside server window' },
];

export function CheckinFlow() {
  const { round, submitCheckin, go } = useGame();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [step, setStep] = useState<Step>('back');
  const [passed, setPassed] = useState(0);
  // Captured at mount: round.checkin is cleared the moment the submission
  // registers, but the confirmation screen still needs the index.
  const [ciIndex] = useState(round?.checkin?.index ?? 0);
  const seeds = useMemo(() => ({ back: Date.now() % 100000, front: (Date.now() % 100000) + 31 }), []);
  const flash = useRef(new Animated.Value(0)).current;
  const scan = useRef(new Animated.Value(0)).current;

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

  // validation sequence
  useEffect(() => {
    if (step !== 'validating') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPassed(0);
    const timers = CHECKS.map((_, i) =>
      setTimeout(() => {
        setPassed(i + 1);
        Haptics.selectionAsync();
      }, 320 * (i + 1)),
    );
    const doneT = setTimeout(() => {
      setStep('done');
      submitCheckin();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, 320 * CHECKS.length + 500);
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(doneT);
    };
  }, [step]);

  if (!round) return null;
  if (step !== 'done' && !round.checkin) return null;
  const remaining = round.checkin ? round.checkin.deadline - round.elapsed : 0;

  const capture = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    flash.setValue(1);
    Animated.timing(flash, { toValue: 0, duration: 320, useNativeDriver: true }).start();
    setTimeout(() => setStep(step === 'back' ? 'front' : 'validating'), 200);
  };

  const finderW = width - space(10);
  const finderH = finderW * 1.25;

  if (step === 'back' || step === 'front') {
    const isBack = step === 'back';
    return (
      <View style={[styles.screen, { paddingTop: insets.top + space(3) }]}>
        <View style={styles.header}>
          <View>
            <Label tone="accent">Check-in 0{ciIndex}</Label>
            <Text style={styles.deadline}>{fmtClock(remaining)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Label tone={isBack ? 'text' : 'faint'}>1 · Back</Label>
            <Label tone={isBack ? 'faint' : 'text'} style={{ marginTop: 3 }}>
              2 · Front
            </Label>
          </View>
        </View>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Brackets size={22} thickness={2} inset={-8} tint={color.accent}>
            <View style={{ width: finderW, height: finderH, borderRadius: radius.sm, overflow: 'hidden' }}>
              <ProceduralPhoto
                seed={isBack ? seeds.back : seeds.front}
                width={finderW}
                height={finderH}
                variant={isBack ? 'back' : 'front'}
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
          <Pressable onPress={capture} style={({ pressed }) => [styles.shutter, pressed && { transform: [{ scale: 0.92 }] }]}>
            <View style={styles.shutterInner} />
          </Pressable>
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
                <Mono style={{ fontSize: 11, color: i < passed ? color.accent : color.faint }}>
                  {i < passed ? 'PASS' : '····'}
                </Mono>
              </View>
            ))}
          </View>
          <Mono style={{ fontSize: 10, color: color.faint, marginTop: space(5), lineHeight: 16 }}>
            Re-validated server-side. A client-reported pass is never trusted.
          </Mono>
        </View>
      </View>
    );
  }

  // done
  const thumbW = (width - space(14)) / 2;
  return (
    <View style={[styles.screen, { paddingTop: insets.top + space(3), padding: space(6) }]}>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Label tone="accent">Submitted</Label>
        <Text style={styles.h1}>In the seeker's feed now.</Text>
        <View style={{ flexDirection: 'row', gap: space(2), marginTop: space(6) }}>
          <View style={styles.thumbWrap}>
            <ProceduralPhoto seed={seeds.back} width={thumbW} height={thumbW * 1.2} variant="back" />
            <Mono style={styles.thumbCaption}>BACK</Mono>
          </View>
          <View style={styles.thumbWrap}>
            <ProceduralPhoto seed={seeds.front} width={thumbW} height={thumbW * 1.2} variant="front" />
            <Mono style={styles.thumbCaption}>FRONT</Mono>
          </View>
        </View>
        <Mono style={{ fontSize: 10, color: color.faint, marginTop: space(4), lineHeight: 16 }}>
          ENCRYPTED AT REST · AUTO-DELETED 24 H AFTER ROUND END · NEVER IN MATCH HISTORY
        </Mono>
      </View>
      <View style={{ paddingBottom: insets.bottom + space(4) }}>
        <Btn title="Return to hiding" onPress={() => go('round')} />
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
  },
  deadline: {
    fontFamily: font.display,
    fontSize: 34,
    color: color.text,
    fontVariant: ['tabular-nums'],
    marginTop: 2,
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
