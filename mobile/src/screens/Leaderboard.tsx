import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, font, radius, space } from '../theme';
import { Body, Card, Label, Mono } from '../components/ui';
import { FadeIn, PressScale } from '../components/motion';
import { useGame } from '../engine/GameContext';
import { buildBoard, poolSize, type Scope } from '../data/leaderboard';

// ---------------------------------------------------------------------------
// Leaderboard, ranked on XP.
//
// **Handles and numbers only.** This is the one surface where a player is
// visible to people who are not their friends, so it exposes the absolute
// minimum: a name they chose and a score. No location, no captures, and no way
// to contact anyone. Adding a "add friend" button to a global list would turn
// this into stranger discovery, which marketing/BRIEF.md 9 rules out.
// ---------------------------------------------------------------------------

const SCOPES: { key: Scope; label: string }[] = [
  { key: 'global', label: 'GLOBAL' },
  { key: 'friends', label: 'FRIENDS' },
];

export function Leaderboard() {
  const { go, profile, friends } = useGame();
  const insets = useSafeAreaInsets();
  const [scope, setScope] = useState<Scope>('global');

  const { rows, myRank } = useMemo(
    () =>
      buildBoard(
        scope,
        { handle: profile.handle, level: profile.level, xp: profile.seasonXp },
        friends.friends,
      ),
    [scope, profile.handle, profile.level, profile.seasonXp, friends.friends],
  );

  const total = poolSize(scope, friends.friends.filter((f) => !f.blocked).length);

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + space(4) }]}>
        <PressScale onPress={() => go('home')}>
          <Mono style={{ fontSize: 11, color: color.dim, letterSpacing: 1.5 }}>← HOME</Mono>
        </PressScale>
        <Text style={styles.h1}>Leaderboard</Text>
        <Body style={{ color: color.dim, marginTop: space(1) }}>Ranked on XP.</Body>

        <View style={styles.tabs}>
          {SCOPES.map((s) => {
            const on = scope === s.key;
            return (
              <Pressable
                key={s.key}
                onPress={() => setScope(s.key)}
                style={({ pressed }) => [
                  styles.tab,
                  on && styles.tabOn,
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Mono style={[styles.tabText, on && { color: color.black }]}>{s.label}</Mono>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.rankBanner}>
          <Mono style={{ fontSize: 10, color: color.dim, letterSpacing: 1 }}>YOUR RANK</Mono>
          <Mono style={{ fontSize: 12, color: color.accent, letterSpacing: 1 }}>
            {myRank} OF {total}
          </Mono>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: space(5), paddingBottom: space(8) }}>
        {rows.length <= 1 && scope === 'friends' ? (
          <Card style={{ padding: space(4) }}>
            <Mono style={{ fontSize: 11, color: color.dim, lineHeight: 17 }}>
              No friends yet, so this board is just you. Add someone by code in the
              friends tab.
            </Mono>
          </Card>
        ) : (
          rows.map((r, i) => (
            <FadeIn key={r.id} index={Math.min(i, 8)} delay={80}>
              <View style={[styles.row, r.you && styles.rowYou]}>
                <Text style={[styles.rank, r.you && { color: color.accent }]}>
                  {String(i + 1).padStart(2, '0')}
                </Text>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={[styles.name, r.you && { color: color.accent }]}
                    numberOfLines={1}
                  >
                    {r.handle}
                    {r.you ? ' · YOU' : ''}
                  </Text>
                  <Mono style={{ fontSize: 9, color: color.faint, letterSpacing: 1 }}>
                    LVL {r.level}
                  </Mono>
                </View>
                <Text style={[styles.xp, r.you && { color: color.accent }]}>
                  {r.xp.toLocaleString()}
                </Text>
              </View>
            </FadeIn>
          ))
        )}

        <Mono style={styles.footnote}>
          HANDLES AND SCORES ONLY · NO LOCATION · NO CAPTURES · NOBODY HERE CAN CONTACT YOU
        </Mono>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  header: {
    paddingHorizontal: space(5),
    paddingBottom: space(4),
    borderBottomWidth: 1,
    borderBottomColor: color.line,
  },
  h1: {
    fontFamily: font.display,
    fontSize: 32,
    color: color.text,
    marginTop: space(3),
    letterSpacing: -0.5,
  },
  tabs: { flexDirection: 'row', gap: space(2), marginTop: space(4) },
  tab: {
    flex: 1,
    borderWidth: 1,
    borderColor: color.lineBright,
    borderRadius: radius.sm,
    alignItems: 'center',
    paddingVertical: space(2.5),
  },
  tabOn: { backgroundColor: color.accent, borderColor: color.accent },
  tabText: { fontSize: 11, letterSpacing: 1.6, color: color.text },
  rankBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: space(3),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    paddingVertical: space(3),
    borderBottomWidth: 1,
    borderBottomColor: color.line,
  },
  rowYou: {
    backgroundColor: color.surface,
    borderRadius: radius.sm,
    paddingHorizontal: space(3),
    borderBottomColor: 'transparent',
  },
  rank: {
    fontFamily: font.monoSemi,
    fontSize: 13,
    color: color.faint,
    width: 26,
  },
  name: { fontFamily: font.displayMed, fontSize: 15, color: color.text },
  xp: { fontFamily: font.monoSemi, fontSize: 13, color: color.text },
  footnote: {
    fontSize: 9,
    letterSpacing: 1.2,
    lineHeight: 15,
    color: color.faint,
    textAlign: 'center',
    marginTop: space(6),
  },
});
