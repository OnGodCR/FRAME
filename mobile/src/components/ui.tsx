import React from 'react';
import {
  Text,
  TextProps,
  View,
  ViewProps,
  Pressable,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { color, font, radius, space } from '../theme';

// ---------- typography ----------

export function Display({ style, ...rest }: TextProps) {
  return <Text {...rest} style={[styles.display, style]} />;
}

export function Body({ style, ...rest }: TextProps) {
  return <Text {...rest} style={[styles.body, style]} />;
}

export function Mono({ style, ...rest }: TextProps) {
  return <Text {...rest} style={[styles.mono, style]} />;
}

/** Uppercase micro-label, letterspaced. The app's signature text style. */
export function Label({
  style,
  children,
  tone = 'dim',
  ...rest
}: TextProps & { tone?: 'dim' | 'text' | 'accent' | 'danger' | 'faint' }) {
  const c =
    tone === 'accent'
      ? color.accent
      : tone === 'danger'
        ? color.danger
        : tone === 'text'
          ? color.text
          : tone === 'faint'
            ? color.faint
            : color.dim;
  return (
    <Text {...rest} style={[styles.label, { color: c }, style]}>
      {typeof children === 'string' ? children.toUpperCase() : children}
    </Text>
  );
}

// ---------- surfaces ----------

export function Card({ style, ...rest }: ViewProps) {
  return <View {...rest} style={[styles.card, style]} />;
}

export function Rule({ style }: { style?: ViewStyle }) {
  return <View style={[{ height: 1, backgroundColor: color.line }, style]} />;
}

// ---------- buttons ----------

type BtnVariant = 'primary' | 'ghost' | 'danger' | 'outline';

export function Btn({
  title,
  onPress,
  variant = 'primary',
  disabled,
  style,
  sub,
}: {
  title: string;
  onPress?: () => void;
  variant?: BtnVariant;
  disabled?: boolean;
  style?: ViewStyle;
  sub?: string;
}) {
  const base: ViewStyle[] = [styles.btn];
  if (variant === 'primary') base.push({ backgroundColor: color.accent });
  if (variant === 'ghost') base.push({ backgroundColor: color.surface2 });
  if (variant === 'danger') base.push({ backgroundColor: color.danger });
  if (variant === 'outline')
    base.push({
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: color.lineBright,
    });
  const textColor =
    variant === 'primary'
      ? color.onAccent
      : variant === 'danger'
        ? '#FFF'
        : color.text;
  return (
    <Pressable
      disabled={disabled}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress?.();
      }}
      style={({ pressed }) => [
        base,
        style,
        disabled && { opacity: 0.35 },
        pressed && !disabled && { opacity: 0.75 },
      ]}
    >
      <Text style={[styles.btnText, { color: textColor }]}>
        {title.toUpperCase()}
      </Text>
      {sub ? (
        <Text style={[styles.btnSub, { color: textColor, opacity: 0.6 }]}>
          {sub}
        </Text>
      ) : null}
    </Pressable>
  );
}

// ---------- progress ----------

export function Bar({
  value,
  height = 4,
  fg = color.accent,
  bg = color.line,
}: {
  value: number; // 0..1
  height?: number;
  fg?: string;
  bg?: string;
}) {
  return (
    <View style={{ height, backgroundColor: bg, borderRadius: height / 2, overflow: 'hidden' }}>
      <View
        style={{
          width: `${Math.max(0, Math.min(1, value)) * 100}%`,
          height,
          backgroundColor: fg,
        }}
      />
    </View>
  );
}

// ---------- corner brackets (the wordmark motif) ----------

export function Brackets({
  size = 14,
  thickness = 2,
  inset = 0,
  tint = color.accent,
  children,
  style,
}: {
  size?: number;
  thickness?: number;
  inset?: number;
  tint?: string;
  children?: React.ReactNode;
  style?: ViewStyle;
}) {
  const corner = (pos: ViewStyle): ViewStyle => ({
    position: 'absolute',
    width: size,
    height: size,
    borderColor: tint,
    ...pos,
  });
  return (
    <View style={style}>
      {children}
      <View
        pointerEvents="none"
        style={corner({
          top: inset,
          left: inset,
          borderTopWidth: thickness,
          borderLeftWidth: thickness,
        })}
      />
      <View
        pointerEvents="none"
        style={corner({
          top: inset,
          right: inset,
          borderTopWidth: thickness,
          borderRightWidth: thickness,
        })}
      />
      <View
        pointerEvents="none"
        style={corner({
          bottom: inset,
          left: inset,
          borderBottomWidth: thickness,
          borderLeftWidth: thickness,
        })}
      />
      <View
        pointerEvents="none"
        style={corner({
          bottom: inset,
          right: inset,
          borderBottomWidth: thickness,
          borderRightWidth: thickness,
        })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  display: {
    fontFamily: font.display,
    color: color.text,
    fontSize: 28,
    letterSpacing: -0.5,
  },
  body: {
    fontFamily: font.displayMed,
    color: color.text,
    fontSize: 15,
    lineHeight: 22,
  },
  mono: {
    fontFamily: font.mono,
    color: color.dim,
    fontSize: 13,
  },
  label: {
    fontFamily: font.monoMed,
    fontSize: 10,
    letterSpacing: 1.6,
  },
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.line,
    padding: space(4),
  },
  btn: {
    minHeight: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space(5),
    paddingVertical: space(3),
  },
  btnText: {
    fontFamily: font.monoSemi,
    fontSize: 14,
    letterSpacing: 2,
  },
  btnSub: {
    fontFamily: font.mono,
    fontSize: 10,
    letterSpacing: 1,
    marginTop: 2,
  },
});
