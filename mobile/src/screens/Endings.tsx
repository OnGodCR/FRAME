import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { color, font, radius, space } from '../theme';
import { Bar, Btn, Card, Label, Mono, Rule } from '../components/ui';
import { FadeIn } from '../components/motion';
import { useGame, SEEKER_BOT } from '../engine/GameContext';

// ---------- blackout (missed check-in) ----------

export function Blackout() {
  const { go } = useGame();
  const insets = useSafeAreaInsets();
  const glitch = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glitch, { toValue: 1, duration: 70, useNativeDriver: true }),
        Animated.timing(glitch, { toValue: 0, duration: 70, useNativeDriver: true }),
        Animated.delay(1400),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <View style={styles.blackoutScreen}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.Text
          style={[
            styles.blackoutTitle,
            {
              transform: [
                { translateX: glitch.interpolate({ inputRange: [0, 1], outputRange: [0, 4] }) },
              ],
            },
          ]}
        >
          BLACKED{'\n'}OUT
        </Animated.Text>
        <View style={styles.blackoutBar} />
        <Mono style={styles.blackoutNote}>
          YOU MISSED THE CHECK-IN WINDOW.{'\n'}THE PARTY HAS BEEN NOTIFIED.
        </Mono>
        <Mono style={[styles.blackoutNote, { color: color.faint, marginTop: space(3) }]}>
          WORSE THAN BEING TAGGED. EVERYONE KNOWS.
        </Mono>
      </View>
      <View style={{ padding: space(6), paddingBottom: insets.bottom + space(6) }}>
        <Btn title="See results" variant="ghost" onPress={() => go('results')} />
      </View>
    </View>
  );
}

// ---------- results ----------

