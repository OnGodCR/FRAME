import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { color, font, radius, space } from '../theme';
import { Bar, Btn, Label, Mono } from '../components/ui';
import { CosmeticPreview } from '../components/Cosmetics';
import { useGame } from '../engine/GameContext';

const CURRENT_TIER = 12;

interface TierReward {
  name: string;
  kind: 'pin' | 'frame' | 'static' | 'tag' | 'title' | 'film';
  tint?: string;
}

interface Tier {
  n: number;
  free?: TierReward;
  paid?: TierReward;
}

// A representative window of the 50-tier track.
const TIERS: Tier[] = [
  { n: 9, free: { name: '50 FILM', kind: 'film' }, paid: { name: 'CONTACT SHEET', kind: 'frame', tint: '#9BE8FF' } },
  { n: 10, paid: { name: 'HALFTONE', kind: 'pin', tint: '#FF8A5C' } },
  { n: 11, free: { name: '"PATIENT"', kind: 'title' }, paid: { name: '150 FILM', kind: 'film' } },
  { n: 12, free: { name: '75 FILM', kind: 'film' }, paid: { name: 'LONG EXPOSURE', kind: 'tag', tint: '#D8B4FF' } },
  { n: 13, paid: { name: 'GRAIN', kind: 'static', tint: '#C9C9D4' } },
  { n: 14, free: { name: '50 FILM', kind: 'film' }, paid: { name: 'REDSCALE', kind: 'frame', tint: '#FF6B5C' } },
  { n: 15, paid: { name: '"OVEREXPOSED"', kind: 'title', tint: '#FFD84D' } },
  { n: 16, free: { name: '"UNSEEN II"', kind: 'title' }, paid: { name: '200 FILM', kind: 'film' } },
];

export function SeasonPass() {
  const { go, profile, buyPass } = useGame();
  const insets = useSafeAreaInsets();

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
          <Label tone="faint">← Home</Label>
        </Pressable>

        <Label tone="accent" style={{ marginTop: space(3) }}>
          Season 01 · Week 4 of 10
        </Label>
        <Text style={styles.h1}>EXPOSURE</Text>

        <View style={{ marginTop: space(3) }}>
          <View style={styles.progressRow}>
            <Mono style={{ fontSize: 11, color: color.text }}>TIER {CURRENT_TIER}</Mono>
            <Mono style={{ fontSize: 10, color: color.faint }}>420 / 1000 XP TO TIER 13</Mono>
          </View>
          <Bar value={0.42} height={5} />
        </View>

        {/* column headers */}
        <View style={styles.trackHeader}>
          <View style={{ width: 44 }} />
          <Label tone="faint" style={styles.colHead}>
            Free
          </Label>
          <Label tone={profile.paidPass ? 'accent' : 'faint'} style={styles.colHead}>
            {profile.paidPass ? 'Paid · owned' : 'Paid · locked'}
          </Label>
        </View>

        {TIERS.map((tier) => {
          const claimed = tier.n <= CURRENT_TIER;
          const current = tier.n === CURRENT_TIER;
          return (
            <View
              key={tier.n}
              style={[styles.tierRow, current && { borderColor: color.accent }]}
            >
              <View style={styles.tierNum}>
                <Text
                  style={[
                    styles.tierNumText,
                    { color: claimed ? color.accent : color.faint },
                  ]}
                >
                  {String(tier.n).padStart(2, '0')}
                </Text>
                {claimed && <View style={styles.claimedDot} />}
              </View>
              <RewardCell reward={tier.free} unlocked={claimed} />
              <RewardCell
                reward={tier.paid}
                unlocked={claimed && profile.paidPass}
                paidLocked={!profile.paidPass}
              />
            </View>
          );
        })}

        <Mono style={{ fontSize: 10, color: color.faint, textAlign: 'center', marginVertical: space(3) }}>
          ··· 34 MORE TIERS ···
        </Mono>

        <Mono style={{ fontSize: 10, color: color.faint, lineHeight: 16 }}>
          Both tracks advance on the same XP. The paid track is cosmetics and FILM only —
          it never contains buffs, slots, or anything that touches a round.
        </Mono>
      </ScrollView>

      {!profile.paidPass && (
        <View
          style={{
            padding: space(5),
            paddingBottom: insets.bottom + space(4),
            borderTopWidth: 1,
            borderTopColor: color.line,
          }}
        >
          <Btn
            title="Unlock paid track — $4.99"
            sub="kills ads on this account permanently"
            onPress={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              buyPass();
            }}
          />
        </View>
      )}
    </View>
  );
}

function RewardCell({
  reward,
  unlocked,
  paidLocked,
}: {
  reward?: TierReward;
  unlocked: boolean;
  paidLocked?: boolean;
}) {
  if (!reward) {
    return (
      <View style={[styles.rewardCell, { opacity: 0.35 }]}>
        <Mono style={{ fontSize: 10, color: color.faint }}>—</Mono>
      </View>
    );
  }
  return (
    <View style={[styles.rewardCell, !unlocked && { opacity: paidLocked ? 0.45 : 0.6 }]}>
      <CosmeticPreview kind={reward.kind} tint={reward.tint} size={38} />
      <Mono style={styles.rewardName} numberOfLines={1}>
        {reward.name}
      </Mono>
      {unlocked ? (
        <Mono style={{ fontSize: 8, color: color.accent, letterSpacing: 1 }}>CLAIMED</Mono>
      ) : paidLocked ? (
        <Mono style={{ fontSize: 8, color: color.faint, letterSpacing: 1 }}>PASS</Mono>
      ) : (
        <Mono style={{ fontSize: 8, color: color.faint, letterSpacing: 1 }}>
          TIER {'>'}
        </Mono>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  h1: {
    fontFamily: font.display,
    fontSize: 40,
    letterSpacing: 4,
    color: color.text,
    marginTop: space(1),
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space(1.5),
  },
  trackHeader: {
    flexDirection: 'row',
    marginTop: space(5),
    marginBottom: space(2),
    gap: space(2),
  },
  colHead: { flex: 1, textAlign: 'center' },
  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(2),
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    padding: space(2.5),
    marginBottom: space(2),
  },
  tierNum: { width: 44, alignItems: 'center', gap: 4 },
  tierNumText: {
    fontFamily: font.display,
    fontSize: 18,
  },
  claimedDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: color.accent,
  },
  rewardCell: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: space(1),
  },
  rewardName: {
    fontSize: 10,
    color: color.text,
    letterSpacing: 0.5,
  },
});
