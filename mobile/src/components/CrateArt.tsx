import React from 'react';
import { View } from 'react-native';
import Svg, {
  Defs,
  G,
  LinearGradient,
  Path,
  Rect,
  Stop,
  RadialGradient,
  Line,
} from 'react-native-svg';
import { color } from '../theme';

// ---------------------------------------------------------------------------
// Crate artwork.
//
// **The first version drew film canisters, which is not a crate.** They were
// cylinders, they read as tins, and the store looked like a shelf of soup. This
// draws an actual box: an isometric cube with a lid, a strap crossing the
// front, corner reinforcements, and light escaping the seam under the lid.
//
// The geometry is one 100x100 viewBox with three faces:
//
//        A---------B          A..B  top back edge
//       /         /|          B..C  right face
//      C---------D |          C..D  front top edge
//      |  front  | E
//      |         |/
//      F---------G
//
// Every tier reads its look from TIERS below rather than from a hardcoded
// drawing, so a generated render can replace any one of them without touching
// the others. See marketing/LOOTBOX-IMAGE-PROMPT.md.
// ---------------------------------------------------------------------------

interface CrateLook {
  /** Front face. */
  face: string;
  /** Top face, lit. */
  top: string;
  /** Right face, in shadow. */
  side: string;
  /** Strap and reinforcement colour. */
  strap: string;
  /** Light escaping the lid seam. Brighter means rarer. */
  glow: string;
  /** How far the light bleeds, 0..1. */
  bleed: number;
  /** A lock plate on the front. */
  lock?: boolean;
  /** Lid tilted open with light pouring out. */
  open?: boolean;
}

const TIERS: Record<string, CrateLook> = {
  'box-tray': {
    face: '#3A3A42', top: '#4E4E58', side: '#26262C',
    strap: '#5A5A66', glow: color.accentDim, bleed: 0.2,
  },
  'box-contact': {
    face: '#2F3A34', top: '#42544A', side: '#1F2823',
    strap: '#6E8A78', glow: color.accent, bleed: 0.4,
  },
  'box-silver': {
    face: '#6E6E7A', top: '#9A9AA6', side: '#4A4A54',
    strap: '#C6C6D0', glow: color.accent, bleed: 0.6,
  },
  'box-vault': {
    face: '#1C1C22', top: '#2A2A32', side: '#121216',
    strap: '#C8FF2E', glow: '#EFFFA8', bleed: 0.95, lock: true,
  },
  'box-first-light': {
    face: '#2A2A32', top: '#3C3C46', side: '#1A1A20',
    strap: '#FFFFFF', glow: '#FFFFFF', bleed: 1, open: true,
  },
};

const FALLBACK = TIERS['box-tray'];

