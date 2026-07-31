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
import * as Haptics from 'expo-haptics';
import { color, font, radius, space } from '../theme';
import { Body, Btn, Card, Label, Mono, Rule } from '../components/ui';
import { FadeIn } from '../components/motion';
import { ZoneMap } from '../components/ZoneMap';
import { useWorld } from '../engine/WorldContext';
import { useGame, SEEKER_BOT } from '../engine/GameContext';
import { PermissionNote } from './Onboarding';
import { TEST_MODE } from '../config';

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
          NO 0/O · NO 1/I/L · CODES SKIP AMBIGUOUS CHARACTERS
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
  /** A simulated player, added on purpose for review. Never a real person. */
  sim?: boolean;
}

/** PRD 4.1: a round needs at least three players. */
const MIN_PARTY = 3;
const MAX_PARTY = 6;

/**
 * Simulated players, for reviewing the round screens without four friends on
 * hand. Offsets are seconds after the host asks for them.
 *
 * These used to arrive on a timer the moment the lobby opened, whether anyone
 * wanted them or not. That was demo dressing that read as a real behaviour, and
 * a bad one: the splash screen promises PRIVATE PARTIES ONLY and the marketing
 * brief forbids implying stranger play, so a host watching unknown names appear
 * unbidden is the app contradicting its own core promise. Filling the lobby is
 * now something the host does deliberately, and the roster labels them.
 */
const SIM_SCHEDULE: { t: number; name: string }[] = [
  { t: 0, name: SEEKER_BOT.name },
  { t: 1, name: 'MAYA' },
  { t: 2, name: 'DEV' },
  { t: 3, name: 'JULES' },
  { t: 4, name: 'ARI' },
];

/**
 * Host settings, with the option sets from the PRD 4.2 table. Tapping a row
 * steps to the next option and wraps, which is faster one-handed than opening
 * a picker for six settings that all have short option lists.
 */
interface SettingDef {
  key: string;
  label: string;
  options: string[];
  /** Locked behind a level, per PRD 5.1. */
  lockedAbove?: number;
}

const SETTING_DEFS: SettingDef[] = [
  {
    key: 'zone',
    label: 'ZONE',
    options: ['300 M', '500 M', '1.0 KM', '2.0 KM', '5.0 KM', '10 KM'],
    lockedAbove: 4,
  },
  {
    key: 'round',
    label: 'ROUND',
    options: ['20 MIN', '30 MIN', '45 MIN', '60 MIN', '90 MIN', '120 MIN'],
    lockedAbove: 4,
  },
  { key: 'checkin', label: 'CHECK-IN', options: ['EVERY 3 MIN', 'EVERY 5 MIN', 'EVERY 10 MIN'] },
  {
    key: 'reveal',
    label: 'REVEAL',
    options: ['EVERY 5 MIN', 'EVERY 10 MIN', 'EVERY 15 MIN'],
  },
  { key: 'visible', label: 'REVEAL LASTS', options: ['15 S', '30 S', '60 S', 'PERMANENT'] },
  { key: 'seekers', label: 'SEEKERS', options: ['1', '2', '3'] },
  { key: 'cooldown', label: 'SEEKER COOLDOWN', options: ['2 MIN', '5 MIN', '10 MIN'] },
  { key: 'shrink', label: 'SHRINKING ZONE', options: ['ON', 'OFF'] },
  { key: 'buffs', label: 'BUFFS', options: ['ON', 'OFF'] },
  { key: 'spectate', label: 'SPECTATE AFTER OUT', options: ['ON', 'OFF'] },
];

const DEFAULT_SETTINGS: Record<string, number> = {
  zone: 2,
  round: 1,
  checkin: 1,
  reveal: 1,
  visible: 1,
  seekers: 0,
  cooldown: 1,
  shrink: 0,
  buffs: 0,
  spectate: 0,
};

/**
 * Named presets.
 *
 * Ten settings is a lot to hand a host who has never played, and the previous
 * version buried the only preset behind one APPLY RURAL PRESET link at the
 * bottom of the list, where nobody found it. These are the actual answer to
 * "what should I pick", so they go first and they say what they change.
 *
 * PRD 4.2: rural play is a settings problem, which is why it gets a preset
 * rather than a separate mode.
 */
export interface Preset {
  key: string;
  name: string;
  blurb: string;
  detail: string;
  settings: Record<string, number>;
}

