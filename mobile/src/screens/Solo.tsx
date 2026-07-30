import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, font, radius, space } from '../theme';
import { Body, Btn, Card, Label, Mono, Rule } from '../components/ui';
import { FadeIn, PressScale } from '../components/motion';
import { CaptureSequence } from '../components/CaptureSequence';
import { ProceduralPhoto } from '../components/ProceduralPhoto';
import { useGame, TEST_FRAME_WINDOW } from '../engine/GameContext';
import { useWorld } from '../engine/WorldContext';
import { DAILY_REWARD, nearestMatch, type Assignment } from '../data/assignments';

// ---------------------------------------------------------------------------
// Solo. The half of FRAME that does not need three friends to be free at the
// same time.
//
// This exists because the game structurally cannot be played alone, which is
// a brutal cold start: a player who installs on their own currently cannot see
// the core mechanic at all. Both modes here are playable the second the app
// opens, in any city.
// ---------------------------------------------------------------------------

/** Distance readout for a destination assignment, or a clear absence of one. */
function DistanceReadout({ a }: { a: Assignment }) {
  const { world, status, request, busy } = useWorld();
  if (a.kind !== 'destination') return null;

  const match = nearestMatch(world.pois, a);
  const located = status.state === 'ready';

  return (
    <View style={styles.distWrap}>
      <View style={styles.distRow}>
        <Label tone="faint">{a.label}</Label>
        {match ? (
          <Text style={styles.distValue}>{match.distM} m</Text>
        ) : (
          <Mono style={{ fontSize: 11, color: color.faint, letterSpacing: 1 }}>
            {located ? 'NONE NEARBY' : 'LOCATION NEEDED'}
          </Mono>
        )}
      </View>
      {match ? (
        <Mono style={styles.distName} numberOfLines={1}>
          NEAREST · {match.name.toUpperCase()}
        </Mono>
      ) : (
        <Mono style={styles.distName}>
          {located
            ? 'Nothing of this kind in range. Take the shot anyway, it still counts.'
            : 'Share your location to see how close you are.'}
        </Mono>
      )}
      {/* Location is requested on tap, never cold at launch (PRD 10.2). */}
      {!located && (
        <PressScale onPress={() => request()} disabled={busy}>
          <Mono style={styles.distCta}>
            {busy ? 'FINDING YOU…' : 'USE MY LOCATION →'}
          </Mono>
        </PressScale>
      )}
    </View>
  );
}

