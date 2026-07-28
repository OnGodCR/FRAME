import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, font, radius, space } from '../theme';
import { Body, Btn, Label, Mono } from '../components/ui';
import { FadeIn } from '../components/motion';
import { POI_TYPE_META } from '../components/ZoneMap';
import { useGame } from '../engine/GameContext';

// Legend for the map. The diamonds are the only thing on screen whose meaning
// is not self-evident, so they get explained once, before the first round,
// with the same shapes and colours the map actually uses.

const TYPES = [
  {
    type: 'beacon' as const,
    what: 'Landmarks. Museums, monuments, stations.',
    does: 'Claim it and it pays you XP for as long as you hold it. Anyone who walks up takes it off you.',
  },
  {
    type: 'waystation' as const,
    what: 'Parks, plazas, libraries, fountains.',
    does: 'Wipes every nerf a seeker has put on you, plus a small XP bonus.',
  },
  {
    type: 'cache' as const,
    what: 'Shops and smaller spots. The most common pin.',
    does: 'One random buff from your pool. Same cache will not pay out again for 30 minutes.',
  },
];

const MARKERS = [
  {
    tint: color.accent,
    shape: 'cone' as const,
    label: 'YOU',
    note: 'Your position. The cone points the way your phone is facing, so you can tell which way you are about to walk.',
  },
  {
    tint: color.accent,
    shape: 'pin' as const,
    label: 'REVEAL',
    note: 'Where a hider was at the last reveal tick. Fades as it goes stale.',
  },
  {
    tint: color.faint,
    shape: 'x' as const,
    label: 'OUT',
    note: 'A player who has been tagged or blacked out.',
  },
];

export function MapTutorial() {
  const { go } = useGame();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={{
          padding: space(6),
          paddingTop: insets.top + space(8),
          paddingBottom: space(6),
        }}
      >
        <FadeIn>
          <Label>Step 6 of 6 · Reading the map</Label>
          <Text style={styles.h1}>The diamonds are worth walking to</Text>
          <Body style={{ color: color.dim, marginTop: space(2) }}>
            Real places near you, filtered down to public ground. Three kinds, and the
            colour tells you which.
          </Body>
        </FadeIn>

        {TYPES.map((t, i) => {
          const meta = POI_TYPE_META[t.type];
          return (
            <FadeIn key={t.type} index={i + 1}>
              <View style={styles.row}>
                <View style={styles.glyphCol}>
                  <View style={[styles.diamond, { borderColor: meta.tint }]} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.typeName, { color: meta.tint }]}>{meta.label}</Text>
                  <Mono style={styles.what}>{t.what}</Mono>
                  <Body style={styles.does}>{t.does}</Body>
                </View>
              </View>
            </FadeIn>
          );
        })}

        <FadeIn index={4}>
          <View style={styles.ruleBox}>
            <Label tone="accent">To use one</Label>
            <Body style={{ color: color.text, marginTop: space(2) }}>
              Get within 30 metres and hold still for 5 seconds. Walking cancels it, and it
              stays locked while the speed lock thinks you are in a vehicle.
            </Body>
            <Mono style={{ fontSize: 10, color: color.faint, marginTop: space(3), lineHeight: 16 }}>
              Some places keep opening hours. A park at 2 a.m. is closed, and a closed
              landmark does nothing.
            </Mono>
          </View>
        </FadeIn>

        <FadeIn index={5}>
          <Label tone="faint" style={{ marginTop: space(6), marginBottom: space(3) }}>
            Everything else on the map
          </Label>
          {MARKERS.map((m) => (
            <View key={m.label} style={styles.markerRow}>
              <View style={styles.glyphCol}>
                {m.shape === 'cone' && (
                  <View style={{ alignItems: 'center' }}>
                    <View style={[styles.cone, { borderBottomColor: m.tint }]} />
                    <View style={[styles.dot, { backgroundColor: m.tint, marginTop: -3 }]} />
                  </View>
                )}
                {m.shape === 'pin' && <View style={[styles.pin, { backgroundColor: m.tint }]} />}
                {m.shape === 'x' && (
                  <Text style={{ color: m.tint, fontFamily: font.monoSemi, fontSize: 14 }}>×</Text>
                )}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Mono style={styles.markerLabel}>{m.label}</Mono>
                <Mono style={{ fontSize: 11, color: color.dim, marginTop: 1 }}>{m.note}</Mono>
              </View>
            </View>
          ))}
          <View style={styles.markerRow}>
            <View style={styles.glyphCol}>
              <View style={styles.zoneRing} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Mono style={styles.markerLabel}>THE ZONE</Mono>
              <Mono style={{ fontSize: 11, color: color.dim, marginTop: 1 }}>
                Dashed circle. Step outside and you have 60 seconds to get back in. It
                shrinks late in the round.
              </Mono>
            </View>
          </View>

          <Mono style={{ fontSize: 11, color: color.faint, marginTop: space(5), lineHeight: 17 }}>
            Pinch to zoom, or use the + and − buttons on the right of the map.
          </Mono>
        </FadeIn>
      </ScrollView>

      <View style={{ padding: space(6), paddingTop: 0, paddingBottom: insets.bottom + space(5) }}>
        <Btn title="Got it" onPress={() => go('home')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  h1: {
    fontFamily: font.display,
    fontSize: 28,
    lineHeight: 33,
    color: color.text,
    marginTop: space(2),
    letterSpacing: -0.5,
  },
  row: {
    flexDirection: 'row',
    gap: space(3),
    paddingVertical: space(4),
    borderBottomWidth: 1,
    borderBottomColor: color.line,
  },
  glyphCol: { width: 30, alignItems: 'center', paddingTop: 3 },
  diamond: {
    width: 14,
    height: 14,
    borderWidth: 2,
    transform: [{ rotate: '45deg' }],
  },
  typeName: {
    fontFamily: font.monoSemi,
    fontSize: 13,
    letterSpacing: 2,
  },
  what: { fontSize: 11, color: color.faint, marginTop: 3 },
  does: { color: color.text, marginTop: space(2), fontSize: 14 },
  ruleBox: {
    marginTop: space(5),
    borderWidth: 1,
    borderColor: color.accentDim,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    padding: space(4),
  },
  markerRow: {
    flexDirection: 'row',
    gap: space(3),
    paddingVertical: space(2.5),
  },
  dot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: color.bg,
  },
  pin: { width: 9, height: 9, transform: [{ rotate: '45deg' }] },
  cone: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderBottomWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    opacity: 0.45,
  },
  zoneRing: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: color.accent,
  },
  markerLabel: {
    fontSize: 11,
    letterSpacing: 1.5,
    color: color.text,
    fontFamily: font.monoSemi,
  },
});
