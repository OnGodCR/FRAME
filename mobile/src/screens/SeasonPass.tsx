import React, { useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { color, font, radius, space } from '../theme';
import { Bar, Btn, Label, Mono } from '../components/ui';
import { CosmeticPreview } from '../components/Cosmetics';
import { FadeIn } from '../components/motion';
import { SEASON, TIERS, Tier, TierReward } from '../data/catalog';
import { useGame } from '../engine/GameContext';

const ROW_H = 92;

export function SeasonPass({ embedded = false }: { embedded?: boolean } = {}) {
  const { go, profile, buyPass, pass } = useGame();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  // A 50-row track is useless if it opens at tier 1, so land the player on
  // where they actually are, with a couple of claimed tiers above for context.
  const onLayout = () => {
    const y = Math.max(0, (pass.tier - 3) * ROW_H);
    scrollRef.current?.scrollTo({ y, animated: false });
  };

  const claimedFree = TIERS.filter((t) => t.free && t.n <= pass.tier).length;
  const claimedPaid = TIERS.filter((t) => t.paid && t.n <= pass.tier).length;

  return (
    <View style={styles.screen}>
      {/* fixed header so the progress stays visible across a long scroll */}
      <View style={[styles.header, { paddingTop: embedded ? space(3) : insets.top + space(4) }]}>
        {!embedded && (
          <Pressable onPress={() => go('home')} hitSlop={10}>
            <Label tone="faint">← Home</Label>
          </Pressable>
        )}
        <View style={styles.titleRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Label tone="accent">
              Season {SEASON.number} · Week {SEASON.week} of {SEASON.weeks}
            </Label>
            <Text style={styles.h1}>{SEASON.name}</Text>
          </View>
          <View style={styles.tierBadge}>
            <Label tone="faint" style={{ fontSize: 8 }}>
              TIER
            </Label>
            <Text style={styles.tierBadgeNum}>{pass.tier}</Text>
          </View>
        </View>
        <View style={{ marginTop: space(3) }}>
          <View style={styles.progressRow}>
            <Mono style={{ fontSize: 10, color: color.dim }}>
              {claimedFree + (profile.paidPass ? claimedPaid : 0)} REWARDS CLAIMED
            </Mono>
            <Mono style={{ fontSize: 10, color: color.faint }}>
              {pass.complete
                ? 'TRACK COMPLETE'
                : `${pass.xpInTier} / ${pass.xpPerTier} XP → TIER ${pass.tier + 1}`}
            </Mono>
          </View>
          <Bar value={pass.progress} height={5} />
        </View>
        <View style={styles.trackHeader}>
          <View style={{ width: 46 }} />
          <Label tone="faint" style={styles.colHead}>
            Free
          </Label>
          <Label tone={profile.paidPass ? 'accent' : 'faint'} style={styles.colHead}>
            {profile.paidPass ? 'Paid · owned' : 'Paid · locked'}
          </Label>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        onLayout={onLayout}
        contentContainerStyle={{
          paddingHorizontal: space(5),
          paddingBottom: profile.paidPass ? insets.bottom + space(8) : space(4),
        }}
      >
        {TIERS.map((tier) => (
          <TierRow
            key={tier.n}
            tier={tier}
            paidPass={profile.paidPass}
            currentTier={pass.tier}
          />
        ))}
        <Mono style={styles.footnote}>
          Both tracks advance on the same XP. The paid track is cosmetics and FILM
          only, and never contains buffs, slots, or anything that touches a round.
        </Mono>
      </ScrollView>

      {!profile.paidPass && (
        <View
          style={{
            padding: space(5),
            paddingBottom: insets.bottom + space(4),
            borderTopWidth: 1,
            borderTopColor: color.line,
            backgroundColor: color.bg,
          }}
        >
        </View>
      )}
    </View>
  );
}

function TierRow({
  tier,
  paidPass,
  currentTier,
}: {
  tier: Tier;
  paidPass: boolean;
  currentTier: number;
}) {
  const reached = tier.n <= currentTier;
  const current = tier.n === currentTier;

  return (
    <View
      style={[
        styles.tierRow,
        tier.milestone && styles.milestoneRow,
        current && styles.currentRow,
      ]}
    >
      <View style={styles.tierNum}>
        <Text
          style={[
            styles.tierNumText,
            { color: reached ? color.accent : color.faint },
            tier.milestone && { fontSize: 21 },
          ]}
        >
          {String(tier.n).padStart(2, '0')}
        </Text>
        {tier.milestone && (
          <Label tone="faint" style={{ fontSize: 7 }}>
            MILE
          </Label>
        )}
        {current && <View style={styles.currentDot} />}
      </View>
      <RewardCell reward={tier.free} unlocked={reached} />
      <RewardCell reward={tier.paid} unlocked={reached && paidPass} paidLocked={!paidPass} />
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
      <View style={styles.rewardCell}>
        <View style={styles.emptySlot} />
      </View>
    );
  }
  return (
    <View style={[styles.rewardCell, !unlocked && { opacity: paidLocked ? 0.4 : 0.6 }]}>
      <CosmeticPreview kind={reward.kind} tint={reward.tint} size={38} />
      <Mono style={styles.rewardName} numberOfLines={1}>
        {reward.name}
      </Mono>
      {unlocked ? (
        <Mono style={styles.claimed}>CLAIMED</Mono>
      ) : paidLocked ? (
        <Mono style={styles.locked}>PASS</Mono>
      ) : (
        <Mono style={styles.locked}>LOCKED</Mono>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  header: {
    paddingHorizontal: space(5),
    paddingBottom: space(2),
    borderBottomWidth: 1,
    borderBottomColor: color.line,
    backgroundColor: color.bg,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: space(3),
    marginTop: space(2),
  },
  h1: {
    fontFamily: font.display,
    fontSize: 36,
    letterSpacing: 3,
    color: color.text,
    marginTop: space(1),
  },
  tierBadge: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  tierBadgeNum: {
    fontFamily: font.display,
    fontSize: 20,
    color: color.accent,
    marginTop: -2,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space(1.5),
    gap: space(2),
  },
  trackHeader: {
    flexDirection: 'row',
    marginTop: space(3),
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
    paddingVertical: space(2),
    paddingHorizontal: space(2.5),
    marginTop: space(2),
    height: ROW_H - space(2),
  },
  milestoneRow: { borderColor: color.lineBright, backgroundColor: color.surface2 },
  currentRow: { borderColor: color.accent, borderWidth: 1.5 },
  tierNum: { width: 46, alignItems: 'center', gap: 2 },
  tierNumText: { fontFamily: font.display, fontSize: 18 },
  currentDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: color.accent,
  },
  rewardCell: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  emptySlot: {
    width: 26,
    height: 1.5,
    backgroundColor: color.line,
  },
  rewardName: {
    fontSize: 9,
    color: color.text,
    letterSpacing: 0.5,
  },
  claimed: { fontSize: 8, color: color.accent, letterSpacing: 1 },
  locked: { fontSize: 8, color: color.faint, letterSpacing: 1 },
  footnote: {
    fontSize: 10,
    color: color.faint,
    lineHeight: 16,
    marginTop: space(4),
  },
});
