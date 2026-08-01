import React from 'react';
import { View } from 'react-native';
import Svg, {
  Defs,
  Ellipse,
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
// Crate and FILM artwork, drawn rather than fetched.
//
// The store was a wall of text with a price on the end of it, which is a
// reasonable description of a product and a terrible advertisement for one.
// This draws the boxes as what they are in the fiction: sealed film canisters
// with light escaping from under the lid, framed by the same corner brackets
// the wordmark uses.
//
// **Vector, not bitmap, and that is the point.** These render at any size with
// no asset pipeline, no download, and no placeholder period, so the store stops
// looking unfinished today rather than after art lands. When the Nano Banana
// renders arrive (marketing/LOOTBOX-IMAGE-PROMPT.md) they can replace these
// per box, one at a time, because every crate reads its look from TIERS below
// rather than from a hardcoded drawing.
// ---------------------------------------------------------------------------

interface CrateLook {
  /** Body of the canister. */
  body: string;
  bodyLow: string;
  /** The light escaping the seam. Brighter means rarer. */
  glow: string;
  /** How much light bleeds out, 0..1. */
  bleed: number;
  /** A locking ring on the lid, for the top tier. */
  ring?: boolean;
  /** Film strip wrapped round the body. */
  strip?: boolean;
  /** Lid lifted, light cutting upward. Only the paid case. */
  open?: boolean;
}

const TIERS: Record<string, CrateLook> = {
  'box-tray': { body: '#4A4A52', bodyLow: '#2A2A30', glow: color.accentDim, bleed: 0.25 },
  'box-contact': { body: '#55555E', bodyLow: '#2E2E35', glow: color.accent, bleed: 0.4, strip: true },
  'box-silver': { body: '#8A8A94', bodyLow: '#45454E', glow: color.accent, bleed: 0.6 },
  'box-vault': { body: '#26262C', bodyLow: '#141418', glow: '#EFFFA8', bleed: 0.9, ring: true },
  'box-first-light': { body: '#3A3A42', bodyLow: '#1E1E24', glow: '#FFFFFF', bleed: 1, open: true },
};

const FALLBACK: CrateLook = TIERS['box-tray'];

export function CrateArt({ id, size = 96 }: { id: string; size?: number }) {
  const look = TIERS[id] ?? FALLBACK;
  const w = size;
  const h = size;
  const uid = id.replace(/[^a-z]/g, '');

  // Canister geometry, in a 100x100 viewBox.
  const bodyTop = look.open ? 42 : 36;
  const bodyBottom = 82;

  return (
    <View style={{ width: w, height: h }}>
      <Svg width={w} height={h} viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id={`body${uid}`} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={look.bodyLow} />
            <Stop offset="0.35" stopColor={look.body} />
            <Stop offset="0.62" stopColor={look.body} />
            <Stop offset="1" stopColor={look.bodyLow} />
          </LinearGradient>
          <RadialGradient id={`halo${uid}`} cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor={look.glow} stopOpacity={0.55 * look.bleed} />
            <Stop offset="1" stopColor={look.glow} stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* The light escaping, drawn first so the metal sits on top of it. */}
        <Ellipse cx="50" cy={bodyTop} rx="46" ry="20" fill={`url(#halo${uid})`} />

        {/* A blade of light out of a lifted lid. Only the paid case opens, and
            it is the only box that should look like it is already giving
            something up. */}
        {look.open && (
          <>
            <Path
              d="M34 40 L50 6 L66 40 Z"
              fill={look.glow}
              opacity={0.22}
            />
            <Line x1="50" y1="38" x2="50" y2="10" stroke={look.glow} strokeWidth="2" opacity={0.7} />
          </>
        )}

        {/* Lid */}
        <Ellipse
          cx="50"
          cy={look.open ? 30 : bodyTop}
          rx="30"
          ry="8"
          fill={look.bodyLow}
          stroke={look.body}
          strokeWidth="1.5"
        />
        {look.ring && (
          <Ellipse
            cx="50"
            cy={bodyTop}
            rx="15"
            ry="4"
            fill="none"
            stroke={look.glow}
            strokeWidth="1.5"
            opacity={0.8}
          />
        )}

        {/* Body */}
        <Path
          d={`M20 ${bodyTop} L20 ${bodyBottom - 8} Q20 ${bodyBottom} 30 ${bodyBottom} L70 ${bodyBottom} Q80 ${bodyBottom} 80 ${bodyBottom - 8} L80 ${bodyTop} Z`}
          fill={`url(#body${uid})`}
        />

        {/* The seam under the lid: the light the canister is holding in. */}
        <Rect
          x="20"
          y={bodyTop - 1}
          width="60"
          height="2.5"
          fill={look.glow}
          opacity={0.35 + 0.65 * look.bleed}
        />

        {/* A wrapped strip of exposed negative, sprocket holes catching light. */}
        {look.strip && (
          <G opacity={0.85}>
            <Rect x="20" y={bodyTop + 14} width="60" height="13" fill="#15151A" />
            {[24, 32, 40, 48, 56, 64, 72].map((x) => (
              <Rect key={x} x={x} y={bodyTop + 16} width="3" height="3" fill={look.glow} opacity={0.5} />
            ))}
          </G>
        )}

        {/* Blank label band, no legible text: image models get type wrong and
            it would have to be localised anyway. */}
        <Rect x="20" y={bodyTop + 30} width="60" height="10" fill="#0F0F13" opacity={0.55} />

        {/* The viewfinder brackets, the one motif every surface shares. */}
        <G stroke={color.accent} strokeWidth="2.5" fill="none" strokeLinecap="square">
          <Path d="M6 20 L6 8 L18 8" />
          <Path d="M94 20 L94 8 L82 8" />
          <Path d="M6 80 L6 92 L18 92" />
          <Path d="M94 80 L94 92 L82 92" />
        </G>
      </Svg>
    </View>
  );
}

/**
 * A stack of canisters for the FILM packs, growing with the size of the pack.
 *
 * The packs were four identical tiny icons with different numbers under them,
 * so the only thing distinguishing the $9.99 from the $0.99 was the digits.
 * Making the pile physically bigger is the oldest trick in this particular book
 * and it works because it is honest: there really is more in it.
 */
export function FilmStack({ count, size = 64 }: { count: number; size?: number }) {
  const n = Math.max(1, Math.min(4, count));
  const uid = `s${n}`;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id={`can${uid}`} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#2A2A30" />
            <Stop offset="0.4" stopColor="#5A5A64" />
            <Stop offset="1" stopColor="#2A2A30" />
          </LinearGradient>
        </Defs>
        {Array.from({ length: n }).map((_, i) => {
          const y = 74 - i * 15;
          return (
            <G key={i}>
              <Rect x={26} y={y - 12} width={48} height={13} fill={`url(#can${uid})`} />
              <Ellipse cx={50} cy={y - 12} rx={24} ry={5} fill="#6A6A76" />
              <Ellipse cx={50} cy={y + 1} rx={24} ry={5} fill="#1C1C22" />
              <Rect x={26} y={y - 7} width={48} height={1.5} fill={color.accent} opacity={0.55} />
            </G>
          );
        })}
      </Svg>
    </View>
  );
}
