/**
 * Item ids. `20260727T142233Z-k3m9qa`.
 *
 * A compact UTC instant, a hyphen, six base36 characters. Four properties, each
 * of which ruled out an alternative:
 *
 *   Sortable.  `ls library/items/` comes out in save order, which is why the
 *              timestamp leads and why it is zero-padded fixed width.
 *   Opaque.    Nothing about the source contributes. Two Items saved from the
 *              same URL get different ids, which 001 explicitly permits.
 *   Typeable.  This is why it is not a UUID. A Claude session hand-writing an
 *              entry has to be able to produce one, and 36 hex characters with
 *              hyphens in the wrong places is a transcription error waiting to
 *              happen.
 *   Portable.  `[0-9A-Za-z-]` only, so the id is safe as a filename on any
 *              filesystem and in a URL without escaping. `dna check` rule 12
 *              enforces this.
 *
 * The timestamp prefix is a sorting convenience and **nothing may parse it**. The
 * id is authoritative and opaque; `addedAt` is where the real instant lives.
 */
import { randomBytes } from 'node:crypto';

const SUFFIX_LENGTH = 6;
const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

/** `2026-07-27T14:22:33.123Z` -> `20260727T142233Z`. */
function compactInstant(now: Date): string {
  return `${now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')}`;
}

/**
 * Rejection sampling rather than `% 36`.
 *
 * 256 is not a multiple of 36, so the naive modulo would make the first four
 * letters of the alphabet slightly likelier than the rest. It would not matter at
 * this scale, and it costs one comparison to not be wrong.
 */
function randomSuffix(length: number): string {
  const limit = Math.floor(256 / ALPHABET.length) * ALPHABET.length;
  let out = '';
  while (out.length < length) {
    for (const byte of randomBytes(length * 2)) {
      if (byte >= limit) continue;
      out += ALPHABET[byte % ALPHABET.length];
      if (out.length === length) break;
    }
  }
  return out;
}

export function newId(now: Date = new Date()): string {
  return `${compactInstant(now)}-${randomSuffix(SUFFIX_LENGTH)}`;
}

/** `dna check` rule 12. Also the gate on any id arriving from an argument. */
export const isPortableId = (id: string): boolean => /^[0-9A-Za-z-]+$/.test(id);
