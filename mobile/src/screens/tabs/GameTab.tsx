import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { color, font, radius, space } from '../../theme';
import { Btn, Label, Mono } from '../../components/ui';
import { FadeIn, PressScale } from '../../components/motion';
import { useGame } from '../../engine/GameContext';
import { MISSION_SWEEP_BONUS } from '../../data/missions';
import type { Tab } from '../../components/TabBar';

// ---------------------------------------------------------------------------
// The Game tab.
//
// **This screen holds four things and nothing else**: identity (in the bar
// above), missions, the two play buttons, and the ad slot. Everything that used
// to be stacked here now lives in one of the other four tabs.
//
// The rule is worth keeping: a home screen answers "what do I do now", and it
// can only answer that if it is not also answering "what can I buy", "who are
// my friends", and "what have I unlocked" at the same time.
// ---------------------------------------------------------------------------

export function GameTab({ onTab }: { onTab: (t: Tab) => void }) {
  const {
    go,
    missions,
    missionsComplete,
    missionSweepPaid,
    claimMissionSweep,
    hasAccount,
  } = useGame();

  const doneCount = missions.filter((m) => m.done).length;

  return (
    <ScrollView
      contentContainerStyle={{ padding: space(5), paddingBottom: space(6) }}
      showsVerticalScrollIndicator={false}
    >
      {/* ---- missions ---- */}
      <FadeIn>
        <View style={styles.section}>
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
                  {m.film > 0 && !m.done && (
                    <Mono style={styles.missionPay}>+{m.film}</Mono>
                  )}
                  {!m.done && <Mono style={styles.chev}>›</Mono>}
                </View>
              </PressScale>
            ))}
          </View>

          {/* The reason to finish the last one. */}
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
                  <Mono style={styles.sweepClaim}>
                    CLAIM {MISSION_SWEEP_BONUS} FILM →
                  </Mono>
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

      {/* ---- play ---- */}
      <FadeIn index={1}>
        <View style={{ marginTop: space(5), gap: space(3) }}>
          <Btn title="Host a round" onPress={() => go('lobby')} />
          <Btn title="Join with code" variant="outline" onPress={() => go('join')} />
        </View>
      </FadeIn>

      <FadeIn index={2}>
        <View style={styles.adSlot}>
          <Mono style={{ fontSize: 11, letterSpacing: 2, color: color.dim }}>
            AD · 320 × 50 BANNER
          </Mono>
          <Mono style={{ fontSize: 9, letterSpacing: 1, color: color.faint, marginTop: 3 }}>

          </Mono>
        </View>
      </FadeIn>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Sections sit on a lifted surface with a real border, so a boundary is
  // visible rather than implied by spacing alone.
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
  missionLabel: { flex: 1, minWidth: 0, fontFamily: font.displayMed, fontSize: 14, color: color.text },
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
  adSlot: {
    marginTop: space(6),
    borderWidth: 1,
    borderColor: color.line,
    borderStyle: 'dashed',
    borderRadius: radius.sm,
    alignItems: 'center',
    paddingVertical: space(3),
  },
});
