import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { color, font, radius, space } from '../theme';
import { Btn, Card, Label, Mono, Rule } from '../components/ui';
import { CosmeticPreview } from '../components/Cosmetics';
import { ProceduralPhoto } from '../components/ProceduralPhoto';
import { CountUp, FadeIn, PressScale, useFlash } from '../components/motion';
import { Cosmetic, SHOP_ITEMS, SEASON, TIER_COUNT, categoryKind, CATEGORIES, STORE } from '../data/catalog';
import { useGame } from '../engine/GameContext';
import { Animated } from 'react-native';

export function Shop() {
  const { go, profile, purchase, buyPass, buyProduct } = useGame();
  const insets = useSafeAreaInsets();
  const frames = SHOP_ITEMS.filter((i) => i.category === 'frame');
  const others = SHOP_ITEMS.filter((i) => i.category !== 'frame');

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
              {TIER_COUNT} tiers of cosmetics and FILM.{'\n'}
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
              <Mono style={styles.viewTiers}>{`VIEW ALL ${TIER_COUNT} TIERS →`}</Mono>
            </Pressable>
          </Card>
        </FadeIn>

        {/* Real money products. Cosmetics and pass tiers only: FILM is never
            sold, because seeker bidding spends it and that would make a role
            advantage purchasable. */}
        <FadeIn index={1}>
          <View style={styles.sectionHead}>
            <Label tone="text">Store</Label>
            <Label tone="faint">REAL MONEY</Label>
          </View>
        </FadeIn>
        {STORE.map((prod, i) => {
          const owned =
            prod.id === 'store-pass'
              ? profile.paidPass
              : prod.grants.length > 0 && prod.grants.every((g) => profile.owned.includes(g));
          return (
            <FadeIn key={prod.id} index={i} delay={100}>
              <PressScale
                disabled={owned}
                onPress={() => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  if (prod.id === 'store-pass') buyPass();
                  buyProduct(prod);
                }}
                style={[styles.storeCard, owned && { opacity: 0.55 }]}
              >
                <View style={styles.storeTop}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
                      <Text style={styles.storeName}>{prod.name}</Text>
                      {prod.tag && <Mono style={styles.storeTag}>{prod.tag}</Mono>}
                    </View>
                    <Mono style={styles.storeBlurb}>{prod.blurb}</Mono>
                  </View>
                </View>
                <View style={styles.storeFoot}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space(2) }}>
                    {prod.anchor && <Mono style={styles.storeAnchor}>{prod.anchor}</Mono>}
                    <Text style={styles.storePrice}>{prod.price}</Text>
                  </View>
                  <Mono style={styles.storeCta}>{owned ? 'OWNED' : 'BUY →'}</Mono>
                </View>
              </PressScale>
            </FadeIn>
          );
        })}
        <Mono style={styles.filmNote}>
          FILM IS NEVER SOLD. IT IS EARNED BY PLAYING, BECAUSE SEEKER BIDDING SPENDS IT.
        </Mono>

        {/* Frames get flagship billing rather than being one tab of five.
            Every check-in photo a hider sends is wearing theirs, and the
            seeker sees every one of them, so it is by a wide margin the
            highest impression-count cosmetic in the product. It is also the
            only one that reads as status in a game about photographs. */}
        <FadeIn index={2}>
          <View style={styles.sectionHead}>
            <Label tone="text">Photo frames</Label>
            <Label tone="faint">SEEN BY EVERYONE</Label>
          </View>
          <Mono style={styles.sectionNote}>
            Wraps every capture you send. The one cosmetic other players actually look at.
          </Mono>
        </FadeIn>
        {frames.map((item, i) => (
          <FrameTile
            key={item.id}
            item={item}
            index={i}
            owned={profile.owned.includes(item.id)}
            affordable={profile.film >= (item.cost ?? 0)}
            onBuy={() => purchase(item.id, item.cost ?? 0)}
          />
        ))}

        {/* everything else */}
        <FadeIn index={3}>
          <View style={styles.sectionHead}>
            <Label tone="text">Everything else</Label>
          </View>
        </FadeIn>
        <View style={styles.grid}>
          {others.map((item, i) => (
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
          </Card>

          <Mono style={{ fontSize: 10, color: color.faint, marginTop: space(4), lineHeight: 16 }}>
            FILM cannot be bought. Seeker bidding spends it, so selling it would make a
            role advantage purchasable. Rewarded video is the one exception and it is
            optional, capped, and never grants buffs.{'\n\n'}
            Any real-money purchase permanently disables all advertising on this account.
            Not for a season. Forever.
          </Mono>
        </FadeIn>
      </ScrollView>
    </View>
  );
}

/**
 * A frame shown the way it is actually experienced: wrapped around a capture,
 * at the size it appears in the seeker's feed. An abstract swatch tells the
 * player nothing about the thing they would be buying.
 */
function FrameTile({
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
  // Stable per item so the preview does not reshuffle on every render.
  const seed = useMemo(
    () => item.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) * 37,
    [item.id],
  );

  return (
    <FadeIn index={index} delay={120}>
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
          styles.frameCard,
          owned && { borderColor: color.accentDim },
          !owned && !affordable && { opacity: 0.55 },
        ]}
      >
        <View style={[styles.framePreview, { borderColor: item.tint }]}>
          <ProceduralPhoto seed={seed} width={92} height={92} variant="back" />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Label tone="faint" style={{ fontSize: 8 }}>
            PHOTO FRAME
          </Label>
          <Text style={[styles.frameName, { color: item.tint }]} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={styles.itemPriceRow}>
            {owned ? (
              <Mono style={{ fontSize: 11, color: color.accent, letterSpacing: 1 }}>OWNED</Mono>
            ) : (
              <>
                <CosmeticPreview
                  kind="film"
                  size={14}
                  tint={affordable ? color.accent : color.faint}
                />
                <Mono
                  style={{
                    fontSize: 13,
                    color: affordable ? color.text : color.faint,
                    fontFamily: font.monoSemi,
                  }}
                >
                  {item.cost}
                </Mono>
              </>
            )}
          </View>
        </View>
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: color.accent, opacity: flashOpacity }]}
        />
      </PressScale>
    </FadeIn>
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
  storeCard: {
    borderWidth: 1,
    borderColor: color.lineBright,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    padding: space(3.5),
    marginBottom: space(2.5),
  },
  storeTop: { flexDirection: 'row', gap: space(3) },
  storeName: { fontFamily: font.display, fontSize: 19, color: color.text },
  storeTag: {
    fontSize: 8,
    letterSpacing: 1.2,
    color: color.black,
    backgroundColor: color.accent,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
  },
  storeBlurb: { fontSize: 10, color: color.dim, lineHeight: 15, marginTop: 4 },
  storeFoot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: space(3),
  },
  storeAnchor: { fontSize: 11, color: color.faint, textDecorationLine: 'line-through' },
  storePrice: { fontFamily: font.display, fontSize: 22, color: color.accent },
  storeCta: { fontSize: 10, letterSpacing: 1.4, color: color.accent },
  filmNote: {
    fontSize: 9,
    letterSpacing: 1.1,
    lineHeight: 14,
    color: color.faint,
    marginTop: space(1),
  },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: space(6),
    marginBottom: space(2),
  },
  sectionNote: {
    fontSize: 10,
    lineHeight: 15,
    color: color.faint,
    marginBottom: space(3),
  },
  frameCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3.5),
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    padding: space(3),
    marginBottom: space(2.5),
    overflow: 'hidden',
  },
  framePreview: {
    borderWidth: 2,
    borderRadius: radius.sm,
    padding: 3,
    overflow: 'hidden',
  },
  frameName: {
    fontFamily: font.display,
    fontSize: 20,
    marginTop: 2,
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
