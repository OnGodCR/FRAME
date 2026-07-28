import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Rect, Circle, Line, Defs, Mask, G, Path } from 'react-native-svg';
import { color, font } from '../theme';
import { Poi, Street } from '../data/poiRules';

// Full-bleed map with a camera that follows the player, rather than a window
// showing the whole zone at once. The zone circle is drawn at its true
// projected size, so at close zoom it runs off screen the way a real boundary
// would. Street geometry and landmarks come from OpenStreetMap, filtered
// against the PRD 6.1 placement rules in poiRules.ts. Coordinates arrive
// already projected into 0..1 space where 1.0 spans the zone diameter.

export type { Poi } from '../data/poiRules';

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 6;

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
  center = { x: 0.5, y: 0.5 },
  zoom = 1,
  showLabels = true,
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
  /** Camera centre in normalized map space. Usually the player. */
  center?: { x: number; y: number };
  zoom?: number;
  showLabels?: boolean;
}) {
  // One normalized unit is the zone diameter. At zoom 1 the whole zone fits.
  const scale = Math.min(width, height) * 0.88 * zoom;
  const px = (x: number) => width / 2 + (x - center.x) * scale;
  const py = (y: number) => height / 2 + (y - center.y) * scale;

  const zx = px(0.5);
  const zy = py(0.5);
  const zr = 0.5 * scale * zoneScale;

  const compact = Math.min(width, height) < 260;
  // Only the 8 beacons are named by default. Everything else earns a caption
  // once you have zoomed in far enough that 32 of them are not a wall of text.
  const detail = zoom >= 3.2;

  const paths = useMemo(() => {
    const major: string[] = [];
    const minor: string[] = [];
    const pad = 120;
    for (const seg of streets) {
      let d = '';
      let drawn = false;
      for (let i = 0; i < seg.p.length; i++) {
        const X = px(seg.p[i][0]);
        const Y = py(seg.p[i][1]);
        if (X < -pad || X > width + pad || Y < -pad || Y > height + pad) {
          d += `M${X.toFixed(1)} ${Y.toFixed(1)}`;
          continue;
        }
        drawn = true;
        d += `${i === 0 ? 'M' : 'L'}${X.toFixed(1)} ${Y.toFixed(1)}`;
      }
      if (drawn) (seg.c === 1 ? major : minor).push(d);
    }
    return { major: major.join(' '), minor: minor.join(' ') };
  }, [width, height, streets, center.x, center.y, zoom]);

  // Roads thicken with zoom so the network stays readable close in.
  const roadW = Math.max(1.6, 2.2 * Math.sqrt(zoom));

  return (
    <View style={{ width, height, overflow: 'hidden', backgroundColor: '#0B0B0E' }}>
      <Svg width={width} height={height}>
        <Defs>
          <Mask id="zone">
            <Rect x={0} y={0} width={width} height={height} fill="#fff" />
            <Circle cx={zx} cy={zy} r={zr} fill="#000" />
          </Mask>
        </Defs>

        <Rect x={0} y={0} width={width} height={height} fill="#0B0B0E" />
        <Path
          d={paths.minor}
          stroke="#1E1E25"
          strokeWidth={roadW}
          fill="none"
          strokeLinecap="round"
        />
        <Path
          d={paths.major}
          stroke="#2B2B34"
          strokeWidth={roadW * 1.6}
          fill="none"
          strokeLinecap="round"
        />

        <Rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill="rgba(5,5,7,0.74)"
          mask="url(#zone)"
        />
        <Circle
          cx={zx}
          cy={zy}
          r={zr}
          fill="rgba(200,255,46,0.025)"
          stroke={color.accent}
          strokeWidth={1.5}
          strokeDasharray="7 5"
        />
        {shrinkPreview && (
          <Circle
            cx={zx}
            cy={zy}
            r={zr * 0.75}
            fill="none"
            stroke={color.warn}
            strokeWidth={1}
            strokeDasharray="3 5"
          />
        )}
        <G>
          <Line x1={zx - 5} y1={zy} x2={zx + 5} y2={zy} stroke={color.faint} strokeWidth={1} />
          <Line x1={zx} y1={zy - 5} x2={zx} y2={zy + 5} stroke={color.faint} strokeWidth={1} />
        </G>
      </Svg>

      {/* Labels are their own layer: a sized child inside a zero-size marker
          box does not lay out, and captions must not steal taps from the
          diamond. Beacons are always named; everything else earns a caption
          once you zoom in far enough for it not to be clutter. */}
      {showLabels &&
        !compact &&
        pois
          .filter((p) => p.type === 'beacon' || detail)
          .map((p) => {
            const left = px(p.x);
            const top = py(p.y);
            if (left < -60 || left > width + 60 || top < -40 || top > height + 40) return null;
            return (
              <Text
                key={`lbl-${p.id}`}
                pointerEvents="none"
                numberOfLines={1}
                style={[
                  styles.poiLabel,
                  {
                    left: Math.max(2, Math.min(left - 55, width - 112)),
                    top: top + 9,
                    color: POI_TYPE_META[p.type].tint,
                  },
                ]}
              >
                {p.name.toUpperCase()}
              </Text>
            );
          })}

      {pois.map((p) => {
        const left = px(p.x);
        const top = py(p.y);
        if (left < -40 || left > width + 40 || top < -40 || top > height + 40) return null;
        return (
          <PoiMarker
            key={p.id}
            poi={p}
            left={left}
            top={top}
            zoom={zoom}
            claimed={claimedPoiIds.includes(p.id)}
            compact={compact}
            onPress={onPoiPress}
          />
        );
      })}

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
  zoom,
  claimed,
  compact,
  onPress,
}: {
  poi: Poi;
  left: number;
  top: number;
  zoom: number;
  claimed: boolean;
  compact: boolean;
  onPress?: (p: Poi) => void;
}) {
  const meta = POI_TYPE_META[poi.type];
  const base = poi.type === 'cache' ? 7 : 10;
  const grow = Math.min(1.7, 0.75 + zoom * 0.28);
  const size = compact ? base * 0.5 : base * grow;
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
                { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 2.4] }) },
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
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
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
    width: 10,
    height: 10,
    backgroundColor: color.accent,
    transform: [{ rotate: '45deg' }],
  },
  markerLabel: {
    position: 'absolute',
    top: 10,
    fontFamily: font.monoMed,
    fontSize: 8,
    letterSpacing: 1,
    color: color.text,
    width: 60,
    textAlign: 'center',
  },
});
