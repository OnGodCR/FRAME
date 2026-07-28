import React, { useEffect, useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, font, radius, space } from '../theme';
import { Body, Btn, Card, Label, Mono, Rule } from '../components/ui';
import { ZoneMap } from '../components/ZoneMap';
import { useGame, SEEKER_BOT } from '../engine/GameContext';

// ---------- join ----------

export function Join() {
  const { go } = useGame();
  const [code, setCode] = useState('');
  const inputRef = useRef<TextInput>(null);
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (code.length === 6) {
      const t = setTimeout(() => go('lobby'), 350);
      return () => clearTimeout(t);
    }
  }, [code]);
  return (
    <View style={styles.screen}>
      <View style={{ flex: 1, padding: space(6), paddingTop: insets.top + space(10) }}>
        <Pressable onPress={() => go('home')} hitSlop={10}>
          <Label tone="faint">← Back</Label>
        </Pressable>
        <Text style={styles.h1}>Enter invite code</Text>
        <Body style={{ color: color.dim, marginTop: space(2) }}>
          Codes come from someone already in the party. There's no other way in.
        </Body>
        <Pressable
          style={styles.codeRow}
          onPress={() => inputRef.current?.focus()}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <View
              key={i}
              style={[styles.codeCell, i === code.length && styles.codeCellActive]}
            >
              <Text style={styles.codeChar}>{code[i] ?? ''}</Text>
            </View>
          ))}
        </Pressable>
        <TextInput
          ref={inputRef}
          value={code}
          onChangeText={(v) =>
            setCode(v.replace(/[^a-hj-km-np-zA-HJ-KM-NP-Z2-9]/g, '').toUpperCase().slice(0, 6))
          }
          autoFocus
          autoCapitalize="characters"
          autoCorrect={false}
          style={{ position: 'absolute', opacity: 0, height: 1 }}
        />
        <Mono style={{ fontSize: 10, color: color.faint, marginTop: space(3) }}>
          NO 0/O · NO 1/I/L — CODES SKIP AMBIGUOUS CHARACTERS
        </Mono>
      </View>
    </View>
  );
}

// ---------- lobby ----------

interface RosterRow {
  name: string;
  ready: boolean;
  you?: boolean;
  host?: boolean;
}

const JOIN_SCHEDULE: { t: number; name: string }[] = [
  { t: 1, name: SEEKER_BOT.name },
  { t: 2, name: 'MAYA' },
  { t: 4, name: 'DEV' },
  { t: 5, name: 'JULES' },
  { t: 7, name: 'ARI' },
];

const SETTINGS: { k: string; v: string }[] = [
  { k: 'ZONE', v: '1.0 KM RADIUS' },
  { k: 'ROUND', v: '45 MIN' },
  { k: 'CHECK-IN', v: 'EVERY 5 MIN' },
  { k: 'REVEAL', v: 'EVERY 10 MIN · 30 S' },
  { k: 'SEEKERS', v: '1' },
  { k: 'SHRINKING ZONE', v: 'ON' },
];

