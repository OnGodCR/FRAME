import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { color, font, radius, space } from '../theme';
import { Btn, Card, Label, Mono, Rule } from '../components/ui';
import { CosmeticPreview } from '../components/Cosmetics';
import { CrateArt, FilmStack } from '../components/CrateArt';
import { ProceduralPhoto } from '../components/ProceduralPhoto';
import { CountUp, FadeIn, PressScale, useFlash } from '../components/motion';
import { Cosmetic, SHOP_ITEMS, SEASON, TIER_COUNT, categoryKind, CATEGORIES } from '../data/catalog';
import {
  LOOT_BOXES,
  FILM_PACKS,
  RARITY_ORDER,
  RARITY_LABEL,
  itemOdds,
  boxAvailability,
  type LootBox,
} from '../data/lootboxes';
import { ECONOMY } from '../data/economy';
import { useGame } from '../engine/GameContext';
import { Animated } from 'react-native';
import Svg, { Line as SvgLine, Rect } from 'react-native-svg';

export function Shop({ embedded = false }: { embedded?: boolean } = {}) {
  const { go, profile, purchase, ageBracket } = useGame();
  const insets = useSafeAreaInsets();
  const frames = SHOP_ITEMS.filter((i) => i.category === 'frame');
  const others = SHOP_ITEMS.filter((i) => i.category !== 'frame');

  /**
   * The one disclosure that stays in the app.
   *
   * Everything else that used to be printed under the shop (FILM is never sold,
   * cosmetics only, nothing affects a round) has moved to the Terms, where it
   * belongs and where it is not competing with the thing being sold. This one
   * is different: it is a **permanent, irreversible consequence of spending
   * money**, so it has to be in front of the player before they spend it rather
   * than in a document they accepted once. Shown every time the store opens.
   */
  const [adsNotice, setAdsNotice] = useState(true);

  /** Which box's odds are expanded. Only one at a time. */
  const [openOdds, setOpenOdds] = useState<string | null>(null);

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={{
          padding: space(5),
          paddingTop: embedded ? space(4) : insets.top + space(4),
          paddingBottom: space(10),
        }}
      >
        {!embedded && (
          <Pressable onPress={() => go('home')} hitSlop={10}>
            <Label tone="faint">← Home</Label>
          </Pressable>
        )}

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
        </FadeIn>

        {/* ---- loot boxes ---- */}
        <FadeIn index={1}>
          <View style={styles.sectionHead}>
            <Label tone="text">Boxes</Label>
            <Label tone="faint">ODDS PUBLISHED</Label>
          </View>
        </FadeIn>
        {LOOT_BOXES.map((box, i) => (
          <BoxCard
            key={box.id}
            box={box}
            index={i}
            film={profile.film}
            bracket={ageBracket}
            oddsOpen={openOdds === box.id}
            onToggleOdds={() => setOpenOdds(openOdds === box.id ? null : box.id)}
          />
        ))}

        {/* ---- FILM ---- */}
        <FadeIn index={2}>
          <View style={styles.sectionHead}>
            <Label tone="text">Film</Label>
            <Label tone="faint">SPENDABLE ON ANY BOX</Label>
          </View>
        </FadeIn>

        {/* Rewarded video. Capped, and the cap is shown rather than discovered
            when the fourth one silently pays nothing. */}
        <FadeIn index={3}>
          <Card style={{ padding: 0, marginBottom: space(3) }}>
            <PressScale onPress={() => Haptics.selectionAsync()} style={styles.filmRow}>
              <View style={styles.filmRowLeft}>
                <CosmeticPreview kind="film" size={34} tint={color.dim} />
                <View style={styles.filmRowText}>
                  <Text style={styles.itemName}>WATCH AN AD</Text>
                  <Mono style={styles.filmRowSub}>
                    {ECONOMY.rewardedAd.seconds} seconds. {ECONOMY.rewardedAd.dailyCap} a day.
                  </Mono>
                </View>
              </View>
              <Mono style={styles.filmRowPrice}>+{ECONOMY.rewardedAd.film}</Mono>
            </PressScale>
          </Card>
        </FadeIn>

        <View style={styles.packGrid}>
          {FILM_PACKS.map((pack, i) => (
            <FadeIn key={pack.id} index={i} delay={60}>
              <PressScale
                onPress={() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)}
                style={styles.pack}
              >
                {pack.tag && <Mono style={styles.packTag}>{pack.tag}</Mono>}
                <FilmStack count={i + 1} size={62} />
                <Text style={styles.packFilm}>{pack.film.toLocaleString()}</Text>
                {pack.bonus && <Mono style={styles.packBonus}>{pack.bonus}</Mono>}
                <Text style={styles.packPrice}>{pack.price}</Text>
              </PressScale>
            </FadeIn>
          ))}
        </View>

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

      </ScrollView>

      <AdsForeverNotice visible={adsNotice} onClose={() => setAdsNotice(false)} />
    </View>
  );
}

