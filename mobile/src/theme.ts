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
// One typeface, with four deliberate exceptions.
//
// The app used to run two families at roughly a 50/50 split: Space Grotesk for
// anything headline-shaped, IBM Plex Mono for everything else. In practice that
// meant a screen could change voice three times between its title and its
// footnote, and neither face was doing a job the other could not.
//
// **IBM Plex Mono is now the base for everything**, including headings. It is
// the face the product already sounded like: an instrument readout, a set of
// measurements taken of a place. `display` and `displayMed` are kept as tokens
// rather than deleted so the 61 call sites do not all have to change, and so
// the intent at each one ("this is a heading") survives the swap.
//
// The exceptions below stay in Space Grotesk because they are **objects, not
// text**: a logo, a number you read at a glance, and the one screen in the game
// that is pure typography. Everywhere else, if you are tempted to reach for
// `wordmark` or `numeral`, use `display` instead.
// ---------------------------------------------------------------------------

export const font = {
  /** Headings. Mono, like everything else. */
  display: 'IBMPlexMono_600SemiBold',
  /** Subheads and heavier body. */
  displayMed: 'IBMPlexMono_500Medium',
  mono: 'IBMPlexMono_400Regular',
  monoMed: 'IBMPlexMono_500Medium',
  monoSemi: 'IBMPlexMono_600SemiBold',

  /** The HIDEWIRE lockup only. Nothing else. */
  wordmark: 'SpaceGrotesk_700Bold',
  /**
   * Large glanceable figures: the round clock, the check-in countdown, the
   * level, the score total. Mono is even-width by definition, which is right
   * for a table and wrong for a number the size of your hand.
   */
  numeral: 'SpaceGrotesk_700Bold',
  /** BLACKED OUT. The one screen that is entirely a piece of typography. */
  blackout: 'SpaceGrotesk_700Bold',
};

export const space = (n: number) => n * 4;

export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
};
