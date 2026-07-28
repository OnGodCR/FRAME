import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { color, font, radius, space } from '../theme';
import { Body, Btn, Label, Mono, Rule } from './ui';
import { TickerEvent } from '../engine/GameContext';

// ---------- event ticker ----------

export function Ticker({ events }: { events: TickerEvent[] }) {
  const latest = events[0];
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!latest) return;
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 250, useNativeDriver: true }).start();
  }, [latest?.id]);
  if (!latest) return null;
  const tint =
    latest.tone === 'danger'
      ? color.danger
      : latest.tone === 'warn'
        ? color.warn
        : latest.tone === 'accent'
          ? color.accent
          : color.dim;
  return (
    <Animated.View style={[styles.ticker, { opacity: fade }]}>
      <View style={[styles.tickerBar, { backgroundColor: tint }]} />
      <Text style={[styles.tickerText, { color: tint }]} numberOfLines={1}>
        {latest.text.toUpperCase()}
      </Text>
    </Animated.View>
  );
}

// ---------- SOS ----------

export function SosButton({ onLeave }: { onLeave: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.sos, pressed && { opacity: 0.8 }]}
        hitSlop={10}
      >
        <Text style={styles.sosText}>SOS</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Label tone="danger">Safety</Label>
            <Body style={{ marginTop: space(2), marginBottom: space(4) }}>
              Leaving is always free. No XP penalty, no quitter flag. If something is
              wrong, stop playing.
            </Body>
            <Btn
              title="Leave round"
              variant="ghost"
              onPress={() => {
                setOpen(false);
                onLeave();
              }}
            />
            <View style={{ height: space(2) }} />
            <Btn
              title="Emergency"
              variant="danger"
              sub="opens your phone's emergency dialer"
              onPress={() => setOpen(false)}
            />
            <View style={{ height: space(2) }} />
            <Btn title="Back to round" variant="outline" onPress={() => setOpen(false)} />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

// ---------- Explainer card (renders fully offline by design) ----------

function FakeQr({ size }: { size: number }) {
  const cells = useMemo(() => {
    let a = 1337;
    const rnd = () => {
      a = (a * 16807) % 2147483647;
      return a / 2147483647;
    };
    const n = 21;
    const grid: boolean[][] = [];
    for (let y = 0; y < n; y++) {
      grid.push([]);
      for (let x = 0; x < n; x++) grid[y].push(rnd() > 0.5);
    }
    const finder = (gx: number, gy: number) => {
      for (let y = 0; y < 7; y++)
        for (let x = 0; x < 7; x++) {
          const edge = x === 0 || y === 0 || x === 6 || y === 6;
          const core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
          grid[gy + y][gx + x] = edge || core;
        }
    };
    finder(0, 0);
    finder(14, 0);
    finder(0, 14);
    return grid;
  }, []);
  const cell = size / 21;
  return (
    <Svg width={size} height={size}>
      <Rect x={0} y={0} width={size} height={size} fill="#FFF" />
      {cells.map((row, y) =>
        row.map((on, x) =>
          on ? (
            <Rect key={`${x}-${y}`} x={x * cell} y={y * cell} width={cell} height={cell} fill="#000" />
          ) : null,
        ),
      )}
    </Svg>
  );
}

export function ExplainerButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={styles.explainerBtn} hitSlop={8}>
        <Text style={styles.explainerBtnText}>?</Text>
      </Pressable>
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.explainer}>
          <ScrollView contentContainerStyle={{ padding: space(7), paddingTop: space(16) }}>
            <Text style={styles.explainerTitle}>I'm playing a mobile game called FRAME.</Text>
            <Text style={styles.explainerBody}>
              It's an app-based game of hide and seek with friends.{'\n\n'}I'm not filming
              you and I'm not recording audio.{'\n\n'}If I'm somewhere I shouldn't be,
              please tell me and I'll leave.
            </Text>
            <View style={{ alignItems: 'center', marginTop: space(8) }}>
              <FakeQr size={132} />
              <Text style={styles.explainerQrCaption}>frame.game/what-is-this</Text>
            </View>
          </ScrollView>
          <View style={{ padding: space(5) }}>
            <Text style={styles.explainerOffline}>THIS CARD WORKS WITHOUT SIGNAL</Text>
            <Btn title="Close" variant="ghost" onPress={() => setOpen(false)} />
          </View>
        </View>
      </Modal>
    </>
  );
}

