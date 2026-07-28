import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { color, font, radius, space } from '../theme';
import { Btn, Card, Label, Mono, Rule } from '../components/ui';
import { CosmeticPreview } from '../components/Cosmetics';
import { CountUp, FadeIn, PressScale, useFlash } from '../components/motion';
import { Cosmetic, SHOP_ITEMS, SEASON, categoryKind, CATEGORIES } from '../data/catalog';
import { useGame } from '../engine/GameContext';
import { Animated } from 'react-native';

export function Shop() {
  const { go, profile, purchase, buyPass } = useGame();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={{
          padding: space(5),
          paddingTop: insets.top + space(4),
          paddingBottom: space(10),
        }}
      >
        <Pressable onPress={() => go('home')} hitSlop={10}>
          <Label tone="faint">← Home</Label>
        </Pressable>

        <FadeIn>
          <View style={styles.header}>
            <Text style={styles.h1}>Shop</Text>
            <View style={styles.filmChip}>
              <CosmeticPreview kind="film" size={22} />
              <CountUp value={profile.film} style={styles.filmAmount} />
              <Label tone="faint" style={{ fontSize: 8 }}>
                FILM
              </Label>
            </View>
          </View>
          <Mono style={{ fontSize: 11, color: color.faint, marginTop: 2 }}>
            Cosmetics only. Nothing here changes how a round plays.
          </Mono>
        </FadeIn>

        {/* season pass product */}
        <FadeIn index={1}>
          <Card
            style={{
              marginTop: space(5),
              borderColor: profile.paidPass ? color.line : color.accent,
            }}
          >
            <View style={styles.passTop}>
              <View style={styles.passTopLeft}>
                <Label tone="accent">
                  Season {SEASON.number} · {SEASON.name}
                </Label>
                <Text style={styles.passName}>PAID TRACK</Text>
              </View>
              <Text style={styles.price}>{profile.paidPass ? 'OWNED' : '$4.99'}</Text>
            </View>
            <Mono style={{ fontSize: 11, color: color.dim, marginTop: space(2) }}>
              50 tiers of cosmetics and FILM.{'\n'}
              {SEASON.weeks - SEASON.week} weeks left in the season.
            </Mono>
            {!profile.paidPass && (
              <Btn
                title="Unlock paid track"
                style={{ marginTop: space(3) }}
                sub="one purchase kills ads on this account, forever"
                onPress={() => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  buyPass();
                }}
              />
            )}
            <Pressable onPress={() => go('pass')} hitSlop={8} style={{ marginTop: space(3) }}>
              <Mono style={styles.viewTiers}>VIEW ALL 50 TIERS →</Mono>
            </Pressable>
          </Card>
        </FadeIn>

        {/* cosmetics grid */}
        <FadeIn index={2}>
          <Label tone="text" style={{ marginTop: space(6), marginBottom: space(3) }}>
            Cosmetics
          </Label>
        </FadeIn>
        <View style={styles.grid}>
          {SHOP_ITEMS.map((item, i) => (
            <ShopTile
              key={item.id}
              item={item}
              index={i}
              owned={profile.owned.includes(item.id)}
              affordable={profile.film >= (item.cost ?? 0)}
              onBuy={() => purchase(item.id, item.cost ?? 0)}
            />
          ))}
        </View>

        {/* film top-ups */}
        <FadeIn index={3}>
          <Label tone="text" style={{ marginTop: space(6), marginBottom: space(3) }}>
            Film
          </Label>
          <Card style={{ padding: 0 }}>
            <PressScale onPress={() => {}} style={styles.filmRow}>
              <View style={styles.filmRowLeft}>
                <CosmeticPreview kind="film" size={34} tint={color.dim} />
                <View style={styles.filmRowText}>
                  <Text style={styles.itemName}>WATCH AN AD</Text>
                  <Mono style={styles.filmRowSub}>
                    Optional. Never grants buffs or gameplay items.
                  </Mono>
                </View>
              </View>
              <Mono style={styles.filmRowPrice}>+50</Mono>
            </PressScale>
            <Rule />
            <View style={styles.filmRow}>
              <View style={styles.filmRowLeft}>
                <CosmeticPreview kind="film" size={34} />
                <View style={styles.filmRowText}>
                  <Text style={styles.itemName}>1,000 FILM</Text>
                  <Mono style={styles.filmRowSub}>Spendable on cosmetics only.</Mono>
                </View>
              </View>
              <Mono style={[styles.filmRowPrice, { color: color.text }]}>$2.99</Mono>
            </View>
          </Card>

          <Mono style={{ fontSize: 10, color: color.faint, marginTop: space(4), lineHeight: 16 }}>
            Any real-money purchase permanently disables all advertising on this account.
            Not for a season — forever. Buffs and nerfs are earned in rounds and are never
            sold.
          </Mono>
        </FadeIn>
      </ScrollView>
    </View>
  );
}

