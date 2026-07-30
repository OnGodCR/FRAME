import * as ImageManipulator from 'expo-image-manipulator';
import jpeg from 'jpeg-js';
import { toGrayscale, validate, type Verdict } from './signals';

// ---------------------------------------------------------------------------
// Real pixels, from a real capture.
//
// PRD 4.5 is whole-image statistics only, so the pipeline is deliberately dumb:
// downscale, decode to RGBA, flatten to grayscale, compute signals. There is no
// model anywhere in here and there must never be one.
//
// The client runs this for instant feedback. **The server re-runs it as the
// authority** (PRD 9: never trust a client-reported pass). Nothing here is a
// verdict, it is a preview of one.
// ---------------------------------------------------------------------------

/**
 * Longest edge of the analysed image, in pixels.
 *
 * A full 12 MP frame is roughly 36 MB of RGBA and would take seconds to decode
 * in JS, which is unusable inside a 60 second window. 256 px keeps the decode
 * around a few hundred milliseconds while preserving what the signals actually
 * measure: blur, exposure, entropy, and edge density are all scale-tolerant.
 *
 * The pHash is computed on a 32x32 DCT anyway, so downscaling costs it nothing.
 */
const ANALYSIS_EDGE = 256;

/** Decodes standard base64 without depending on Buffer or atob. */
export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/^data:[^,]+,/, '').replace(/[^A-Za-z0-9+/=]/g, '');
  const lookup = new Uint8Array(256);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;

  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  const byteLength = (clean.length / 4) * 3 - padding;
  const bytes = new Uint8Array(byteLength);

  let p = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const e1 = lookup[clean.charCodeAt(i)];
    const e2 = lookup[clean.charCodeAt(i + 1)];
    const e3 = lookup[clean.charCodeAt(i + 2)];
    const e4 = lookup[clean.charCodeAt(i + 3)];
    if (p < byteLength) bytes[p++] = (e1 << 2) | (e2 >> 4);
    if (p < byteLength) bytes[p++] = ((e2 & 15) << 4) | (e3 >> 2);
    if (p < byteLength) bytes[p++] = ((e3 & 3) << 6) | e4;
  }
  return bytes;
}

export interface CaptureCheckOptions {
  /** pHashes from this player's recent submissions this round. */
  recentHashes?: bigint[];
  capturedAt?: number;
  windowOpen?: number;
  windowClose?: number;
}

/**
 * The whole client-side check: downscale, decode, and run PRD 4.5 against real
 * pixels. Returns the same Verdict shape the server will produce.
 *
 * Takes a file URI rather than the original base64 because the manipulator
 * needs to resize before we decode: decoding first would mean holding the full
 * resolution frame in memory, which is the thing we are avoiding.
 *
 * Throws on a corrupt or undecodable frame. Callers treat that as a failed
 * capture rather than a passed one, because the safe default when we cannot
 * see the image is not to accept it.
 */
export async function checkCapture(
  uri: string,
  opts: CaptureCheckOptions = {},
): Promise<Verdict> {
  // JPEG out, because jpeg-js is the decoder and a PNG round trip would be
  // larger and slower for no gain at this size.
  const context = ImageManipulator.ImageManipulator.manipulate(uri);
  context.resize({ width: ANALYSIS_EDGE });
  const image = await context.renderAsync();
  const result = await image.saveAsync({
    base64: true,
    compress: 0.9,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  if (!result.base64) throw new Error('resize produced no data');

  const raw = jpeg.decode(base64ToBytes(result.base64), { useTArray: true });
  if (!raw?.data?.length) throw new Error('jpeg decode failed');

  // jpeg-js emits RGBA, which is what toGrayscale expects.
  const gray = toGrayscale(raw.data, raw.width, raw.height);
  return validate(gray, raw.width, raw.height, opts);
}
