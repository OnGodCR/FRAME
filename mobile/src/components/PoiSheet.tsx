import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { color, font, radius, space } from '../theme';
import { Btn, Label, Mono, Rule } from './ui';
import { Poi, POI_TYPE_META } from './ZoneMap';

const HOLD_MS = 5000; // PRD 6.2: hold still for 5 seconds
const RANGE_M = 30; // PRD 6.2: within 30 m

/** Rough "is it open right now" check against an OSM opening_hours string. */
export function isOpenNow(hours: string | null): boolean {
  if (!hours) return true;
  if (/24\/7/.test(hours)) return true;
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const ranges = [...hours.matchAll(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/g)];
  if (!ranges.length) return true;
  return ranges.some((m) => {
    const from = +m[1] * 60 + +m[2];
    const to = +m[3] * 60 + +m[4];
    return mins >= from && mins <= to;
  });
}

export function PoiSheet({
  poi,
  distanceM,
  claimed,
  speedLocked,
  onClaim,
  onClose,
}: {
  poi: Poi | null;
  distanceM: number;
  claimed: boolean;
  speedLocked?: boolean;
  onClaim: (poi: Poi) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const progress = useRef(new Animated.Value(0)).current;
  const [holding, setHolding] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDone(false);
    setHolding(false);
    progress.setValue(0);
  }, [poi?.id]);

  if (!poi) return null;

  const meta = POI_TYPE_META[poi.type];
  const open = isOpenNow(poi.hours);
  const inRange = distanceM <= RANGE_M;
  const blocked = speedLocked || !open || !inRange || claimed;

  const startHold = () => {
    if (blocked || done) return;
    setHolding(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.timing(progress, {
      toValue: 1,
      duration: HOLD_MS,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (!finished) return;
      setDone(true);
      setHolding(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClaim(poi);
    });
  };

  const cancelHold = () => {
    if (done) return;
    setHolding(false);
    Animated.timing(progress, {
      toValue: 0,
      duration: 220,
      useNativeDriver: false,
    }).start();
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + space(8) }]} onPress={() => {}}>
          <View style={styles.headRow}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Label style={{ color: meta.tint }}>{meta.label}</Label>
              <Text style={styles.name}>{poi.name}</Text>
              <Mono style={styles.category}>
                {poi.category.toUpperCase()} · {Math.round(distanceM)} M AWAY
              </Mono>
            </View>
            <View style={[styles.glyph, { borderColor: meta.tint }]} />
          </View>

          <Rule style={{ marginVertical: space(4) }} />

          <Mono style={styles.blurb}>{meta.blurb}</Mono>

          {poi.hours && (
            <Mono style={[styles.hours, !open && { color: color.warn }]}>
              HOURS {poi.hours.toUpperCase()}
              {!open ? ' · CLOSED RIGHT NOW' : ''}
            </Mono>
          )}

          <View style={{ marginTop: space(5) }}>
            {done || claimed ? (
              <View style={[styles.holdBtn, { borderColor: meta.tint }]}>
                <Text style={[styles.holdText, { color: meta.tint }]}>
                  {poi.type === 'beacon' ? 'HELD' : 'COLLECTED'}
                </Text>
              </View>
            ) : (
              <Pressable
                onPressIn={startHold}
                onPressOut={cancelHold}
                disabled={blocked}
                style={[styles.holdBtn, blocked && { opacity: 0.4 }]}
              >
                <Animated.View
                  style={[
                    styles.holdFill,
                    {
                      backgroundColor: meta.tint,
                      width: progress.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                      }),
                    },
                  ]}
                />
                <Text style={styles.holdText}>
                  {speedLocked
                    ? 'DISABLED WHILE MOVING'
                    : !open
                      ? 'CLOSED'
                      : !inRange
                        ? `MOVE CLOSER · WITHIN ${RANGE_M} M`
                        : holding
                          ? 'HOLD STILL'
                          : 'HOLD TO INTERACT'}
                </Text>
              </Pressable>
            )}
            <Mono style={styles.footnote}>
              {inRange
                ? 'Stay still for 5 seconds. Moving cancels it.'
                : 'You have to actually walk there.'}
            </Mono>
          </View>

          <View style={{ height: space(3) }} />
          <Btn title="Close" variant="outline" onPress={onClose} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: color.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.line,
    padding: space(5),
  },
  headRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space(3) },
  name: {
    fontFamily: font.display,
    fontSize: 24,
    color: color.text,
    marginTop: 4,
    letterSpacing: -0.3,
  },
  category: { fontSize: 10, color: color.dim, letterSpacing: 1.2, marginTop: 4 },
  glyph: {
    width: 22,
    height: 22,
    borderWidth: 2,
    transform: [{ rotate: '45deg' }],
    marginTop: 6,
    flexShrink: 0,
  },
  blurb: { fontSize: 12, color: color.text, lineHeight: 19 },
  hours: { fontSize: 10, color: color.faint, letterSpacing: 1, marginTop: space(3) },
  holdBtn: {
    height: 56,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.lineBright,
    backgroundColor: color.surface2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  holdFill: { position: 'absolute', left: 0, top: 0, bottom: 0, opacity: 0.28 },
  holdText: {
    fontFamily: font.monoSemi,
    fontSize: 12,
    letterSpacing: 2,
    color: color.text,
  },
  footnote: {
    fontSize: 10,
    color: color.faint,
    marginTop: space(2),
    textAlign: 'center',
  },
});
