/**
 * Validator checks against synthetic images with known properties.
 * Run: node mobile/src/validation/signals.test.mjs
 *
 * These prove the maths is right. They do NOT prove the thresholds are right:
 * those have to come from the calibration photo set, and until it exists the
 * defaults are placeholders.
 */
import {
  toGrayscale, meanLuminance, laplacianVariance, shannonEntropy,
  edgeDensity, pHash, hamming, validate, DEFAULT_THRESHOLDS,
} from './signals.ts';

const W = 96, H = 96;
let pass = 0, fail = 0;

const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}  ${detail}`); }
};

// --- image generators -------------------------------------------------------

const flat = (v) => { const g = new Uint8Array(W * H); g.fill(v); return g; };

const noise = (seed = 1) => {
  const g = new Uint8Array(W * H);
  let s = seed;
  for (let i = 0; i < g.length; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; g[i] = (s >>> 15) & 255; }
  return g;
};

const halves = () => {
  const g = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) g[y * W + x] = x < W / 2 ? 20 : 230;
  return g;
};

const checker = (cell = 8) => {
  const g = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
    g[y * W + x] = ((x / cell | 0) + (y / cell | 0)) % 2 ? 210 : 40;
  return g;
};

/** Plausible stand-in for a real scene: structure plus texture. */
const scene = (seed = 7) => {
  const g = new Uint8Array(W * H);
  let s = seed;
  const fx = 4 + (seed % 5) * 2.5;        // structure varies with the seed,
  const fy = 6 + (seed % 7) * 1.7;        // otherwise every scene hashes alike
  const tilt = (seed % 3) - 1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const structure =
      110 + 55 * Math.sin(x / fx + seed) * Math.cos(y / fy) + tilt * (x - y) * 0.4;
    g[y * W + x] = Math.max(0, Math.min(255, structure + (((s >>> 15) & 31) - 16)));
  }
  return g;
};

const shift = (g, dx) => {
  const o = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
    o[y * W + x] = g[y * W + Math.min(W - 1, Math.max(0, x + dx))];
  return o;
};

console.log('\ngrayscale + luminance');
{
  const rgba = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i++) { rgba[i*4] = 255; rgba[i*4+1] = 255; rgba[i*4+2] = 255; rgba[i*4+3] = 255; }
  const g = toGrayscale(rgba, W, H);
  ok('white rgba -> ~255 luma', Math.abs(meanLuminance(g) - 255) < 1.5, meanLuminance(g).toFixed(1));
  ok('flat 10 reads as dark', meanLuminance(flat(10)) < DEFAULT_THRESHOLDS.darkMax);
  ok('flat 250 reads as bright', meanLuminance(flat(250)) > DEFAULT_THRESHOLDS.brightMin);
}

console.log('\nblur, variance of Laplacian');
{
  const flatVar = laplacianVariance(flat(128), W, H);
  const noiseVar = laplacianVariance(noise(), W, H);
  ok('flat has ~zero variance', flatVar < 1, flatVar.toFixed(3));
  ok('noise has high variance', noiseVar > 1000, noiseVar.toFixed(0));
  ok('noise >> flat', noiseVar > flatVar * 1000);
}

console.log('\nentropy');
{
  const eFlat = shannonEntropy(flat(128));
  const eHalves = shannonEntropy(halves());
  const eNoise = shannonEntropy(noise());
  ok('single value -> 0 bits', eFlat === 0, eFlat.toFixed(3));
  ok('two values -> ~1 bit', Math.abs(eHalves - 1) < 0.01, eHalves.toFixed(3));
  ok('uniform noise -> ~8 bits', eNoise > 7.9, eNoise.toFixed(3));
  ok('flat fails the uniform check', eFlat < DEFAULT_THRESHOLDS.entropyMin);
}

console.log('\nedge density');
{
  const dFlat = edgeDensity(flat(128), W, H);
  const dCheck = edgeDensity(checker(), W, H);
  ok('flat has no edges', dFlat === 0, String(dFlat));
  ok('checkerboard is mostly edges', dCheck > 0.15, dCheck.toFixed(3));
  ok('flat fails low-detail', dFlat < DEFAULT_THRESHOLDS.edgeDensityMin);
}

console.log('\nperceptual hash');
{
  const a = scene(7);
  const h1 = pHash(a, W, H);
  ok('hash is 64 bits', h1.toString(2).length === 64, String(h1.toString(2).length));
  ok('identical image -> distance 0', hamming(h1, pHash(a, W, H)) === 0);

  // The invariances pHash actually promises: it excludes the DC term and
  // thresholds against the median, so overall exposure should not move it,
  // and mild sensor noise should barely move it.
  const brighter = a.map((v) => Math.min(255, v + 30));
  const dBright = hamming(h1, pHash(Uint8Array.from(brighter), W, H));
  ok('exposure shift barely moves the hash', dBright <= 2, `d=${dBright}`);

  const grainy = a.map((v, i) => Math.max(0, Math.min(255, v + ((i * 2654435761) % 11) - 5)));
  const dGrain = hamming(h1, pHash(Uint8Array.from(grainy), W, H));
  ok('mild grain barely moves the hash', dGrain <= 4, `d=${dGrain}`);

  const dOther = hamming(h1, pHash(scene(999), W, H));
  ok('different scene clears the threshold', dOther >= DEFAULT_THRESHOLDS.phashMinDistance, `d=${dOther}`);
  ok('different scene > exposure shift', dOther > dBright, `${dOther} vs ${dBright}`);

  // Deliberately NOT asserted: how far the hash moves when a player stands in
  // one spot and drifts slightly between check-ins. A synthetic sine shifted
  // by a pixel changes phase and flips most coefficients, which tells us
  // nothing about a real photograph. That number decides whether honest
  // players get eliminated for not moving, and it has to come from the
  // repeat/ series in the calibration set.
}

console.log('\nend to end');
{
  const good = validate(scene(7), W, H);
  ok('a textured scene passes', good.pass, good.failures.join(','));

  const dark = validate(flat(5), W, H);
  ok('black frame fails', !dark.pass && dark.failures.includes('too_dark'));
  ok('  and says something useful', /lens covered/i.test(dark.message ?? ''));

  const wall = validate(flat(128), W, H);
  ok('blank wall fails on multiple signals', wall.failures.length >= 3, wall.failures.join(','));

  const a = scene(7);
  const reuse = validate(a, W, H, { recentHashes: [pHash(a, W, H)] });
  ok('resubmitting the same shot fails', reuse.failures.includes('reused_image'));

  const stale = validate(scene(7), W, H, { capturedAt: 1000, windowOpen: 5000, windowClose: 9000 });
  ok('capture outside the window fails', stale.failures.includes('stale_capture'));

  const inWindow = validate(scene(7), W, H, { capturedAt: 6000, windowOpen: 5000, windowClose: 9000 });
  ok('capture inside the window passes', inWindow.pass, inWindow.failures.join(','));
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
