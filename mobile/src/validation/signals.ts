/**
 * PRD 4.5 image validity signals.
 *
 * Every check here operates on whole-image statistics. There is no face
 * detection, no person detection, no pose estimation, and nothing capable of
 * producing a persistent identifier for a human being. That is a legal
 * constraint under BIPA, not a preference, and it is the reason this file
 * deals only in luminance histograms and gradients.
 *
 * Thresholds live in DEFAULT_THRESHOLDS but are meant to be served from the
 * backend so they can move without an app release (PRD 4.5). The values below
 * are deliberately permissive placeholders: a false elimination is far worse
 * for retention than a successful cheat, and the real numbers have to come
 * from the calibration set, not from guesses.
 */

export interface Thresholds {
  /** Variance of Laplacian. Below this the image is smeared or out of focus. */
  blurMin: number;
  /** Mean luminance floor. PRD 4.5 fixes this at 15/255. */
  darkMax: number;
  /** Mean luminance ceiling. PRD 4.5 fixes this at 240/255. */
  brightMin: number;
  /** Shannon entropy of the luminance histogram, in bits (0..8). */
  entropyMin: number;
  /** Fraction of pixels that are edges, via Sobel. */
  edgeDensityMin: number;
  /** Hamming distance below which two pHashes count as the same image. */
  phashMinDistance: number;
}

export const DEFAULT_THRESHOLDS: Thresholds = {
  blurMin: 40,
  darkMax: 15,
  brightMin: 240,
  entropyMin: 3.2,
  edgeDensityMin: 0.012,
  phashMinDistance: 6,
};

export interface Signals {
  meanLuminance: number;
  blurVariance: number;
  entropy: number;
  edgeDensity: number;
  phash: bigint;
}

export type FailureCode =
  | 'too_dark'
  | 'too_bright'
  | 'blurred'
  | 'uniform_surface'
  | 'low_detail'
  | 'reused_image'
  | 'stale_capture';

export interface Verdict {
  pass: boolean;
  failures: FailureCode[];
  signals: Signals;
  /** Plain-language, per PRD 4.4: tell the player what to actually do. */
  message: string | null;
}

// ---------------------------------------------------------------------------
// pixel helpers
// ---------------------------------------------------------------------------

/** Rec. 601 luma. Matches what human vision weights, unlike a flat average. */
export function toGrayscale(rgba: Uint8Array | Uint8ClampedArray, w: number, h: number) {
  const out = new Uint8Array(w * h);
  for (let i = 0, p = 0; i < out.length; i++, p += 4) {
    out[i] = (rgba[p] * 299 + rgba[p + 1] * 587 + rgba[p + 2] * 114) / 1000;
  }
  return out;
}

export function meanLuminance(gray: Uint8Array) {
  let sum = 0;
  for (let i = 0; i < gray.length; i++) sum += gray[i];
  return sum / gray.length;
}

/**
 * Variance of the Laplacian. A sharp image has strong second derivatives in
 * many places; a smeared or defocused one does not.
 */
export function laplacianVariance(gray: Uint8Array, w: number, h: number) {
  const vals: number[] = [];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      vals.push(
        -4 * gray[i] + gray[i - 1] + gray[i + 1] + gray[i - w] + gray[i + w],
      );
    }
  }
  if (!vals.length) return 0;
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  return vals.reduce((a, v) => a + (v - mean) ** 2, 0) / vals.length;
}

/**
 * Shannon entropy of the luminance histogram, in bits. A thumb over the lens,
 * a pocket, or a blank wall all collapse to a handful of levels and score low.
 */
export function shannonEntropy(gray: Uint8Array) {
  const hist = new Uint32Array(256);
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++;
  const n = gray.length;
  let e = 0;
  for (let i = 0; i < 256; i++) {
    if (!hist[i]) continue;
    const p = hist[i] / n;
    e -= p * Math.log2(p);
  }
  return e;
}

/** Fraction of pixels whose Sobel gradient magnitude clears `threshold`. */
export function edgeDensity(gray: Uint8Array, w: number, h: number, threshold = 60) {
  let edges = 0;
  let counted = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx =
        -gray[i - w - 1] + gray[i - w + 1] +
        -2 * gray[i - 1] + 2 * gray[i + 1] +
        -gray[i + w - 1] + gray[i + w + 1];
      const gy =
        -gray[i - w - 1] - 2 * gray[i - w] - gray[i - w + 1] +
        gray[i + w - 1] + 2 * gray[i + w] + gray[i + w + 1];
      if (Math.hypot(gx, gy) >= threshold) edges++;
      counted++;
    }
  }
  return counted ? edges / counted : 0;
}

// ---------------------------------------------------------------------------
// perceptual hash
// ---------------------------------------------------------------------------

