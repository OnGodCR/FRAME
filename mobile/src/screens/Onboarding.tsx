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

const MAX_AGE = 120;
/**
 * A typo should be correctable, but unlimited retries turn the age gate into a
 * guessing game, which is exactly what a good-faith gate is meant to avoid.
 * A few corrections, then it sticks.
 */
const MAX_CORRECTIONS = 3;

/** Days in a month, leap-year aware, so 02/30 and 04/31 are rejected. */
function daysInMonth(month: number, year: number) {
  if (month === 2) {
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return leap ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/** Returns an error string, or null when the date is real and plausible. */
function validateDob(mm: string, dd: string, yyyy: string): string | null {
  const m = parseInt(mm, 10);
  const d = parseInt(dd, 10);
  const y = parseInt(yyyy, 10);
  if (!m || m < 1 || m > 12) return 'That month does not exist.';
  if (!y) return 'Check the year.';

  const now = new Date();
  if (y > now.getFullYear()) return 'That year is in the future.';
  if (y < now.getFullYear() - MAX_AGE) return `Nobody is over ${MAX_AGE}. Check the year.`;
  if (!d || d < 1 || d > daysInMonth(m, y)) return 'That day does not exist in that month.';

  const dob = new Date(y, m - 1, d);
  if (dob.getTime() > now.getTime()) return 'That date has not happened yet.';
  return null;
}

/** Whole years elapsed, counting whether this year's birthday has passed. */
function ageFrom(mm: string, dd: string, yyyy: string) {
  const now = new Date();
  const dob = new Date(parseInt(yyyy, 10), parseInt(mm, 10) - 1, parseInt(dd, 10));
  let age = now.getFullYear() - dob.getFullYear();
  const beforeBirthday =
    now.getMonth() < dob.getMonth() ||
    (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate());
  if (beforeBirthday) age--;
  return age;
}

export function DobGate() {
  const { go, setAgeBracket } = useGame();
  const [mm, setMm] = useState('');
  const [dd, setDd] = useState('');
  const [yyyy, setYyyy] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [refused, setRefused] = useState(false);
  const [corrections, setCorrections] = useState(0);
  const ddRef = useRef<TextInput>(null);
  const yyRef = useRef<TextInput>(null);
  const insets = useSafeAreaInsets();

  /**
   * Month and day are accepted as one digit or two.
   *
   * This used to require exactly two, and the failure was silent: somebody born
   * on the 1st of January typed 1 / 1 / 1998, got a Continue button that was
   * disabled with no message next to it, and had no way to find out why. The
   * app looked broken on the second screen of the funnel, which is the worst
   * possible place for it. A gate is allowed to reject a date. It is not
   * allowed to reject one without saying so.
   */
  const complete = mm.length >= 1 && dd.length >= 1 && yyyy.length === 4;

  /**
   * 1 becomes 01, applied only when the field is finished by a separator.
   *
   * **There is deliberately no padding on blur.** The first version of this did
   * pad on blur, via `setMm(pad(mm))`, and that reads `mm` from the render that
   * installed the handler. Typing the second digit moves focus, so the blur
   * fired holding the stale one-character value and overwrote the real one:
   * typing 05 left 00 in the field, and 12 left 01.
   *
   * A functional update fixes the staleness, but the padding is cosmetic and it
   * could not be shown to fire reliably, so it is gone instead. A one-character
   * month is valid input, `validateDob` reads it correctly, and 1/7/1998 is not
   * ambiguous. Fewer handlers on the gate that blocks the entire app is worth
   * more than a leading zero.
   */
  const pad = (v: string) => (v.length === 1 ? '0' + v : v);

  const submit = () => {
    const invalid = validateDob(mm, dd, yyyy);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    const age = ageFrom(mm, dd, yyyy);
    if (age < 13) {
      setRefused(true);
      return;
    }
    // Only the bracket is kept. The date of birth itself is never stored
    // (PRD 3): the bracket drives the ads rule and the 18+ Nearby gate, and
    // holding a birthdate would add real risk for no benefit.
    setAgeBracket(age >= 18 ? '18_plus' : '13_17');
    go('legal');
  };

  const reenter = () => {
    setCorrections((c) => c + 1);
    setRefused(false);
    setMm('');
    setDd('');
    setYyyy('');
    setError(null);
  };

  if (refused) {
    const attemptsLeft = MAX_CORRECTIONS - corrections;
    return (
      <View style={[styles.screen, { padding: space(6), justifyContent: 'center' }]}>
        <Label tone="danger">Not yet</Label>
        <Text style={styles.h1}>Hidewire is for players 13 and up.</Text>
        <Body style={{ color: color.dim, marginTop: space(3) }}>
          {attemptsLeft > 0
            ? 'If you mistyped your date of birth, you can correct it.'
            : 'You have used all your corrections on this device.'}
        </Body>
        {attemptsLeft > 0 && (
          <>
            <Btn
              title="Re-enter my date of birth"
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

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={{ flex: 1, padding: space(6), paddingTop: insets.top + space(10) }}>
        <Label>Step 1 of 5</Label>
        <Text style={styles.h1}>Date of birth</Text>
        <Body style={{ color: color.dim, marginTop: space(2) }}>
          Required once. Not shown to other players.
        </Body>
        <View style={{ flexDirection: 'row', gap: space(3), marginTop: space(8) }}>
          <DateCell
            value={mm}
            placeholder="MM"
            maxLength={2}
            onChange={(v, separator) => {
              setError(null);
              // Two digits, or a typed separator. Somebody entering "1/" means
              // January as clearly as "01" does.
              const advance = v.length === 2 || (separator && v.length >= 1);
              setMm(advance ? pad(v) : v);
              if (advance) ddRef.current?.focus();
            }}
            autoFocus
          />
          <DateCell
            inputRef={ddRef}
            value={dd}
            placeholder="DD"
            maxLength={2}
            onChange={(v, separator) => {
              setError(null);
              const advance = v.length === 2 || (separator && v.length >= 1);
              setDd(advance ? pad(v) : v);
              if (advance) yyRef.current?.focus();
            }}
          />
          <DateCell
            inputRef={yyRef}
            value={yyyy}
            placeholder="YYYY"
            maxLength={4}
            wide
            onChange={(v) => {
              setYyyy(v);
              setError(null);
            }}
          />
        </View>

        {error && (
          <Mono style={styles.dobError} accessibilityLiveRegion="polite">
            {error}
          </Mono>
        )}
      </View>
      <View style={{ padding: space(6), paddingBottom: insets.bottom + space(6) }}>
        <Btn title="Continue" disabled={!complete} onPress={submit} />
      </View>
    </KeyboardAvoidingView>
  );
}

function DateCell({
  value,
  onChange,
  placeholder,
  maxLength,
  wide,
  autoFocus,
  inputRef,
}: {
  value: string;
  /** Receives the digits, plus whether the raw input carried a separator. */
  onChange: (v: string, separator: boolean) => void;
  placeholder: string;
  maxLength: number;
  wide?: boolean;
  autoFocus?: boolean;
  inputRef?: React.RefObject<TextInput | null>;
}) {
  return (
    <TextInput
      ref={inputRef}
      value={value}
      onChangeText={(v) =>
        // The separator is detected before it is stripped, so the caller can
        // treat "1/" as a finished month.
        onChange(v.replace(/[^0-9]/g, ''), /[^0-9]/.test(v))
      }
      placeholder={placeholder}
      placeholderTextColor={color.faint}
      keyboardType="number-pad"
      maxLength={maxLength}
      autoFocus={autoFocus}
      style={[styles.dateCell, wide && { flex: 1.6 }]}
    />
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
