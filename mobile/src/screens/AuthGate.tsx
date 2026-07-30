import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as Haptics from 'expo-haptics';
import Svg, { Path } from 'react-native-svg';
import { color, font, radius, space } from '../theme';
import { Body, Btn, Label, Mono } from '../components/ui';
import { FadeIn, PressScale } from '../components/motion';
import { supabase, supabaseReady } from '../lib/supabase';
import { useGame } from '../engine/GameContext';

type Provider = 'google' | 'apple';

export function AuthGate() {
  const { go, setAuth } = useGame();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);

  const signIn = async (provider: Provider) => {
    setError(null);
    if (!supabase) {
      setError('Sign-in is not configured yet. Continue as a guest for now.');
      return;
    }
    setBusy(provider);
    try {
      const redirectTo = Linking.createURL('auth-callback');
      const { data, error: err } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (err) throw err;
      if (!data?.url) throw new Error('No sign-in URL returned');

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type !== 'success') {
        setBusy(null);
        return;
      }

      // Supabase returns the session in the callback fragment.
      const fragment = result.url.split('#')[1] ?? '';
      const params = new URLSearchParams(fragment);
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');
      if (!access_token || !refresh_token) throw new Error('No session in callback');

      const { data: sess, error: sErr } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });
      if (sErr) throw sErr;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setAuth({ kind: provider, email: sess.user?.email ?? null });
      go('handle');
    } catch (e: any) {
      // The most likely cause by far is that the provider has not been enabled
      // in the Supabase dashboard yet, so say that rather than dumping a stack.
      const msg = String(e?.message ?? e);
      setError(
        /provider|not enabled|unsupported/i.test(msg)
          ? `${provider === 'google' ? 'Google' : 'Apple'} sign-in is not enabled on this project yet.`
          : msg,
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={{ flex: 1, padding: space(6), paddingTop: insets.top + space(8) }}>
        <FadeIn>
          <Label>Step 3 of 4</Label>
          <Text style={styles.h1}>Save your progress</Text>
          <Body style={{ color: color.dim, marginTop: space(2) }}>
            Linking an account keeps your level, cosmetics, and stats if you change phone.
            You can skip this and decide later.
          </Body>
        </FadeIn>

        <View style={{ marginTop: space(8), gap: space(3) }}>
          <FadeIn index={1}>
            <ProviderButton
              provider="google"
              label="Continue with Google"
              busy={busy === 'google'}
              onPress={() => signIn('google')}
            />
          </FadeIn>
          {Platform.OS !== 'android' && (
            <FadeIn index={2}>
              <ProviderButton
                provider="apple"
                label="Continue with Apple"
                busy={busy === 'apple'}
                onPress={() => signIn('apple')}
              />
            </FadeIn>
          )}
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Mono style={{ fontSize: 11, color: color.warn, lineHeight: 17 }}>{error}</Mono>
          </View>
        )}

        {!supabaseReady && (
          <View style={styles.errorBox}>
            <Mono style={{ fontSize: 11, color: color.faint, lineHeight: 17 }}>
              No Supabase project configured. Guest play works; sign-in needs the keys in
              .env.
            </Mono>
          </View>
        )}
      </View>

      <View style={{ padding: space(6), paddingBottom: insets.bottom + space(5) }}>
        <Btn
          title="Play as a guest"
          variant="outline"
          sub="progress stays on this device only"
          onPress={() => {
            setAuth({ kind: 'guest', email: null });
            go('handle');
          }}
        />
        <Mono style={styles.footnote}>
          Guests get a device-local account. We collect no email address at all.
        </Mono>
      </View>
    </View>
  );
}

function ProviderButton({
  provider,
  label,
  busy,
  onPress,
}: {
  provider: Provider;
  label: string;
  busy: boolean;
  onPress: () => void;
}) {
  return (
    <PressScale onPress={onPress} disabled={busy} haptic="medium">
      <View style={[styles.provider, busy && { opacity: 0.5 }]}>
        <View style={styles.providerIcon}>
          {provider === 'google' ? <GoogleMark /> : <AppleMark />}
        </View>
        <Text style={styles.providerLabel}>{busy ? 'OPENING…' : label.toUpperCase()}</Text>
      </View>
    </PressScale>
  );
}

function GoogleMark() {
  return (
    <Svg width={18} height={18} viewBox="0 0 48 48">
      <Path
        fill="#EA4335"
        d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.1 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.2 17.6 9.5 24 9.5z"
      />
      <Path
        fill="#4285F4"
        d="M46.1 24.6c0-1.6-.1-3.2-.4-4.6H24v9.1h12.4c-.5 2.9-2.1 5.4-4.6 7l7.6 5.9c4.4-4.1 6.7-10.1 6.7-17.4z"
      />
      <Path
        fill="#FBBC05"
        d="M10.4 28.7c-.5-1.4-.8-2.9-.8-4.7s.3-3.3.8-4.7l-7.8-6.1C1 16.4 0 20.1 0 24s1 7.6 2.6 10.8l7.8-6.1z"
      />
      <Path
        fill="#34A853"
        d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.8 2.3-8.3 2.3-6.4 0-11.7-3.7-13.6-9.9l-7.8 6.1C6.5 42.6 14.6 48 24 48z"
      />
    </Svg>
  );
}

function AppleMark() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path
        fill={color.text}
        d="M16.4 12.8c0-2.4 1.9-3.5 2-3.6-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9s-1.8-.9-3-.9c-1.5 0-2.9.9-3.7 2.3-1.6 2.7-.4 6.8 1.1 9 .8 1.1 1.7 2.3 2.9 2.2 1.2 0 1.6-.7 3-.7s1.8.7 3 .7c1.2 0 2-1.1 2.8-2.2.9-1.3 1.2-2.5 1.2-2.5s-2.4-.9-2.4-3.4zM14.2 5.6c.6-.8 1.1-1.9 1-3-.9 0-2.1.6-2.8 1.4-.6.7-1.2 1.8-1 2.9 1 .1 2.1-.5 2.8-1.3z"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  h1: {
    fontFamily: font.display,
    fontSize: 30,
    color: color.text,
    marginTop: space(2),
    letterSpacing: -0.5,
  },
  provider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    minHeight: 56,
    paddingHorizontal: space(4),
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.lineBright,
    backgroundColor: color.surface,
  },
  providerIcon: { width: 22, alignItems: 'center' },
  providerLabel: {
    fontFamily: font.monoSemi,
    fontSize: 12,
    letterSpacing: 1.6,
    color: color.text,
  },
  errorBox: {
    marginTop: space(4),
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.sm,
    padding: space(3),
    backgroundColor: color.surface,
  },
  footnote: {
    fontSize: 10,
    color: color.faint,
    textAlign: 'center',
    marginTop: space(3),
    lineHeight: 15,
  },
});
