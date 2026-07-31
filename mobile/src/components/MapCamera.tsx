import React, { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { color, font, radius, space } from '../theme';
import { MAX_ZOOM, MIN_ZOOM } from './ZoneMap';

const clamp = (v: number) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, v));

/**
 * Map camera zoom, driven by pinch on device and by buttons everywhere.
 *
 * The buttons are not just a web fallback: one-handed play while walking is the
 * normal case for this game, and a pinch needs two hands.
 */
/**
 * Default zoom. 1 shows the whole zone; higher numbers move in.
 *
 * Opens close to the player. A previous change pulled this out to 1.15 on the
 * theory that a hider wants to see the whole zone, which was the wrong call:
 * what you actually need while walking is the street you are on and the
 * nearest few POIs, and the zone ring is already legible from the scale badge.
 * Zooming out is one tap; squinting at a wide map while moving is not.
 */
export const DEFAULT_ZOOM = 2.6;

export function useMapCamera(initial = DEFAULT_ZOOM) {
  const [zoom, setZoomState] = useState(initial);
  const start = useRef(initial);

  const setZoom = useCallback((z: number) => setZoomState(clamp(z)), []);

  const step = useCallback((dir: 1 | -1) => {
    Haptics.selectionAsync();
    setZoomState((z) => clamp(dir === 1 ? z * 1.5 : z / 1.5));
  }, []);

  // runOnJS keeps the handlers on the JS thread, which avoids pulling in
  // Reanimated for what is a handful of state updates per gesture.
  const pinch = Gesture.Pinch()
    .runOnJS(true)
    .onStart(() => {
      start.current = zoom;
    })
    .onUpdate((e) => {
      setZoomState(clamp(start.current * e.scale));
    });

  return { zoom, setZoom, step, pinch };
}

export function PinchArea({
  gesture,
  children,
}: {
  gesture: ReturnType<typeof Gesture.Pinch>;
  children: React.ReactNode;
}) {
  return <GestureDetector gesture={gesture}>{children as any}</GestureDetector>;
}

export function ZoomControls({
  zoom,
  onStep,
  style,
}: {
  zoom: number;
  onStep: (dir: 1 | -1) => void;
  style?: any;
}) {
  return (
    <View style={[styles.wrap, style]}>
      <Pressable
        onPress={() => onStep(1)}
        disabled={zoom >= MAX_ZOOM}
        style={({ pressed }) => [
          styles.btn,
          styles.btnTop,
          zoom >= MAX_ZOOM && styles.dim,
          pressed && styles.pressed,
        ]}
        hitSlop={6}
      >
        <Text style={styles.glyph}>+</Text>
      </Pressable>
      <View style={styles.divider} />
      <Pressable
        onPress={() => onStep(-1)}
        disabled={zoom <= MIN_ZOOM}
        style={({ pressed }) => [
          styles.btn,
          styles.btnBottom,
          zoom <= MIN_ZOOM && styles.dim,
          pressed && styles.pressed,
        ]}
        hitSlop={6}
      >
        <Text style={styles.glyph}>−</Text>
      </Pressable>
    </View>
  );
}

/** Small readout so the player knows how far out they are looking. */
export function ScaleBadge({ zoom, style }: { zoom: number; style?: any }) {
  // 1.0 normalized unit is the 1 km zone diameter.
  const acrossM = Math.round(2000 / zoom / 10) * 10;
  const text = acrossM >= 1000 ? `${(acrossM / 1000).toFixed(1)} KM` : `${acrossM} M`;
  return (
    <View style={[styles.badge, style]}>
      <Text style={styles.badgeText}>{text} ACROSS</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: 'rgba(10,10,12,0.9)',
    borderWidth: 1,
    borderColor: color.lineBright,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  btn: {
    width: 40,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnTop: {},
  btnBottom: {},
  divider: { height: 1, backgroundColor: color.line },
  dim: { opacity: 0.3 },
  pressed: { backgroundColor: color.surface2 },
  glyph: {
    fontFamily: font.display,
    fontSize: 22,
    lineHeight: 26,
    color: color.text,
  },
  badge: {
    backgroundColor: 'rgba(10,10,12,0.9)',
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: {
    fontFamily: font.monoMed,
    fontSize: 9,
    letterSpacing: 1.2,
    color: color.dim,
  },
});
