import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, font, radius, space, REDUCED_MOTION } from '../theme';
import { Body, Brackets, Btn, Label, Mono } from '../components/ui';
import { useGame } from '../engine/GameContext';

export function Splash() {
  const { go } = useGame();
  const blink = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (REDUCED_MOTION) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(2400),
        Animated.timing(blink, { toValue: 0.15, duration: 60, useNativeDriver: true }),
        Animated.timing(blink, { toValue: 1, duration: 60, useNativeDriver: true }),
        Animated.timing(blink, { toValue: 0.4, duration: 50, useNativeDriver: true }),
        Animated.timing(blink, { toValue: 1, duration: 80, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <View style={styles.screen}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Brackets size={18} thickness={2.5} inset={-18} tint={color.accent}>
          <Animated.Text style={[styles.wordmark, { opacity: blink }]}>HIDEWIRE</Animated.Text>
        </Brackets>
        <Mono style={{ marginTop: space(8), color: color.dim, letterSpacing: 2, fontSize: 12 }}>
          HIDING ISN'T ENOUGH.
        </Mono>
        <Mono style={{ marginTop: 4, color: color.text, letterSpacing: 2, fontSize: 12 }}>
          PROVE IT.
        </Mono>
      </View>
      <View style={{ padding: space(6), paddingBottom: space(12) }}>
        <Btn title="Enter" onPress={() => go('dob')} />
        <Mono style={styles.footnote}>PRIVATE PARTIES ONLY · INVITE CODE REQUIRED</Mono>
      </View>
    </View>
  );
}

/**
 * The age gate, as a slider.
 *
 * **This supersedes PRD 3**, which specifies a blank date-of-birth field and
 * marks it [HARD CONSTRAINT] for COPPA, on the reasoning that anything easier
 * is "trivially defeated and not a good-faith gate". Angad's call, recorded
 * here and in the session handoff rather than made quietly, because it moves a
 * line the PRD draws in a section about a children's privacy statute.
 *
 * What is kept, so the gate stays as good-faith as a slider can be:
 *
 * - **No starting position.** The thumb does not exist until the player puts
 *   it somewhere. A slider pre-set to 18, or to any adult age, is a leading
 *   question with a default answer.
 * - **The range starts below 13.** If the lowest reachable value were 13 the
 *   control would announce the threshold, and a gate that shows you the
 *   passing answer is not a gate.
 * - **Nothing marks where the cutoff is.** No colour change, no tick, no label.
 * - **The refusal still sticks**, with the same three corrections as before.
 *
 * What is genuinely better: the date of birth is now never entered at all,
 * which goes further than PRD 3's promise not to store it. The app only ever
 * learns an age, and only ever keeps which side of 18 it falls on.
 */
const MIN_AGE = 8;
const MAX_AGE = 80;

/**
 * A typo should be correctable, but unlimited retries turn the age gate into a
 * guessing game, which is exactly what a good-faith gate is meant to avoid.
 * A few corrections, then it sticks.
 */
const MAX_CORRECTIONS = 3;

export function DobGate() {
  const { go, setAgeBracket } = useGame();
  const insets = useSafeAreaInsets();
  const [age, setAge] = useState<number | null>(null);
  const [refused, setRefused] = useState(false);
  const [corrections, setCorrections] = useState(0);
  const [track, setTrack] = useState(0);

  const submit = () => {
    if (age == null) return;
    if (age < 13) {
      setRefused(true);
      return;
    }
    // Only the bracket is kept, per PRD 3. Nothing here can reconstruct a
    // birthday, because nothing here ever asked for one.
    setAgeBracket(age >= 18 ? '18_plus' : '13_17');
    go('legal');
  };

  const reenter = () => {
    setCorrections((c) => c + 1);
    setRefused(false);
    setAge(null);
  };

  if (refused) {
    const attemptsLeft = MAX_CORRECTIONS - corrections;
    return (
      <View style={[styles.screen, { padding: space(6), justifyContent: 'center' }]}>
        <Label tone="danger">Not yet</Label>
        <Text style={styles.h1}>Hidewire is for players 13 and up.</Text>
        <Body style={{ color: color.dim, marginTop: space(3) }}>
          {attemptsLeft > 0
            ? 'If you set that wrong, you can correct it.'
            : 'You have used all your corrections on this device.'}
        </Body>
        {attemptsLeft > 0 && (
          <>
            <Btn
              title="Set my age again"
              variant="outline"
              style={{ marginTop: space(6) }}
              onPress={reenter}
            />
            <Mono style={{ fontSize: 10, color: color.faint, marginTop: space(3) }}>
              {attemptsLeft} {attemptsLeft === 1 ? 'CORRECTION' : 'CORRECTIONS'} LEFT
            </Mono>
          </>
        )}
      </View>
    );
  }

  const setFromX = (x: number) => {
    if (track <= 0) return;
    const frac = Math.max(0, Math.min(1, x / track));
    setAge(Math.round(MIN_AGE + frac * (MAX_AGE - MIN_AGE)));
  };

  const frac = age == null ? 0 : (age - MIN_AGE) / (MAX_AGE - MIN_AGE);

  return (
    <View style={styles.screen}>
      <View style={{ flex: 1, padding: space(6), paddingTop: insets.top + space(10) }}>
        <Label>Step 1 of 5</Label>
        <Text style={styles.h1}>How old are you?</Text>
        <Body style={{ color: color.dim, marginTop: space(2) }}>
          Asked once. Never shown to other players, and never stored as a date.
        </Body>

        <View style={{ alignItems: 'center', marginTop: space(10) }}>
          <Text style={[styles.ageValue, age == null && { color: color.faint }]}>
            {age ?? '--'}
          </Text>
          <Mono style={{ fontSize: 10, letterSpacing: 2, color: color.faint, marginTop: space(1) }}>
            YEARS OLD
          </Mono>
        </View>

        <View
          style={styles.sliderHit}
          onLayout={(e) => setTrack(e.nativeEvent.layout.width)}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={(e) => setFromX(e.nativeEvent.locationX)}
          onResponderMove={(e) => setFromX(e.nativeEvent.locationX)}
        >
          <View style={styles.sliderTrack} />
          {age != null && (
            <>
              <View style={[styles.sliderFill, { width: frac * track }]} />
              <View style={[styles.sliderThumb, { left: frac * track - 14 }]} />
            </>
          )}
        </View>

        <Mono style={styles.sliderHint}>
          {age == null ? 'TAP OR DRAG THE LINE TO SET YOUR AGE' : ' '}
        </Mono>
      </View>
      <View style={{ padding: space(6), paddingBottom: insets.bottom + space(6) }}>
        <Btn title="Continue" disabled={age == null} onPress={submit} />
      </View>
    </View>
  );
}

export function HandlePick() {
  const { go, setHandle } = useGame();
  const [v, setV] = useState('');
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={{ flex: 1, padding: space(6), paddingTop: insets.top + space(10) }}>
        <Label>Step 4 of 5</Label>
        <Text style={styles.h1}>Pick a handle</Text>
        <Body style={{ color: color.dim, marginTop: space(2) }}>
          This is what your party sees on the map and in the feed.
        </Body>
        <TextInput
          value={v}
          onChangeText={(t) => setV(t.replace(/[^a-zA-Z0-9_]/g, '').toUpperCase().slice(0, 12))}
          placeholder="HANDLE"
          placeholderTextColor={color.faint}
          autoFocus
          autoCapitalize="characters"
          autoCorrect={false}
          style={[styles.dateCell, { flex: 0, marginTop: space(8), letterSpacing: 3 }]}
        />
      </View>
      <View style={{ padding: space(6), paddingBottom: insets.bottom + space(6) }}>
        <Btn
          title="Continue"
          disabled={v.length < 3}
          onPress={() => {
            setHandle(v);
            // Into the tutorial, which is the first thing in this funnel the
            // player actually *does* rather than fills in. The permission
            // explainer that used to sit here requested nothing, so it was pure
            // reading in the one place a new player has the least patience for
            // it; each permission now explains itself at the moment it is
            // actually asked for, which is what that screen promised and the
            // funnel did not deliver.
            go('tutorial');
          }}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

/**
 * What each permission is for, in the player's language.
 *
 * This used to be its own onboarding step, which requested nothing and so was
 * pure reading placed before the player had any reason to care. The copy was
 * always right; the placement was wrong. It now renders next to the button
 * that actually triggers the system prompt, via PermissionNote.
 */
export const PERMS = {
  location: {
    name: 'LOCATION',
    note: 'Asked when you join your first round, never at launch. Between reveals, your position never leaves the server.',
  },
  camera: {
    name: 'CAMERA',
    note: 'Live in-app capture only. Hidewire never asks for gallery access.',
  },
  notifications: {
    name: 'NOTIFICATIONS',
    note: 'Check-in ticks arrive as time-sensitive alerts. Miss one and you are out.',
  },
  bluetooth: {
    name: 'BLUETOOTH',
    note: 'Used once per tag, to prove the seeker is actually next to you.',
  },
} as const;

export type PermKey = keyof typeof PERMS;

/** Drop this immediately above whatever triggers the system prompt. */
export function PermissionNote({ perm }: { perm: PermKey }) {
  const p = PERMS[perm];
  return (
    <View style={styles.permRow}>
      <View style={styles.permTick} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.permName}>{p.name}</Text>
        <Mono style={{ fontSize: 11, marginTop: 2, lineHeight: 16 }}>{p.note}</Mono>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  wordmark: {
    fontFamily: font.wordmark,
    // HIDEWIRE is eight characters where FRAME was five. At the old 56/10 it
    // overflowed a 375 pt screen and collided with the corner brackets, so the
    // size comes down and the tracking with it. The brackets are the constant
    // in this lockup, not the point size.
    fontSize: 38,
    letterSpacing: 6,
    color: color.text,
  },
  footnote: {
    fontSize: 9,
    letterSpacing: 1.5,
    color: color.faint,
    textAlign: 'center',
    marginTop: space(4),
  },
  h1: {
    fontFamily: font.display,
    fontSize: 30,
    color: color.text,
    marginTop: space(2),
    letterSpacing: -0.5,
  },
  dobError: {
    fontSize: 12,
    color: color.warn,
    marginTop: space(4),
    letterSpacing: 0.5,
  },
  ageValue: {
    fontFamily: font.numeral,
    fontSize: 76,
    color: color.text,
    fontVariant: ['tabular-nums'],
  },
  // A generous touch target around a thin line. The line is the design; the
  // hit area is 44pt so it is actually usable.
  sliderHit: {
    height: 44,
    marginTop: space(9),
    justifyContent: 'center',
  },
  sliderTrack: { height: 2, backgroundColor: color.lineBright },
  sliderFill: { position: 'absolute', height: 2, backgroundColor: color.accent },
  sliderThumb: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: color.accent,
  },
  sliderHint: {
    fontSize: 10,
    letterSpacing: 1.4,
    color: color.faint,
    textAlign: 'center',
    marginTop: space(4),
    minHeight: 14,
  },
  dateCell: {
    flex: 1,
    minWidth: 0,
    ...(Platform.OS === 'web' ? ({ outlineWidth: 0 } as object) : null),
    height: 62,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.lineBright,
    borderRadius: radius.md,
    color: color.text,
    fontFamily: font.monoSemi,
    fontSize: 20,
    textAlign: 'center',
  },
  permRow: {
    flexDirection: 'row',
    gap: space(3),
    paddingVertical: space(3),
    borderBottomWidth: 1,
    borderBottomColor: color.line,
  },
  permTick: {
    width: 8,
    height: 8,
    backgroundColor: color.accent,
    marginTop: 5,
    transform: [{ rotate: '45deg' }],
  },
  permName: {
    fontFamily: font.monoSemi,
    fontSize: 13,
    letterSpacing: 2,
    color: color.text,
  },
});