export function CrateArt({ id, size = 96 }: { id: string; size?: number }) {
  const look = TIERS[id] ?? FALLBACK;
  const uid = id.replace(/[^a-z]/g, '');

  // Box corners. Front face is a rectangle; top and right are parallelograms
  // sheared to give it depth without a real 3D projection.
  const L = 22, R = 72, T = 46, B = 84;   // front face
  const dx = 12, dy = 10;                  // depth offset

  const lidH = 9;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id={`f${uid}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={look.face} />
            <Stop offset="1" stopColor={look.side} />
          </LinearGradient>
          <RadialGradient id={`h${uid}`} cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor={look.glow} stopOpacity={0.5 * look.bleed} />
            <Stop offset="1" stopColor={look.glow} stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* Halo, behind the box. */}
        <Path
          d={`M${L - 14} ${T - 6} L${R + dx + 10} ${T - 18} L${R + dx + 10} ${T + 14} L${L - 14} ${T + 20} Z`}
          fill={`url(#h${uid})`}
        />

        {/* A blade of light out of the tilted lid. Only the paid case opens. */}
        {look.open && (
          <>
            <Path d={`M${L + 6} ${T - 4} L50 4 L${R - 6} ${T - 4} Z`} fill={look.glow} opacity={0.18} />
            <Line x1="50" y1={T - 6} x2="50" y2="8" stroke={look.glow} strokeWidth="2" opacity={0.75} />
          </>
        )}

        {/* ---- body ---- */}
        {/* right face */}
        <Path d={`M${R} ${T} L${R + dx} ${T - dy} L${R + dx} ${B - dy} L${R} ${B} Z`} fill={look.side} />
        {/* top face */}
        <Path d={`M${L} ${T} L${L + dx} ${T - dy} L${R + dx} ${T - dy} L${R} ${T} Z`} fill={look.top} />
        {/* front face */}
        <Rect x={L} y={T} width={R - L} height={B - T} fill={`url(#f${uid})`} />

        {/* ---- lid ---- */}
        {/* Open is a straight lift, no rotation.
            Two attempts at tilting it both failed the same way: the lid is a
            top panel plus a front band, and rotating the pair detached the band
            from the box and left a slab floating beside it. Lifting the whole
            lid square, with the seam glowing underneath, reads as open without
            any of that. */}
        <G transform={look.open ? 'translate(0 -13)' : undefined}>
          <Path
            d={`M${L} ${T} L${L + dx} ${T - dy} L${R + dx} ${T - dy} L${R} ${T} Z`}
            fill={look.top}
            stroke={look.strap}
            strokeWidth="1.5"
          />
          <Rect x={L} y={T} width={R - L} height={lidH} fill={look.face} stroke={look.strap} strokeWidth="1.5" />
          <Path d={`M${R} ${T} L${R + dx} ${T - dy} L${R + dx} ${T - dy + lidH} L${R} ${T + lidH} Z`} fill={look.side} />
        </G>

        {/* The seam the light escapes from, just under the lid. */}
        <Rect
          x={L}
          y={T + lidH}
          width={R - L}
          height={2.5}
          fill={look.glow}
          opacity={0.3 + 0.7 * look.bleed}
        />

        {/* ---- strap down the front and over the lid ---- */}
        <Rect x={44} y={T} width={7} height={B - T} fill={look.strap} opacity={0.9} />
        <Path d={`M${44} ${T} L${44 + dx} ${T - dy} L${51 + dx} ${T - dy} L${51} ${T} Z`} fill={look.strap} opacity={0.7} />

        {/* Corner reinforcements, which is what makes it read as a crate
            rather than a gift box. */}
        {[
          [L, T + lidH], [R - 8, T + lidH], [L, B - 8], [R - 8, B - 8],
        ].map(([x, y], i) => (
          <Rect key={i} x={x} y={y} width={8} height={8} fill={look.strap} opacity={0.35} />
        ))}

        {/* Slat lines, so the front face is not a flat block of colour. */}
        <G stroke={look.side} strokeWidth="1" opacity={0.5}>
          <Line x1={L} y1={T + 24} x2={R} y2={T + 24} />
          <Line x1={L} y1={T + 32} x2={R} y2={T + 32} />
        </G>

        {/* Lock plate on the top tier. */}
        {look.lock && (
          <>
            <Rect x={42} y={T + 20} width={11} height={11} rx={2} fill={look.glow} opacity={0.9} />
            <Rect x={46} y={T + 24} width={3} height={4} fill={look.face} />
          </>
        )}

        {/* The viewfinder brackets, the motif every surface shares. */}
        <G stroke={color.accent} strokeWidth="2.5" fill="none" strokeLinecap="square">
          <Path d="M6 24 L6 12 L18 12" />
          <Path d="M94 24 L94 12 L82 12" />
          <Path d="M6 82 L6 94 L18 94" />
          <Path d="M94 82 L94 94 L82 94" />
        </G>
      </Svg>
    </View>
  );
}

/**
 * A stack of crates for the FILM packs, growing with the size of the pack.
 *
 * The packs were four identical icons with different numbers under them, so the
 * only thing separating $9.99 from $0.99 was the digits. Making the pile
 * physically bigger is the oldest trick in this book and it works because it is
 * honest: there really is more in it.
 */
export function FilmStack({ count, size = 64 }: { count: number; size?: number }) {
  const n = Math.max(1, Math.min(4, count));
  const uid = `s${n}`;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id={`c${uid}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#4E4E58" />
            <Stop offset="1" stopColor="#26262C" />
          </LinearGradient>
        </Defs>
        {Array.from({ length: n }).map((_, i) => {
          const y = 76 - i * 16;
          const L = 30, R = 70, dx = 8, dy = 6, h = 14;
          return (
            <G key={i}>
              <Path d={`M${R} ${y - h} L${R + dx} ${y - h - dy} L${R + dx} ${y - dy} L${R} ${y} Z`} fill="#1C1C22" />
              <Path d={`M${L} ${y - h} L${L + dx} ${y - h - dy} L${R + dx} ${y - h - dy} L${R} ${y - h} Z`} fill="#5A5A66" />
              <Rect x={L} y={y - h} width={R - L} height={h} fill={`url(#c${uid})`} />
              <Rect x={L} y={y - h + 3} width={R - L} height={1.5} fill={color.accent} opacity={0.6} />
              <Rect x={46} y={y - h} width={5} height={h} fill="#6E6E7A" opacity={0.8} />
            </G>
          );
        })}
      </Svg>
    </View>
  );
}
