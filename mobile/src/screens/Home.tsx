import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, font, radius, space } from '../theme';
import { Bar, Btn, Card, Label, Mono } from '../components/ui';
import { useGame } from '../engine/GameContext';

const STATS = [
  { k: 'ROUNDS', v: '23' },
  { k: 'SURVIVAL', v: '61%' },
  { k: 'CHECK-INS', v: '94%' },
  { k: 'TAGS', v: '9' },
];

export function Home() {
  const { go, profile } = useGame();
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
        {/* identity */}
        <View style={styles.topRow}>
          <View>
            <Text style={styles.handle}>{profile.handle || 'PLAYER'}</Text>
            <Mono style={{ fontSize: 11, marginTop: 2 }}>SEASON 01 · WEEK 4</Mono>
          </View>
          <View style={styles.levelBadge}>
            <Label tone="faint" style={{ fontSize: 8 }}>
              LVL
            </Label>
            <Text style={styles.levelNum}>{profile.level}</Text>
          </View>
        </View>

        {/* xp */}
        <View style={{ marginTop: space(4) }}>
          <View style={styles.xpRow}>
            <Label tone="faint">XP</Label>
            <Mono style={{ fontSize: 10, color: color.faint }}>
              {Math.round(profile.xp * 100)}% TO LVL {profile.level + 1}
            </Mono>
          </View>
          <Bar value={profile.xp} height={5} />
        </View>

        {/* season pass strip */}
        <Card style={{ marginTop: space(5), padding: space(3.5) }}>
          <View style={styles.xpRow}>
            <Label tone="text">Season pass</Label>
            <Mono style={{ fontSize: 10, color: color.accent }}>TIER 12 / 50</Mono>
          </View>
          <View style={styles.tierRow}>
            {Array.from({ length: 16 }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.tierChip,
                  i < 12 && { backgroundColor: color.accent, borderColor: color.accent },
                ]}
              />
            ))}
          </View>
          <Mono style={{ fontSize: 10, color: color.faint, marginTop: space(2) }}>
            Cosmetics and currency only. Nothing in the pass affects a round.
          </Mono>
        </Card>

        {/* stats */}
        <View style={styles.statGrid}>
          {STATS.map((s) => (
            <View key={s.k} style={styles.statCell}>
              <Text style={styles.statVal}>{s.v}</Text>
              <Label tone="faint" style={{ marginTop: 2 }}>
                {s.k}
              </Label>
            </View>
          ))}
        </View>

        {/* play */}
        <View style={{ marginTop: space(6), gap: space(3) }}>
          <Btn title="Host a round" onPress={() => go('lobby')} />
          <Btn title="Join with code" variant="outline" onPress={() => go('join')} />
        </View>
      </ScrollView>

      {/* ad slot — home/lobby only per spec */}
      <View style={[styles.adSlot, { paddingBottom: insets.bottom + space(2) }]}>
        <Mono style={{ fontSize: 9, letterSpacing: 1.5, color: color.faint }}>
          AD SLOT · NEVER SHOWN DURING A ROUND
        </Mono>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  handle: {
    fontFamily: font.display,
    fontSize: 26,
    letterSpacing: 1,
    color: color.text,
  },
  levelBadge: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelNum: {
    fontFamily: font.display,
    fontSize: 22,
    color: color.accent,
    marginTop: -2,
  },
  xpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space(1.5),
  },
  tierRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: space(1),
  },
  tierChip: {
    flex: 1,
    height: 14,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: color.lineBright,
    backgroundColor: color.surface2,
  },
  statGrid: {
    flexDirection: 'row',
    marginTop: space(5),
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space(3.5),
    borderRightWidth: 1,
    borderRightColor: color.line,
    backgroundColor: color.surface,
  },
  statVal: {
    fontFamily: font.display,
    fontSize: 18,
    color: color.text,
  },
  adSlot: {
    borderTopWidth: 1,
    borderTopColor: color.line,
    alignItems: 'center',
    paddingTop: space(2.5),
    backgroundColor: color.surface,
  },
});
