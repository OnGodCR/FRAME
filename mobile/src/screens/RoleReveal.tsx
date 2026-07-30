import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { color, font, space, REDUCED_MOTION } from '../theme';
import { Label, Mono } from '../components/ui';
import { useGame, SEEKER_BOT, ROUND_DISPLAY_MINUTES } from '../engine/GameContext';

const NAMES = ['MAYA', 'KAI', 'DEV', 'JULES', 'ARI', 'YOU'];

export function RoleReveal() {
  const { go, round, profile } = useGame();
  const role = round?.role ?? 'hider';
  const [phase, setPhase] = useState<'shuffle' | 'reveal'>('shuffle');
  const [shuffleName, setShuffleName] = useState(NAMES[0]);
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let i = 0;
    const spin = setInterval(() => {
      i++;
      setShuffleName(NAMES[i % NAMES.length]);
    }, 110);
    const stop = setTimeout(() => {
      clearInterval(spin);
      setPhase('reveal');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      if (REDUCED_MOTION) fade.setValue(1);
      else Animated.timing(fade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }, 2200);
    const advance = setTimeout(() => go('round'), 5600);
    return () => {
      clearInterval(spin);
      clearTimeout(stop);
      clearTimeout(advance);
    };
  }, []);

  if (phase === 'shuffle') {
    return (
      <View style={styles.screen}>
        <Label tone="faint">Assigning seeker · server-side</Label>
        <Text style={styles.shuffle}>{shuffleName}</Text>
      </View>
    );
  }

  const seeking = role === 'seeker';
  return (
    <Animated.View style={[styles.screen, { opacity: fade }]}>
      <Label tone={seeking ? 'danger' : 'accent'}>
        {seeking ? 'You are the seeker' : `${SEEKER_BOT.name} is seeking`}
      </Label>
      <Text style={[styles.role, { color: seeking ? color.danger : color.accent }]}>
        {seeking ? 'SEEK' : 'HIDE'}
      </Text>
      <Mono style={styles.note}>
        {seeking
          ? `Cooldown 5:00. Hold position while hiders disperse.\nEvery check-in they pass lands in your feed.`
          : `Seeker is locked for 5:00. Go.\nFirst check-in comes fast. Prove where you are or you're out.`}
      </Mono>
      {!seeking && (
        <Mono style={[styles.note, { color: color.faint, marginTop: space(4) }]}>
          {`${profile.handle || 'YOU'} · HIDER · ROUND ${ROUND_DISPLAY_MINUTES}:00`}
        </Mono>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: color.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space(8),
  },
  shuffle: {
    fontFamily: font.display,
    fontSize: 44,
    letterSpacing: 4,
    color: color.faint,
    marginTop: space(4),
  },
  role: {
    fontFamily: font.display,
    fontSize: 88,
    letterSpacing: 8,
    marginTop: space(3),
  },
  note: {
    fontFamily: font.monoMed,
    fontSize: 12,
    lineHeight: 19,
    letterSpacing: 0.5,
    color: color.dim,
    textAlign: 'center',
    marginTop: space(5),
  },
});
