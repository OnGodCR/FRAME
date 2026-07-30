import React from 'react';
import * as Haptics from 'expo-haptics';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, font, radius, space } from '../theme';
import { Bar, Btn, Card, Label, Mono } from '../components/ui';
import { AvatarMark, CosmeticPreview } from '../components/Cosmetics';
import { CountUp, FadeIn, PressScale } from '../components/motion';
import { SEASON, TIER_COUNT, byId, categoryKind } from '../data/catalog';
import { POI_TYPE_META } from '../components/ZoneMap';
import { isOpenNow } from '../components/PoiSheet';
import { useGame } from '../engine/GameContext';
import { useWorld } from '../engine/WorldContext';
import { Poi } from '../data/poiRules';
import type { Seen } from '../engine/persist';
import type { DailyState } from '../data/assignments';

/** Closest of each type, so the row shows the whole system rather than 3 shops. */
const pickNearby = (pois: Poi[]) =>
  (['beacon', 'waystation', 'cache'] as const)
    .map((t) => pois.filter((p) => p.type === t).sort((a, b) => a.distM - b.distM)[0])
    .filter(Boolean);

/**
 * The first three things worth doing, in order. Deliberately ends at "play a
 * round with friends" rather than at anything purchasable, and disappears
 * entirely once all three are done rather than becoming a permanent chore list.
 */
const STEPS: { label: string; done: (s: { seen: Seen; daily: DailyState }) => boolean }[] = [
  { label: 'Try a check-in', done: (s) => s.seen.practised },
  { label: "Do today's assignment", done: (s) => s.daily.lastDone !== null },
  { label: 'Play a round with friends', done: (s) => s.seen.finishedRound },
];

