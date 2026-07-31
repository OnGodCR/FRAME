import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { color, font, space } from '../theme';
import { Mono } from './ui';

// ---------------------------------------------------------------------------
// The five buckets.
//
// GAME sits in the middle and is visually the largest, the way a Clash Royale
// battle button does. That is not decoration: the middle slot is the easiest
// target on a phone held one-handed, and it should be the thing you hit without
// looking.
//
// Everything that used to be stacked on the home screen now lives behind one of
// these. The rule is that the Game tab holds only identity, missions, and the
// two play buttons. Anything else belongs in a bucket.
// ---------------------------------------------------------------------------

export type Tab = 'location' | 'social' | 'game' | 'store' | 'profile';

export const TABS: { key: Tab; label: string }[] = [
  { key: 'location', label: 'NEARBY' },
  { key: 'social', label: 'SOCIAL' },
  { key: 'game', label: 'GAME' },
  { key: 'store', label: 'STORE' },
  { key: 'profile', label: 'PROFILE' },
];

function Icon({ tab, on }: { tab: Tab; on: boolean }) {
  const tint = on ? color.black : color.dim;
  const s = 22;
  switch (tab) {
    case 'location':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24">
          <Path
            d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11z"
            stroke={tint}
            strokeWidth={2}
            fill="none"
          />
          <Circle cx={12} cy={10} r={2.6} fill={tint} />
        </Svg>
      );
    case 'social':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24">
          <Circle cx={9} cy={8} r={3.2} stroke={tint} strokeWidth={2} fill="none" />
          <Circle cx={17} cy={9.5} r={2.4} stroke={tint} strokeWidth={1.6} fill="none" />
          <Path d="M3 19c0-3.3 2.7-5 6-5s6 1.7 6 5" stroke={tint} strokeWidth={2} fill="none" />
        </Svg>
      );
    case 'game':
      // The viewfinder brackets, which is the app's own mark.
      return (
        <Svg width={26} height={26} viewBox="0 0 24 24">
          <Path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" stroke={tint} strokeWidth={2.2} fill="none" />
          <Circle cx={12} cy={12} r={3} fill={tint} />
        </Svg>
      );
    case 'store':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24">
          <Rect x={4} y={8} width={16} height={12} rx={2} stroke={tint} strokeWidth={2} fill="none" />
          <Path d="M8.5 8V6.5a3.5 3.5 0 0 1 7 0V8" stroke={tint} strokeWidth={2} fill="none" />
        </Svg>
      );
    case 'profile':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24">
          <Circle cx={12} cy={8} r={3.6} stroke={tint} strokeWidth={2} fill="none" />
          <Path d="M4.5 20c0-4 3.4-6 7.5-6s7.5 2 7.5 6" stroke={tint} strokeWidth={2} fill="none" />
        </Svg>
      );
  }
}

interface Props {
  active: Tab;
  onChange: (t: Tab) => void;
  /** Small dot on a tab that wants attention, keyed by tab. */
  badges?: Partial<Record<Tab, boolean>>;
}

export function TabBar({ active, onChange, badges }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, space(2)) }]}>
      {TABS.map((t) => {
        const on = active === t.key;
        const isGame = t.key === 'game';
        return (
          <Pressable
            key={t.key}
            onPress={() => {
              if (!on) Haptics.selectionAsync();
              onChange(t.key);
            }}
            style={({ pressed }) => [styles.slot, pressed && { opacity: 0.75 }]}
          >
            <View style={[styles.pill, on && styles.pillOn, isGame && styles.pillGame, on && isGame && styles.pillGameOn]}>
              <Icon tab={t.key} on={on} />
              {badges?.[t.key] && !on && <View style={styles.badge} />}
            </View>
            <Mono style={[styles.label, on && { color: color.accent }]}>{t.label}</Mono>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    // Strong separation from content. The old home screen had every section on
    // the same near-black, so nothing read as a boundary.
    backgroundColor: color.surface,
    borderTopWidth: 1,
    borderTopColor: color.lineBright,
    paddingTop: space(2),
    ...(Platform.OS === 'web' ? ({ position: 'sticky', bottom: 0 } as object) : null),
  },
  slot: { flex: 1, alignItems: 'center', gap: 4 },
  pill: {
    width: 46,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  pillOn: { backgroundColor: color.accent },
  pillGame: { width: 56, height: 38, borderWidth: 1, borderColor: color.lineBright },
  pillGameOn: { borderColor: color.accent },
  label: { fontSize: 8, letterSpacing: 1.1, color: color.faint },
  badge: {
    position: 'absolute',
    top: 4,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: color.accent,
  },
});
