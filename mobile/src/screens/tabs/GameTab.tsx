import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { color, font, radius, space } from '../../theme';
import { Btn, Label, Mono } from '../../components/ui';
import { FadeIn, PressScale } from '../../components/motion';
import { useGame } from '../../engine/GameContext';
import { MISSION_SWEEP_BONUS } from '../../data/missions';
import { DAILY_REWARD } from '../../data/assignments';
import type { Tab } from '../../components/TabBar';

// ---------------------------------------------------------------------------
// The Game tab.
//
// Order matters and it changed: **the two play buttons are first now.** They
// used to sit below missions, so a returning player who opened the app to start
// a round had to read a chore list before reaching the button they came for.
// Missions answer "what should I do today", which is the second question a
// player has, not the first.
//
//   1. Host / Join         what a returning player came to do
//   2. Missions            what to do today
//   3. Today's assignment  the one thing playable alone, right now
//   4. Lifetime            where you are
//   5. Ad
//
// The assignment stays even though it was not in the requested order, because
// mission 2 points straight at it, and taking it out returns the tab to the
// empty screen this layout exists to fix.
// ---------------------------------------------------------------------------

/**
 * Stat colours, borrowed from the cosmetic palette in data/catalog.ts.
 *
 * Deliberately from that list rather than invented: the product has one accent
 * and a small set of cosmetic tints, and a fifth colour scheme appearing on the
 * home screen would read as a different app.
 */
const STAT_TINT = {
  film: color.accent,
  level: '#9BE8FF',
  streak: '#FF8A5C',
  rounds: '#D8B4FF',
};

export function GameTab({ onTab }: { onTab: (t: Tab) => void }) {
  const {
    go,
    missions,
    missionsComplete,
    missionSweepPaid,
    claimMissionSweep,
    hasAccount,
    daily,
    dailyAssignment,
    dailyOpen,
    startSolo,
    profile,
    seen,
  } = useGame();

  const doneCount = missions.filter((m) => m.done).length;

  return (
    <ScrollView
      contentContainerStyle={{ padding: space(5), paddingBottom: space(6) }}
      showsVerticalScrollIndicator={false}
    >
      {/* ---- 1. play ---- */}
      <FadeIn>
        <View style={{ gap: space(3) }}>
          <Btn title="Host a round" onPress={() => go('lobby')} />
          <Btn title="Join with code" variant="outline" onPress={() => go('join')} />
        </View>
      </FadeIn>

      {/* ---- 2. missions ---- */}
      <FadeIn index={1}>
        <View style={[styles.section, { marginTop: space(5) }]}>
          <View style={styles.sectionHead}>
            <Label tone="text">Missions</Label>
            <Mono style={styles.progress}>
              {doneCount}/{missions.length}
            </Mono>
          </View>

          <View style={styles.missionList}>
            {missions.map((m, i) => (
              <PressScale
                key={m.key}
                disabled={m.done}
                onPress={() => (m.goto === 'social' ? onTab('social') : go(m.goto))}
              >
                <View style={[styles.mission, m.done && styles.missionDone]}>
                  <View style={[styles.tick, m.done && styles.tickOn]}>
                    <Mono style={[styles.tickMark, m.done && { color: color.black }]}>
                      {m.done ? '✓' : i + 1}
                    </Mono>
                  </View>
                  <Text
                    style={[styles.missionLabel, m.done && styles.missionLabelDone]}
                    numberOfLines={1}
                  >
                    {m.label}
                  </Text>
                  {m.film > 0 && !m.done && <Mono style={styles.missionPay}>+{m.film}</Mono>}
                  {!m.done && <Mono style={styles.chev}>›</Mono>}
                </View>
              </PressScale>
            ))}
          </View>

          {hasAccount && (
            <View style={[styles.sweep, missionsComplete && !missionSweepPaid && styles.sweepReady]}>
              {missionSweepPaid ? (
                <Mono style={styles.sweepDone}>ALL MISSIONS DONE TODAY · PAID</Mono>
              ) : missionsComplete ? (
                <PressScale
                  onPress={() => {
                    const paid = claimMissionSweep();
                    if (paid > 0) {
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    }
                  }}
                >
                  <Mono style={styles.sweepClaim}>CLAIM {MISSION_SWEEP_BONUS} FILM →</Mono>
                </PressScale>
              ) : (
                <Mono style={styles.sweepPending}>
                  FINISH ALL {missions.length} FOR {MISSION_SWEEP_BONUS} FILM
                </Mono>
              )}
            </View>
          )}
        </View>
      </FadeIn>

      {/* ---- 3. today's assignment ---- */}
      <FadeIn index={2}>
        <View style={[styles.section, { marginTop: space(4) }]}>
          <View style={styles.sectionHead}>
            <Label tone="accent">Today's assignment</Label>
            {daily.streak > 0 ? (
              <Mono style={styles.streak}>{daily.streak} WK STREAK</Mono>
            ) : (
              <Mono style={styles.progress}>+{DAILY_REWARD.film} FILM</Mono>
            )}
          </View>

          <View style={styles.promptWrap}>
            <Text style={styles.prompt} numberOfLines={3}>
              {dailyAssignment.text}
            </Text>
          </View>

          {dailyOpen ? (
            <Btn
              title="Take the shot"
              style={{ marginTop: space(3) }}
              sub={`+${Math.round(DAILY_REWARD.xp * 1000)} XP · +${DAILY_REWARD.film} FILM`}
              onPress={() => startSolo()}
            />
          ) : (
            <View style={styles.doneChip}>
              <Mono style={styles.doneChipText}>DONE TODAY · NEXT ONE AT MIDNIGHT</Mono>
            </View>
          )}
        </View>
      </FadeIn>

      {/* ---- 4. lifetime ---- */}
      <FadeIn index={3}>
        <View style={[styles.sectionHead, { marginTop: space(5) }]}>
          <Label tone="text">Lifetime</Label>
        </View>
        <View style={styles.statGrid}>
          <StatCard
            glyph="film"
            k="FILM"
            v={compact(profile.film)}
            tint={STAT_TINT.film}
            fill={Math.min(1, profile.film / 20000)}
            note="IN THE BANK"
          />
          <StatCard
            glyph="level"
            k="LEVEL"
            v={String(profile.level)}
            tint={STAT_TINT.level}
            fill={profile.xp}
            note={`${Math.round(profile.xp * 100)}% TO ${profile.level + 1}`}
          />
          <StatCard
            glyph="streak"
            k="STREAK"
            v={String(daily.streak)}
            tint={STAT_TINT.streak}
            fill={Math.min(1, daily.streak / 10)}
            note="WEEKS IN A ROW"
          />
          <StatCard
            glyph="rounds"
            k="ROUNDS"
            v={seen.finishedRound ? '1+' : '0'}
            tint={STAT_TINT.rounds}
            fill={seen.finishedRound ? 1 : 0}
            note={seen.finishedRound ? 'FINISHED' : 'NONE YET'}
          />
        </View>
      </FadeIn>

      {/* ---- 5. ad ---- */}
      <FadeIn index={4}>
        <View style={styles.adSlot}>
          <Mono style={{ fontSize: 11, letterSpacing: 2, color: color.dim }}>
            AD · 320 × 50 BANNER
          </Mono>
        </View>
      </FadeIn>
    </ScrollView>
  );
}