// ---------- inventory drawer ----------

const HIDER_ITEMS = [
  { name: 'GHOST PING', desc: 'Skip one location reveal entirely.' },
  { name: 'GRACE', desc: 'Extend a check-in window by 90 s. Usable after the tick.' },
];
const SEEKER_ITEMS = [
  { name: 'THERMAL', desc: 'Direction to the nearest hider for 60 s. No distance.' },
  { name: 'PRESSURE', desc: 'Force an extra check-in from all hiders.' },
];

export function InventoryDrawer({ role }: { role: 'hider' | 'seeker' }) {
  const [open, setOpen] = useState(false);
  const items = role === 'hider' ? HIDER_ITEMS : SEEKER_ITEMS;
  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={styles.invBtn} hitSlop={8}>
        <Label tone="text" style={{ fontSize: 9 }}>
          ITEMS
        </Label>
        <Text style={styles.invCount}>{items.length}/2</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Label>{`Inventory · ${role === 'hider' ? 'hider pool' : 'seeker pool'}`}</Label>
            {items.map((it, i) => (
              <View key={it.name}>
                {i > 0 && <Rule style={{ marginVertical: space(3) }} />}
                <View style={{ marginTop: i === 0 ? space(4) : 0 }}>
                  <Text style={styles.invName}>{it.name}</Text>
                  <Mono style={{ marginTop: 2, fontSize: 12 }}>{it.desc}</Mono>
                </View>
              </View>
            ))}
            <Mono style={{ marginTop: space(4), fontSize: 11, color: color.faint }}>
              Earned through play only. Never purchasable. 90 s cooldown between uses.
            </Mono>
            <View style={{ height: space(3) }} />
            <Btn title="Close" variant="outline" onPress={() => setOpen(false)} />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  ticker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10,10,12,0.92)',
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.sm,
    paddingVertical: 7,
    paddingHorizontal: 10,
    gap: 8,
  },
  tickerBar: { width: 3, alignSelf: 'stretch', borderRadius: 2 },
  tickerText: {
    fontFamily: font.monoMed,
    fontSize: 10,
    letterSpacing: 1.2,
    flex: 1,
  },
  sos: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: color.danger,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FF7B72',
  },
  sosText: {
    fontFamily: font.monoSemi,
    fontSize: 12,
    letterSpacing: 1.5,
    color: '#FFF',
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: color.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.line,
    padding: space(5),
    paddingBottom: space(10),
  },
  explainerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: color.surface2,
    borderWidth: 1,
    borderColor: color.lineBright,
    alignItems: 'center',
    justifyContent: 'center',
  },
  explainerBtnText: {
    fontFamily: font.monoSemi,
    fontSize: 16,
    color: color.text,
  },
  explainer: { flex: 1, backgroundColor: '#FFFFFF' },
  explainerTitle: {
    fontFamily: font.display,
    fontSize: 30,
    lineHeight: 36,
    color: '#000',
  },
  explainerBody: {
    fontFamily: font.displayMed,
    fontSize: 20,
    lineHeight: 28,
    color: '#111',
    marginTop: space(6),
  },
  explainerQrCaption: {
    fontFamily: font.monoMed,
    fontSize: 12,
    color: '#444',
    marginTop: space(2),
  },
  explainerOffline: {
    fontFamily: font.monoMed,
    fontSize: 10,
    letterSpacing: 1.6,
    color: '#666',
    textAlign: 'center',
    marginBottom: space(3),
  },
  invBtn: {
    backgroundColor: color.surface2,
    borderWidth: 1,
    borderColor: color.lineBright,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  invCount: {
    fontFamily: font.monoSemi,
    fontSize: 13,
    color: color.accent,
    marginTop: 2,
  },
  invName: {
    fontFamily: font.monoSemi,
    fontSize: 13,
    letterSpacing: 1.5,
    color: color.text,
  },
});