/**
 * Shown every time the store opens, and dismissed rather than remembered.
 *
 * The rest of the shop's small print is gone, moved to the Terms where it is
 * read once and not competing with the thing being sold. This one stayed for a
 * specific reason: it is the only consequence of a purchase here that is
 * **permanent and cannot be undone**, and a consequence like that belongs in
 * front of the player at the moment of spending, not in a document accepted
 * during onboarding.
 */
function AdsForeverNotice({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.noticeBackdrop}>
        <View style={styles.noticeCard}>
          <View style={styles.noticeArt}>
            <Svg width={132} height={92} viewBox="0 0 132 92">
              {/* An ad banner with the signal cut. The crossed-out slot says
                  the whole thing without a paragraph under it. */}
              <Rect
                x={6}
                y={26}
                width={120}
                height={40}
                rx={5}
                fill={color.surface2}
                stroke={color.lineBright}
                strokeWidth={2}
              />
              {[16, 16 + 22, 16 + 44].map((x) => (
                <Rect key={x} x={x} y={38} width={16} height={4} rx={2} fill={color.faint} />
              ))}
              <Rect x={16} y={50} width={62} height={4} rx={2} fill={color.faint} />
              <SvgLine
                x1={14}
                y1={20}
                x2={118}
                y2={72}
                stroke={color.accent}
                strokeWidth={5}
                strokeLinecap="round"
              />
            </Svg>
          </View>
          <Text style={styles.noticeTitle}>Buy anything, and ads are gone for good.</Text>
          <Btn title="Got it" style={{ marginTop: space(5) }} onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

/**
 * One box, with its odds one tap away.
 *
 * **The odds have to be reachable before the purchase, not after.** Apple has
 * required that since 2017 and Google Play since 2019, and it is statutory in
 * China and South Korea. Putting the table behind a tap is fine; putting it
 * behind the transaction is not. See monetization/LOOT-BOXES.md.
 */
function BoxCard({
  box,
  index,
  film,
  bracket,
  oddsOpen,
  onToggleOdds,
}: {
  box: LootBox;
  index: number;
  film: number;
  bracket: '13_17' | '18_plus' | null;
  oddsOpen: boolean;
  onToggleOdds: () => void;
}) {
  // Country is not yet plumbed through, so the regional block cannot be
  // evaluated here. Passing null means it never blocks, which is the wrong
  // default to ship: see LOOT-BOXES.md section 5.
  const availability = boxAvailability(bracket, null, box);
  const blocked = availability !== 'available';
  const affordable = box.film == null || film >= box.film;

  return (
    <FadeIn index={index} delay={60}>
      <View style={[styles.boxCard, blocked && { opacity: 0.5 }]}>
        <View style={styles.boxTop}>
          <CrateArt id={box.id} size={82} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
              <Text style={styles.boxName}>{box.name}</Text>
              {box.tag && <Mono style={styles.boxTag}>{box.tag}</Mono>}
            </View>
            <Mono style={styles.boxBlurb}>{box.blurb}</Mono>
          </View>
          <View style={styles.boxElite}>
            <Text style={styles.boxElitePct}>{Math.round(box.odds.elite * 100)}%</Text>
            <Mono style={styles.boxEliteLabel}>ELITE</Mono>
          </View>
        </View>

        <View style={styles.boxFoot}>
          <PressScale onPress={onToggleOdds}>
            <Mono style={styles.boxOddsLink}>{oddsOpen ? 'HIDE ODDS' : 'SEE FULL ODDS'}</Mono>
          </PressScale>

          {blocked ? (
            <Mono style={styles.boxBlocked}>
              {availability === 'blocked_age' ? '18+ ONLY' : 'NOT AVAILABLE HERE'}
            </Mono>
          ) : (
            <PressScale
              onPress={() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)}
            >
              <View style={[styles.boxBuy, !affordable && styles.boxBuyOff]}>
                <Mono style={[styles.boxBuyText, !affordable && { color: color.faint }]}>
                  {box.price ?? `${box.film?.toLocaleString()} FILM`}
                </Mono>
              </View>
            </PressScale>
          )}
        </View>

        {oddsOpen && (
          <View style={styles.oddsPanel}>
            {RARITY_ORDER.map((r) => (
              <View key={r} style={styles.oddsRow}>
                <Mono style={styles.oddsName}>{RARITY_LABEL[r]}</Mono>
                <Mono style={styles.oddsPct}>{(box.odds[r] * 100).toFixed(box.odds[r] < 0.01 && box.odds[r] > 0 ? 1 : 0)}%</Mono>
              </View>
            ))}
            <Rule style={{ marginVertical: space(2) }} />
            <Mono style={styles.oddsHead}>PER ITEM</Mono>
            {itemOdds(box).map(({ item, p }) => (
              <View key={item.id} style={styles.oddsRow}>
                <Mono style={styles.oddsItem} numberOfLines={1}>
                  {item.name}
                </Mono>
                <Mono style={styles.oddsPct}>{(p * 100).toFixed(2)}%</Mono>
              </View>
            ))}
            <Mono style={styles.oddsFoot}>
              ONE ITEM PER BOX. DUPLICATES REFUND FILM. ODDS ARE PER OPEN AND DO NOT
              IMPROVE WITH FAILED ATTEMPTS.
            </Mono>
          </View>
        )}
      </View>
    </FadeIn>
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
  // ---- loot boxes ----
  boxCard: {
    borderWidth: 1,
    borderColor: color.lineBright,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    padding: space(4),
    marginBottom: space(3),
  },
  boxTop: { flexDirection: 'row', gap: space(3), alignItems: 'flex-start' },
  boxName: { fontFamily: font.display, fontSize: 16, color: color.text, letterSpacing: 0.5 },
  boxTag: { fontSize: 8, letterSpacing: 1.2, color: color.accent },
  boxBlurb: { fontSize: 11, color: color.dim, marginTop: 4, lineHeight: 16 },
  boxElite: { alignItems: 'flex-end', minWidth: 56 },
  boxElitePct: { fontFamily: font.numeral, fontSize: 24, color: color.accent },
  boxEliteLabel: { fontSize: 8, letterSpacing: 1.4, color: color.faint },
  boxFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space(4),
  },
  boxOddsLink: { fontSize: 10, letterSpacing: 1.2, color: color.dim },
  boxBlocked: { fontSize: 10, letterSpacing: 1.2, color: color.warn },
  boxBuy: {
    borderWidth: 1,
    borderColor: color.accent,
    backgroundColor: color.accent,
    borderRadius: radius.sm,
    paddingHorizontal: space(4),
    paddingVertical: space(2.5),
  },
  boxBuyOff: { backgroundColor: 'transparent', borderColor: color.line },
  boxBuyText: { fontSize: 12, letterSpacing: 1.4, color: color.onAccent },
  oddsPanel: {
    marginTop: space(4),
    borderTopWidth: 1,
    borderTopColor: color.line,
    paddingTop: space(3),
  },
  oddsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  oddsName: { fontSize: 10, letterSpacing: 1.2, color: color.text },
  oddsItem: { fontSize: 10, color: color.dim, flex: 1, minWidth: 0 },
  oddsPct: { fontSize: 10, color: color.text, fontVariant: ['tabular-nums'] },
  oddsHead: { fontSize: 8, letterSpacing: 1.4, color: color.faint, marginBottom: 3 },
  oddsFoot: { fontSize: 8, letterSpacing: 1, color: color.faint, marginTop: space(3), lineHeight: 13 },

  // ---- FILM packs ----
  packGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space(3) },
  pack: {
    width: 150,
    borderWidth: 1,
    borderColor: color.lineBright,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    padding: space(3),
    alignItems: 'center',
    gap: 4,
  },
  packTag: { fontSize: 8, letterSpacing: 1.2, color: color.accent },
  packFilm: { fontFamily: font.numeral, fontSize: 22, color: color.text },
  packBonus: { fontSize: 9, letterSpacing: 1, color: color.accent },
  packPrice: { fontFamily: font.display, fontSize: 15, color: color.text, marginTop: 2 },

  // ---- the one notice that stayed ----
  noticeBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: space(6),
  },
  noticeCard: {
    width: '100%',
    borderWidth: 1,
    borderColor: color.lineBright,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    padding: space(5),
  },
  noticeArt: { alignItems: 'center', marginBottom: space(4) },
  noticeTitle: {
    fontFamily: font.display,
    fontSize: 21,
    textAlign: 'center',
    lineHeight: 28,
    color: color.text,
    marginTop: space(2),
  },
  noticeBody: { fontSize: 11, color: color.dim, lineHeight: 18, marginTop: space(3) },

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
