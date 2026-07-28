import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { color, font, radius, space } from '../theme';
import { Btn, Label, Mono } from '../components/ui';
import { ZoneMap, MapMarker } from '../components/ZoneMap';
import { useWorld } from '../engine/WorldContext';
import { ExplainerButton, InventoryDrawer, SosButton, Ticker } from '../components/RoundChrome';
import { ProceduralPhoto } from '../components/ProceduralPhoto';
import { FeedPhoto, fmtClock, roundClock, useGame } from '../engine/GameContext';

export function SeekerRound() {
  const { round, leaveRound, tag } = useGame();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [openPhoto, setOpenPhoto] = useState<FeedPhoto | null>(null);
  const { world } = useWorld();

  if (!round) return null;
  const t = round.elapsed;
  const alive = round.bots.filter((b) => b.state === 'alive');
  const nextRevealAt = t < 32 ? 32 : t < 128 ? 128 : null;

  const markers: MapMarker[] = [
    { key: 'me', x: 0.5, y: 0.5, kind: 'seeker', label: 'YOU' },
    ...round.reveals.map((p) => ({
      key: p.id,
      x: p.pos.x,
      y: p.pos.y,
      kind: 'reveal' as const,
      label: p.name,
      fade: 1 - (t - p.bornAt) / p.ttl,
    })),
    ...round.bots
      .filter((b) => b.state !== 'alive')
      .map((b) => ({ key: `dead-${b.id}`, x: b.pos.x, y: b.pos.y, kind: 'dead' as const, label: b.name })),
  ];

  const canTag = round.proximity >= 0.8;
  const signalBars = Math.round(round.proximity * 5);
  const mapH = height - 332 - insets.top;

  return (
    <View style={styles.screen}>
      {/* top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + space(2) }]}>
        <View>
          <Label tone="faint" style={{ fontSize: 8 }}>
            ROUND
          </Label>
          <Text style={styles.clock}>{roundClock(round)}</Text>
        </View>
        <View style={{ alignItems: 'center' }}>
          <Label tone="danger">Seeking</Label>
          <Mono style={{ fontSize: 10, color: color.dim, marginTop: 2 }}>
            {alive.length} {alive.length === 1 ? 'HIDER' : 'HIDERS'} LEFT · NEXT REVEAL{' '}
            {nextRevealAt != null ? fmtClock(nextRevealAt - t) : '--:--'}
          </Mono>
        </View>
        <ExplainerButton />
      </View>

      {/* map */}
      <View style={{ flex: 1 }}>
        <ZoneMap
          width={width}
          height={Math.max(mapH, 180)}
          zoneScale={round.zoneScale}
          markers={markers}
          pois={world.pois}
          streets={world.streets}
        />
        <View style={styles.tickerWrap} pointerEvents="none">
          <Ticker events={round.ticker} />
        </View>
        <View style={[styles.sosWrap, { bottom: space(3) }]}>
          <SosButton onLeave={leaveRound} />
        </View>
        <View style={[styles.invWrap, { bottom: space(3) }]}>
          <InventoryDrawer role="seeker" />
        </View>
      </View>

      {/* photo feed */}
      <View style={styles.feed}>
        <View style={styles.feedHeader}>
          <Label tone="text">Proof feed</Label>
          <Mono style={{ fontSize: 10, color: color.faint }}>
            NEWEST FIRST · DELETED 24 H AFTER ROUND
          </Mono>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space(3), gap: space(2) }}>
          {round.photos.length === 0 ? (
            <View style={styles.feedEmpty}>
              <Mono style={{ fontSize: 11, color: color.faint }}>
                Waiting for the first check-in tick…
              </Mono>
            </View>
          ) : (
            round.photos.map((p) => (
              <Pressable key={p.id} style={styles.feedCard} onPress={() => setOpenPhoto(p)}>
                <View style={{ flexDirection: 'row' }}>
                  <ProceduralPhoto seed={p.seedBack} width={62} height={78} variant="back" />
                  <ProceduralPhoto seed={p.seedFront} width={62} height={78} variant="front" />
                </View>
                <View style={styles.feedMeta}>
                  <Text style={styles.feedName}>{p.name}</Text>
                  <Mono style={{ fontSize: 9, color: color.faint }}>CI-0{p.checkinIndex}</Mono>
                </View>
              </Pressable>
            ))
          )}
        </ScrollView>
      </View>

      {/* tag control */}
      <View style={[styles.tagBar, { paddingBottom: insets.bottom + space(3) }]}>
        <View style={{ flex: 1 }}>
          <Label tone={canTag ? 'accent' : 'faint'}>
            {canTag
              ? 'BLE HANDSHAKE · SIGNAL STRONG'
              : round.proximity > 0
                ? 'BLE SIGNAL RISING'
                : 'NO BLE SIGNAL'}
          </Label>
          <View style={styles.signalRow}>
            {Array.from({ length: 5 }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.signalBar,
                  { height: 6 + i * 4 },
                  i < signalBars && { backgroundColor: canTag ? color.accent : color.warn },
                ]}
              />
            ))}
          </View>
          <Mono style={{ fontSize: 9, color: color.faint, marginTop: 3 }}>
            GPS ALONE NEVER CONFIRMS A TAG
          </Mono>
        </View>
        <Pressable
          disabled={!canTag}
          onPress={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            tag();
          }}
          style={({ pressed }) => [
            styles.tagBtn,
            !canTag && { backgroundColor: color.surface2, borderColor: color.line },
            pressed && canTag && { opacity: 0.8 },
          ]}
        >
          <Text style={[styles.tagText, !canTag && { color: color.faint }]}>TAG</Text>
        </Pressable>
      </View>

      {/* photo detail */}
      <Modal visible={!!openPhoto} transparent animationType="fade" onRequestClose={() => setOpenPhoto(null)}>
        <Pressable style={styles.photoBackdrop} onPress={() => setOpenPhoto(null)}>
          {openPhoto && (
            <View style={styles.photoSheet}>
              <View style={{ flexDirection: 'row', gap: space(2) }}>
                <ProceduralPhoto seed={openPhoto.seedBack} width={(width - space(16)) / 2} height={200} variant="back" />
                <ProceduralPhoto seed={openPhoto.seedFront} width={(width - space(16)) / 2} height={200} variant="front" />
              </View>
              <View style={{ marginTop: space(3), flexDirection: 'row', justifyContent: 'space-between' }}>
                <View>
                  <Text style={styles.feedName}>{openPhoto.name}</Text>
                  <Mono style={{ fontSize: 10, color: color.dim, marginTop: 2 }}>
                    CHECK-IN 0{openPhoto.checkinIndex} · VALIDATED SERVER-SIDE
                  </Mono>
                </View>
                <Pressable hitSlop={8}>
                  <Label tone="danger">Report</Label>
                </Pressable>
              </View>
            </View>
          )}
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: space(4),
    paddingBottom: space(2.5),
    borderBottomWidth: 1,
    borderBottomColor: color.line,
  },
  clock: {
    fontFamily: font.display,
    fontSize: 24,
    color: color.text,
    fontVariant: ['tabular-nums'],
  },
  tickerWrap: {
    position: 'absolute',
    top: space(3),
    left: space(3),
    right: space(3),
  },
  sosWrap: { position: 'absolute', left: space(4) },
  invWrap: { position: 'absolute', right: space(4) },
  feed: {
    borderTopWidth: 1,
    borderTopColor: color.line,
    backgroundColor: color.surface,
    paddingBottom: space(3),
  },
  feedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space(4),
    paddingVertical: space(2.5),
  },
  feedEmpty: {
    height: 100,
    justifyContent: 'center',
    paddingHorizontal: space(4),
  },
  feedCard: {
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: color.bg,
  },
  feedMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 5,
  },
  feedName: {
    fontFamily: font.monoSemi,
    fontSize: 11,
    letterSpacing: 1.2,
    color: color.text,
  },
  tagBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(4),
    borderTopWidth: 1,
    borderTopColor: color.line,
    backgroundColor: color.bg,
    paddingHorizontal: space(4),
    paddingTop: space(3),
  },
  signalRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    marginTop: 6,
  },
  signalBar: {
    width: 8,
    backgroundColor: color.surface2,
    borderRadius: 1.5,
  },
  tagBtn: {
    width: 108,
    height: 64,
    borderRadius: radius.md,
    backgroundColor: color.accent,
    borderWidth: 1,
    borderColor: color.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagText: {
    fontFamily: font.display,
    fontSize: 22,
    letterSpacing: 4,
    color: color.onAccent,
  },
  photoBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    padding: space(5),
  },
  photoSheet: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.md,
    padding: space(3),
  },
});
