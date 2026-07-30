import React, { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { color, font, radius, space } from '../theme';
import { Body, Brackets, Btn, Card, Label, Mono, Rule } from '../components/ui';
import { FadeIn, PressScale } from '../components/motion';
import { ProceduralPhoto } from '../components/ProceduralPhoto';
import { useGame } from '../engine/GameContext';
import { ECONOMY } from '../data/economy';
import { REFERRAL_TASKS } from '../data/friends';
import QRCode from 'react-native-qrcode-svg';

// ---------------------------------------------------------------------------
// Friends.
//
// **Codes only. No search, no suggestions, no people-you-may-know.** A code you
// deliberately hand to somebody is consent; a list of nearby strangers is not,
// and marketing/BRIEF.md 9 makes stranger play a legal line rather than a
// preference. The age gate means minors are here, which is why report and block
// are on every row from the first commit rather than added after launch.
// ---------------------------------------------------------------------------

/**
 * QR renderer, in the game's palette.
 *
 * Acid on near-black inside the same corner brackets the wordmark and the
 * viewfinder use, so the code reads as part of FRAME rather than a pasted-in
 * utility widget. Scanners cope fine: what they need is contrast, and acid on
 * #0A0A0C is a stronger ratio than the usual black on white.
 *
 * Rendered on every platform including web, since react-native-qrcode-svg
 * draws through react-native-svg, which is already a dependency here.
 */
function QrBlock({ value, size = 160 }: { value: string; size?: number }) {
  return (
    <View style={styles.qrOuter}>
      <Brackets size={18} thickness={2} inset={-10} tint={color.accent}>
        <View style={styles.qrWrap}>
          <QRCode
            value={value}
            size={size}
            backgroundColor={color.black}
            color={color.accent}
            ecl="M"
          />
        </View>
      </Brackets>
      <Mono style={styles.qrCaption}>SCAN TO SEND A FRIEND REQUEST</Mono>
    </View>
  );
}

export function Friends() {
  const {
    go,
    profile,
    friends,
    addFriend,
    removeFriend,
    blockFriend,
    reportFriend,
    applaud,
    applauseToday,
    redeemReferral,
    referralProgress,
  } = useGame();
  const insets = useSafeAreaInsets();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [refCode, setRefCode] = useState('');
  const [refError, setRefError] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const visible = friends.friends.filter((f) => !f.blocked);
  const capped = applauseToday.earned >= applauseToday.cap;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={{
          padding: space(5),
          paddingTop: insets.top + space(5),
          paddingBottom: space(8),
        }}
      >
        <FadeIn>
          <PressScale onPress={() => go('home')}>
            <Mono style={{ fontSize: 11, color: color.dim, letterSpacing: 1.5 }}>← HOME</Mono>
          </PressScale>
          <Text style={styles.h1}>Friends</Text>
          <Body style={{ color: color.dim, marginTop: space(2) }}>
            Codes only. FRAME never suggests people you do not know.
          </Body>
        </FadeIn>

        {/* ---- your code ---- */}
        <FadeIn index={1}>
          <Card style={{ marginTop: space(5), padding: space(4) }}>
            <View style={styles.rowBetween}>
              <Label tone="text">Your friend code</Label>
              <PressScale onPress={() => setShowQr((v) => !v)}>
                <Mono style={{ fontSize: 10, color: color.accent, letterSpacing: 1.2 }}>
                  {showQr ? 'HIDE QR' : 'SHOW QR'}
                </Mono>
              </PressScale>
            </View>
            <Text style={styles.myCode}>{friends.myCode}</Text>
            {showQr && (
              <View style={{ alignItems: 'center', marginTop: space(3) }}>
                <QrBlock value={`frame://friend/${friends.myCode}`} />
              </View>
            )}
          </Card>
        </FadeIn>

        {/* ---- add by code ---- */}
        <FadeIn index={2}>
          <Card style={{ marginTop: space(3), padding: space(4) }}>
            <Label tone="text">Add a friend</Label>
            <View style={styles.inputRow}>
              <TextInput
                value={code}
                onChangeText={(t) => {
                  setCode(t.toUpperCase());
                  setError(null);
                }}
                placeholder="FRIEND CODE"
                placeholderTextColor={color.faint}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={12}
                style={styles.input}
              />
              <Pressable
                onPress={() => {
                  const err = addFriend(code);
                  if (err) {
                    setError(err);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                  } else {
                    setCode('');
                    setToast('Friend added.');
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  }
                }}
                style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.7 }]}
              >
                <Mono style={styles.addBtnText}>ADD</Mono>
              </Pressable>
            </View>
            {error && <Mono style={styles.error}>{error}</Mono>}
            {toast && !error && <Mono style={styles.ok}>{toast}</Mono>}
            <Mono style={styles.hint}>Try KAY2XQ7M, MAYA5TRW, or JUKE3NBH in this build.</Mono>
          </Card>
        </FadeIn>

        {/* ---- the feed ---- */}
        <FadeIn index={3}>
          <View style={styles.sectionHead}>
            <Label tone="text">Today's captures</Label>
            <Mono style={{ fontSize: 9, color: capped ? color.warn : color.faint, letterSpacing: 1 }}>
              {applauseToday.earned}/{applauseToday.cap} FILM TODAY
            </Mono>
          </View>
          <Mono style={styles.sectionNote}>
            Applaud pays them {ECONOMY.applauseFilm} FILM, up to {ECONOMY.applauseDailyCap} a day.
            Past that you can still applaud, it just stops paying.
          </Mono>
        </FadeIn>

        {visible.length === 0 ? (
          <FadeIn index={4}>
            <Card style={styles.empty}>
              <Mono style={{ fontSize: 11, color: color.dim, lineHeight: 17 }}>
                No friends yet. Add someone by code and their daily capture shows up
                here, the same way yours shows up for them.
              </Mono>
            </Card>
          </FadeIn>
        ) : (
          visible.map((f, i) => (
            <FadeIn key={f.id} index={4 + i}>
              <Card style={styles.friendCard}>
                <View style={styles.friendTop}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.friendName}>{f.handle}</Text>
                    <Mono style={{ fontSize: 9, color: color.faint, letterSpacing: 1 }}>
                      LVL {f.level} · {f.code}
                    </Mono>
                  </View>
                  <PressScale onPress={() => go('lobby')}>
                    <View style={styles.inviteBtn}>
                      <Mono style={styles.inviteText}>INVITE</Mono>
                    </View>
                  </PressScale>
                </View>

                {f.postedToday ? (
                  <View style={styles.postRow}>
                    <View style={styles.postShot}>
                      <ProceduralPhoto
                        seed={f.id.charCodeAt(0) * 613}
                        width={84}
                        height={84}
                        variant="back"
                      />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Mono style={{ fontSize: 10, color: color.dim, lineHeight: 16 }}>
                        Posted today's assignment.
                      </Mono>
                      <PressScale
                        disabled={f.applauded}
                        onPress={() => {
                          const paid = applaud(f.id);
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setToast(
                            paid > 0
                              ? `Applauded. ${f.handle} gets ${paid} FILM.`
                              : `Applauded. Daily FILM cap reached, so no payout.`,
                          );
                        }}
                      >
                        <View
                          style={[
                            styles.applaudBtn,
                            f.applauded && { borderColor: color.accentDim, opacity: 0.6 },
                          ]}
                        >
                          <Mono style={styles.applaudText}>
                            {f.applauded ? 'APPLAUDED' : 'APPLAUD'}
                          </Mono>
                        </View>
                      </PressScale>
                    </View>
                  </View>
                ) : (
                  <Mono style={{ fontSize: 10, color: color.faint, marginTop: space(3) }}>
                    Has not posted today.
                  </Mono>
                )}

                <Rule style={{ marginVertical: space(3) }} />
                <View style={styles.modRow}>
                  <PressScale onPress={() => reportFriend(f.id)} disabled={f.reported}>
                    <Mono style={styles.modAction}>{f.reported ? 'REPORTED' : 'REPORT'}</Mono>
                  </PressScale>
                  <PressScale onPress={() => blockFriend(f.id)}>
                    <Mono style={styles.modAction}>BLOCK</Mono>
                  </PressScale>
                  <PressScale onPress={() => removeFriend(f.id)}>
                    <Mono style={styles.modAction}>REMOVE</Mono>
                  </PressScale>
                </View>
              </Card>
            </FadeIn>
          ))
        )}

        {/* ---- referral ---- */}
        <FadeIn index={10}>
          <Card style={{ marginTop: space(5), padding: space(4) }}>
            <View style={styles.rowBetween}>
              <Label tone="text">Referral</Label>
              <Mono style={{ fontSize: 9, color: color.faint, letterSpacing: 1 }}>
                {ECONOMY.referralFilm} FILM EACH
              </Mono>
            </View>

            {friends.referredBy ? (
              <>
                <Mono style={{ fontSize: 11, color: color.accent, marginTop: space(2) }}>
                  Referred by {friends.referredBy}. Both of you were paid.
                </Mono>
                <Mono style={styles.hint}>
                  Finish these together to keep the bonus coming.
                </Mono>
                <View style={{ marginTop: space(3), gap: space(2.5) }}>
                  {REFERRAL_TASKS.map((t) => {
                    const done = referralProgress[t.key] ?? 0;
                    const pct = Math.min(1, done / t.target);
                    return (
                      <View key={t.key}>
                        <View style={styles.rowBetween}>
                          <Mono style={{ fontSize: 10, color: color.text }}>{t.label}</Mono>
                          <Mono style={{ fontSize: 10, color: color.faint }}>
                            {done}/{t.target}
                          </Mono>
                        </View>
                        <View style={styles.track}>
                          <View style={[styles.trackFill, { width: `${pct * 100}%` }]} />
                        </View>
                      </View>
                    );
                  })}
                </View>
              </>
            ) : (
              <>
                <Mono style={{ fontSize: 11, color: color.dim, marginTop: space(2), lineHeight: 17 }}>
                  Enter a friend's code once. You both get {ECONOMY.referralFilm} FILM and a
                  shared task track.
                </Mono>
                <View style={styles.inputRow}>
                  <TextInput
                    value={refCode}
                    onChangeText={(t) => {
                      setRefCode(t.toUpperCase());
                      setRefError(null);
                    }}
                    placeholder="REFERRAL CODE"
                    placeholderTextColor={color.faint}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    maxLength={12}
                    style={styles.input}
                  />
                  <Pressable
                    onPress={() => {
                      const err = redeemReferral(refCode);
                      if (err) {
                        setRefError(err);
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                      } else {
                        setRefCode('');
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      }
                    }}
                    style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.7 }]}
                  >
                    <Mono style={styles.addBtnText}>USE</Mono>
                  </Pressable>
                </View>
                {refError && <Mono style={styles.error}>{refError}</Mono>}
              </>
            )}
          </Card>
        </FadeIn>

        <FadeIn index={11}>
          <Mono style={styles.footnote}>
            FRIEND CODES ONLY · NO DISCOVERY · REPORTS REVIEWED WITHIN 24 H
          </Mono>
        </FadeIn>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  h1: {
    fontFamily: font.display,
    fontSize: 34,
    color: color.text,
    marginTop: space(3),
    letterSpacing: -0.5,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  myCode: {
    fontFamily: font.display,
    fontSize: 34,
    letterSpacing: 6,
    color: color.accent,
    marginTop: space(2),
  },
  qrOuter: { alignItems: 'center' },
  qrWrap: {
    padding: space(3),
    backgroundColor: color.black,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.accentDim,
  },
  qrCaption: {
    fontSize: 9,
    letterSpacing: 1.4,
    color: color.faint,
    marginTop: space(3),
  },
  qrFallback: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: color.line,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: { fontSize: 10, color: color.faint, lineHeight: 15, marginTop: space(2.5) },
  inputRow: { flexDirection: 'row', gap: space(2), marginTop: space(3) },
  input: {
    flex: 1,
    minWidth: 0,
    ...(Platform.OS === 'web' ? ({ outlineWidth: 0 } as object) : null),
    height: 46,
    backgroundColor: color.surface2,
    borderWidth: 1,
    borderColor: color.lineBright,
    borderRadius: radius.sm,
    color: color.text,
    fontFamily: font.monoSemi,
    fontSize: 14,
    letterSpacing: 2,
    paddingHorizontal: space(3),
  },
  addBtn: {
    paddingHorizontal: space(4),
    justifyContent: 'center',
    backgroundColor: color.accent,
    borderRadius: radius.sm,
  },
  addBtnText: { fontSize: 12, letterSpacing: 1.5, color: color.black },
  error: { fontSize: 10, color: color.warn, marginTop: space(2) },
  ok: { fontSize: 10, color: color.accent, marginTop: space(2) },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: space(6),
  },
  sectionNote: { fontSize: 10, color: color.faint, lineHeight: 15, marginTop: space(1.5) },
  empty: { marginTop: space(3), padding: space(4) },
  friendCard: { marginTop: space(3), padding: space(4) },
  friendTop: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  friendName: { fontFamily: font.display, fontSize: 20, color: color.text },
  inviteBtn: {
    borderWidth: 1,
    borderColor: color.accent,
    borderRadius: radius.sm,
    paddingHorizontal: space(3),
    paddingVertical: space(1.5),
  },
  inviteText: { fontSize: 10, letterSpacing: 1.4, color: color.accent },
  postRow: { flexDirection: 'row', gap: space(3), marginTop: space(3), alignItems: 'center' },
  postShot: { borderWidth: 1, borderColor: color.line, borderRadius: radius.sm, overflow: 'hidden' },
  applaudBtn: {
    borderWidth: 1,
    borderColor: color.lineBright,
    borderRadius: radius.sm,
    alignItems: 'center',
    paddingVertical: space(2),
    marginTop: space(2),
  },
  applaudText: { fontSize: 10, letterSpacing: 1.4, color: color.text },
  modRow: { flexDirection: 'row', gap: space(4) },
  modAction: { fontSize: 9, letterSpacing: 1.2, color: color.faint },
  track: { height: 4, backgroundColor: color.surface2, borderRadius: 2, marginTop: 5 },
  trackFill: { height: 4, backgroundColor: color.accent, borderRadius: 2 },
  footnote: {
    fontSize: 9,
    letterSpacing: 1.3,
    color: color.faint,
    textAlign: 'center',
    marginTop: space(6),
  },
});
