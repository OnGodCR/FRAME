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

const CURRENT_YEAR = 2026;

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
          <Animated.Text style={[styles.wordmark, { opacity: blink }]}>FRAME</Animated.Text>
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

export function DobGate() {
  const { go } = useGame();
  const [mm, setMm] = useState('');
  const [dd, setDd] = useState('');
  const [yyyy, setYyyy] = useState('');
  const [refused, setRefused] = useState(false);
  const ddRef = useRef<TextInput>(null);
  const yyRef = useRef<TextInput>(null);
  const insets = useSafeAreaInsets();

  const complete = mm.length === 2 && dd.length === 2 && yyyy.length === 4;
  const submit = () => {
    const age = CURRENT_YEAR - parseInt(yyyy, 10);
    if (age < 13) {
      setRefused(true);
      return;
    }
    go('handle');
  };

  if (refused) {
    return (
      <View style={[styles.screen, { padding: space(6), justifyContent: 'center' }]}>
        <Label tone="danger">Not yet</Label>
        <Text style={styles.h1}>FRAME is for players 13 and up.</Text>
        <Body style={{ color: color.dim, marginTop: space(3) }}>
          This decision is remembered on this device. Changing the date won't change the
          answer.
        </Body>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={{ flex: 1, padding: space(6), paddingTop: insets.top + space(10) }}>
        <Label>Step 1 of 3</Label>
        <Text style={styles.h1}>Date of birth</Text>
        <Body style={{ color: color.dim, marginTop: space(2) }}>
          Required once. Not shown to other players.
        </Body>
        <View style={{ flexDirection: 'row', gap: space(3), marginTop: space(8) }}>
          <DateCell
            value={mm}
            placeholder="MM"
            maxLength={2}
            onChange={(v) => {
              setMm(v);
              if (v.length === 2) ddRef.current?.focus();
            }}
            autoFocus
          />
          <DateCell
            inputRef={ddRef}
            value={dd}
            placeholder="DD"
            maxLength={2}
            onChange={(v) => {
              setDd(v);
              if (v.length === 2) yyRef.current?.focus();
            }}
          />
          <DateCell
            inputRef={yyRef}
            value={yyyy}
            placeholder="YYYY"
            maxLength={4}
            wide
            onChange={setYyyy}
          />
        </View>
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
  onChange: (v: string) => void;
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
      onChangeText={(v) => onChange(v.replace(/[^0-9]/g, ''))}
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
        <Label>Step 2 of 3</Label>
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
            go('permissions');
          }}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const PERMS = [
  {
    name: 'LOCATION',
    note: "Asked when you join your first round — never at launch. Between reveals, your position never leaves the server.",
  },
  {
    name: 'CAMERA',
    note: 'Live in-app capture only. FRAME never asks for gallery access.',
  },
  {
    name: 'NOTIFICATIONS',
    note: 'Check-in ticks arrive as time-sensitive alerts. Miss one and you are out.',
  },
  {
    name: 'BLUETOOTH',
    note: 'Used once per tag, to prove the seeker is actually next to you.',
  },
];

export function Permissions() {
  const { go } = useGame();
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.screen}>
      <View style={{ flex: 1, padding: space(6), paddingTop: insets.top + space(10) }}>
        <Label>Step 3 of 3</Label>
        <Text style={styles.h1}>What FRAME will ask for</Text>
        <Body style={{ color: color.dim, marginTop: space(2), marginBottom: space(4) }}>
          Each permission is requested in context, the first time it's needed.
        </Body>
        {PERMS.map((p) => (
          <View key={p.name} style={styles.permRow}>
            <View style={styles.permTick} />
            <View style={{ flex: 1 }}>
              <Text style={styles.permName}>{p.name}</Text>
              <Mono style={{ fontSize: 12, marginTop: 2, lineHeight: 17 }}>{p.note}</Mono>
            </View>
          </View>
        ))}
      </View>
      <View style={{ padding: space(6), paddingBottom: insets.bottom + space(6) }}>
        <Btn title="Got it" onPress={() => go('home')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  wordmark: {
    fontFamily: font.display,
    fontSize: 56,
    letterSpacing: 10,
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
