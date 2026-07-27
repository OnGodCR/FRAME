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

export const font = {
  display: 'SpaceGrotesk_700Bold',
  displayMed: 'SpaceGrotesk_500Medium',
  mono: 'IBMPlexMono_400Regular',
  monoMed: 'IBMPlexMono_500Medium',
  monoSemi: 'IBMPlexMono_600SemiBold',
};

export const space = (n: number) => n * 4;

export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
};