/**
 * Thousands as 12K, so a five-digit balance cannot outgrow its own dial.
 *
 * The previous version printed the full number inside the ring and 12,000
 * spilled straight through both sides of it. The value has since moved out from
 * under the ring anyway, but keeping this means the four cards stay the same
 * width whatever the balance does.
 */
function compact(n: number): string {
  if (n >= 10000) return `${Math.round(n / 1000)}K`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

type Glyph = 'film' | 'level' | 'streak' | 'rounds';

/**
 * A mark inside each ring, so the dials are distinguishable at a glance rather
 * than four identical circles differing only in colour and a digit.
 *
 * Drawn from the product's own vocabulary: a film cassette, a level chevron, a
 * flame, and the viewfinder crosshair the wordmark and every capture already
 * use.
 */
function StatGlyph({ kind, tint }: { kind: Glyph; tint: string }) {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24">
      {kind === 'film' && (
        <G>
          <Rect x={3} y={6} width={18} height={12} rx={2} stroke={tint} strokeWidth={1.8} fill="none" />
          <Rect x={6.5} y={9.5} width={2.5} height={5} fill={tint} />
          <Rect x={10.75} y={9.5} width={2.5} height={5} fill={tint} />
          <Rect x={15} y={9.5} width={2.5} height={5} fill={tint} />
        </G>
      )}
      {kind === 'level' && (
        <G stroke={tint} strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round">
          <Path d="M6 13 L12 7 L18 13" />
          <Path d="M6 18 L12 12 L18 18" />
        </G>
      )}
      {kind === 'streak' && (
        <Path
          d="M12 3 C13.5 7 17 8 17 12.5 A5 5 0 0 1 7 12.5 C7 10.5 8 9.5 9 8.5 C9.3 10.5 10.2 11 11 11 C11 8.5 11 5.5 12 3 Z"
          fill={tint}
        />
      )}
      {kind === 'rounds' && (
        <G stroke={tint} strokeWidth={2} fill="none" strokeLinecap="round">
          <Path d="M4 8 L4 4 L8 4" />
          <Path d="M20 8 L20 4 L16 4" />
          <Path d="M4 16 L4 20 L8 20" />
          <Path d="M20 16 L20 20 L16 20" />
          <Circle cx={12} cy={12} r={2.6} fill={tint} stroke="none" />
        </G>
      )}
    </Svg>
  );
}

