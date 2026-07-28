import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, font, radius, space } from '../theme';
import { Bar, Btn, Card, Label, Mono } from '../components/ui';
import { AvatarMark, PinSwatch, FrameSwatch, StaticSwatch } from '../components/Cosmetics';
import { useGame } from '../engine/GameContext';

const LOADOUT = [
  { k: 'TITLE', v: 'UNSEEN', swatch: null },
  { k: 'MAP PIN', v: 'ACID DOT', swatch: <PinSwatch /> },
  { k: 'PHOTO FRAME', v: 'BRACKETS', swatch: <FrameSwatch /> },
  { k: 'BLACKOUT', v: 'STATIC', swatch: <StaticSwatch /> },
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

        {/* season pass strip → full pass screen */}
        <Pressable onPress={() => go('pass')}>
          <Card style={{ marginTop: space(5), padding: space(3.5) }}>
            <View style={styles.xpRow}>
              <Label tone="text">Season pass · EXPOSURE</Label>
              <Mono style={{ fontSize: 10, color: color.accent }}>TIER 12 / 50 →</Mono>
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
          </Card>
        </Pressable>

        {/* loadout */}
        <Card style={{ marginTop: space(4), padding: space(4) }}>
          <View style={styles.xpRow}>
            <Label tone="text">Loadout</Label>
            <Pressable onPress={() => go('shop')} hitSlop={8}>
              <Mono style={{ fontSize: 10, color: color.accent, letterSpacing: 1.2 }}>
                OPEN SHOP →
              </Mono>
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', gap: space(4), marginTop: space(3) }}>
            <AvatarMark size={84} />
            <View style={{ flex: 1 }}>
              {LOADOUT.map((row, i) => (
                <View
                  key={row.k}
                  style={[styles.loadoutRow, i === 0 && { borderTopWidth: 0, paddingTop: 0 }]}
                >
                  <Label tone="faint" style={{ fontSize: 9 }}>
                    {row.k}
                  </Label>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {row.swatch}
                    <Mono style={{ fontSize: 11, color: color.text, letterSpacing: 1 }}>
                      {row.v}
                    </Mono>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </Card>

        {/* play */}
        <View style={{ marginTop: space(6), gap: space(3) }}>
          <Btn title="Host a round" onPress={() => go('lobby')} />
          <Btn title="Join with code" variant="outline" onPress={() => go('join')} />
        </View>
      </ScrollView>

      {/* banner ad slot — home/lobby only per spec */}
      <View style={[styles.adWrap, { paddingBottom: insets.bottom + space(2) }]}>
        <View style={styles.adBanner}>
          <Mono style={{ fontSize: 11, letterSpacing: 2, color: color.dim }}>
            AD · 320 × 50 BANNER
          </Mono>
          <Mono style={{ fontSize: 9, letterSpacing: 1, color: color.faint, marginTop: 3 }}>
            ADMOB ADAPTIVE · NEVER SHOWN DURING A ROUND
          </Mono>
        </View>
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
  loadoutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: space(2),
    borderTopWidth: 1,
    borderTopColor: color.line,
  },
  adWrap: {
    borderTopWidth: 1,
    borderTopColor: color.line,
    backgroundColor: color.surface,
    paddingTop: space(2.5),
    paddingHorizontal: space(5),
  },
  adBanner: {
    height: 64,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: color.lineBright,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surface2,
  },
});
