import { Platform } from 'react-native';

// Headless/background web contexts can throttle rAF, freezing JS-driven
// animations mid-flight. Decorative motion is skipped on web; native gets it all.
export const REDUCED_MOTION = Platform.OS === 'web';

export const color = {
  bg: '#0A0A0C',
  surface: '#121215',
  surface2: '#1A1A1F',
  line: '#232329',
  lineBright: '#2E2E36',
  text: '#F4F4F2',
  dim: '#9A9AA3',
  faint: '#5C5C66',
  accent: '#C8FF2E',
  accentDim: '#5E7A0E',
  danger: '#FF4438',
  warn: '#FFB020',
  black: '#000000',
  onAccent: '#0A0A0C',
};

// ---------------------------------------------------------------------------
// Two typefaces, split on a rule rather than by screen.
//
// The app briefly ran everything in IBM Plex Mono. That was too far: a whole
// product set in a monospace face reads as a terminal, and the prose stopped
// being prose. It also ran two faces at a 50/50 split before that, which was
// too little rule and too much coincidence.
//
// **The rule: mono is for things a machine produced, Space Grotesk is for
// things a person wrote.**
//
//   Mono            codes, handles, timers, prices, all-caps labels and chips,
//                   button text, validator readouts, odds tables, stat values.
//                   Anything you would read out loud character by character,
//                   and anything that wants even-width digits.
//
//   Space Grotesk   screen titles, card headings, body copy, mission labels,
//                   item names and descriptions. Anything written in
//                   sentences.
//
// If a new surface is ambiguous, ask whether the text would still make sense
// if a person had not written it. A friend code would. A safety warning would
// not.
//
// The three exceptions below are Space Grotesk regardless, because they are
// objects rather than text: a logo, a figure read at a glance, and the one
// screen that is entirely typography.
// ---------------------------------------------------------------------------

export const font = {
  /** Screen titles and card headings. */
  display: 'SpaceGrotesk_700Bold',
  /** Body copy and anything written in sentences. */
  displayMed: 'SpaceGrotesk_500Medium',

  /** The machine voice: labels, codes, buttons, readouts. */
  mono: 'IBMPlexMono_400Regular',
  monoMed: 'IBMPlexMono_500Medium',
  monoSemi: 'IBMPlexMono_600SemiBold',

  /** The HIDEWIRE lockup only. */
  wordmark: 'SpaceGrotesk_700Bold',
  /** Large glanceable figures: round clock, countdown, level, score total. */
  numeral: 'SpaceGrotesk_700Bold',
  /** BLACKED OUT. */
  blackout: 'SpaceGrotesk_700Bold',
};

export const space = (n: number) => n * 4;

export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
};