export const PRESETS: Preset[] = [
  {
    key: 'city',
    name: 'CITY',
    blurb: 'The default. Dense streets, short walks.',
    detail: '1 KM · 30 MIN · CHECK-IN 5 MIN',
    settings: { ...DEFAULT_SETTINGS },
  },
  {
    key: 'sprint',
    name: 'SPRINT',
    blurb: 'One quick game. Good for a first round.',
    detail: '500 M · 20 MIN · CHECK-IN 3 MIN',
    settings: { ...DEFAULT_SETTINGS, zone: 1, round: 0, checkin: 0, reveal: 0, cooldown: 0 },
  },
  {
    key: 'rural',
    name: 'RURAL',
    blurb: 'Spread out, fewer landmarks, longer legs.',
    detail: '5 KM · 90 MIN · REVEALS STAY UP',
    settings: { ...DEFAULT_SETTINGS, zone: 4, round: 4, reveal: 0, visible: 3 },
  },
];

/** FILM per bid increment, and what the bots are willing to pay. */
const BID_STEP = 25;
const RIVAL_BID = TEST_MODE ? 75 : 0;

/** Which preset the current settings match, if any. */
function activePreset(s: Record<string, number>): string | null {
  const found = PRESETS.find((p) =>
    Object.keys(p.settings).every((k) => p.settings[k] === s[k]),
  );
  return found ? found.key : null;
}

const HOST_LEVEL_GATE = 20;

