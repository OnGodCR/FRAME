import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, font, space } from '../theme';
import { Body, Btn, Card, Label, Mono } from '../components/ui';
import { FadeIn, PressScale } from '../components/motion';
import { useGame } from '../engine/GameContext';

// ---------------------------------------------------------------------------
// The guest boundary.
//
// Guests cannot use the shop, FILM, friends, the leaderboard, or referrals.
// That is not a paywall and it is not an upsell: those features all involve
// **other people or durable value**, and a guest has no account for either to
// attach to.
//
// This screen exists so the app reads honestly. **The real enforcement is in
// the database**: every social table keys off `profiles`, which keys off
// `auth.users`, so a guest has no row to own anything with and every policy
// fails on `auth.uid() is null`. Deleting this component would not open a hole,
// it would just make the app confusing. See supabase/migrations/0002_social.sql.
// ---------------------------------------------------------------------------

interface Props {
  /** What the player was trying to reach, in the app's own words. */
  feature: string;
  /** Why an account is genuinely required, in one line. */
  reason: string;
  children: React.ReactNode;
}

export function AccountGate({ feature, reason, children }: Props) {
  const { hasAccount } = useGame();
  if (hasAccount) return <>{children}</>;
  return <GuestWall feature={feature} reason={reason} />;
}

function GuestWall({ feature, reason }: { feature: string; reason: string }) {
  const { go } = useGame();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={{
          padding: space(6),
          paddingTop: insets.top + space(6),
          flexGrow: 1,
          justifyContent: 'center',
        }}
      >
        <FadeIn>
          <PressScale onPress={() => go('home')}>
            <Mono style={{ fontSize: 11, color: color.dim, letterSpacing: 1.5 }}>← HOME</Mono>
          </PressScale>

          <Label tone="accent" style={{ marginTop: space(8) }}>
            Account needed
          </Label>
          <Text style={styles.h1}>{feature} needs an account.</Text>
          <Body style={{ color: color.dim, marginTop: space(3), lineHeight: 22 }}>
            {reason}
          </Body>

          <Card style={styles.card}>
            <Mono style={styles.point}>
              You are playing as a guest. Everything you have earned lives on this
              phone and nowhere else.
            </Mono>
            <Mono style={[styles.point, { marginTop: space(3) }]}>
              Rounds, the daily assignment, and practice all keep working. Only the
              parts that involve other people or spending are held back.
            </Mono>
          </Card>

          <Btn
            title="Create an account"
            style={{ marginTop: space(6) }}
            sub="keeps your progress if you change phone"
            // Send them to the real auth screen. Deliberately does not touch
            // the existing session: promoting a guest silently would be a
            // worse answer than letting them choose.
            onPress={() => go('auth')}
          />
          <Btn
            title="Not now"
            variant="outline"
            style={{ marginTop: space(2) }}
            onPress={() => go('home')}
          />
        </FadeIn>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  h1: {
    fontFamily: font.display,
    fontSize: 32,
    lineHeight: 38,
    color: color.text,
    marginTop: space(2),
    letterSpacing: -0.5,
  },
  card: { marginTop: space(5), padding: space(4) },
  point: { fontSize: 11, color: color.dim, lineHeight: 17 },
});
