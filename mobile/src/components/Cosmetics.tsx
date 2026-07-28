import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, Line, Polygon, Rect } from 'react-native-svg';
import { color, radius } from '../theme';
import { Brackets } from './ui';

// Small visual language for cosmetics: geometric marks, no characters/mascots.

export function AvatarMark({ size = 84 }: { size?: number }) {
  const c = size / 2;
  return (
    <Brackets size={12} thickness={2} inset={0} tint={color.accent}>
      <View
        style={{
          width: size,
          height: size,
          backgroundColor: color.surface2,
          borderRadius: radius.sm,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Svg width={size * 0.62} height={size * 0.62} viewBox="0 0 60 60">
          <Polygon
            points="30,4 56,30 30,56 4,30"
            fill="none"
            stroke={color.accent}
            strokeWidth={2.5}
          />
          <Polygon
            points="30,17 43,30 30,43 17,30"
            fill={color.accent}
            opacity={0.9}
          />
          <Line x1={30} y1={0} x2={30} y2={9} stroke={color.dim} strokeWidth={1.5} />
          <Line x1={30} y1={51} x2={30} y2={60} stroke={color.dim} strokeWidth={1.5} />
        </Svg>
      </View>
    </Brackets>
  );
}

export function PinSwatch({ size = 14 }: { size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color.accent,
        borderWidth: 2,
        borderColor: color.bg,
      }}
    />
  );
}

export function FrameSwatch({ size = 16 }: { size?: number }) {
  return (
    <Brackets size={5} thickness={1.5} inset={0} tint={color.dim}>
      <View style={{ width: size, height: size }} />
    </Brackets>
  );
}

export function StaticSwatch({ size = 16 }: { size?: number }) {
  return (
    <View style={[styles.staticBox, { width: size, height: size }]}>
      {[2, 6, 10].map((t) => (
        <View key={t} style={{ position: 'absolute', top: t, left: 1, right: 1, height: 1.5, backgroundColor: color.dim }} />
      ))}
    </View>
  );
}

/** Generic preview tile for shop items. kind picks the glyph. */
export function CosmeticPreview({
  kind,
  tint = color.accent,
  size = 56,
}: {
  kind: 'pin' | 'frame' | 'static' | 'tag' | 'title' | 'film';
  tint?: string;
  size?: number;
}) {
  const s = size;
  return (
    <View
      style={{
        width: s,
        height: s,
        backgroundColor: color.bg,
        borderRadius: radius.sm,
        borderWidth: 1,
        borderColor: color.line,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {kind === 'pin' && (
        <Svg width={s * 0.5} height={s * 0.5} viewBox="0 0 24 24">
          <Circle cx={12} cy={12} r={5} fill={tint} />
          <Circle cx={12} cy={12} r={9} fill="none" stroke={tint} strokeWidth={1.5} strokeDasharray="3 3" />
        </Svg>
      )}
      {kind === 'frame' && (
        <Brackets size={8} thickness={2} inset={0} tint={tint}>
          <View style={{ width: s * 0.5, height: s * 0.5 }} />
        </Brackets>
      )}
      {kind === 'static' && (
        <Svg width={s * 0.55} height={s * 0.55} viewBox="0 0 24 24">
          {[3, 8, 13, 18].map((y, i) => (
            <Rect key={y} x={i % 2 === 0 ? 2 : 5} y={y} width={i % 2 === 0 ? 20 : 14} height={2.4} fill={tint} opacity={0.5 + 0.5 * ((i + 1) % 2)} />
          ))}
        </Svg>
      )}
      {kind === 'tag' && (
        <Svg width={s * 0.55} height={s * 0.55} viewBox="0 0 24 24">
          <Circle cx={12} cy={12} r={9} fill="none" stroke={tint} strokeWidth={2} />
          <Line x1={12} y1={5} x2={12} y2={12} stroke={tint} strokeWidth={2} />
          <Line x1={12} y1={12} x2={17} y2={15} stroke={tint} strokeWidth={2} />
        </Svg>
      )}
      {kind === 'title' && (
        <Svg width={s * 0.6} height={s * 0.35} viewBox="0 0 30 14">
          <Rect x={1} y={1} width={28} height={12} rx={2} fill="none" stroke={tint} strokeWidth={1.5} />
          <Rect x={5} y={5.5} width={14} height={3} fill={tint} />
        </Svg>
      )}
      {kind === 'film' && (
        <Svg width={s * 0.55} height={s * 0.55} viewBox="0 0 24 24">
          <Rect x={3} y={5} width={18} height={14} rx={2} fill="none" stroke={tint} strokeWidth={1.8} />
          {[6.5, 10.5, 14.5].map((x) => (
            <Rect key={x} x={x} y={8} width={2.4} height={8} fill={tint} />
          ))}
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  staticBox: {
    backgroundColor: color.bg,
    borderWidth: 1,
    borderColor: color.lineBright,
    borderRadius: 3,
    overflow: 'hidden',
  },
});
