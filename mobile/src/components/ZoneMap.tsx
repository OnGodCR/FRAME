import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, {
  Rect,
  Circle,
  Line,
  Defs,
  Mask,
  G,
  Polygon,
} from 'react-native-svg';
import { color, font } from '../theme';

// Seeded PRNG so the "city" is stable across renders.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface BlockRect {
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
}

function buildCity(seed: number, W: number, H: number): BlockRect[] {
  const rnd = mulberry32(seed);
  const xs: number[] = [0];
  while (xs[xs.length - 1] < W) xs.push(xs[xs.length - 1] + 26 + rnd() * 46);
  const ys: number[] = [0];
  while (ys[ys.length - 1] < H) ys.push(ys[ys.length - 1] + 26 + rnd() * 46);
  const gap = 5;
  const blocks: BlockRect[] = [];
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ys.length - 1; j++) {
      const r = rnd();
      let fill = '#131318';
      if (r > 0.86) fill = '#101a12'; // park
      else if (r > 0.68) fill = '#17171d';
      blocks.push({
        x: xs[i] + gap / 2,
        y: ys[j] + gap / 2,
        w: xs[i + 1] - xs[i] - gap,
        h: ys[j + 1] - ys[j] - gap,
        fill,
      });
    }
  }
  return blocks;
}

export interface MapMarker {
  key: string;
  x: number; // 0..1
  y: number;
  kind: 'self' | 'reveal' | 'poi' | 'seeker' | 'dead';
  label?: string;
  fade?: number; // 0..1 remaining visibility for reveals
}

export function ZoneMap({
  width,
  height,
  zoneScale = 1,
  shrinkPreview = false,
  markers = [],
  seed = 7,
}: {
  width: number;
  height: number;
  zoneScale?: number;
  shrinkPreview?: boolean;
  markers?: MapMarker[];
  seed?: number;
}) {
  const blocks = useMemo(() => buildCity(seed, width, height), [seed, width, height]);
  const cx = width / 2;
  const cy = height / 2;
  const baseR = Math.min(width, height) * 0.44;
  const r = baseR * zoneScale;

  const zoneAnim = useRef(new Animated.Value(zoneScale)).current;
  useEffect(() => {
    Animated.timing(zoneAnim, {
      toValue: zoneScale,
      duration: 1200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [zoneScale]);

  return (
    <View style={{ width, height, overflow: 'hidden', backgroundColor: color.bg }}>
      <Svg width={width} height={height}>
        <Defs>
          <Mask id="zone">
            <Rect x={0} y={0} width={width} height={height} fill="#fff" />
            <Circle cx={cx} cy={cy} r={r} fill="#000" />
          </Mask>
        </Defs>
        {blocks.map((b, i) => (
          <Rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} fill={b.fill} rx={1.5} />
        ))}
        {/* diagonal avenue */}
        <Line
          x1={-20}
          y1={height * 0.85}
          x2={width * 0.9}
          y2={-20}
          stroke={color.bg}
          strokeWidth={9}
        />
        {/* outside-zone dimmer */}
        <Rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill="rgba(5,5,7,0.72)"
          mask="url(#zone)"
        />
        {/* zone ring */}
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          fill="rgba(200,255,46,0.03)"
          stroke={color.accent}
          strokeWidth={1.5}
          strokeDasharray="7 5"
        />
        {shrinkPreview && (
          <Circle
            cx={cx}
            cy={cy}
            r={r * 0.75}
            fill="none"
            stroke={color.warn}
            strokeWidth={1}
            strokeDasharray="3 5"
          />
        )}
        {/* center tick */}
        <G>
          <Line x1={cx - 5} y1={cy} x2={cx + 5} y2={cy} stroke={color.faint} strokeWidth={1} />
          <Line x1={cx} y1={cy - 5} x2={cx} y2={cy + 5} stroke={color.faint} strokeWidth={1} />
        </G>
        {/* POI diamonds drawn in SVG so they sit under the overlay markers */}
        {markers
          .filter((m) => m.kind === 'poi')
          .map((m) => {
            const px = m.x * width;
            const py = m.y * height;
            return (
              <Polygon
                key={m.key}
                points={`${px},${py - 6} ${px + 6},${py} ${px},${py + 6} ${px - 6},${py}`}
                fill="none"
                stroke={color.dim}
                strokeWidth={1.4}
              />
            );
          })}
      </Svg>
      {markers
        .filter((m) => m.kind !== 'poi')
        .map((m) => (
          <Marker key={m.key} marker={m} width={width} height={height} />
        ))}
    </View>
  );
}

function Marker({
  marker,
  width,
  height,
}: {
  marker: MapMarker;
  width: number;
  height: number;
}) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (marker.kind !== 'self' && marker.kind !== 'seeker') return;
    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 1800,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const left = marker.x * width;
  const top = marker.y * height;

  if (marker.kind === 'self' || marker.kind === 'seeker') {
    const tint = marker.kind === 'self' ? color.accent : color.danger;
    return (
      <View pointerEvents="none" style={[styles.markerWrap, { left, top }]}>
        <Animated.View
          style={[
            styles.pulseRing,
            {
              borderColor: tint,
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
              transform: [
                { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 2.2] }) },
              ],
            },
          ]}
        />
        <View style={[styles.dot, { backgroundColor: tint }]} />
        {marker.label ? <Text style={styles.markerLabel}>{marker.label}</Text> : null}
      </View>
    );
  }

  if (marker.kind === 'reveal') {
    return (
      <View
        pointerEvents="none"
        style={[styles.markerWrap, { left, top, opacity: 0.25 + 0.75 * (marker.fade ?? 1) }]}
      >
        <View style={styles.revealPin} />
        {marker.label ? (
          <Text style={[styles.markerLabel, { color: color.accent }]}>{marker.label}</Text>
        ) : null}
      </View>
    );
  }

  // dead
  return (
    <View pointerEvents="none" style={[styles.markerWrap, { left, top, opacity: 0.5 }]}>
      <Text style={{ color: color.faint, fontSize: 11, fontFamily: font.monoSemi }}>×</Text>
      {marker.label ? (
        <Text style={[styles.markerLabel, { color: color.faint }]}>{marker.label}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  markerWrap: {
    position: 'absolute',
    width: 0,
    height: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: color.bg,
  },
  pulseRing: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
  },
  revealPin: {
    width: 9,
    height: 9,
    backgroundColor: color.accent,
    transform: [{ rotate: '45deg' }],
  },
  markerLabel: {
    position: 'absolute',
    top: 8,
    fontFamily: font.monoMed,
    fontSize: 8,
    letterSpacing: 1,
    color: color.text,
    width: 60,
    textAlign: 'center',
  },
});