export function Lobby() {
  const { go, profile, partyCode, startRound } = useGame();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [elapsed, setElapsed] = useState(0);
  const [acked, setAcked] = useState(false);
  const [safetyOpen, setSafetyOpen] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const roster: RosterRow[] = [
    { name: profile.handle || 'YOU', ready: acked, you: true, host: true },
    ...JOIN_SCHEDULE.filter((j) => elapsed >= j.t).map((j) => ({
      name: j.name,
      ready: elapsed >= j.t + 3,
    })),
  ];
  const allBotsIn = elapsed >= 10;
  const canStart = acked && allBotsIn;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={{
          padding: space(5),
          paddingTop: insets.top + space(4),
          paddingBottom: space(4),
        }}
      >
        <Pressable onPress={() => go('home')} hitSlop={10}>
          <Label tone="faint">← Leave party</Label>
        </Pressable>

        <View style={styles.codeHeader}>
          <View>
            <Label tone="faint">Invite code</Label>
            <Text style={styles.bigCode}>{partyCode}</Text>
          </View>
          <View style={styles.expiry}>
            <Label tone="faint" style={{ fontSize: 8 }}>
              EXPIRES
            </Label>
            <Mono style={{ fontSize: 12, color: color.dim }}>
              {(() => {
                const s = 4 * 3600 - 140 - elapsed;
                const h = Math.floor(s / 3600);
                const m = Math.floor((s % 3600) / 60);
                const ss = s % 60;
                return `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
              })()}
            </Mono>
          </View>
        </View>

        <View style={styles.mapFrame}>
          <ZoneMap
            width={width - space(10) - 2}
            height={170}
            seed={7}
            markers={[{ key: 'me', x: 0.5, y: 0.52, kind: 'self' }]}
          />
          <View style={styles.mapCaption}>
            <Mono style={{ fontSize: 9, letterSpacing: 1.2, color: color.dim }}>
              PLAY ZONE · 1.0 KM · CENTER: YOUR LOCATION
            </Mono>
          </View>
        </View>

        {/* roster */}
        <Card style={{ marginTop: space(4), padding: 0 }}>
          <View style={styles.cardHeader}>
            <Label tone="text">Party</Label>
            <Mono style={{ fontSize: 10, color: color.dim }}>{roster.length}/6 · MIN 3</Mono>
          </View>
          {roster.map((r) => (
            <View key={r.name} style={styles.rosterRow}>
              <View
                style={[
                  styles.readyDot,
                  { backgroundColor: r.ready ? color.accent : color.faint },
                ]}
              />
              <Text style={styles.rosterName}>{r.name}</Text>
              {r.host && (
                <Text style={styles.hostTag}>HOST</Text>
              )}
              <Mono style={{ fontSize: 10, color: r.ready ? color.accent : color.faint }}>
                {r.ready ? 'READY' : 'JOINED'}
              </Mono>
            </View>
          ))}
        </Card>

        {/* settings */}
        <Card style={{ marginTop: space(4), padding: 0 }}>
          <View style={styles.cardHeader}>
            <Label tone="text">Round settings</Label>
            <Mono style={{ fontSize: 10, color: color.faint }}>HOST ONLY</Mono>
          </View>
          {SETTINGS.map((s) => (
            <View key={s.k} style={styles.settingRow}>
              <Label tone="faint">{s.k}</Label>
              <Mono style={{ fontSize: 11, color: color.text }}>{s.v}</Mono>
            </View>
          ))}
        </Card>

        {/* safety gate */}
        <Card
          style={{
            marginTop: space(4),
            borderColor: acked ? color.line : color.warn,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Label tone={acked ? 'accent' : 'text'}>
              {acked ? 'Safety card — acknowledged' : 'Safety card'}
            </Label>
            {!acked && <Label tone="faint">REQUIRED</Label>}
          </View>
          <Mono style={{ fontSize: 12, marginTop: space(2), lineHeight: 18 }}>
            Every player reads and acknowledges the safety card before the host can
            start. Logged per player, per round.
          </Mono>
          {!acked && (
            <Btn
              title="Read safety card"
              variant="ghost"
              style={{ marginTop: space(3) }}
              onPress={() => setSafetyOpen(true)}
            />
          )}
        </Card>
      </ScrollView>

      <View
        style={{
          padding: space(5),
          paddingBottom: insets.bottom + space(4),
          borderTopWidth: 1,
          borderTopColor: color.line,
        }}
      >
        <Btn
          title="Start round"
          disabled={!canStart}
          sub={
            canStart
              ? 'seeker assigned at random, server-side'
              : !acked
                ? 'acknowledge the safety card first'
                : 'waiting for players…'
          }
          onPress={() => startRound('hider')}
        />
      </View>

      {safetyOpen && (
        <SafetyOverlay
          onAck={() => {
            setAcked(true);
            setSafetyOpen(false);
          }}
          onClose={() => setSafetyOpen(false)}
        />
      )}
    </View>
  );
}

const RULES = [
  'Public places only. Fence, gate, "no trespassing" sign — that spot is out.',
  "Stay off roads and away from traffic. Don't hide between parked cars.",
  'Walk. The app suspends your round over 10 mph anyway.',
  'If security, staff, or a cop tells you to stop, stop. The round does not matter.',
  'The law still applies while you play.',
  'You can leave any time. SOS → Leave round. No penalty, nobody gets flagged.',
  "Charge your phone. GPS and camera drain fast — under 40% you probably won't finish the round.",
];

function SafetyOverlay({ onAck, onClose }: { onAck: () => void; onClose: () => void }) {
  const [reachedEnd, setReachedEnd] = useState(false);
  const [viewH, setViewH] = useState(0);
  const insets = useSafeAreaInsets();
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 40) {
      setReachedEnd(true);
    }
  };
  return (
    <View style={[styles.safetyOverlay, { paddingTop: insets.top + space(4) }]}>
      <View style={{ paddingHorizontal: space(6) }}>
        <Label tone="danger">Read all of it</Label>
        <Text style={styles.h1}>Before you play</Text>
      </View>
      <ScrollView
        onScroll={onScroll}
        onLayout={(e) => setViewH(e.nativeEvent.layout.height)}
        onContentSizeChange={(_, h) => {
          if (viewH > 0 && h <= viewH + 8) setReachedEnd(true);
        }}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator
        style={{ flex: 1, marginTop: space(4) }}
        contentContainerStyle={{ paddingHorizontal: space(6), paddingBottom: space(8) }}
      >
        {RULES.map((r, i) => (
          <View key={i} style={styles.ruleRow}>
            <Text style={styles.ruleIndex}>{String(i + 1).padStart(2, '0')}</Text>
            <Body style={{ flex: 1, color: color.text }}>{r}</Body>
          </View>
        ))}
        <Rule style={{ marginVertical: space(4) }} />
        <Mono style={{ fontSize: 11, lineHeight: 17, color: color.faint }}>
          Your acknowledgment is logged for this round. This is a real place with real
          people in it — you are responsible for where you put yourself.
        </Mono>
      </ScrollView>
      <View style={{ padding: space(6), paddingBottom: insets.bottom + space(5) }}>
        <Btn
          title={reachedEnd ? 'I understand' : 'Scroll to the end'}
          disabled={!reachedEnd}
          onPress={onAck}
        />
        <View style={{ height: space(2) }} />
        <Btn title="Close" variant="outline" onPress={onClose} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  h1: {
    fontFamily: font.display,
    fontSize: 30,
    color: color.text,
    marginTop: space(2),
    letterSpacing: -0.5,
  },
  codeRow: {
    flexDirection: 'row',
    gap: space(2),
    marginTop: space(8),
  },
  codeCell: {
    flex: 1,
    height: 62,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.lineBright,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeCellActive: { borderColor: color.accent },
  codeChar: {
    fontFamily: font.monoSemi,
    fontSize: 24,
    color: color.text,
  },
  codeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: space(4),
    marginBottom: space(4),
  },
  bigCode: {
    fontFamily: font.display,
    fontSize: 40,
    letterSpacing: 8,
    color: color.accent,
    marginTop: 2,
  },
  expiry: { alignItems: 'flex-end', paddingBottom: 6 },
  mapFrame: {
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  mapCaption: {
    paddingVertical: space(2),
    paddingHorizontal: space(3),
    backgroundColor: color.surface,
    borderTopWidth: 1,
    borderTopColor: color.line,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: space(4),
    paddingBottom: space(3),
  },
  rosterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space(4),
    paddingVertical: space(2.5),
    borderTopWidth: 1,
    borderTopColor: color.line,
    gap: space(3),
  },
  readyDot: { width: 7, height: 7, borderRadius: 4 },
  rosterName: {
    fontFamily: font.monoSemi,
    fontSize: 13,
    letterSpacing: 1.5,
    color: color.text,
    flex: 1,
  },
  hostTag: {
    fontFamily: font.monoMed,
    fontSize: 8,
    letterSpacing: 1.2,
    color: color.bg,
    backgroundColor: color.dim,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
    overflow: 'hidden',
    marginRight: space(2),
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space(4),
    paddingVertical: space(2.5),
    borderTopWidth: 1,
    borderTopColor: color.line,
  },
  ruleRow: {
    flexDirection: 'row',
    gap: space(3),
    paddingVertical: space(3),
    borderBottomWidth: 1,
    borderBottomColor: color.line,
  },
  ruleIndex: {
    fontFamily: font.monoSemi,
    fontSize: 13,
    color: color.accent,
    width: 26,
  },
  safetyOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: color.bg,
    zIndex: 10,
  },
});