export function SoloHub() {
  const { go, startSolo, daily, dailyAssignment, dailyOpen, seen } = useGame();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={{
          padding: space(6),
          paddingTop: insets.top + space(6),
          paddingBottom: space(6),
        }}
      >
        <FadeIn>
          <PressScale onPress={() => go('home')}>
            <Mono style={{ fontSize: 11, color: color.dim, letterSpacing: 1.5 }}>
              ← HOME
            </Mono>
          </PressScale>
          <Text style={styles.h1}>Solo</Text>
          <Body style={{ color: color.dim, marginTop: space(2) }}>
            No party, no invite code. Just you and the camera.
          </Body>
        </FadeIn>

        {/* ---- daily assignment ---- */}
        <FadeIn index={1}>
          <Card style={{ marginTop: space(5), padding: 0 }}>
            <View style={styles.cardHead}>
              <Label tone="accent">Daily assignment</Label>
              {daily.streak > 0 ? (
                <Label tone="text">{daily.streak} WK STREAK</Label>
              ) : null}
            </View>
            <View style={{ paddingHorizontal: space(4), paddingBottom: space(4) }}>
              <View style={styles.promptWrap}>
                <Text style={styles.prompt}>{dailyAssignment.text}</Text>
              </View>
              <DistanceReadout a={dailyAssignment} />
              <Mono style={styles.assignNote}>
                THE SAME PROMPT FOR EVERY PLAYER IN THE WORLD TODAY.
              </Mono>
              <Rule style={{ marginVertical: space(3) }} />
              <View style={styles.rewardRow}>
                <Mono style={{ fontSize: 11, color: color.dim, letterSpacing: 1 }}>
                  PAYS
                </Mono>
                <Mono style={{ fontSize: 12, color: color.accent, letterSpacing: 1 }}>
                  +{Math.round(DAILY_REWARD.xp * 1000)} XP · +{DAILY_REWARD.film} FILM
                </Mono>
              </View>
              <View style={{ marginTop: space(3) }}>
                {dailyOpen ? (
                  <Btn title="Take the shot" onPress={() => startSolo('daily')} />
                ) : (
                  <View style={styles.doneChip}>
                    <Mono style={{ fontSize: 11, color: color.accent, letterSpacing: 1.5 }}>
                      DONE TODAY · NEXT ONE AT MIDNIGHT
                    </Mono>
                  </View>
                )}
              </View>
              <Mono style={styles.safety}>
                Public ground only, at street level. Nothing here is worth climbing for.
              </Mono>
            </View>
          </Card>
        </FadeIn>

        {/* ---- party feed ---- */}
        <FadeIn index={2}>
          <PartyFeed />
        </FadeIn>

        {/* ---- test frame ---- */}
        <FadeIn index={3}>
          <Card style={{ marginTop: space(3), padding: 0 }}>
            <View style={styles.cardHead}>
              <Label tone="text">Test frame</Label>
              <Label tone="faint">{seen.practised ? 'PRACTISED' : 'RECOMMENDED'}</Label>
            </View>
            <View style={{ paddingHorizontal: space(4), paddingBottom: space(4) }}>
              <Body style={{ color: color.dim, lineHeight: 21 }}>
                One check-in, {TEST_FRAME_WINDOW} seconds, exactly like the real thing.
                Nothing is at stake. Let the timer run out on purpose if you want to
                see what that looks like before it costs you a round.
              </Body>
              <View style={{ marginTop: space(3) }}>
                <Btn
                  title="Run a test frame"
                  variant={seen.practised ? 'outline' : 'primary'}
                  onPress={() => startSolo('test')}
                />
              </View>
            </View>
          </Card>
        </FadeIn>
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// The shared feed.
//
// Assignment captures are visible to **the people already in your party**, and
// to nobody else. That scope is deliberate and it is not the same thing as a
// global feed:
//
//   - The splash screen says PRIVATE PARTIES ONLY, and marketing/BRIEF.md 9
//     lists "never imply stranger play" as a legal line.
//   - The age gate means minors are on this platform. A worldwide photo feed
//     with minors in it needs proactive moderation, not a report button, and
//     App Store 1.2 requires filtering plus a published contact before a UGC
//     feed can ship at all.
//   - Assignment photos are pictures of where somebody actually is. Showing
//     those to strangers is a location-disclosure problem regardless of how
//     the feature is described.
//
// Sharing is opt-in per capture and revocable. Report and block are here from
// the start rather than added later, because a feed without them is not
// shippable and pretending otherwise just moves the work.
// ---------------------------------------------------------------------------

interface FeedEntry {
  id: string;
  who: string;
  seed: number;
  hidden?: boolean;
}

const PARTY_FEED: FeedEntry[] = [
  { id: 'f1', who: 'KAI', seed: 4021 },
  { id: 'f2', who: 'MAYA', seed: 7734 },
  { id: 'f3', who: 'JULES', seed: 1188 },
];

function PartyFeed() {
  const { daily, profile } = useGame();
  const [blocked, setBlocked] = useState<string[]>([]);
  const [reported, setReported] = useState<string[]>([]);
  const mine = daily.lastDone !== null;

  const entries = useMemo(
    () => PARTY_FEED.filter((e) => !blocked.includes(e.id)),
    [blocked],
  );

  return (
    <Card style={{ marginTop: space(3), padding: 0 }}>
      <View style={styles.cardHead}>
        <Label tone="text">Today, in your party</Label>
        <Label tone="faint">{entries.length + (mine ? 1 : 0)} SHOTS</Label>
      </View>
      <View style={{ paddingHorizontal: space(4) }}>
        <Mono style={{ fontSize: 10, color: color.faint, lineHeight: 15 }}>
          ONLY YOUR PARTY SEES THESE. NEVER STRANGERS, NEVER A PUBLIC FEED.
        </Mono>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ padding: space(4), gap: space(2.5) }}
      >
        {mine && (
          <View style={styles.feedItem}>
            <View style={[styles.feedShot, { borderColor: color.accent }]}>
              <ProceduralPhoto seed={9001} width={104} height={104} variant="back" />
            </View>
            <Mono style={[styles.feedWho, { color: color.accent }]}>
              {profile.handle || 'YOU'}
            </Mono>
          </View>
        )}
        {entries.map((e) => (
          <View key={e.id} style={styles.feedItem}>
            <View style={styles.feedShot}>
              <ProceduralPhoto seed={e.seed} width={104} height={104} variant="back" />
            </View>
            <Mono style={styles.feedWho}>{e.who}</Mono>
            <View style={styles.feedActions}>
              <PressScale
                onPress={() => setReported((r) => [...r, e.id])}
                disabled={reported.includes(e.id)}
              >
                <Mono style={styles.feedAction}>
                  {reported.includes(e.id) ? 'REPORTED' : 'REPORT'}
                </Mono>
              </PressScale>
              <PressScale onPress={() => setBlocked((b) => [...b, e.id])}>
                <Mono style={styles.feedAction}>BLOCK</Mono>
              </PressScale>
            </View>
          </View>
        ))}
        {!mine && (
          <View style={[styles.feedItem, styles.feedLocked]}>
            <Mono style={styles.feedLockedText}>
              TAKE TODAY'S{'\n'}SHOT TO{'\n'}UNLOCK
            </Mono>
          </View>
        )}
      </ScrollView>

      <View style={{ paddingHorizontal: space(4), paddingBottom: space(4) }}>
        <Mono style={{ fontSize: 9, color: color.faint, lineHeight: 14 }}>
          DELETED AFTER 24 H · REPORTS REVIEWED WITHIN 24 H · BLOCK IS PERMANENT
        </Mono>
      </View>
    </Card>
  );
}