export function Lobby() {
  const { go, profile, partyCode, startRound, spendFilm } = useGame();
  const { world, status, request } = useWorld();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [elapsed, setElapsed] = useState(0);
  const [settings, setSettings] = useState<Record<string, number>>(DEFAULT_SETTINGS);

  // The zone centres on the host's position (PRD 4.2), so this is the moment
  // location is genuinely needed and therefore the right moment to ask.
  useEffect(() => {
    if (status.state === 'idle') request(1000);
  }, []);

  const cycle = (def: SettingDef) => {
    Haptics.selectionAsync();
    setSettings((s) => {
      const next = ((s[def.key] ?? 0) + 1) % def.options.length;
      return { ...s, [def.key]: next };
    });
  };

  const gatedNotice =
    profile.level < HOST_LEVEL_GATE &&
    SETTING_DEFS.some(
      (d) => d.lockedAbove !== undefined && (settings[d.key] ?? 0) >= d.lockedAbove,
    );
  const [acked, setAcked] = useState(false);
  const [safetyOpen, setSafetyOpen] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // null until the host explicitly asks for simulated players. Holds the
  // `elapsed` value at that moment so arrivals still stagger from the tap
  // rather than from when the lobby opened.
  const [simFrom, setSimFrom] = useState<number | null>(null);
  const simElapsed = simFrom == null ? -1 : elapsed - simFrom;

  const roster: RosterRow[] = [
    { name: profile.handle || 'YOU', ready: acked, you: true, host: true },
    ...(simFrom == null
      ? []
      : SIM_SCHEDULE.filter((j) => simElapsed >= j.t).map((j) => ({
          name: j.name,
          ready: simElapsed >= j.t + 2,
          sim: true,
        }))),
  ];

  const allIn = roster.length >= MIN_PARTY && roster.every((r) => r.ready);
  const canStart = acked && allIn;
  const preset = activePreset(settings);

  // Seeker bidding. Highest bid takes the role rather than the server rolling
  // for it. Bids are in FILM, which is earned only, never sold: see the note on
  // Profile.film. The winner PAYS, so this is a sink, not a reward, and wanting
  // to seek is a preference rather than an advantage.
  const [bid, setBid] = useState(0);
  // Nobody to outbid until there is somebody in the lobby to outbid.
  const topRivalBid = roster.some((r) => r.sim) ? RIVAL_BID : 0;
  const winningBid = bid > topRivalBid;
  const canBid = bid + BID_STEP <= profile.film;

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

        <FadeIn style={styles.codeHeader}>
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
        </FadeIn>

        <FadeIn index={1} style={styles.mapFrame}>
          <ZoneMap
            width={width - space(10) - 2}
            height={170}
            pois={world.pois}
            streets={world.streets}
            markers={[{ key: 'me', x: 0.5, y: 0.5, kind: 'self' }]}
          />
          <View style={styles.mapCaption}>
            <Mono style={{ fontSize: 9, letterSpacing: 1.2, color: color.dim }}>
              {`PLAY ZONE · 1.0 KM · ${world.label.toUpperCase()} · ${world.pois.length} POIs`}
            </Mono>
            {/* ODbL requires visible attribution wherever the data is shown.
                This is the quietest place in the app that still qualifies. */}
            <Mono style={{ fontSize: 8, letterSpacing: 1, color: color.faint, marginTop: 3 }}>
              MAP DATA © OPENSTREETMAP CONTRIBUTORS
            </Mono>
          </View>
        </FadeIn>

        {/* roster */}
        <Card style={{ marginTop: space(4), padding: 0 }}>
          <View style={styles.cardHeader}>
            <Label tone="text">Party</Label>
            <Mono style={{ fontSize: 10, color: color.dim }}>
              {roster.length}/{MAX_PARTY} · MIN {MIN_PARTY}
            </Mono>
          </View>
          {/* keyed by name so each arrival animates in as it joins */}
          {roster.map((r) => (
            <FadeIn key={r.name} distance={8} duration={300}>
              <View style={styles.rosterRow}>
                <View
                  style={[
                    styles.readyDot,
                    { backgroundColor: r.ready ? color.accent : color.faint },
                  ]}
                />
                <Text style={styles.rosterName}>{r.name}</Text>
                {r.host && <Text style={styles.hostTag}>HOST</Text>}
                {/* Never let a simulated name pass for a person. */}
                {r.sim && <Text style={styles.simTag}>TEST</Text>}
                <Mono style={{ fontSize: 10, color: r.ready ? color.accent : color.faint }}>
                  {r.ready ? 'READY' : 'JOINED'}
                </Mono>
              </View>
            </FadeIn>
          ))}

          {/* Empty state. The invite code is the only way anyone joins. */}
          {roster.length < MIN_PARTY && (
            <View style={styles.waitingRow}>
              <Mono style={{ fontSize: 11, color: color.dim, lineHeight: 17 }}>
                Waiting for {MIN_PARTY - roster.length} more.{' '}
                {simFrom == null
                  ? 'Send them the invite code above.'
                  : 'Test players are arriving.'}
              </Mono>
              <Mono style={{ fontSize: 9, color: color.faint, letterSpacing: 1, marginTop: 4 }}>
                NOBODY CAN JOIN WITHOUT THE CODE. HIDEWIRE NEVER MATCHES YOU WITH STRANGERS.
              </Mono>
              {simFrom == null && TEST_MODE && (
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setSimFrom(elapsed);
                  }}
                  style={({ pressed }) => [styles.simBtn, pressed && { opacity: 0.7 }]}
                >
                  <Mono style={styles.simBtnText}>ADD TEST PLAYERS</Mono>
                  <Mono style={{ fontSize: 9, color: color.faint, marginTop: 2 }}>
                    simulated, for trying the round out alone
                  </Mono>
                </Pressable>
              )}
            </View>
          )}
        </Card>

        {/* presets, before the ten individual dials */}
        <Card style={{ marginTop: space(4), padding: 0 }}>
          <View style={styles.cardHeader}>
            <Label tone="text">Preset</Label>
            <Mono style={{ fontSize: 10, color: color.faint }}>
              {preset ? 'MATCHED' : 'CUSTOM'}
            </Mono>
          </View>
          <View style={{ paddingHorizontal: space(4), paddingBottom: space(4), gap: space(2) }}>
            {PRESETS.map((p) => {
              const on = preset === p.key;
              return (
                <Pressable
                  key={p.key}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setSettings({ ...p.settings });
                  }}
                  style={({ pressed }) => [
                    styles.presetCard,
                    on && { borderColor: color.accent, backgroundColor: color.surface2 },
                    pressed && { opacity: 0.75 },
                  ]}
                >
                  <View style={styles.presetTop}>
                    <Mono style={[styles.presetName, on && { color: color.accent }]}>
                      {p.name}
                    </Mono>
                    {on && (
                      <Mono style={{ fontSize: 9, letterSpacing: 1.2, color: color.accent }}>
                        ACTIVE
                      </Mono>
                    )}
                  </View>
                  <Mono style={styles.presetBlurb}>{p.blurb}</Mono>
                  <Mono style={styles.presetDetail}>{p.detail}</Mono>
                </Pressable>
              );
            })}
            <Mono style={{ fontSize: 9, color: color.faint, lineHeight: 14 }}>
              Pick one, then change anything below. Editing a dial makes it CUSTOM.
            </Mono>
          </View>
        </Card>

        {/* settings */}
        <Card style={{ marginTop: space(4), padding: 0 }}>
          <View style={styles.cardHeader}>
            <Label tone="text">Round settings</Label>
            <Mono style={{ fontSize: 10, color: color.faint }}>HOST ONLY</Mono>
          </View>
          {SETTING_DEFS.map((def) => {
            const idx = settings[def.key] ?? 0;
            const locked =
              def.lockedAbove !== undefined &&
              profile.level < HOST_LEVEL_GATE &&
              idx >= def.lockedAbove;
            return (
              <Pressable
                key={def.key}
                onPress={() => cycle(def)}
                style={({ pressed }) => [
                  styles.settingRow,
                  pressed && { backgroundColor: color.surface2 },
                ]}
              >
                <Label tone="faint">{def.label}</Label>
                <View style={styles.settingValue}>
                  <Mono style={{ fontSize: 11, color: locked ? color.warn : color.text }}>
                    {def.options[idx]}
                  </Mono>
                  <Mono style={styles.settingChevron}>›</Mono>
                </View>
              </Pressable>
            );
          })}
          {gatedNotice && (
            <View style={styles.gateNotice}>
              <Mono style={{ fontSize: 10, color: color.warn, lineHeight: 15 }}>
                Zones above 2 km and rounds over 60 minutes unlock at level{' '}
                {HOST_LEVEL_GATE}. Keeps a first game from becoming unmanageable.
              </Mono>
            </View>
          )}
        </Card>

        {/* seeker bidding */}
        <Card style={{ marginTop: space(4), padding: 0 }}>
          <View style={styles.cardHeader}>
            <Label tone="text">Bid to seek</Label>
            <Mono style={{ fontSize: 10, color: color.faint }}>OPTIONAL</Mono>
          </View>
          <View style={{ paddingHorizontal: space(4), paddingBottom: space(4) }}>
            <Mono style={{ fontSize: 11, color: color.dim, lineHeight: 17 }}>
              Nobody has to seek. If more than one of you wants it, the highest bid
              takes the role and pays. Otherwise it is assigned at random.
            </Mono>

            <View style={styles.bidRow}>
              <View>
                <Label tone="faint">YOUR BID</Label>
                <Text style={[styles.bidValue, winningBid && { color: color.accent }]}>
                  {bid}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Label tone="faint">TOP BID</Label>
                <Text style={styles.bidRival}>
                  {Math.max(topRivalBid, bid)}
                  {winningBid ? ' · YOU' : topRivalBid > 0 ? ' · KAI' : ''}
                </Text>
              </View>
            </View>

            <View style={styles.bidControls}>
              <Pressable
                disabled={bid === 0}
                onPress={() => {
                  Haptics.selectionAsync();
                  setBid((b) => Math.max(0, b - BID_STEP));
                }}
                style={({ pressed }) => [
                  styles.bidBtn,
                  bid === 0 && { opacity: 0.4 },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Mono style={styles.bidBtnText}>−{BID_STEP}</Mono>
              </Pressable>
              <Pressable
                disabled={!canBid}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setBid((b) => b + BID_STEP);
                }}
                style={({ pressed }) => [
                  styles.bidBtn,
                  !canBid && { opacity: 0.4 },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Mono style={styles.bidBtnText}>+{BID_STEP}</Mono>
              </Pressable>
              <View style={{ flex: 1 }} />
              <Mono style={{ fontSize: 10, color: color.faint }}>
                {profile.film - bid} FILM LEFT
              </Mono>
            </View>

            {!canBid && bid < profile.film + BID_STEP && (
              <Mono style={{ fontSize: 10, color: color.warn, marginTop: space(2) }}>
                Not enough FILM. Earn it from daily assignments and rounds.
              </Mono>
            )}
            <Mono style={{ fontSize: 9, color: color.faint, marginTop: space(2), lineHeight: 14 }}>
              FILM IS EARNED, NEVER SOLD. SEEKING IS A ROLE, NOT AN ADVANTAGE.
            </Mono>
          </View>
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
              {acked ? 'Safety card: acknowledged' : 'Safety card'}
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
        {/* Starting the round is what asks for notification permission, so
            the explanation belongs here rather than four screens back in a
            list the player skimmed before any of it meant anything. */}
        {canStart && <PermissionNote perm="notifications" />}
        <Btn
          title="Start round"
          disabled={!canStart}
          sub={
            canStart
              ? winningBid
                ? `you win the bid at ${bid} FILM · you seek`
                : 'seeker assigned at random, server-side'
              : roster.length < MIN_PARTY
                ? `needs ${MIN_PARTY} players, you have ${roster.length}`
                : !acked
                  ? 'acknowledge the safety card first'
                  : 'waiting for everyone to be ready…'
          }
          onPress={() => {
            // Winning the bid buys the role and the FILM is spent either way.
            if (winningBid) spendFilm(bid);
            startRound(winningBid ? 'seeker' : 'hider');
          }}
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
  'Public places only. Fence, gate, "no trespassing" sign. That spot is out.',
  "Stay off roads and away from traffic. Don't hide between parked cars.",
  'Walk. The app suspends your round over 10 mph anyway.',
  'If security, staff, or a cop tells you to stop, stop. The round does not matter.',
  'The law still applies while you play.',
  'You can leave any time. SOS → Leave round. No penalty, nobody gets flagged.',
  "Charge your phone. GPS and camera drain fast. Under 40% you probably won't finish the round.",
];

function SafetyOverlay({ onAck, onClose }: { onAck: () => void; onClose: () => void }) {
  const [reachedEnd, setReachedEnd] = useState(false);
  const [viewH, setViewH] = useState(0);
  const [contentH, setContentH] = useState(0);
  const insets = useSafeAreaInsets();
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 40) {
      setReachedEnd(true);
    }
  };

  // Same fits-entirely case as the legal gate, and the stakes are higher: this
  // gate is the only thing standing between a tall-screen player and never
  // being able to start a round. onLayout and onContentSizeChange fire in an
  // order that is not guaranteed, so the comparison belongs in an effect that
  // re-runs when either value lands rather than inside one of the handlers.
  useEffect(() => {
    if (viewH > 0 && contentH > 0 && contentH <= viewH + 8) setReachedEnd(true);
  }, [viewH, contentH]);
  return (
    <View style={[styles.safetyOverlay, { paddingTop: insets.top + space(4) }]}>
      <View style={{ paddingHorizontal: space(6) }}>
        <Label tone="danger">Read all of it</Label>
        <Text style={styles.h1}>Before you play</Text>
      </View>
      <ScrollView
        onScroll={onScroll}
        onLayout={(e) => setViewH(e.nativeEvent.layout.height)}
        onContentSizeChange={(_, h) => setContentH(h)}
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
          people in it. You are responsible for where you put yourself.
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
    paddingVertical: space(3),
    borderTopWidth: 1,
    borderTopColor: color.line,
  },
  settingValue: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  settingChevron: { fontSize: 14, color: color.faint, marginTop: -2 },
  simTag: {
    fontFamily: font.monoSemi,
    fontSize: 8,
    letterSpacing: 1.2,
    color: color.warn,
    borderWidth: 1,
    borderColor: color.warn,
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
    marginRight: space(2),
  },
  waitingRow: {
    paddingHorizontal: space(4),
    paddingVertical: space(3.5),
    borderTopWidth: 1,
    borderTopColor: color.line,
  },
  simBtn: {
    marginTop: space(3),
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: color.lineBright,
    borderRadius: radius.sm,
    alignItems: 'center',
    paddingVertical: space(2.5),
  },
  simBtnText: { fontSize: 10, letterSpacing: 1.4, color: color.text },
  bidRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: space(3),
  },
  bidValue: {
    fontFamily: font.display,
    fontSize: 30,
    color: color.text,
    fontVariant: ['tabular-nums'],
  },
  bidRival: {
    fontFamily: font.monoSemi,
    fontSize: 14,
    color: color.dim,
  },
  bidControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(2),
    marginTop: space(3),
  },
  bidBtn: {
    borderWidth: 1,
    borderColor: color.lineBright,
    borderRadius: radius.sm,
    paddingVertical: space(2),
    paddingHorizontal: space(3.5),
  },
  bidBtnText: { fontSize: 12, letterSpacing: 1, color: color.text },
  presetCard: {
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.md,
    padding: space(3),
  },
  presetTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  presetName: { fontSize: 13, letterSpacing: 2, color: color.text },
  presetBlurb: { fontSize: 11, color: color.dim, marginTop: 3, lineHeight: 16 },
  presetDetail: { fontSize: 9, letterSpacing: 1.2, color: color.faint, marginTop: 4 },
  presetRow: {
    paddingHorizontal: space(4),
    paddingVertical: space(3),
    borderTopWidth: 1,
    borderTopColor: color.line,
    alignItems: 'center',
    gap: 3,
  },
  presetText: { fontSize: 10, letterSpacing: 1.4, color: color.accent },
  gateNotice: {
    paddingHorizontal: space(4),
    paddingVertical: space(3),
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
