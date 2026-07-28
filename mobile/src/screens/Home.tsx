import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, font, radius, space } from '../theme';
import { Bar, Btn, Card, Label, Mono } from '../components/ui';
import { AvatarMark, CosmeticPreview } from '../components/Cosmetics';
import { CountUp, FadeIn, PressScale } from '../components/motion';
import { SEASON, byId, categoryKind } from '../data/catalog';
import { useGame } from '../engine/GameContext';

export function Home() {
  const { go, profile } = useGame();
  const insets = useSafeAreaInsets();

  const eq = profile.equipped;
  const title = byId(eq.title)!;
  const frame = byId(eq.frame)!;
  const pin = byId(eq.pin)!;
  const passPct = SEASON.currentTier / 50;

  const slots = [
    { key: 'pin' as const, label: 'PIN', item: byId(eq.pin)! },
    { key: 'frame' as const, label: 'FRAME', item: byId(eq.frame)! },
    { key: 'blackout' as const, label: 'BLACKOUT', item: byId(eq.blackout)! },
    { key: 'tag' as const, label: 'TAG', item: byId(eq.tag)! },
  ];

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
        <FadeIn>
          <View style={styles.topRow}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.handle} numberOfLines={1}>
                {profile.handle || 'PLAYER'}
              </Text>
              <Text style={[styles.titleFlair, { color: title.tint }]}>{title.name}</Text>
            </View>
            <View style={styles.levelBadge}>
              <Label tone="faint" style={{ fontSize: 8 }}>
                LVL
              </Label>
              <Text style={styles.levelNum}>{profile.level}</Text>
            </View>
          </View>

          <View style={{ marginTop: space(4) }}>
            <View style={styles.metaRow}>
              <Label tone="faint">XP</Label>
              <Mono style={{ fontSize: 10, color: color.faint }}>
                {Math.round(profile.xp * 100)}% TO LVL {profile.level + 1}
              </Mono>
            </View>
            <Bar value={profile.xp} height={5} />
          </View>
        </FadeIn>

        {/* season pass */}
        <FadeIn index={1}>
          <PressScale onPress={() => go('pass')} style={{ marginTop: space(5) }}>
            <Card style={{ padding: space(3.5) }}>
              <View style={styles.metaRow}>
                <Label tone="text">{`Season pass · ${SEASON.name}`}</Label>
                <Mono style={{ fontSize: 10, color: color.accent }}>
                  TIER {SEASON.currentTier} / 50 →
                </Mono>
              </View>
              <View style={styles.tierRow}>
                {Array.from({ length: 25 }).map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.tierChip,
                      i / 25 < passPct && {
                        backgroundColor: color.accent,
                        borderColor: color.accent,
                      },
                    ]}
                  />
                ))}
              </View>
              <Mono style={{ fontSize: 10, color: color.faint, marginTop: space(2) }}>
                {profile.paidPass ? 'PAID TRACK UNLOCKED' : 'FREE TRACK · PAID AVAILABLE'}
              </Mono>
            </Card>
          </PressScale>
        </FadeIn>

        {/* loadout */}
        <FadeIn index={2}>
          <PressScale onPress={() => go('loadout')} style={{ marginTop: space(4) }}>
            <Card style={{ padding: space(4) }}>
              <View style={styles.metaRow}>
                <Label tone="text">Loadout</Label>
                <Mono style={{ fontSize: 10, color: color.accent, letterSpacing: 1.2 }}>
                  EDIT →
                </Mono>
              </View>
              <View style={styles.loadoutBody}>
                <AvatarMark size={78} tint={pin.tint} frameTint={frame.tint} />
                <View style={styles.slotGrid}>
                  {slots.map((s) => (
                    <View key={s.key} style={styles.slot}>
                      <CosmeticPreview
                        kind={categoryKind(s.item.category)}
                        tint={s.item.tint}
                        size={26}
                      />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Label tone="faint" style={{ fontSize: 7 }}>
                          {s.label}
                        </Label>
                        <Mono style={styles.slotName} numberOfLines={1}>
                          {s.item.name}
                        </Mono>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            </Card>
          </PressScale>
        </FadeIn>

        {/* shop entry */}
        <FadeIn index={3}>
          <PressScale onPress={() => go('shop')} style={{ marginTop: space(3) }}>
            <Card style={styles.shopRow}>
              <View style={styles.shopRowLeft}>
                <CosmeticPreview kind="film" size={34} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Label tone="text">Shop</Label>
                  <Mono style={{ fontSize: 10, color: color.faint, marginTop: 2 }}>
                    Cosmetics and season pass
                  </Mono>
                </View>
              </View>
              <View style={styles.filmPill}>
                <CountUp value={profile.film} style={styles.filmPillText} />
              </View>
            </Card>
          </PressScale>
        </FadeIn>

        {/* play */}
        <FadeIn index={4}>
          <View style={{ marginTop: space(6), gap: space(3) }}>
            <Btn title="Host a round" onPress={() => go('lobby')} />
            <Btn title="Join with code" variant="outline" onPress={() => go('join')} />
          </View>
        </FadeIn>
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
    gap: space(3),
  },
  handle: {
    fontFamily: font.display,
    fontSize: 26,
    letterSpacing: 1,
    color: color.text,
  },
  titleFlair: {
    fontFamily: font.monoMed,
    fontSize: 10,
    letterSpacing: 1.8,
    marginTop: 3,
  },
  levelBadge: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  levelNum: {
    fontFamily: font.display,
    fontSize: 22,
    color: color.accent,
    marginTop: -2,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space(1.5),
    gap: space(2),
  },
  tierRow: { flexDirection: 'row', gap: 3, marginTop: space(1) },
  tierChip: {
    flex: 1,
    height: 12,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: color.lineBright,
    backgroundColor: color.surface2,
  },
  loadoutBody: {
    flexDirection: 'row',
    gap: space(4),
    marginTop: space(3),
    alignItems: 'center',
  },
  slotGrid: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space(2),
  },
  slot: {
    width: '46%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  slotName: {
    fontSize: 9,
    color: color.text,
    letterSpacing: 0.5,
  },
  shopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space(3),
    paddingVertical: space(3),
  },
  shopRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    flex: 1,
    minWidth: 0,
  },
  filmPill: {
    backgroundColor: color.surface2,
    borderWidth: 1,
    borderColor: color.lineBright,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexShrink: 0,
  },
  filmPillText: {
    fontFamily: font.monoSemi,
    fontSize: 13,
    color: color.accent,
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