// ---------------------------------------------------------------------------

export function SoloRun() {
  const { solo, dailyAssignment, passSolo, exitSolo } = useGame();
  const insets = useSafeAreaInsets();

  if (!solo) return null;

  // Practice blackout. Deliberately the real thing, minus the consequence,
  // so the first time a player sees this screen is not the first time it
  // has actually cost them something.
  if (solo.outcome === 'expired') {
    return (
      <View style={styles.blackScreen}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={styles.blackoutTitle}>BLACKED{'\n'}OUT</Text>
          <View style={styles.blackoutBar} />
          <Mono style={styles.blackoutNote}>
            THE WINDOW CLOSED WITH NO SUBMISSION.
          </Mono>
          <Mono style={[styles.blackoutNote, { color: color.faint, marginTop: space(3) }]}>
            IN A REAL ROUND THAT IS THE END OF IT.{'\n'}THIS ONE COST YOU NOTHING.
          </Mono>
        </View>
        <View style={{ padding: space(6), paddingBottom: insets.bottom + space(6), gap: space(2) }}>
          <Btn title="Try again" onPress={() => exitSolo()} />
        </View>
      </View>
    );
  }

  const isDaily = solo.mode === 'daily';
  const remaining = solo.window == null ? null : solo.window - solo.elapsed;

  return (
    <CaptureSequence
      eyebrow={isDaily ? 'Daily assignment' : 'Test frame'}
      prompt={isDaily ? dailyAssignment.text : null}
      remaining={remaining}
      onValidated={passSolo}
      validatingNote={
        isDaily
          ? 'The prompt is not scored. The capture only has to be real.'
          : 'Practice run. The same checks, none of the consequences.'
      }
      doneTitle={isDaily ? 'Assignment complete.' : 'That would have counted.'}
      doneNote={
        isDaily
          ? `+${Math.round(DAILY_REWARD.xp * 1000)} XP · +${DAILY_REWARD.film} FILM · SHARED WITH YOUR PARTY · DELETED IN 24 H`
          : "IN A REAL ROUND BOTH FRAMES WOULD NOW BE IN THE SEEKER'S FEED."
      }
      doneCta="Done"
      onDone={exitSolo}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  blackScreen: { flex: 1, backgroundColor: color.black },
  h1: {
    fontFamily: font.display,
    fontSize: 34,
    color: color.text,
    marginTop: space(3),
    letterSpacing: -0.5,
  },
  cardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: space(4),
    paddingBottom: space(3),
  },
  promptWrap: {
    borderLeftWidth: 2,
    borderLeftColor: color.accent,
    paddingLeft: space(3),
    paddingVertical: space(1),
  },
  prompt: {
    fontFamily: font.display,
    fontSize: 22,
    lineHeight: 29,
    color: color.text,
  },
  distWrap: {
    marginTop: space(3),
    borderWidth: 1,
    borderColor: color.lineBright,
    borderRadius: radius.sm,
    padding: space(3),
  },
  distRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  distValue: {
    fontFamily: font.display,
    fontSize: 24,
    color: color.accent,
    fontVariant: ['tabular-nums'],
  },
  distName: {
    fontSize: 10,
    color: color.faint,
    letterSpacing: 0.8,
    lineHeight: 15,
    marginTop: 4,
  },
  distCta: {
    fontSize: 10,
    letterSpacing: 1.3,
    color: color.accent,
    marginTop: space(2),
  },
  assignNote: {
    fontSize: 9,
    letterSpacing: 1.4,
    color: color.faint,
    marginTop: space(3),
    lineHeight: 15,
  },
  rewardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  doneChip: {
    borderWidth: 1,
    borderColor: color.accentDim,
    borderRadius: radius.sm,
    alignItems: 'center',
    paddingVertical: space(3.5),
  },
  safety: {
    fontSize: 10,
    lineHeight: 16,
    color: color.faint,
    marginTop: space(3),
  },
  feedItem: { width: 104 },
  feedShot: {
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  feedWho: {
    fontSize: 10,
    letterSpacing: 1.2,
    color: color.dim,
    marginTop: 5,
  },
  feedActions: { flexDirection: 'row', gap: space(2), marginTop: 3 },
  feedAction: { fontSize: 8, letterSpacing: 1, color: color.faint },
  feedLocked: {
    height: 104,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: color.line,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedLockedText: {
    fontSize: 9,
    letterSpacing: 1.2,
    color: color.faint,
    textAlign: 'center',
    lineHeight: 14,
  },
  blackoutTitle: {
    fontFamily: font.display,
    fontSize: 64,
    lineHeight: 66,
    letterSpacing: 6,
    color: color.text,
    textAlign: 'center',
  },
  blackoutBar: {
    width: 120,
    height: 3,
    backgroundColor: color.danger,
    marginTop: space(5),
  },
  blackoutNote: {
    fontFamily: font.monoMed,
    fontSize: 11,
    lineHeight: 18,
    letterSpacing: 1.2,
    color: color.dim,
    textAlign: 'center',
    marginTop: space(5),
  },
});