function ShopTile({
  item,
  index,
  owned,
  affordable,
  onBuy,
}: {
  item: Cosmetic;
  index: number;
  owned: boolean;
  affordable: boolean;
  onBuy: () => boolean;
}) {
  const { flashOpacity, fire } = useFlash();
  const categoryLabel = CATEGORIES.find((c) => c.key === item.category)!.label;

  return (
    <FadeIn index={index} delay={120} style={styles.tileWrap}>
      <PressScale
        disabled={owned || !affordable}
        haptic="none"
        onPress={() => {
          if (onBuy()) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            fire();
          }
        }}
        style={[
          styles.itemCard,
          owned && { borderColor: color.accentDim },
          !owned && !affordable && { opacity: 0.5 },
        ]}
      >
        <CosmeticPreview kind={categoryKind(item.category)} tint={item.tint} size={64} />
        <Label tone="faint" style={{ fontSize: 8, marginTop: space(2) }}>
          {categoryLabel}
        </Label>
        <Text style={styles.itemName} numberOfLines={1}>
          {item.name}
        </Text>
        <View style={styles.itemPriceRow}>
          {owned ? (
            <Mono style={{ fontSize: 10, color: color.accent, letterSpacing: 1 }}>OWNED</Mono>
          ) : (
            <>
              <CosmeticPreview
                kind="film"
                size={14}
                tint={affordable ? color.accent : color.faint}
              />
              <Mono
                style={{
                  fontSize: 12,
                  color: affordable ? color.text : color.faint,
                  fontFamily: font.monoSemi,
                }}
              >
                {item.cost}
              </Mono>
            </>
          )}
        </View>
        <Animated.View
          pointerEvents="none"
          style={[styles.flash, { opacity: flashOpacity }]}
        />
      </PressScale>
    </FadeIn>
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
  filmChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  filmAmount: {
    fontFamily: font.monoSemi,
    fontSize: 15,
    color: color.text,
  },
  // The price sits in its own non-shrinking column; the left column must be
  // allowed to shrink or long copy pushes the price off-screen.
  passTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space(3),
  },
  passTopLeft: { flex: 1, minWidth: 0 },
  passName: {
    fontFamily: font.display,
    fontSize: 22,
    color: color.text,
    marginTop: 2,
  },
  price: {
    fontFamily: font.monoSemi,
    fontSize: 16,
    color: color.accent,
    flexShrink: 0,
  },
  viewTiers: {
    fontSize: 10,
    color: color.accent,
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space(3),
  },
  tileWrap: { width: '47.5%' },
  itemCard: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.md,
    padding: space(3),
    alignItems: 'center',
    overflow: 'hidden',
  },
  itemName: {
    fontFamily: font.monoSemi,
    fontSize: 12,
    letterSpacing: 1,
    color: color.text,
    marginTop: 2,
  },
  itemPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: space(2),
  },
  flash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: color.accent,
  },
  filmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: space(3.5),
    gap: space(3),
  },
  filmRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    flex: 1,
    minWidth: 0,
  },
  filmRowText: { flex: 1, minWidth: 0 },
  filmRowSub: { fontSize: 10, color: color.faint },
  filmRowPrice: {
    fontSize: 12,
    color: color.accent,
    fontFamily: font.monoSemi,
    flexShrink: 0,
  },
});