/**
 * A stat as a dial with a mark in it, the number under it, and a fixed height.
 *
 * Three things were wrong with the first version and all three were the same
 * mistake, which was putting the value inside the ring: a five-digit balance
 * burst out of both sides of the circle, the four cards ended up different
 * heights because their notes wrapped differently, and every dial looked
 * identical because the only thing distinguishing them was a digit.
 */
function StatCard({
  glyph,
  k,
  v,
  tint,
  fill,
  note,
}: {
  glyph: Glyph;
  k: string;
  v: string;
  tint: string;
  fill: number;
  note: string;
}) {
  const r = 22;
  const circumference = 2 * Math.PI * r;
  const on = Math.max(0, Math.min(1, fill));

  return (
    <View style={[styles.statCard, { borderColor: tint + '3D' }]}>
      <View style={styles.dial}>
        <Svg width={56} height={56} viewBox="0 0 56 56">
          <Circle cx={28} cy={28} r={r} stroke={color.line} strokeWidth={4} fill="none" />
          <Circle
            cx={28}
            cy={28}
            r={r}
            stroke={tint}
            strokeWidth={4}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circumference * on} ${circumference}`}
            transform="rotate(-90 28 28)"
          />
        </Svg>
        <View style={styles.dialCentre}>
          <StatGlyph kind={glyph} tint={tint} />
        </View>
      </View>

      <Text style={[styles.statValue, { color: tint }]} numberOfLines={1}>
        {v}
      </Text>
      <Mono style={[styles.statKey, { color: tint }]} numberOfLines={1}>
        {k}
      </Mono>
      <Mono style={styles.statNote} numberOfLines={1}>
        {note}
      </Mono>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.lineBright,
    borderRadius: radius.md,
    padding: space(4),
  },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progress: { fontFamily: font.monoSemi, fontSize: 12, color: color.accent },
  streak: { fontFamily: font.monoSemi, fontSize: 11, color: color.accent },

  missionList: { marginTop: space(3), gap: space(2) },
  mission: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    backgroundColor: color.surface2,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.sm,
    paddingVertical: space(3),
    paddingHorizontal: space(3),
  },
  missionDone: { opacity: 0.5, borderColor: color.accentDim },
  tick: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: color.lineBright,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tickOn: { backgroundColor: color.accent, borderColor: color.accent },
  tickMark: { fontSize: 10, color: color.dim },
  missionLabel: {
    flex: 1,
    minWidth: 0,
    fontFamily: font.displayMed,
    fontSize: 14,
    color: color.text,
  },
  missionLabelDone: { color: color.faint, textDecorationLine: 'line-through' },
  missionPay: { fontFamily: font.monoSemi, fontSize: 11, color: color.accent },
  chev: { fontSize: 16, color: color.faint },
  sweep: {
    marginTop: space(3),
    borderTopWidth: 1,
    borderTopColor: color.line,
    paddingTop: space(3),
    alignItems: 'center',
  },
  sweepReady: { borderTopColor: color.accent },
  sweepPending: { fontSize: 10, letterSpacing: 1.2, color: color.faint },
  sweepClaim: { fontSize: 12, letterSpacing: 1.6, color: color.accent },
  sweepDone: { fontSize: 10, letterSpacing: 1.2, color: color.accentDim },

  promptWrap: {
    borderLeftWidth: 2,
    borderLeftColor: color.accent,
    paddingLeft: space(3),
    paddingVertical: space(1),
    marginTop: space(3),
  },
  prompt: { fontFamily: font.display, fontSize: 17, lineHeight: 24, color: color.text },
  doneChip: {
    marginTop: space(3),
    borderWidth: 1,
    borderColor: color.accentDim,
    borderRadius: radius.sm,
    alignItems: 'center',
    paddingVertical: space(3),
  },
  doneChipText: { fontSize: 10, letterSpacing: 1.3, color: color.accent },

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space(3), marginTop: space(3) },
  statCard: {
    flexGrow: 1,
    flexBasis: '45%',
    // Fixed, so four cards with notes of different lengths still line up.
    height: 168,
    borderWidth: 1,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    paddingVertical: space(4),
    paddingHorizontal: space(2),
    alignItems: 'center',
    justifyContent: 'center',
  },
  dial: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  dialCentre: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: { fontFamily: font.numeral, fontSize: 22, marginTop: space(2) },
  statKey: { fontFamily: font.monoSemi, fontSize: 10, letterSpacing: 1.6, marginTop: 2 },
  statNote: { fontSize: 8, letterSpacing: 1, color: color.faint, marginTop: 3 },

  adSlot: {
    marginTop: space(5),
    borderWidth: 1,
    borderColor: color.line,
    borderStyle: 'dashed',
    borderRadius: radius.sm,
    alignItems: 'center',
    paddingVertical: space(3),
  },
});
