// Renders every icon asset Expo needs from one vector source.
// Run: node brand/build-icons.mjs
import sharp from 'sharp';
import { writeFileSync, mkdirSync } from 'fs';

const A = '#C8FF2E';
const BG = '#0A0A0C';
const OUT = 'mobile/assets/';
mkdirSync(OUT, { recursive: true });

const BRACKETS = (stroke) => `
  <g stroke="${stroke}" stroke-width="56" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M104,420 L104,104 L420,104"/>
    <path d="M604,104 L920,104 L920,420"/>
    <path d="M920,604 L920,920 L604,920"/>
    <path d="M420,920 L104,920 L104,604"/>
  </g>`;
const DROP = (fill) =>
  `<path fill="${fill}" d="M838,257 L693.2,686.8 A225,225 0 1 1 408.2,401.8 Z"/>`;

/** @param opts.bg null for transparent. @param opts.scale shrink for safe zones. */
const svg = ({ bg = BG, tint = A, scale = 1 }) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  ${bg ? `<rect width="1024" height="1024" fill="${bg}"/>` : ''}
  <g transform="translate(512,512) scale(${scale}) translate(-512,-512)">
    ${BRACKETS(tint)}${DROP(tint)}
  </g>
</svg>`;

/**
 * iOS rejects app icons that carry an alpha channel, so anything meant to be
 * opaque is flattened rather than just drawn on a background rect.
 */
const png = (markup, file, size = 1024, opaque = false) => {
  let p = sharp(Buffer.from(markup)).resize(size, size);
  if (opaque) p = p.flatten({ background: BG });
  return p.png().toFile(OUT + file);
};

const jobs = [
  // iOS and the main icon. No transparency allowed on iOS icons.
  [svg({}), 'icon.png', 1024, true],
  // Android adaptive: foreground is masked to varying shapes, and only the
  // inner ~66% is guaranteed visible, so the mark is scaled down to clear it.
  [svg({ bg: null, scale: 0.6 }), 'android-icon-foreground.png', 1024],
  [svg({ bg: BG, tint: BG, scale: 0.6 }), 'android-icon-background.png', 1024, true],
  // Themed icons: flat silhouette, the OS recolours it.
  [svg({ bg: null, tint: '#FFFFFF', scale: 0.6 }), 'android-icon-monochrome.png', 1024],
  // Splash sits on the backgroundColor set in app.json.
  [svg({ bg: null, scale: 0.86 }), 'splash-icon.png', 1024],
  [svg({}), 'favicon.png', 96, true],
];

writeFileSync('brand/frame-glyph.svg', svg({ bg: null }).trim());

await Promise.all(jobs.map(([m, f, s, o]) => png(m, f, s, o)));
console.log('wrote ' + jobs.length + ' assets to ' + OUT);
for (const [, f] of jobs) {
  const meta = await sharp(OUT + f).metadata();
  console.log(`  ${f.padEnd(32)} ${meta.width}x${meta.height}  alpha=${!!meta.hasAlpha}`);
}
