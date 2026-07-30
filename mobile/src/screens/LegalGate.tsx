import React, { useEffect, useState } from 'react';
import {
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { color, font, radius, space } from '../theme';
import { Body, Btn, Label, Mono } from '../components/ui';
import { FadeIn } from '../components/motion';
import { Doc, PRIVACY, TERMS } from '../data/legal';
import { useGame } from '../engine/GameContext';

// The points a player actually needs to have registered before they agree.
// The full documents are one tap away, but nobody reads a wall of text, and
// pretending otherwise is how you end up with consent that is not informed.
const HIGHLIGHTS = [
  {
    title: 'You are responsible for where you go',
    body: 'FRAME gives you reasons to walk to real places. It does not know if the route is safe or the property is public. Stay on public ground, obey the law, and stop if anyone asks you to.',
  },
  {
    title: 'Your photos go to the seeker, then get deleted',
    body: 'Check-in photos are visible to the seeker in your party while the round runs, then permanently deleted 24 hours after it ends. They never enter your match history.',
  },
  {
    title: 'No face detection, ever',
    body: 'Photos are checked on brightness, blur, and detail. Nothing in the pipeline can identify a person, and we never ask for gallery access.',
  },
  {
    title: 'Your position is not live to the seeker',
    body: 'Between reveal ticks your coordinates stay on the server. The seeker only sees where you were at each tick.',
  },
];

export function LegalGate() {
  const { go } = useGame();
  const insets = useSafeAreaInsets();
  const [reachedEnd, setReachedEnd] = useState(false);
  const [viewerH, setViewerH] = useState(0);
  const [contentH, setContentH] = useState(0);
  const [open, setOpen] = useState<Doc | null>(null);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 40) {
      setReachedEnd(true);
    }
  };

  // A gate that cannot be satisfied is worse than no gate at all. On a wide or
  // tall viewport the four points fit without overflowing, so there is nothing
  // to scroll and onScroll never fires: the player is locked out of the app
  // permanently. That is reachable on a tablet, on an unfolded foldable, and in
  // the desktop dev preview.
  //
  // This has to live in an effect rather than inside either handler, because
  // onLayout and onContentSizeChange fire in an order React Native does not
  // guarantee. Checking inside onContentSizeChange alone (the previous version)
  // read viewerH while it was still 0, skipped the check, and never ran again.
  useEffect(() => {
    if (viewerH > 0 && contentH > 0 && contentH <= viewerH + 8) setReachedEnd(true);
  }, [viewerH, contentH]);

  return (
    <View style={styles.screen}>
      <View style={{ paddingHorizontal: space(6), paddingTop: insets.top + space(8) }}>
        <Label>Step 2 of 4</Label>
        <Text style={styles.h1}>Before you make an account</Text>
      </View>

      <ScrollView
        onScroll={onScroll}
        onLayout={(e) => setViewerH(e.nativeEvent.layout.height)}
        onContentSizeChange={(_, h) => setContentH(h)}
        scrollEventThrottle={16}
        style={{ flex: 1, marginTop: space(4) }}
        contentContainerStyle={{ paddingHorizontal: space(6), paddingBottom: space(6) }}
      >
        {HIGHLIGHTS.map((h, i) => (
          <FadeIn key={h.title} index={i}>
            <View style={styles.item}>
              <Text style={styles.itemNum}>{String(i + 1).padStart(2, '0')}</Text>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.itemTitle}>{h.title}</Text>
                <Body style={{ color: color.dim, marginTop: space(1.5), fontSize: 14 }}>
                  {h.body}
                </Body>
              </View>
            </View>
          </FadeIn>
        ))}

        <View style={styles.docRow}>
          <Pressable onPress={() => setOpen(TERMS)} style={styles.docBtn}>
            <Mono style={styles.docBtnText}>READ FULL TERMS</Mono>
          </Pressable>
          <Pressable onPress={() => setOpen(PRIVACY)} style={styles.docBtn}>
            <Mono style={styles.docBtnText}>READ PRIVACY POLICY</Mono>
          </Pressable>
        </View>

        <Mono style={styles.draftNote}>
          Draft documents. Not yet reviewed by a lawyer, and they will change before
          public launch.
        </Mono>
      </ScrollView>

      <View style={{ padding: space(6), paddingBottom: insets.bottom + space(5) }}>
        <Btn
          title={reachedEnd ? 'I agree' : 'Scroll to the end'}
          disabled={!reachedEnd}
          sub={reachedEnd ? 'to the Terms of Service and Privacy Policy' : undefined}
          onPress={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            go('auth');
          }}
        />
      </View>

      <DocViewer doc={open} onClose={() => setOpen(null)} />
    </View>
  );
}

export function DocViewer({ doc, onClose }: { doc: Doc | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  if (!doc) return null;
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={{
            padding: space(6),
            paddingTop: insets.top + space(6),
            paddingBottom: space(6),
          }}
        >
          <Label tone="faint">Updated {doc.updated}</Label>
          <Text style={styles.h1}>{doc.title}</Text>
          <Body style={{ color: color.dim, marginTop: space(3) }}>{doc.intro}</Body>

          {doc.sections.map((s) => (
            <View key={s.heading} style={{ marginTop: space(6) }}>
              <Text style={styles.sectionHeading}>{s.heading}</Text>
              {s.body.map((p, i) => (
                <Body key={i} style={{ color: color.text, marginTop: space(2), fontSize: 14 }}>
                  {p}
                </Body>
              ))}
            </View>
          ))}
        </ScrollView>
        <View style={{ padding: space(6), paddingBottom: insets.bottom + space(5) }}>
          <Btn title="Close" variant="outline" onPress={onClose} />
        </View>
      </View>
    </Modal>
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
  item: {
    flexDirection: 'row',
    gap: space(3),
    paddingVertical: space(3.5),
    borderBottomWidth: 1,
    borderBottomColor: color.line,
  },
  itemNum: {
    fontFamily: font.monoSemi,
    fontSize: 13,
    color: color.accent,
    width: 26,
    paddingTop: 2,
  },
  itemTitle: {
    fontFamily: font.displayMed,
    fontSize: 16,
    color: color.text,
    lineHeight: 21,
  },
  docRow: { flexDirection: 'row', gap: space(2), marginTop: space(5) },
  docBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: color.lineBright,
    borderRadius: radius.md,
    paddingVertical: space(3),
    alignItems: 'center',
  },
  docBtnText: {
    fontSize: 9,
    letterSpacing: 1.2,
    color: color.text,
    textAlign: 'center',
  },
  draftNote: {
    fontSize: 10,
    color: color.faint,
    lineHeight: 16,
    marginTop: space(4),
  },
  sectionHeading: {
    fontFamily: font.monoSemi,
    fontSize: 13,
    letterSpacing: 1.2,
    color: color.accent,
  },
});
