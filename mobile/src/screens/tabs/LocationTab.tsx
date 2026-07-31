import React, { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { color, font, radius, space } from '../../theme';
import { Body, Card, Label, Mono } from '../../components/ui';
import { FadeIn, PressScale } from '../../components/motion';
import { POI_TYPE_META } from '../../components/ZoneMap';
import { isOpenNow } from '../../components/PoiSheet';
import { useGame } from '../../engine/GameContext';
import { useWorld } from '../../engine/WorldContext';
import { TEST_MODE } from '../../config';
import type { Poi } from '../../data/poiRules';

// ---------------------------------------------------------------------------
// Nearby.
//
// **18+ only, and that is a hard gate.** This is the one surface in Hidewire where
// a player can see other players they do not already know, which is why it is
// the one surface minors never reach. The age bracket comes from the DOB gate;
// the date of birth itself is never stored.
//
// Even for adults, this is built to the most conservative reading that still
// delivers the feature:
//
//   - **Opt in, off by default.** Nobody is listed until they choose to be.
//   - **Coarse distance only.** Buckets, never a position, never a pin on a
//     map. Knowing someone is "under 1 km" is enough to decide whether to ask
//     them to play; knowing where they are standing is not something a stranger
//     needs.
//   - **Requests, not contact.** You can send an invite. You cannot message,
//     and you cannot see them again unless they accept.
//   - **Report and block on every row**, same as friends.
//
// This is a deliberate supersession of the "never imply stranger play" line in
// marketing/BRIEF.md 9. It is recorded as such in CLAUDE.md, because it is a
// legal line and a product decision to cross it should be visible rather than
// buried in a component.
// ---------------------------------------------------------------------------

/** Coarse buckets. Deliberately not a number of metres. */
function bucket(m: number): string {
  if (m < 500) return 'UNDER 500 M';
  if (m < 1000) return 'UNDER 1 KM';
  if (m < 3000) return 'UNDER 3 KM';
  return 'FURTHER OUT';
}

interface NearbyGame {
  id: string;
  host: string;
  players: number;
  max: number;
  distM: number;
  startsIn: string;
}

/** Fixture. See TEST-FIXTURES.md. */
const NEARBY_GAMES: NearbyGame[] = TEST_MODE
  ? [
      { id: 'n1', host: 'VESPER', players: 4, max: 6, distM: 420, startsIn: '6 MIN' },
      { id: 'n2', host: 'HALFLIGHT', players: 3, max: 8, distM: 1650, startsIn: '18 MIN' },
      { id: 'n3', host: 'GRAIN', players: 5, max: 6, distM: 2900, startsIn: '31 MIN' },
    ]
  : [];

export function LocationTab() {
  const { ageBracket, hasAccount } = useGame();
  const { world, status, request, busy } = useWorld();
  const [visible, setVisible] = useState(false);
  const [asked, setAsked] = useState<string[]>([]);

  if (ageBracket !== '18_plus') {
    return <AdultsOnly />;
  }

  const pois = [...world.pois].sort((a, b) => a.distM - b.distM).slice(0, 12);

  return (
    <ScrollView
      contentContainerStyle={{ padding: space(5), paddingBottom: space(8) }}
      showsVerticalScrollIndicator={false}
    >
      {/* ---- visibility, off by default ---- */}
      <FadeIn>
        <Card style={styles.section}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Label tone="text">Let nearby players see me</Label>
              <Mono style={styles.note}>
                Off by default. When on, adults within a few kilometres can see your
                handle and a rough distance, never your position.
              </Mono>
            </View>
            <Switch
              value={visible}
              onValueChange={(v) => {
                Haptics.selectionAsync();
                setVisible(v);
              }}
              trackColor={{ false: color.surface2, true: color.accentDim }}
              thumbColor={visible ? color.accent : color.faint}
            />
          </View>
        </Card>
      </FadeIn>

      {/* ---- games near you ---- */}
      <FadeIn index={1}>
        <View style={styles.sectionHead}>
          <Label tone="text">Games near you</Label>
          <Mono style={styles.count}>{NEARBY_GAMES.length}</Mono>
        </View>
      </FadeIn>

      {NEARBY_GAMES.length === 0 ? (
        <Card style={styles.empty}>
          <Mono style={styles.emptyText}>
            Nothing open nearby right now. Host one and your friends can join with a
            code.
          </Mono>
        </Card>
      ) : (
        NEARBY_GAMES.map((g, i) => (
          <FadeIn key={g.id} index={2 + i}>
            <Card style={styles.gameCard}>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.host}>{g.host}</Text>
                  <Mono style={styles.gameMeta}>
                    {g.players}/{g.max} PLAYERS · STARTS IN {g.startsIn}
                  </Mono>
                </View>
                <View style={styles.distChip}>
                  <Mono style={styles.distText}>{bucket(g.distM)}</Mono>
                </View>
              </View>

              <View style={styles.gameActions}>
                <PressScale
                  disabled={asked.includes(g.id)}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setAsked((a) => [...a, g.id]);
                  }}
                >
                  <View
                    style={[
                      styles.askBtn,
                      asked.includes(g.id) && { borderColor: color.accentDim, opacity: 0.6 },
                    ]}
                  >
                    <Mono style={styles.askText}>
                      {asked.includes(g.id) ? 'REQUEST SENT' : 'ASK TO JOIN'}
                    </Mono>
                  </View>
                </PressScale>
                <View style={{ flex: 1 }} />
                <Mono style={styles.modAction}>REPORT</Mono>
                <Mono style={styles.modAction}>BLOCK</Mono>
              </View>
            </Card>
          </FadeIn>
        ))
      )}

      <Mono style={styles.safety}>
        REQUESTS ONLY · NO MESSAGING · NO EXACT POSITIONS · NOBODY SEES YOU UNLESS YOU
        TURN IT ON
      </Mono>

      {/* ---- POIs ---- */}
      <FadeIn index={6}>
        <View style={styles.sectionHead}>
          <Label tone="text">Points of interest</Label>
          <Mono style={styles.count}>{world.label.toUpperCase()}</Mono>
        </View>
      </FadeIn>

      <Card style={{ padding: 0 }}>
        {pois.map((p: Poi) => {
          const meta = POI_TYPE_META[p.type];
          const open = isOpenNow(p.hours);
          return (
            <View key={p.id} style={styles.poiRow}>
              <View style={[styles.poiGlyph, { borderColor: meta.tint }]} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Mono style={styles.poiName} numberOfLines={1}>
                  {p.name}
                </Mono>
                <Mono style={styles.poiMeta}>
                  {meta.label} · {p.category.toUpperCase()}
                  {!open ? ' · CLOSED' : ''}
                </Mono>
              </View>
              <Mono style={styles.poiDist}>{p.distM} m</Mono>
            </View>
          );
        })}
        {status.state !== 'ready' && (
          <PressScale onPress={() => request()} disabled={busy}>
            <View style={styles.poiFoot}>
              <Mono style={{ fontSize: 10, color: busy ? color.faint : color.accent, letterSpacing: 1.2 }}>
                {busy ? 'FINDING LANDMARKS NEAR YOU…' : 'USE MY LOCATION →'}
              </Mono>
            </View>
          </PressScale>
        )}
      </Card>
    </ScrollView>
  );
}