export function Home() {
  const { go, profile, daily, dailyAssignment, dailyOpen, pass, seen, resetProgress, friends } = useGame();
  const allStepsDone = STEPS.every((s) => s.done({ seen, daily }));
  const { world, status, request, busy } = useWorld();
  const insets = useSafeAreaInsets();
  const nearby = pickNearby(world.pois);

  const eq = profile.equipped;
  const title = byId(eq.title)!;
  const frame = byId(eq.frame)!;
  const pin = byId(eq.pin)!;
  const passPct = (pass.tier - 1) / TIER_COUNT;

  const slots = [
    { key: 'pin' as const, label: 'PIN', item: byId(eq.pin)! },
    { key: 'frame' as const, label: 'FRAME', item: byId(eq.frame)! },
    { key: 'blackout' as const, label: 'BLACKOUT', item: byId(eq.blackout)! },
    { key: 'tag' as const, label: 'TAG', item: byId(eq.tag)! },
  ];

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={{
          padding: space(5),
          paddingTop: insets.top + space(4),
          paddingBottom: space(4),
        }}
      >
        {/* identity */}
        <FadeIn>
          <View style={styles.topRow}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.handle} numberOfLines={1}>
                {profile.handle || 'PLAYER'}
              </Text>
              <Text style={[styles.titleFlair, { color: title.tint }]}>{title.name}</Text>
            </View>
            <View style={styles.levelBadge}>
              <Label tone="faint" style={{ fontSize: 8 }}>
                LVL
              </Label>
              <Text style={styles.levelNum}>{profile.level}</Text>
            </View>
          </View>

          <View style={{ marginTop: space(4) }}>
            <View style={styles.metaRow}>
              <Label tone="faint">XP</Label>
              <Mono style={{ fontSize: 10, color: color.faint }}>
                {Math.round(profile.xp * 100)}% TO LVL {profile.level + 1}
              </Mono>
            </View>
            <Bar value={profile.xp} height={5} />
          </View>
        </FadeIn>

        {/* First run. A brand new account otherwise lands on a screen full of
            empty progression with nothing telling it what to do, which is the
            classic dead-end empty state: no explanation, no call to action. It
            names the mechanic in one line and offers exactly one next step. */}
        {!seen.practised && (
          <FadeIn index={1}>
            <PressScale onPress={() => go('solo')} style={{ marginTop: space(5) }}>
              <Card style={styles.startCard}>
                <Label tone="accent">Start here</Label>
                <Text style={styles.startTitle}>
                  Every few minutes, you photograph where you are hiding.
                </Text>
                <Mono style={styles.startBody}>
                  Miss the window and you are BLACKED OUT. Try one now, alone, with
                  nothing at stake. It takes 60 seconds.
                </Mono>
                <View style={styles.startCta}>
                  <Mono style={styles.startCtaText}>RUN A TEST FRAME →</Mono>
                </View>
              </Card>
            </PressScale>
          </FadeIn>
        )}

        {/* Three steps, so progress is legible before any XP exists. */}
        {!allStepsDone && (
          <FadeIn index={2}>
            <View style={styles.steps}>
              {STEPS.map((s, i) => {
                const done = s.done({ seen, daily });
                return (
                  <View key={s.label} style={styles.stepRow}>
                    <View style={[styles.stepDot, done && styles.stepDotDone]}>
                      <Mono style={[styles.stepNum, done && { color: color.black }]}>
                        {done ? '✓' : i + 1}
                      </Mono>
                    </View>
                    <Mono style={[styles.stepLabel, done && { color: color.faint }]}>
                      {s.label}
                    </Mono>
                  </View>
                );
              })}
            </View>
          </FadeIn>
        )}

        {/* Solo. Sits above everything that needs other people, because on
            day one the player does not have other people yet. */}
        <FadeIn index={1}>
          <PressScale onPress={() => go('solo')} style={{ marginTop: space(5) }}>
            <Card
              style={[
                styles.soloCard,
                dailyOpen && { borderColor: color.accentDim },
              ]}
            >
              <View style={styles.metaRow}>
                <Label tone={dailyOpen ? 'accent' : 'text'}>
                  {dailyOpen ? 'Daily assignment · open' : 'Solo'}
                </Label>
                <Mono style={{ fontSize: 10, color: color.accent, letterSpacing: 1.2 }}>
                  {dailyOpen ? 'TAKE IT →' : 'OPEN →'}
                </Mono>
              </View>
              <Text style={styles.soloPrompt} numberOfLines={2}>
                {dailyOpen
                  ? dailyAssignment.text
                  : 'Done today. Practice runs are always open.'}
              </Text>
              <Mono style={{ fontSize: 9, color: color.faint, letterSpacing: 1.2, marginTop: space(2) }}>
                {daily.streak > 0 ? `${daily.streak} WEEK STREAK · ` : ''}
                NO PARTY NEEDED
              </Mono>
            </Card>
          </PressScale>
        </FadeIn>

        {/* play */}
        <FadeIn index={4}>
          <View style={{ marginTop: space(6), gap: space(3) }}>
            <Btn title="Host a round" onPress={() => go('lobby')} />
            <Btn title="Join with code" variant="outline" onPress={() => go('join')} />
            {/* The map legend is reference material, not a one-time cutscene.
                The most cited FTUE failure in this genre is a tutorial that can
                never be seen again, so it gets a real card on the main screen
                rather than a text link that is easy to miss. */}
            <PressScale onPress={() => go('mapTutorial')}>
              <Card style={styles.legendCard}>
                <View style={styles.legendGlyphs}>
                  {[color.accent, '#9BE8FF', '#D8B4FF'].map((tint) => (
                    <View key={tint} style={[styles.legendDiamond, { borderColor: tint }]} />
                  ))}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Label tone="text">How to read the map</Label>
                  <Mono style={{ fontSize: 10, color: color.faint, marginTop: 3 }}>
                    What the three pin types do
                  </Mono>
                </View>
                <Mono style={{ fontSize: 10, color: color.accent, letterSpacing: 1.2 }}>
                  OPEN →
                </Mono>
              </Card>
            </PressScale>
          </View>
        </FadeIn>

        {/* Social. Friends is the only way anyone reaches anyone, so it sits
            with the play actions rather than buried in progression. */}
        <FadeIn index={5}>
          <View style={styles.socialRow}>
            <PressScale style={{ flex: 1 }} onPress={() => go('friends')}>
              <Card style={styles.socialCard}>
                <Label tone="text">Friends</Label>
                <Text style={styles.socialValue}>
                  {friends.friends.filter((f) => !f.blocked).length}
                </Text>
                <Mono style={styles.socialNote}>ADD BY CODE</Mono>
              </Card>
            </PressScale>
            <PressScale style={{ flex: 1 }} onPress={() => go('leaderboard')}>
              <Card style={styles.socialCard}>
                <Label tone="text">Leaderboard</Label>
                <Text style={styles.socialValue}>{profile.seasonXp.toLocaleString()}</Text>
                <Mono style={styles.socialNote}>YOUR XP</Mono>
              </Card>
            </PressScale>
          </View>
        </FadeIn>

        {/* Progressive disclosure. The pass, loadout, and shop are all empty
            and meaningless before the first capture, and showing three dead
            cards to a new player buries the one thing they should actually do.
            They appear the moment there is progress to look at, which is about
            60 seconds in. */}
        {seen.practised && (
          <>
        {/* season pass */}
        <FadeIn index={1}>
          <PressScale onPress={() => go('pass')} style={{ marginTop: space(5) }}>
            <Card style={{ padding: space(3.5) }}>
              <View style={styles.metaRow}>
                <Label tone="text">{`Season pass · ${SEASON.name}`}</Label>
                <Mono style={{ fontSize: 10, color: color.accent }}>
                  TIER {pass.tier} / {TIER_COUNT} →
                </Mono>
              </View>
              <View style={styles.tierRow}>
                {Array.from({ length: 25 }).map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.tierChip,
                      i / 25 < passPct && {
                        backgroundColor: color.accent,
                        borderColor: color.accent,
                      },
                    ]}
                  />
                ))}
              </View>
              <Mono style={{ fontSize: 10, color: color.faint, marginTop: space(2) }}>
                {profile.paidPass ? 'PAID TRACK UNLOCKED' : 'FREE TRACK · PAID AVAILABLE'}
              </Mono>
            </Card>
          </PressScale>
        </FadeIn>

        {/* loadout */}
        <FadeIn index={2}>
          <PressScale onPress={() => go('loadout')} style={{ marginTop: space(4) }}>
            <Card style={{ padding: space(4) }}>
              <View style={styles.metaRow}>
                <Label tone="text">Loadout</Label>
                <Mono style={{ fontSize: 10, color: color.accent, letterSpacing: 1.2 }}>
                  EDIT →
                </Mono>
              </View>
              <View style={styles.loadoutBody}>
                <AvatarMark size={78} tint={pin.tint} frameTint={frame.tint} />
                <View style={styles.slotGrid}>
                  {slots.map((s) => (
                    <View key={s.key} style={styles.slot}>
                      <CosmeticPreview
                        kind={categoryKind(s.item.category)}
                        tint={s.item.tint}
                        size={26}
                      />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Label tone="faint" style={{ fontSize: 7 }}>
                          {s.label}
                        </Label>
                        <Mono style={styles.slotName} numberOfLines={1}>
                          {s.item.name}
                        </Mono>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            </Card>
          </PressScale>
        </FadeIn>

        {/* shop entry */}
        <FadeIn index={3}>
          <PressScale onPress={() => go('shop')} style={{ marginTop: space(3) }}>
            <Card style={styles.shopRow}>
              <View style={styles.shopRowLeft}>
                <CosmeticPreview kind="film" size={34} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Label tone="text">Shop</Label>
                  <Mono style={{ fontSize: 10, color: color.faint, marginTop: 2 }}>
                    Cosmetics and season pass
                  </Mono>
                </View>
              </View>
              <View style={styles.filmPill}>
                <CountUp value={profile.film} style={styles.filmPillText} />
              </View>
            </Card>
          </PressScale>
        </FadeIn>
          </>
        )}

        {/* There is no server (CLAUDE.md 7), so a "new account" is just a
            device with no stored state. Without this the only way to test a
            first run is clearing app data by hand. */}
        <FadeIn index={6}>
          <PressScale
            onPress={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              resetProgress();
            }}
          >
            <Mono style={styles.resetLink}>RESET PROGRESS · LOCAL ONLY</Mono>
          </PressScale>
        </FadeIn>

        {/* world layer: real landmarks near the player */}
        <FadeIn index={5}>
          <Card style={{ marginTop: space(5), padding: 0 }}>
            <View style={styles.nearbyHead}>
              <Label tone="text">Nearby</Label>
              <Mono style={{ fontSize: 9, color: color.faint, letterSpacing: 1 }}>
                {busy ? 'LOCATING…' : world.label.toUpperCase()}
              </Mono>
            </View>
            {nearby.map((p) => {
              const meta = POI_TYPE_META[p.type];
              const open = isOpenNow(p.hours);
              return (
                <View key={p.id} style={styles.nearbyRow}>
                  <View style={[styles.nearbyGlyph, { borderColor: meta.tint }]} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Mono style={styles.nearbyName} numberOfLines={1}>
                      {p.name}
                    </Mono>
                    <Mono style={{ fontSize: 9, color: color.faint, letterSpacing: 1 }}>
                      {meta.label} · {p.category.toUpperCase()}
                      {!open ? ' · CLOSED' : ''}
                    </Mono>
                  </View>
                  <Mono style={styles.nearbyDist}>{p.distM} m</Mono>
                </View>
              );
            })}
            {/* Location is requested on tap, never cold at launch (PRD 10.2).
                Once the real world is loaded the list speaks for itself. */}
            {status.state !== 'ready' && (
              <PressScale onPress={() => request()} disabled={busy}>
                <View style={styles.nearbyFoot}>
                  <Mono style={{ fontSize: 10, color: busy ? color.faint : color.accent, letterSpacing: 1.2 }}>
                    {busy ? 'FINDING LANDMARKS NEAR YOU…' : 'USE MY LOCATION →'}
                  </Mono>
                  <Mono style={{ fontSize: 9, color: color.faint, lineHeight: 14, marginTop: 4 }}>
                    {status.state === 'fallback'
                      ? `${status.reason}. Showing ${world.label}.`
                      : `Showing ${world.label} as a sample until you do.`}
                  </Mono>
                </View>
              </PressScale>
            )}
          </Card>
        </FadeIn>
      </ScrollView>

      {/* banner ad slot, home and lobby only per spec */}
      <View style={[styles.adWrap, { paddingBottom: insets.bottom + space(2) }]}>
        <View style={styles.adBanner}>
          <Mono style={{ fontSize: 11, letterSpacing: 2, color: color.dim }}>
            AD · 320 × 50 BANNER
          </Mono>
          <Mono style={{ fontSize: 9, letterSpacing: 1, color: color.faint, marginTop: 3 }}>
            ADMOB ADAPTIVE · NEVER SHOWN DURING A ROUND
          </Mono>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space(3),
  },
  handle: {
    fontFamily: font.display,
    fontSize: 26,
    letterSpacing: 1,
    color: color.text,
  },
  titleFlair: {
    fontFamily: font.monoMed,
    fontSize: 10,
    letterSpacing: 1.8,
    marginTop: 3,
  },
  levelBadge: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  levelNum: {
    fontFamily: font.display,
    fontSize: 22,
    color: color.accent,
    marginTop: -2,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space(1.5),
    gap: space(2),
  },
  tierRow: { flexDirection: 'row', gap: 3, marginTop: space(1) },
  tierChip: {
    flex: 1,
    height: 12,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: color.lineBright,
    backgroundColor: color.surface2,
  },
  loadoutBody: {
    flexDirection: 'row',
    gap: space(4),
    marginTop: space(3),
    alignItems: 'center',
  },
  slotGrid: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space(2),
  },
  slot: {
    width: '46%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  slotName: {
    fontSize: 9,
    color: color.text,
    letterSpacing: 0.5,
  },
  shopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space(3),
    paddingVertical: space(3),
  },
  shopRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    flex: 1,
    minWidth: 0,
  },
  filmPill: {
    backgroundColor: color.surface2,
    borderWidth: 1,
    borderColor: color.lineBright,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexShrink: 0,
  },
  filmPillText: {
    fontFamily: font.monoSemi,
    fontSize: 13,
    color: color.accent,
  },
  nearbyHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: space(4),
    paddingBottom: space(3),
  },
  nearbyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    paddingHorizontal: space(4),
    paddingVertical: space(2.5),
    borderTopWidth: 1,
    borderTopColor: color.line,
  },
  nearbyGlyph: {
    width: 11,
    height: 11,
    borderWidth: 1.6,
    transform: [{ rotate: '45deg' }],
  },
  startCard: {
    padding: space(4),
    borderColor: color.accentDim,
  },
  startTitle: {
    fontFamily: font.display,
    fontSize: 22,
    lineHeight: 28,
    color: color.text,
    marginTop: space(2),
  },
  startBody: {
    fontSize: 11,
    lineHeight: 17,
    color: color.dim,
    marginTop: space(2.5),
  },
  startCta: {
    marginTop: space(3.5),
    borderTopWidth: 1,
    borderTopColor: color.line,
    paddingTop: space(3),
  },
  startCtaText: { fontSize: 11, letterSpacing: 1.5, color: color.accent },
  steps: { marginTop: space(4), gap: space(2) },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: space(2.5) },
  stepDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: color.lineBright,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotDone: { backgroundColor: color.accent, borderColor: color.accent },
  stepNum: { fontSize: 9, color: color.dim },
  stepLabel: { fontSize: 11, color: color.text, letterSpacing: 0.5 },
  soloCard: {
    padding: space(4),
  },
  soloPrompt: {
    fontFamily: font.display,
    fontSize: 19,
    lineHeight: 25,
    color: color.text,
    marginTop: space(2.5),
  },
  socialRow: { flexDirection: 'row', gap: space(3), marginTop: space(4) },
  socialCard: { padding: space(3.5) },
  socialValue: {
    fontFamily: font.display,
    fontSize: 26,
    color: color.text,
    marginTop: space(1.5),
  },
  socialNote: { fontSize: 9, letterSpacing: 1.2, color: color.faint, marginTop: 2 },
  resetLink: {
    fontSize: 9,
    letterSpacing: 1.4,
    color: color.faint,
    textAlign: 'center',
    marginTop: space(5),
    paddingVertical: space(2),
  },
  legendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    padding: space(3.5),
  },
  legendGlyphs: { flexDirection: 'row', gap: 5 },
  legendDiamond: {
    width: 11,
    height: 11,
    borderWidth: 2,
    transform: [{ rotate: '45deg' }],
    flexShrink: 0,
  },
  nearbyName: {
    fontSize: 12,
    color: color.text,
    fontFamily: font.monoSemi,
    letterSpacing: 0.5,
  },
  nearbyDist: {
    fontSize: 11,
    color: color.accent,
    fontFamily: font.monoSemi,
    flexShrink: 0,
  },
  nearbyFoot: {
    paddingHorizontal: space(4),
    paddingVertical: space(3),
    borderTopWidth: 1,
    borderTopColor: color.line,
  },
  adWrap: {
    borderTopWidth: 1,
    borderTopColor: color.line,
    backgroundColor: color.surface,
    paddingTop: space(2.5),
    paddingHorizontal: space(5),
  },
  adBanner: {
    height: 64,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: color.lineBright,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surface2,
  },
});