export function Results() {
  const { round, go, startRound, finishRound, addXp, profile } = useGame();
  const insets = useSafeAreaInsets();
  const [xpApplied, setXpApplied] = useState(false);
  const barAnim = useRef(new Animated.Value(0)).current;

  const data = useMemo(() => {
    if (!round) return null;
    const frac = Math.min(1, round.elapsed / round.totalReal);
    const survivedMin = Math.round(45 * frac);
    if (round.role === 'hider') {
      const survived = round.outcome === 'survived';
      const checkins = round.checkinsPassed + 3;
      const lines = [
        { k: `SURVIVAL · ${survivedMin} MIN`, v: survivedMin },
        { k: `CHECK-INS PASSED · ${checkins} × 5`, v: checkins * 5 },
        { k: 'POIs CLAIMED · 0', v: 0 },
        ...(survived ? [{ k: 'SURVIVED TO TIMER', v: 25 }] : []),
      ];
      return {
        win: survived,
        title: survived ? 'SURVIVED' : 'BLACKED OUT',
        subtitle: survived
          ? `You outlasted ${SEEKER_BOT.name}. JULES survived too.`
          : 'Check-in window expired with no valid submission.',
        lines,
        total: lines.reduce((a, l) => a + l.v, 0),
        mvp: survived ? profile.handle || 'YOU' : 'JULES',
        xp: survived ? 0.24 : 0.08,
      };
    }
    const tags = round.tags.length;
    const blackouts = round.bots.filter((b) => b.state === 'blackout').length;
    const cleared = round.outcome === 'cleared';
    const lines = [
      { k: `TAGS · ${tags} × 30`, v: tags * 30 },
      { k: `BLACKOUTS FORCED · ${blackouts} × 10`, v: blackouts * 10 },
      ...(cleared ? [{ k: 'BOARD CLEARED', v: 60 }] : []),
      ...(cleared ? [{ k: 'TIME BONUS', v: Math.round(45 * (1 - frac)) }] : []),
    ];
    return {
      win: cleared,
      title: cleared ? 'BOARD CLEARED' : 'HIDERS SURVIVED',
      subtitle: cleared
        ? 'Every hider tagged or blacked out before the timer.'
        : 'The timer beat you. Surviving hiders win.',
      lines,
      total: lines.reduce((a, l) => a + l.v, 0),
      mvp: cleared ? profile.handle || 'YOU' : 'JULES',
      xp: cleared ? 0.28 : 0.1,
    };
  }, [round == null]);

  useEffect(() => {
    if (!data || xpApplied) return;
    const t = setTimeout(() => {
      setXpApplied(true);
      addXp(data.xp);
      Animated.timing(barAnim, { toValue: 1, duration: 900, useNativeDriver: false }).start();
    }, 600);
    return () => clearTimeout(t);
  }, [data, xpApplied]);

  if (!round || !data) return null;
  const wasHider = round.role === 'hider';

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={{
          padding: space(6),
          paddingTop: insets.top + space(8),
          paddingBottom: space(4),
        }}
      >
        <FadeIn>
          <Label tone={data.win ? 'accent' : 'danger'}>
            {wasHider ? 'Round 12 · Hider' : 'Round 13 · Seeker'}
          </Label>
          <Text style={[styles.resultTitle, { color: data.win ? color.accent : color.danger }]}>
            {data.title}
          </Text>
          <Mono style={{ fontSize: 12, color: color.dim, marginTop: space(1), lineHeight: 18 }}>
            {data.subtitle}
          </Mono>
        </FadeIn>

        <Card style={{ marginTop: space(5), padding: 0 }}>
          <View style={styles.scoreHeader}>
            <Label tone="text">Score</Label>
            <Text style={styles.scoreTotal}>{data.total}</Text>
          </View>
          {data.lines.map((l, i) => (
            <FadeIn key={l.k} index={i} delay={220} distance={6}>
              <View style={styles.scoreRow}>
                <Mono style={{ fontSize: 11, color: color.dim, letterSpacing: 0.5 }}>
                  {l.k}
                </Mono>
                <Mono style={{ fontSize: 12, color: color.text }}>+{l.v}</Mono>
              </View>
            </FadeIn>
          ))}
        </Card>

        <Card style={{ marginTop: space(3) }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Label>Round MVP</Label>
            <Label tone="accent">{data.mvp}</Label>
          </View>
          <Rule style={{ marginVertical: space(3) }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: space(1.5) }}>
            <Label tone="faint">XP</Label>
            <Mono style={{ fontSize: 10, color: color.accent }}>
              +{Math.round(data.xp * 1000)} XP
            </Mono>
          </View>
          <Bar value={xpApplied ? profile.xp : Math.max(0, profile.xp - data.xp)} height={5} />
          <Mono style={{ fontSize: 10, color: color.faint, marginTop: space(1.5) }}>
            LVL {profile.level} · {Math.round(profile.xp * 100)}% TO NEXT
          </Mono>
        </Card>

        <View style={styles.adSlot}>
          <Mono style={{ fontSize: 9, letterSpacing: 1.2, color: color.faint }}>
            INTERSTITIAL SLOT · POST-ROUND ONLY · CAPPED 1 PER 3 ROUNDS · SKIPPABLE
          </Mono>
        </View>
      </ScrollView>

      <View style={{ padding: space(6), paddingTop: 0, paddingBottom: insets.bottom + space(5), gap: space(2) }}>
        <Btn
          title={wasHider ? 'Next round · you seek' : 'Next round · you hide'}
          onPress={() => startRound(wasHider ? 'seeker' : 'hider')}
        />
        <Btn
          title="Home"
          variant="outline"
          onPress={() => {
            finishRound();
            go('home');
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  blackoutScreen: { flex: 1, backgroundColor: color.black },
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
  resultTitle: {
    fontFamily: font.display,
    fontSize: 44,
    letterSpacing: 1,
    marginTop: space(1),
  },
  scoreHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: space(4),
    paddingBottom: space(2),
  },
  scoreTotal: {
    fontFamily: font.display,
    fontSize: 30,
    color: color.text,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: space(4),
    paddingVertical: space(2.5),
    borderTopWidth: 1,
    borderTopColor: color.line,
  },
  adSlot: {
    marginTop: space(3),
    borderWidth: 1,
    borderColor: color.line,
    borderStyle: 'dashed',
    borderRadius: radius.sm,
    alignItems: 'center',
    paddingVertical: space(3),
  },
});
