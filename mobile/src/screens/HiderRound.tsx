import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { color, font, radius, space } from '../theme';
import { Btn, Label, Mono } from '../components/ui';
import { ZoneMap, MapMarker, Poi } from '../components/ZoneMap';
import { PinchArea, ScaleBadge, ZoomControls, useMapCamera } from '../components/MapCamera';
import { useWorld } from '../engine/WorldContext';
import { useHeading } from '../engine/useHeading';
import { PoiSheet } from '../components/PoiSheet';
import { ExplainerButton, InventoryDrawer, SosButton, Ticker } from '../components/RoundChrome';
import { fmtClock, roundClock, useGame } from '../engine/GameContext';

const SELF = { x: 0.47, y: 0.56 };
const ZONE_DIAMETER_M = 2000;

/** Ground distance between two normalized map points. */
const metersTo = (p: { x: number; y: number }) =>
  Math.hypot(p.x - SELF.x, p.y - SELF.y) * ZONE_DIAMETER_M;

export function HiderRound() {
  const { round, go, leaveRound } = useGame();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const pulse = useRef(new Animated.Value(0)).current;
  const [openPoi, setOpenPoi] = useState<Poi | null>(null);
  const [claimed, setClaimed] = useState<string[]>([]);
  const { world } = useWorld();
  const { zoom, step, pinch } = useMapCamera(2);
  const { heading } = useHeading();

  const checkinOpen = !!round?.checkin && !round.checkin.submitted;

  useEffect(() => {
    if (!checkinOpen) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 550,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 550,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [checkinOpen]);

  if (!round) return null;

  const t = round.elapsed;
  const pinged = round.pingFlashUntil != null && t < round.pingFlashUntil;
  const nextTickAt = round.checkin ? null : t < 20 ? 20 : t < 150 ? 150 : null;
  const alive = round.bots.filter((b) => b.state === 'alive').length + 1;

  const markers: MapMarker[] = [
    { key: 'me', x: SELF.x, y: SELF.y, kind: 'self', label: 'YOU', heading },
  ];

  return (
    <View style={styles.screen}>
      {/* The map is the screen. Everything else floats on top of it. */}
      <View style={StyleSheet.absoluteFill}>
        <PinchArea gesture={pinch}>
          <View>
            <ZoneMap
              width={width}
              height={height}
              zoneScale={round.zoneScale}
              shrinkPreview={round.shrinkWarnUntil != null}
              markers={markers}
              pois={world.pois}
              streets={world.streets}
              claimedPoiIds={claimed}
              onPoiPress={setOpenPoi}
              center={SELF}
              zoom={zoom}
            />
          </View>
        </PinchArea>
      </View>

      {/* top HUD */}
      <View style={[styles.topBar, { paddingTop: insets.top + space(2) }]}>
        <View>
          <Label tone="faint" style={{ fontSize: 8 }}>
            ROUND
          </Label>
          <Text style={styles.clock}>{roundClock(round)}</Text>
        </View>
        <View style={{ alignItems: 'center' }}>
          <Label tone="accent">Hiding</Label>
          <Mono style={{ fontSize: 10, color: color.dim, marginTop: 2 }}>
            {alive} ALIVE · ZONE {round.zoneScale === 1 ? '1.0' : '0.75'} KM
          </Mono>
        </View>
        <ExplainerButton />
      </View>

      <View style={[styles.tickerWrap, { top: insets.top + space(14) }]} pointerEvents="none">
        <Ticker events={round.ticker} />
        {round.shrinkWarnUntil != null && (
          <View style={styles.shrinkWarn}>
            <Mono style={{ fontSize: 10, letterSpacing: 1.2, color: color.warn }}>
              ZONE CONTRACTS IN {fmtClock(round.shrinkWarnUntil - t)}
            </Mono>
          </View>
        )}
      </View>

      {/* right rail sits below the ticker so the two never overlap */}
      <View style={[styles.rightRail, { top: insets.top + space(24) }]}>
        <ZoomControls zoom={zoom} onStep={step} />
        <ScaleBadge zoom={zoom} style={{ marginTop: space(2) }} />
      </View>

      {pinged && (
        <View pointerEvents="none" style={styles.pingFlash}>
          <Text style={styles.pingText}>YOU'VE BEEN PINGED</Text>
          <Mono style={{ fontSize: 10, color: '#FFD9D6', letterSpacing: 1.5 }}>
            THE SEEKER HAS YOUR LAST POSITION
          </Mono>
        </View>
      )}

      {/* bottom HUD */}
      <View style={[styles.bottomStack, { paddingBottom: insets.bottom + space(3) }]}>
        <View style={styles.controlRow}>
          <SosButton onLeave={leaveRound} />
          <InventoryDrawer role="hider" />
        </View>

        <View style={styles.bottom}>
          {checkinOpen ? (
            <Animated.View
              style={[
                styles.checkinAlert,
                {
                  borderColor: pulse.interpolate({
                    inputRange: [0, 1],
                    outputRange: [color.accent, '#5E7A0E'],
                  }),
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Label tone="accent">Check-in 0{round.checkin!.index} open</Label>
                <Text style={styles.checkinTimer}>{fmtClock(round.checkin!.deadline - t)}</Text>
                <Mono style={{ fontSize: 10, color: color.dim }}>
                  MISS IT AND YOU'RE BLACKED OUT
                </Mono>
              </View>
              <Btn title="Open camera" onPress={() => go('checkin')} style={{ minWidth: 130 }} />
            </Animated.View>
          ) : (
            <View style={styles.nextRow}>
              <View>
                <Label tone="faint">Next check-in</Label>
                <Text style={styles.nextTimer}>
                  {nextTickAt != null ? fmtClock(nextTickAt - t) : '--:--'}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Label tone="faint">Check-ins passed</Label>
                <Text style={[styles.nextTimer, { color: color.accent }]}>
                  {String(round.checkinsPassed + 3).padStart(2, '0')}
                </Text>
              </View>
            </View>
          )}
        </View>
      </View>

      <PoiSheet
        poi={openPoi}
        distanceM={openPoi ? metersTo(openPoi) : Infinity}
        claimed={openPoi ? claimed.includes(openPoi.id) : false}
        onClaim={(p) => setClaimed((c) => [...c, p.id])}
        onClose={() => setOpenPoi(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: space(4),
    paddingBottom: space(2.5),
    backgroundColor: 'rgba(10,10,12,0.82)',
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
    left: space(3),
    right: space(3),
    gap: space(2),
  },
  rightRail: {
    position: 'absolute',
    right: space(3),
    alignItems: 'center',
  },
  shrinkWarn: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(10,10,12,0.92)',
    borderWidth: 1,
    borderColor: color.warn,
    borderRadius: radius.sm,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  pingFlash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 3,
    borderColor: color.danger,
    backgroundColor: 'rgba(255,68,56,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pingText: {
    fontFamily: font.display,
    fontSize: 22,
    letterSpacing: 3,
    color: color.danger,
    marginBottom: 4,
  },
  bottomStack: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: space(4),
    marginBottom: space(3),
  },
  bottom: {
    marginHorizontal: space(3),
    borderWidth: 1,
    borderColor: color.lineBright,
    borderRadius: radius.lg,
    padding: space(4),
    // Fully opaque: this panel holds the countdown that decides whether the
    // player survives, and map labels bleeding through it read as a glitch.
    backgroundColor: color.bg,
  },
  nextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  nextTimer: {
    fontFamily: font.display,
    fontSize: 36,
    color: color.text,
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  checkinAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    borderWidth: 2,
    borderRadius: radius.md,
    padding: space(3.5),
    backgroundColor: color.bg,
  },
  checkinTimer: {
    fontFamily: font.display,
    fontSize: 34,
    color: color.accent,
    fontVariant: ['tabular-nums'],
    marginVertical: 2,
  },
});
