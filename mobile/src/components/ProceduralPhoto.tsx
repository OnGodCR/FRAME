import React, { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Rect, Ellipse, Line } from 'react-native-svg';

// Stand-in for real camera captures in the demo: seeded abstract "urban"
// compositions. Deliberately unidentifiable — no people, no faces.

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PALETTES = [
  { sky: '#232B36', mid: '#39465A', dark: '#141A22', ground: '#0F1319' },
  { sky: '#2B2A24', mid: '#4A4636', dark: '#1B1A14', ground: '#12110C' },
  { sky: '#222831', mid: '#3E4A45', dark: '#161C19', ground: '#0E1210' },
  { sky: '#2E2530', mid: '#4D3F52', dark: '#1C161E', ground: '#120E14' },
];

export function ProceduralPhoto({
  seed,
  width,
  height,
  variant = 'back',
}: {
  seed: number;
  width: number;
  height: number;
  variant?: 'back' | 'front';
}) {
  const parts = useMemo(() => {
    const rnd = mulberry32(seed);
    const pal = PALETTES[Math.floor(rnd() * PALETTES.length)];
    const horizon = height * (0.35 + rnd() * 0.25);
    const buildings: { x: number; w: number; h: number; fill: string }[] = [];
    let x = -4;
    while (x < width) {
      const w = 14 + rnd() * (width / 4);
      const h = height * (0.15 + rnd() * 0.5);
      buildings.push({ x, w, h, fill: rnd() > 0.5 ? pal.mid : pal.dark });
      x += w + 2;
    }
    const grain: { x: number; y: number; o: number }[] = [];
    for (let i = 0; i < 34; i++) {
      grain.push({ x: rnd() * width, y: rnd() * height, o: 0.03 + rnd() * 0.07 });
    }
    return { pal, horizon, buildings, grain, tilt: (rnd() - 0.5) * 8 };
  }, [seed, width, height]);

  const { pal, horizon, buildings, grain } = parts;

  return (
    <View style={{ width, height, overflow: 'hidden', backgroundColor: pal.dark }}>
      <Svg width={width} height={height}>
        <Rect x={0} y={0} width={width} height={horizon} fill={pal.sky} />
        {buildings.map((b, i) => (
          <Rect
            key={i}
            x={b.x}
            y={horizon - b.h}
            width={b.w}
            height={b.h}
            fill={b.fill}
          />
        ))}
        <Rect x={0} y={horizon} width={width} height={height - horizon} fill={pal.ground} />
        {variant === 'front' && (
          <>
            {/* abstract too-close-to-lens foreground mass; not a person shape */}
            <Ellipse
              cx={width * 0.5}
              cy={height * 1.15}
              rx={width * 0.75}
              ry={height * 0.6}
              fill={pal.dark}
              opacity={0.92}
            />
            <Ellipse
              cx={width * 0.5}
              cy={height * 1.2}
              rx={width * 0.5}
              ry={height * 0.45}
              fill="#0B0D10"
            />
          </>
        )}
        {grain.map((g, i) => (
          <Rect key={i} x={g.x} y={g.y} width={1.4} height={1.4} fill="#FFF" opacity={g.o} />
        ))}
        {/* vignette edges */}
        <Rect x={0} y={0} width={width} height={height} fill="none" />
        <Line x1={0} y1={0} x2={width} y2={0} stroke="#000" strokeWidth={6} opacity={0.25} />
        <Line
          x1={0}
          y1={height}
          x2={width}
          y2={height}
          stroke="#000"
          strokeWidth={6}
          opacity={0.25}
        />
      </Svg>
    </View>
  );
}
