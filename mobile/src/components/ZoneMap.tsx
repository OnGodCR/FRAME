import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Rect, Circle, Line, Defs, Mask, G, Path, Polygon } from 'react-native-svg';
import { color, font } from '../theme';
import { Poi, Street } from '../data/poiRules';

// The basemap is real: street geometry and landmarks come from OpenStreetMap,
// filtered against the PRD 6.1 placement restrictions in poiRules.ts, either
// live around the player or from the pre-baked sample. Coordinates arrive
// already projected into 0..1 map space where 0.5 of offset is the zone radius.

export type { Poi } from '../data/poiRules';

export const POI_TYPE_META: Record<
  Poi['type'],
  { label: string; blurb: string; tint: string }
> = {
  cache: {
    label: 'CACHE',
    blurb: 'Grants one random buff from your pool. 30 minute cooldown.',
    tint: '#9BE8FF',
  },
  beacon: {
    label: 'BEACON',
    blurb: 'Claimable. Earns passive XP while you hold it. Anyone who visits takes it.',
    tint: '#C8FF2E',
  },
  waystation: {
    label: 'WAYSTATION',
    blurb: 'Clears every active nerf on you and pays a small XP bonus.',
    tint: '#D8B4FF',
  },
};

export interface MapMarker {
  key: string;
  x: number;
  y: number;
  kind: 'self' | 'reveal' | 'seeker' | 'dead';
  label?: string;
  fade?: number;
}

export function ZoneMap({
  width,
  height,
  zoneScale = 1,
  shrinkPreview = false,
  markers = [],
  pois = [],
  streets = [],
  claimedPoiIds = [],
  onPoiPress,
}: {
  width: number;
  height: number;
  zoneScale?: number;
  shrinkPreview?: boolean;
  markers?: MapMarker[];
  pois?: Poi[];
  streets?: Street[];
  claimedPoiIds?: string[];
  onPoiPress?: (poi: Poi) => void;
}) {
  const cx = width / 2;
  const cy = height / 2;
  const baseR = Math.min(width, height) * 0.44;
  const r = baseR * zoneScale;

  // The ingest projects the zone radius onto an offset of 0.5 from centre, so
  // that offset has to land exactly on the zone ring: a landmark 1 km out
  // belongs on the boundary, not past it.
  const px = (x: number) => cx + (x - 0.5) * 2 * baseR;
  const py = (y: number) => cy + (y - 0.5) * 2 * baseR;

  // Marker weight scales with the map so the lobby thumbnail is not covered
  // in diamonds.
  const compact = Math.min(width, height) < 260;

  const paths = useMemo(() => {
    const major: string[] = [];
    const minor: string[] = [];
    for (const seg of streets) {
      let d = '';
      for (let i = 0; i < seg.p.length; i++) {
        const X = px(seg.p[i][0]);
        const Y = py(seg.p[i][1]);
        if (X < -80 || X > width + 80 || Y < -80 || Y > height + 80) {
          d += `M${X.toFixed(1)} ${Y.toFixed(1)}`;
          continue;
        }
        d += `${i === 0 ? 'M' : 'L'}${X.toFixed(1)} ${Y.toFixed(1)}`;
      }
      (seg.c === 1 ? major : minor).push(d);
    }
    return { major: major.join(' '), minor: minor.join(' ') };
  }, [width, height, streets]);

  return (
    <View style={{ width, height, overflow: 'hidden', backgroundColor: color.bg }}>
      <Svg width={width} height={height}>
        <Defs>
          <Mask id="zone">
            <Rect x={0} y={0} width={width} height={height} fill="#fff" />
            <Circle cx={cx} cy={cy} r={r} fill="#000" />
          </Mask>
        </Defs>

        <Rect x={0} y={0} width={width} height={height} fill="#0B0B0E" />
        <Path d={paths.minor} stroke="#1E1E25" strokeWidth={2.2} fill="none" strokeLinecap="round" />
        <Path d={paths.major} stroke="#2B2B34" strokeWidth={3.6} fill="none" strokeLinecap="round" />

        <Rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill="rgba(5,5,7,0.74)"
          mask="url(#zone)"
        />
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          fill="rgba(200,255,46,0.025)"
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
        <G>
          <Line x1={cx - 5} y1={cy} x2={cx + 5} y2={cy} stroke={color.faint} strokeWidth={1} />
          <Line x1={cx} y1={cy - 5} x2={cx} y2={cy + 5} stroke={color.faint} strokeWidth={1} />
        </G>
      </Svg>

      {/* Labels are their own layer: a sized child inside a zero-size marker
          box does not lay out, and they must not steal taps from the diamond.
          Only beacons are named, otherwise 32 captions fight each other. */}
      {!compact &&
        pois
          .filter((p) => p.type === 'beacon')
          .map((p) => (
            <Text
              key={`lbl-${p.id}`}
              pointerEvents="none"
              numberOfLines={1}
              style={[
                styles.poiLabel,
                {
                  // clamped so a landmark near the edge does not get its
                  // caption sliced off by the map bounds
                  left: Math.max(2, Math.min(px(p.x) - 55, width - 112)),
                  top: py(p.y) + 8,
                  color: POI_TYPE_META[p.type].tint,
                },
              ]}
            >
              {p.name.toUpperCase()}
            </Text>
          ))}

      {pois.map((p) => (
        <PoiMarker
          key={p.id}
          poi={p}
          left={px(p.x)}
          top={py(p.y)}
          claimed={claimedPoiIds.includes(p.id)}
          compact={compact}
          onPress={onPoiPress}
        />
      ))}

      {markers.map((m) => (
        <Marker key={m.key} marker={m} left={px(m.x)} top={py(m.y)} />
      ))}
    </View>
  );
}

function PoiMarker({
  poi,
  left,
  top,
  claimed,
  compact,
  onPress,
}: {
  poi: Poi;
  left: number;
  top: number;
  claimed: boolean;
  compact: boolean;
  onPress?: (p: Poi) => void;
}) {
  const meta = POI_TYPE_META[poi.type];
  const base = poi.type === 'cache' ? 7 : 10;
  const size = compact ? base * 0.5 : base;
  return (
    <Pressable
      onPress={() => onPress?.(poi)}
      hitSlop={compact ? 4 : 16}
      style={[styles.poiWrap, { left, top }]}
    >
      <View
        style={{
          width: size,
          height: size,
          borderWidth: compact ? 1 : 1.5,
          borderColor: meta.tint,
          backgroundColor: claimed ? meta.tint : 'transparent',
          transform: [{ rotate: '45deg' }],
          opacity: compact ? 0.85 : 1,
        }}
      />
    </Pressable>
  );
}

function Marker({ marker, left, top }: { marker: MapMarker; left: number; top: number }) {
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
  poiWrap: {
    position: 'absolute',
    width: 0,
    height: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  poiLabel: {
    position: 'absolute',
    width: 110,
    textAlign: 'center',
    fontFamily: font.monoMed,
    fontSize: 8,
    letterSpacing: 0.6,
  },
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