function bilinearResize(gray: Uint8Array, w: number, h: number, size: number) {
  const out = new Float64Array(size * size);
  for (let y = 0; y < size; y++) {
    const sy = ((y + 0.5) * h) / size - 0.5;
    const y0 = Math.max(0, Math.min(h - 1, Math.floor(sy)));
    const y1 = Math.min(h - 1, y0 + 1);
    const fy = sy - y0;
    for (let x = 0; x < size; x++) {
      const sx = ((x + 0.5) * w) / size - 0.5;
      const x0 = Math.max(0, Math.min(w - 1, Math.floor(sx)));
      const x1 = Math.min(w - 1, x0 + 1);
      const fx = sx - x0;
      const a = gray[y0 * w + x0] * (1 - fx) + gray[y0 * w + x1] * fx;
      const b = gray[y1 * w + x0] * (1 - fx) + gray[y1 * w + x1] * fx;
      out[y * size + x] = a * (1 - fy) + b * fy;
    }
  }
  return out;
}

/** Separable DCT-II over a square matrix. */
function dct2(input: Float64Array, n: number) {
  const tmp = new Float64Array(n * n);
  const out = new Float64Array(n * n);
  const cos: number[][] = [];
  for (let u = 0; u < n; u++) {
    cos[u] = [];
    for (let x = 0; x < n; x++) cos[u][x] = Math.cos(((2 * x + 1) * u * Math.PI) / (2 * n));
  }
  for (let y = 0; y < n; y++)
    for (let u = 0; u < n; u++) {
      let s = 0;
      for (let x = 0; x < n; x++) s += input[y * n + x] * cos[u][x];
      tmp[y * n + u] = s;
    }
  for (let u = 0; u < n; u++)
    for (let v = 0; v < n; v++) {
      let s = 0;
      for (let y = 0; y < n; y++) s += tmp[y * n + u] * cos[v][y];
      out[v * n + u] = s;
    }
  return out;
}

/**
 * 64-bit pHash: 32x32 grayscale, DCT, keep the low-frequency 8x8 corner minus
 * the DC term, threshold against the median. Survives rescaling and JPEG
 * recompression, which is the point, since a cheat is usually a re-sent file.
 */
export function pHash(gray: Uint8Array, w: number, h: number): bigint {
  const N = 32;
  const small = bilinearResize(gray, w, h, N);
  const d = dct2(small, N);

  const coeffs: number[] = [];
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) {
      if (x === 0 && y === 0) continue; // DC carries overall brightness only
      coeffs.push(d[y * N + x]);
    }
  const sorted = [...coeffs].sort((a, b) => a - b);
  const median = (sorted[31] + sorted[32]) / 2;

  let bits = 0n;
  bits |= 1n; // keep bit 63 stable so the value is always 64 bits wide
  for (let i = 0; i < 63; i++) {
    bits = (bits << 1n) | (coeffs[i] > median ? 1n : 0n);
  }
  return bits;
}

export function hamming(a: bigint, b: bigint) {
  let x = a ^ b;
  let n = 0;
  while (x) {
    x &= x - 1n;
    n++;
  }
  return n;
}

// ---------------------------------------------------------------------------
// the validator
// ---------------------------------------------------------------------------

export function computeSignals(gray: Uint8Array, w: number, h: number): Signals {
  return {
    meanLuminance: meanLuminance(gray),
    blurVariance: laplacianVariance(gray, w, h),
    entropy: shannonEntropy(gray),
    edgeDensity: edgeDensity(gray, w, h),
    phash: pHash(gray, w, h),
  };
}

const MESSAGES: Record<FailureCode, string> = {
  too_dark: 'That came out almost black. Is the lens covered?',
  too_bright: 'That is blown out. Try pointing away from the light.',
  blurred: 'Too blurry. Hold still for a second and take it again.',
  uniform_surface: 'That is a flat surface. Show a bit more of where you are.',
  low_detail: 'Not enough detail to tell where that is. Try again.',
  reused_image: 'That is the same shot as a previous check-in. Take a new one.',
  stale_capture: 'That photo was taken outside the check-in window.',
};

export function validate(
  gray: Uint8Array,
  w: number,
  h: number,
  opts: {
    thresholds?: Thresholds;
    /** pHashes from this player's recent submissions this round. */
    recentHashes?: bigint[];
    /** Capture time vs the server window, both epoch ms. */
    capturedAt?: number;
    windowOpen?: number;
    windowClose?: number;
  } = {},
): Verdict {
  const t = opts.thresholds ?? DEFAULT_THRESHOLDS;
  const signals = computeSignals(gray, w, h);
  const failures: FailureCode[] = [];

  if (signals.meanLuminance < t.darkMax) failures.push('too_dark');
  if (signals.meanLuminance > t.brightMin) failures.push('too_bright');
  if (signals.blurVariance < t.blurMin) failures.push('blurred');
  if (signals.entropy < t.entropyMin) failures.push('uniform_surface');
  if (signals.edgeDensity < t.edgeDensityMin) failures.push('low_detail');

  for (const prev of opts.recentHashes ?? []) {
    if (hamming(signals.phash, prev) < t.phashMinDistance) {
      failures.push('reused_image');
      break;
    }
  }

  if (
    opts.capturedAt !== undefined &&
    opts.windowOpen !== undefined &&
    opts.windowClose !== undefined &&
    (opts.capturedAt < opts.windowOpen || opts.capturedAt > opts.windowClose)
  ) {
    failures.push('stale_capture');
  }

  return {
    pass: failures.length === 0,
    failures,
    signals,
    message: failures.length ? MESSAGES[failures[0]] : null,
  };
}