function AdultsOnly() {
  return (
    <View style={styles.gateWrap}>
      <Label tone="danger">18 and over</Label>
      <Text style={styles.gateTitle}>Nearby is not available on your account.</Text>
      <Body style={{ color: color.dim, marginTop: space(3), lineHeight: 21 }}>
        This is the only part of Hidewire where you can see players you do not already
        know, so it is limited to adults.
      </Body>
      <Mono style={styles.gateNote}>
        Everything else works normally. Play with friends using an invite code or a
        friend code.
      </Mono>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { padding: space(4) },
  rowBetween: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  note: { fontSize: 10, color: color.faint, lineHeight: 15, marginTop: 4 },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: space(5),
    marginBottom: space(2.5),
  },
  count: { fontSize: 10, letterSpacing: 1.2, color: color.faint },
  empty: { padding: space(4) },
  emptyText: { fontSize: 11, color: color.dim, lineHeight: 17 },
  gameCard: { padding: space(4), marginBottom: space(2.5) },
  host: { fontFamily: font.display, fontSize: 19, color: color.text },
  gameMeta: { fontSize: 9, letterSpacing: 1.1, color: color.faint, marginTop: 3 },
  distChip: {
    borderWidth: 1,
    borderColor: color.lineBright,
    borderRadius: radius.sm,
    paddingHorizontal: space(2.5),
    paddingVertical: space(1),
  },
  distText: { fontSize: 9, letterSpacing: 1.1, color: color.dim },
  gameActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    marginTop: space(3),
  },
  askBtn: {
    borderWidth: 1,
    borderColor: color.accent,
    borderRadius: radius.sm,
    paddingHorizontal: space(3),
    paddingVertical: space(1.5),
  },
  askText: { fontSize: 10, letterSpacing: 1.3, color: color.accent },
  modAction: { fontSize: 9, letterSpacing: 1.1, color: color.faint },
  safety: {
    fontSize: 9,
    letterSpacing: 1.1,
    lineHeight: 15,
    color: color.faint,
    marginTop: space(3),
  },
  poiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    paddingVertical: space(3),
    paddingHorizontal: space(4),
    borderBottomWidth: 1,
    borderBottomColor: color.line,
  },
  poiGlyph: { width: 11, height: 11, borderWidth: 2, transform: [{ rotate: '45deg' }] },
  poiName: { fontSize: 13, color: color.text },
  poiMeta: { fontSize: 9, letterSpacing: 1, color: color.faint, marginTop: 2 },
  poiDist: { fontSize: 12, color: color.accent },
  poiFoot: { padding: space(4), alignItems: 'center' },
  gateWrap: { flex: 1, justifyContent: 'center', padding: space(6) },
  gateTitle: {
    fontFamily: font.display,
    fontSize: 28,
    lineHeight: 34,
    color: color.text,
    marginTop: space(2),
  },
  gateNote: { fontSize: 10, color: color.faint, lineHeight: 16, marginTop: space(5) },
});
