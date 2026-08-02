import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, font, radius, space } from '../theme';
import { Bar, Label, Mono } from './ui';
import { CosmeticPreview } from './Cosmetics';
import { CountUp } from './motion';
import { useGame } from '../engine/GameContext';
import { byId } from '../data/catalog';

// ---------------------------------------------------------------------------
// The persistent top bar: who you are, what level, how much FILM.
//
// Sits above every tab so identity never moves. Clash Royale keeps name, level
// and currency pinned for the same reason: they are reference, not content, and
// a player should never have to go looking for their own balance.
//
// FILM is hidden for guests rather than shown as zero. A guest has no FILM at
// all, and showing an empty wallet implies one they could fill.
// ---------------------------------------------------------------------------

export function IdentityBar({ compact = false }: { compact?: boolean }) {
  const { profile, hasAccount } = useGame();
  const insets = useSafeAreaInsets();
  const title = byId(profile.equipped.title);

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + space(2) }]}>
      <View style={styles.row}>
        <View style={styles.levelChip}>
          <Mono style={styles.levelNum}>{profile.level}</Mono>
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.handle} numberOfLines={1}>
            {profile.handle || 'PLAYER'}
          </Text>
          {title && (
            <Text style={[styles.title, { color: title.tint }]} numberOfLines={1}>
              {title.name}
            </Text>
          )}
        </View>

        {hasAccount && (
          <View style={styles.filmChip}>
            <CosmeticPreview kind="film" size={16} />
            <CountUp value={profile.film} style={styles.filmText} />
          </View>
        )}
      </View>

      {!compact && (
        <View style={styles.xpRow}>
          <Bar value={profile.xp} height={4} />
          <Mono style={styles.xpText}>
            {Math.round(profile.xp * 100)}% TO LVL {profile.level + 1}
          </Mono>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: space(5),
    paddingBottom: space(3),
    backgroundColor: color.surface,
    borderBottomWidth: 1,
    borderBottomColor: color.lineBright,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  levelChip: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: color.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The level is one of the four Space Grotesk exceptions: a figure you read
  // at a glance rather than a piece of text.
  levelNum: { fontFamily: font.numeral, fontSize: 14, color: color.accent },
  handle: {
    fontFamily: font.monoSemi,
    fontSize: 20,
    color: color.text,
    letterSpacing: 0.5,
  },
  title: { fontFamily: font.monoSemi, fontSize: 9, letterSpacing: 1.4, marginTop: 1 },
  filmChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: color.surface2,
    borderWidth: 1,
    borderColor: color.lineBright,
    borderRadius: radius.sm,
    paddingHorizontal: space(2.5),
    paddingVertical: space(1.5),
  },
  filmText: { fontFamily: font.monoSemi, fontSize: 13, color: color.text },
  xpRow: { marginTop: space(2.5) },
  xpText: { fontSize: 9, letterSpacing: 1, color: color.faint, marginTop: 4 },
});
