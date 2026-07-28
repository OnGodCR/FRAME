import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { color, font, radius, space, REDUCED_MOTION } from '../theme';
import { Label, Mono } from '../components/ui';
import { AvatarMark, CosmeticPreview } from '../components/Cosmetics';
import { EASE_OUT, FadeIn, PressScale, useBreathe } from '../components/motion';
import {
  CATEGORIES,
  Category,
  COSMETICS,
  byId,
  categoryKind,
} from '../data/catalog';
import { Equipped, useGame } from '../engine/GameContext';

export function Loadout() {
  const { go, profile, equip } = useGame();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Category>('title');

  const eq = profile.equipped;
  const title = byId(eq.title)!;
  const pin = byId(eq.pin)!;
  const frame = byId(eq.frame)!;
  const blackout = byId(eq.blackout)!;
  const tagCos = byId(eq.tag)!;

  const items = COSMETICS.filter((c) => c.category === tab);
  const ownedCount = COSMETICS.filter((c) => profile.owned.includes(c.id)).length;

  // The hero re-animates whenever the equipped set changes, so a tap in the
  // grid visibly lands on the preview above it.
  const pop = useRef(new Animated.Value(1)).current;
  const eqKey = `${eq.title}|${eq.pin}|${eq.frame}|${eq.blackout}|${eq.tag}`;
  useEffect(() => {
    pop.setValue(0.9);
    Animated.spring(pop, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 10,
    }).start();
  }, [eqKey]);

  const breathe = useBreathe(!REDUCED_MOTION);

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={{
          padding: space(5),
          paddingTop: insets.top + space(4),
          paddingBottom: insets.bottom + space(8),
        }}
      >
        <Pressable onPress={() => go('home')} hitSlop={10}>
          <Label tone="faint">← Home</Label>
        </Pressable>

        <FadeIn>
          <View style={styles.header}>
            <Text style={styles.h1}>Loadout</Text>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.ownedNum}>{ownedCount}</Text>
              <Label tone="faint" style={{ fontSize: 8 }}>
                OWNED / {COSMETICS.length}
              </Label>
            </View>
          </View>
        </FadeIn>

        {/* hero preview */}
        <FadeIn index={1}>
          <View style={styles.hero}>
            <Animated.View
              style={{
                alignItems: 'center',
                transform: [
                  { scale: pop },
                  {
                    translateY: breathe.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -4],
                    }),
                  },
                ],
              }}
            >
              <AvatarMark size={118} tint={pin.tint} frameTint={frame.tint} />
              <Text style={[styles.heroHandle, { marginTop: space(5) }]}>
                {profile.handle || 'PLAYER'}
              </Text>
              <Text style={[styles.heroTitle, { color: title.tint }]}>{title.name}</Text>
            </Animated.View>

            <View style={styles.heroChips}>
              <HeroChip label="PIN" name={pin.name} kind="pin" tint={pin.tint} />
              <HeroChip label="FRAME" name={frame.name} kind="frame" tint={frame.tint} />
              <HeroChip
                label="BLACKOUT"
                name={blackout.name}
                kind="static"
                tint={blackout.tint}
              />
              <HeroChip label="TAG" name={tagCos.name} kind="tag" tint={tagCos.tint} />
            </View>
          </View>
        </FadeIn>

        {/* category tabs */}
        <FadeIn index={2}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabRow}
            style={{ marginTop: space(5), marginHorizontal: -space(5) }}
          >
            {CATEGORIES.map((c) => {
              const active = c.key === tab;
              return (
                <Pressable
                  key={c.key}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setTab(c.key);
                  }}
                  style={[styles.tab, active && styles.tabActive]}
                >
                  <Text style={[styles.tabText, active && { color: color.onAccent }]}>
                    {c.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </FadeIn>

        {/* item grid */}
        <View style={styles.grid} key={tab}>
          {items.map((item, i) => {
            const owned = profile.owned.includes(item.id);
            const equipped = eq[tab as keyof Equipped] === item.id;
            return (
              <FadeIn key={item.id} index={i} stagger={40} style={styles.tileWrap}>
                <PressScale
                  disabled={!owned}
                  haptic="none"
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    equip(tab as keyof Equipped, item.id);
                  }}
                  style={[
                    styles.tile,
                    equipped && styles.tileEquipped,
                    !owned && styles.tileLocked,
                  ]}
                >
                  <CosmeticPreview
                    kind={categoryKind(item.category)}
                    tint={owned ? item.tint : color.faint}
                    size={58}
                  />
                  <Text
                    style={[styles.tileName, !owned && { color: color.faint }]}
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                  {equipped ? (
                    <Mono style={styles.equippedTag}>EQUIPPED</Mono>
                  ) : owned ? (
                    <Mono style={styles.tapTag}>TAP TO EQUIP</Mono>
                  ) : (
                    <Mono style={styles.lockTag}>{sourceLabel(item)}</Mono>
                  )}
                </PressScale>
              </FadeIn>
            );
          })}
        </View>

        <Mono style={styles.footnote}>
          Cosmetics are visual only. Nothing here makes you easier or harder to find.
        </Mono>
      </ScrollView>
    </View>
  );
}

