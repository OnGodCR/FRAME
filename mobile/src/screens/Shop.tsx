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
  const { go, profile, purchase, ageBracket, seen, markSeen } = useGame();
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
  const [adsNotice, setAdsNotice] = useState(!seen.adsNoticeHidden);

  /** The box whose contents are open, or null. */
  const [detail, setDetail] = useState<LootBox | null>(null);

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
        <View style={styles.boxGrid}>
          {LOOT_BOXES.map((box, i) => (
            <BoxTile key={box.id} box={box} index={i} onOpen={() => setDetail(box)} />
          ))}
        </View>

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

      <BoxDetail
        box={detail}
        film={profile.film}
        bracket={ageBracket}
        onClose={() => setDetail(null)}
      />

      <AdsForeverNotice
        visible={adsNotice}
        onClose={() => setAdsNotice(false)}
        onNeverAgain={() => {
          markSeen({ adsNoticeHidden: true });
          setAdsNotice(false);
        }}
      />
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
function AdsForeverNotice({
  visible,
  onClose,
  onNeverAgain,
}: {
  visible: boolean;
  onClose: () => void;
  onNeverAgain: () => void;
}) {
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
          <PressScale onPress={onNeverAgain}>
            <Mono style={styles.noticeNever}>DON'T SHOW THIS AGAIN</Mono>
          </PressScale>
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
/**
 * One box in the grid: the art, the name, the price. Nothing else.
 *
 * The previous version put the blurb, the elite percentage, an odds toggle, and
 * a buy button on every row, which meant five boxes filled the screen with
 * small print and none of them looked like an object you might want. A shop
 * shelf shows you the thing and its price; everything else belongs behind the
 * tap.
 */
function BoxTile({ box, index, onOpen }: { box: LootBox; index: number; onOpen: () => void }) {
  return (
    <FadeIn index={index} delay={50}>
      <PressScale onPress={onOpen} haptic="light">
        <View style={styles.boxTile}>
          {box.tag && (
            <View style={styles.ribbon}>
              <Mono style={styles.ribbonText} numberOfLines={1}>
                {box.tag}
              </Mono>
            </View>
          )}
          <CrateArt id={box.id} size={104} />
          <Text style={styles.tileName} numberOfLines={1}>
            {box.name}
          </Text>
          <View style={styles.pricePill}>
            {box.film != null && <CosmeticPreview kind="film" size={14} />}
            <Mono style={styles.priceText}>
              {box.price ?? box.film?.toLocaleString()}
            </Mono>
          </View>
        </View>
      </PressScale>
    </FadeIn>
  );
}

/**
 * What is in the box, before you buy it.
 *
 * **The odds live here and this screen is reachable without spending anything.**
 * Apple has required pre-purchase disclosure since 2017 and Google Play since
 * 2019, and it is statutory in China and South Korea. Putting the table one tap
 * away is fine. Putting it behind the transaction is not, so the buy button is
 * deliberately below the odds rather than above them.
 */
function BoxDetail({
  box,
  film,
  bracket,
  onClose,
}: {
  box: LootBox | null;
  film: number;
  bracket: '13_17' | '18_plus' | null;
  onClose: () => void;
}) {
  if (!box) return null;

  const availability = boxAvailability(bracket, null, box);
  const blocked = availability !== 'available';
  const affordable = box.film == null || film >= box.film;
  const rows = itemOdds(box);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.detailBackdrop}>
        <View style={styles.detailCard}>
          <View style={styles.detailHead}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.detailName}>{box.name}</Text>
              <Mono style={styles.detailBlurb}>{box.blurb}</Mono>
            </View>
            <PressScale onPress={onClose}>
              <Mono style={styles.detailClose}>CLOSE</Mono>
            </PressScale>
          </View>

          <View style={styles.detailArt}>
            <CrateArt id={box.id} size={132} />
          </View>

          <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator>
            <Mono style={styles.detailSection}>CHANCE BY TIER</Mono>
            {RARITY_ORDER.map((r) => (
              <View key={r} style={styles.oddsRow}>
                <Mono style={styles.oddsName}>{RARITY_LABEL[r]}</Mono>
                <Mono style={styles.oddsPct}>
                  {(box.odds[r] * 100).toFixed(box.odds[r] > 0 && box.odds[r] < 0.01 ? 1 : 0)}%
                </Mono>
              </View>
            ))}

            <Rule style={{ marginVertical: space(3) }} />
            <Mono style={styles.detailSection}>WHAT IS IN IT</Mono>
            {rows.map(({ item, p }) => (
              <View key={item.id} style={styles.itemRow}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Mono style={styles.itemRowName} numberOfLines={1}>
                    {item.name}
                  </Mono>
                  <Mono style={styles.itemRowBlurb} numberOfLines={2}>
                    {item.blurb}
                  </Mono>
                </View>
                <Mono style={styles.oddsPct}>{(p * 100).toFixed(2)}%</Mono>
              </View>
            ))}

            <Mono style={styles.detailFoot}>
              ONE ITEM PER BOX. DUPLICATES REFUND FILM. ODDS ARE PER OPEN AND DO NOT
              IMPROVE AFTER A FAILED ATTEMPT. ONE UTILITY ITEM MAY BE USED PER ROUND.
            </Mono>
          </ScrollView>

          <View style={{ marginTop: space(4) }}>
            {blocked ? (
              <View style={styles.detailBlocked}>
                <Mono style={styles.detailBlockedText}>
                  {availability === 'blocked_age'
                    ? 'RANDOM ITEMS ARE 18 AND OVER'
                    : 'NOT AVAILABLE IN YOUR REGION'}
                </Mono>
              </View>
            ) : (
              <Btn
                title={box.price ?? `Open for ${box.film?.toLocaleString()} FILM`}
                disabled={!affordable}
                sub={!affordable ? 'not enough FILM' : undefined}
                onPress={() =>
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
                }
              />
            )}
          </View>
        </View>
      </View>
    </Modal>
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
  boxGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space(3) },
  boxTile: {
    width: 156,
    borderWidth: 1,
    borderColor: color.lineBright,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    paddingVertical: space(4),
    paddingHorizontal: space(3),
    alignItems: 'center',
    gap: space(2),
  },
  // The ribbon sits over the art, like a sale flash on a shelf.
  ribbon: {
    position: 'absolute',
    top: space(3),
    left: 0,
    backgroundColor: color.accent,
    paddingHorizontal: space(2),
    paddingVertical: 3,
    borderTopRightRadius: radius.sm,
    borderBottomRightRadius: radius.sm,
    maxWidth: '85%',
  },
  ribbonText: { fontSize: 7, letterSpacing: 1, color: color.onAccent },
  tileName: {
    fontFamily: font.display,
    fontSize: 12,
    letterSpacing: 0.8,
    color: color.text,
    textAlign: 'center',
  },
  pricePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.surface2,
    borderRadius: 999,
    paddingHorizontal: space(3),
    paddingVertical: space(1.5),
  },
  priceText: { fontFamily: font.monoSemi, fontSize: 12, color: color.text },

  // ---- box detail ----
  detailBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    padding: space(5),
  },
  detailCard: {
    borderWidth: 1,
    borderColor: color.lineBright,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    padding: space(5),
  },
  detailHead: { flexDirection: 'row', alignItems: 'flex-start', gap: space(3) },
  detailName: { fontFamily: font.display, fontSize: 19, color: color.text },
  detailBlurb: { fontSize: 11, color: color.dim, marginTop: 3, lineHeight: 16 },
  detailClose: { fontSize: 10, letterSpacing: 1.3, color: color.faint },
  detailArt: { alignItems: 'center', paddingVertical: space(3) },
  detailSection: { fontSize: 8, letterSpacing: 1.5, color: color.faint, marginBottom: space(2) },
  oddsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  oddsName: { fontSize: 10, letterSpacing: 1.2, color: color.text },
  oddsPct: { fontSize: 11, color: color.accent, fontVariant: ['tabular-nums'] },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    paddingVertical: space(2),
    borderBottomWidth: 1,
    borderBottomColor: color.line,
  },
  itemRowName: { fontFamily: font.monoSemi, fontSize: 11, color: color.text },
  itemRowBlurb: { fontSize: 9, color: color.faint, lineHeight: 13, marginTop: 2 },
  detailFoot: {
    fontSize: 8,
    letterSpacing: 1,
    color: color.faint,
    lineHeight: 13,
    marginTop: space(4),
  },
  detailBlocked: {
    borderWidth: 1,
    borderColor: color.warn,
    borderRadius: radius.sm,
    alignItems: 'center',
    paddingVertical: space(3.5),
  },
  detailBlockedText: { fontSize: 10, letterSpacing: 1.3, color: color.warn },

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
  noticeNever: {
    fontSize: 10,
    letterSpacing: 1.4,
    color: color.faint,
    textAlign: 'center',
    marginTop: space(4),
  },

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
