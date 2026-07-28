import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleProp,
  Text,
  TextStyle,
  ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';

// Shared motion vocabulary. Entrance animations are one-shot and settle at
// their final value, so a throttled frame loop degrades to "slightly offset"
// rather than "stuck invisible". That is why these run on every platform
// while looping decorative animations stay gated behind REDUCED_MOTION.

export const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);

/** Fade + rise. `index` staggers a list without each caller doing the math. */
export function FadeIn({
  children,
  delay = 0,
  index,
  stagger = 55,
  distance = 14,
  duration = 420,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  index?: number;
  stagger?: number;
  distance?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const v = useRef(new Animated.Value(0)).current;
  const totalDelay = delay + (index ?? 0) * stagger;

  useEffect(() => {
    const anim = Animated.timing(v, {
      toValue: 1,
      duration,
      delay: totalDelay,
      easing: EASE_OUT,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: v,
          transform: [
            {
              translateY: v.interpolate({
                inputRange: [0, 1],
                outputRange: [distance, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** Pressable that springs down on touch. The app's standard tap feedback. */
export function PressScale({
  children,
  onPress,
  disabled,
  style,
  scaleTo = 0.965,
  haptic = 'light',
}: {
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  haptic?: 'light' | 'medium' | 'none';
}) {
  const s = useRef(new Animated.Value(1)).current;

  const to = (value: number) =>
    Animated.spring(s, {
      toValue: value,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();

  return (
    <Pressable
      disabled={disabled}
      onPressIn={() => to(scaleTo)}
      onPressOut={() => to(1)}
      onPress={() => {
        if (haptic === 'medium') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        else if (haptic === 'light') Haptics.selectionAsync();
        onPress?.();
      }}
    >
      <Animated.View style={[style, { transform: [{ scale: s }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

/** Number that tweens to its new value. Used for the FILM balance. */
export function CountUp({
  value,
  style,
  duration = 550,
}: {
  value: number;
  style?: StyleProp<TextStyle>;
  duration?: number;
}) {
  const anim = useRef(new Animated.Value(value)).current;
  const [shown, setShown] = useState(value);

  useEffect(() => {
    const id = anim.addListener(({ value: v }) => setShown(Math.round(v)));
    Animated.timing(anim, {
      toValue: value,
      duration,
      easing: EASE_OUT,
      useNativeDriver: false,
    }).start(() => setShown(value));
    return () => anim.removeListener(id);
  }, [value]);

  return <Text style={style}>{shown.toLocaleString()}</Text>;
}

/** One-shot flash overlay, used to confirm a purchase on a tile. */
export function useFlash() {
  const v = useRef(new Animated.Value(0)).current;
  const fire = () => {
    v.setValue(0.85);
    Animated.timing(v, {
      toValue: 0,
      duration: 620,
      easing: EASE_OUT,
      useNativeDriver: true,
    }).start();
  };
  return { flashOpacity: v, fire };
}

/** Slow breathing scale for a focal element. Gated: it loops forever. */
export function useBreathe(enabled: boolean) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!enabled) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(v, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [enabled]);
  return v;
}
