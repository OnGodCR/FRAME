import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { color, font, radius, space } from '../theme';
import { Btn, Card, Label, Mono, Rule } from '../components/ui';
import { CosmeticPreview } from '../components/Cosmetics';
import { useGame } from '../engine/GameContext';

interface ShopItem {
  id: string;
  name: string;
  kind: 'pin' | 'frame' | 'static' | 'tag' | 'title';
  category: string;
  cost: number; // FILM
  tint?: string;
}

const ITEMS: ShopItem[] = [
  { id: 'pin-ghost', name: 'GHOST GRID', kind: 'pin', category: 'MAP PIN', cost: 600, tint: '#9BE8FF' },
  { id: 'frame-darkroom', name: 'DARKROOM', kind: 'frame', category: 'PHOTO FRAME', cost: 400, tint: '#FF8A5C' },
  { id: 'static-signal', name: 'SIGNAL LOST', kind: 'static', category: 'BLACKOUT STYLE', cost: 550, tint: '#C9C9D4' },
  { id: 'tag-prism', name: 'PRISM', kind: 'tag', category: 'TAG ANIMATION', cost: 800, tint: '#D8B4FF' },
  { id: 'title-developer', name: '"DEVELOPED"', kind: 'title', category: 'TITLE', cost: 300, tint: '#C8FF2E' },
  { id: 'pin-negative', name: 'NEGATIVE', kind: 'pin', category: 'MAP PIN', cost: 450, tint: '#FFFFFF' },
];

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

        <View style={styles.header}>
          <Text style={styles.h1}>Shop</Text>
          <View style={styles.filmChip}>
            <CosmeticPreview kind="film" size={22} />
            <Text style={styles.filmAmount}>{profile.film.toLocaleString()}</Text>
            <Label tone="faint" style={{ fontSize: 8 }}>
              FILM
            </Label>
          </View>
        </View>
        <Mono style={{ fontSize: 11, color: color.faint, marginTop: 2 }}>
          Cosmetics only. Nothing here changes how a round plays.
        </Mono>

        {/* season pass product */}
        <Card style={{ marginTop: space(5), borderColor: profile.paidPass ? color.line : color.accent }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Label tone="accent">Season 01 · Exposure</Label>
              <Text style={styles.passName}>PAID TRACK</Text>
              <Mono style={{ fontSize: 11, color: color.dim, marginTop: 2 }}>
                50 tiers of cosmetics + FILM. 6 weeks left.
              </Mono>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.price}>{profile.paidPass ? 'OWNED' : '$4.99'}</Text>
            </View>
          </View>
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
            <Mono style={{ fontSize: 10, color: color.accent, letterSpacing: 1.2, textAlign: 'center' }}>
              VIEW ALL 50 TIERS →
            </Mono>
          </Pressable>
        </Card>

        {/* cosmetics grid */}
        <Label tone="text" style={{ marginTop: space(6), marginBottom: space(3) }}>
          Cosmetics
        </Label>
        <View style={styles.grid}>
          {ITEMS.map((item) => {
            const owned = profile.owned.includes(item.id);
            const affordable = profile.film >= item.cost;
            return (
              <Pressable
                key={item.id}
                disabled={owned || !affordable}
                onPress={() => {
                  if (purchase(item.id, item.cost)) {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  }
                }}
                style={({ pressed }) => [styles.itemCard, pressed && { opacity: 0.75 }]}
              >
                <CosmeticPreview kind={item.kind} tint={item.tint} size={64} />
                <Label tone="faint" style={{ fontSize: 8, marginTop: space(2) }}>
                  {item.category}
                </Label>
                <Text style={styles.itemName}>{item.name}</Text>
                <View style={styles.itemPriceRow}>
                  {owned ? (
                    <Mono style={{ fontSize: 10, color: color.accent, letterSpacing: 1 }}>OWNED</Mono>
                  ) : (
                    <>
                      <CosmeticPreview kind="film" size={14} tint={affordable ? color.accent : color.faint} />
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
              </Pressable>
            );
          })}
        </View>

        {/* film top-ups */}
        <Label tone="text" style={{ marginTop: space(6), marginBottom: space(3) }}>
          Film
        </Label>
        <Card style={{ padding: 0 }}>
          <Pressable
            style={styles.filmRow}
            onPress={() => Haptics.selectionAsync()}
          >
            <View style={styles.filmRowLeft}>
              <CosmeticPreview kind="film" size={34} tint={color.dim} />
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>WATCH AN AD</Text>
                <Mono style={{ fontSize: 10, color: color.faint }}>
                  Optional. Never grants buffs or gameplay items.
                </Mono>
              </View>
            </View>
            <Mono style={{ fontSize: 12, color: color.accent, fontFamily: font.monoSemi }}>+50</Mono>
          </Pressable>
          <Rule />
          <View style={styles.filmRow}>
            <View style={styles.filmRowLeft}>
              <CosmeticPreview kind="film" size={34} />
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>1,000 FILM</Text>
                <Mono style={{ fontSize: 10, color: color.faint }}>Spendable on cosmetics only.</Mono>
              </View>
            </View>
            <Mono style={{ fontSize: 12, color: color.text, fontFamily: font.monoSemi }}>$2.99</Mono>
          </View>
        </Card>

        <Mono style={{ fontSize: 10, color: color.faint, marginTop: space(4), lineHeight: 16 }}>
          Any real-money purchase permanently disables all advertising on this account.
          Not for a season — forever. Buffs and nerfs are earned in rounds and are never
          sold.
        </Mono>
      </ScrollView>
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
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space(3),
  },
  itemCard: {
    width: '47.7%',
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.md,
    padding: space(3),
    alignItems: 'center',
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
  },
});
