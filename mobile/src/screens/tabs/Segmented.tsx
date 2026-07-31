import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { color, radius, space } from '../../theme';
import { Mono } from '../../components/ui';

// ---------------------------------------------------------------------------
// Sub-navigation inside a bucket.
//
// A bucket holds two or three related screens (Social holds friends,
// leaderboard, and referrals). This is how you move between them without
// spending a whole bottom tab on each, which is what kept the tab bar at five.
// ---------------------------------------------------------------------------

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.wrap}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => {
              if (!on) Haptics.selectionAsync();
              onChange(o.key);
            }}
            style={({ pressed }) => [styles.seg, on && styles.segOn, pressed && { opacity: 0.8 }]}
          >
            <Mono style={[styles.label, on && { color: color.black }]}>{o.label}</Mono>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    gap: space(1.5),
    padding: space(1.5),
    backgroundColor: color.surface2,
    borderWidth: 1,
    borderColor: color.lineBright,
    borderRadius: radius.md,
    marginHorizontal: space(5),
    marginTop: space(4),
  },
  seg: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space(2.5),
    borderRadius: radius.sm,
  },
  segOn: { backgroundColor: color.accent },
  label: { fontSize: 10, letterSpacing: 1.4, color: color.dim },
});