function sourceLabel(item: { source: string; cost?: number; tier?: number }) {
  if (item.source === 'shop') return `SHOP · ${item.cost}`;
  if (item.source === 'free') return `FREE · TIER ${item.tier}`;
  if (item.source === 'paid') return `PASS · TIER ${item.tier}`;
  return 'LOCKED';
}

function HeroChip({
  label,
  name,
  kind,
  tint,
}: {
  label: string;
  name: string;
  kind: 'pin' | 'frame' | 'static' | 'tag';
  tint: string;
}) {
  return (
    <View style={styles.heroChip}>
      <CosmeticPreview kind={kind} tint={tint} size={30} />
      <Label tone="faint" style={{ fontSize: 7, marginTop: 5 }}>
        {label}
      </Label>
      <Mono style={styles.heroChipName} numberOfLines={1}>
        {name}
      </Mono>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: space(3),
    gap: space(3),
  },
  h1: {
    fontFamily: font.display,
    fontSize: 34,
    color: color.text,
    letterSpacing: -0.5,
  },
  ownedNum: {
    fontFamily: font.display,
    fontSize: 20,
    color: color.accent,
  },
  hero: {
    marginTop: space(4),
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.lg,
    paddingVertical: space(7),
    paddingHorizontal: space(4),
    alignItems: 'center',
  },
  heroHandle: {
    fontFamily: font.display,
    fontSize: 24,
    letterSpacing: 2,
    color: color.text,
  },
  heroTitle: {
    fontFamily: font.monoSemi,
    fontSize: 12,
    letterSpacing: 2,
    marginTop: 4,
  },
  heroChips: {
    flexDirection: 'row',
    marginTop: space(6),
    gap: space(2),
    alignSelf: 'stretch',
  },
  heroChip: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    backgroundColor: color.bg,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.sm,
    paddingVertical: space(2.5),
    paddingHorizontal: space(1),
  },
  heroChipName: {
    fontSize: 8,
    color: color.text,
    letterSpacing: 0.5,
    marginTop: 1,
  },
  tabRow: {
    gap: space(2),
    paddingHorizontal: space(5),
  },
  tab: {
    paddingHorizontal: space(3.5),
    paddingVertical: space(2),
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.lineBright,
    backgroundColor: color.surface,
  },
  tabActive: { backgroundColor: color.accent, borderColor: color.accent },
  tabText: {
    fontFamily: font.monoSemi,
    fontSize: 10,
    letterSpacing: 1.4,
    color: color.dim,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space(3),
    marginTop: space(4),
  },
  tileWrap: { width: '47.5%' },
  tile: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.md,
    padding: space(3),
    alignItems: 'center',
  },
  tileEquipped: { borderColor: color.accent, backgroundColor: color.surface2 },
  tileLocked: { opacity: 0.55, borderStyle: 'dashed' },
  tileName: {
    fontFamily: font.monoSemi,
    fontSize: 11,
    letterSpacing: 1,
    color: color.text,
    marginTop: space(2),
  },
  equippedTag: {
    fontSize: 8,
    letterSpacing: 1.2,
    color: color.accent,
    marginTop: 3,
  },
  tapTag: {
    fontSize: 8,
    letterSpacing: 1.2,
    color: color.faint,
    marginTop: 3,
  },
  lockTag: {
    fontSize: 8,
    letterSpacing: 1,
    color: color.faint,
    marginTop: 3,
  },
  footnote: {
    fontSize: 10,
    color: color.faint,
    lineHeight: 16,
    marginTop: space(5),
  },
});
