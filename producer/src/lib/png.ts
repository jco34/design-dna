/**
 * Reading a PNG's real dimensions off its header.
 *
 * `dna validate` rule 7 checks that `capture.pixelWidth` and `pixelHeight` agree
 * with the file on disk. That check is what catches a Capture that has been
 * replaced or corrupted since it was recorded, and it has to read the actual
 * bytes rather than trust the record it is checking.
 *
 * No image library for this. The IHDR chunk is at a fixed offset in every valid
 * PNG, so 24 bytes and two big-endian reads answer the question, and a dependency
 * that decodes the whole image to report two integers would be a worse version of
 * the same thing.
 */
import { open } from 'node:fs/promises';

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export interface PngSize {
  readonly width: number;
  readonly height: number;
}

/**
 * The layout this relies on, from the PNG specification:
 *
 *   bytes 0-7    signature, always the same eight bytes
 *   bytes 8-11   length of the first chunk
 *   bytes 12-15  chunk type, which must be "IHDR" for a valid PNG
 *   bytes 16-19  width, big-endian uint32
 *   bytes 20-23  height, big-endian uint32
 *
 * IHDR is required by the spec to be the first chunk, so the offsets are fixed
 * rather than needing a chunk walk.
 */
export async function readPngSize(file: string): Promise<PngSize> {
  const handle = await open(file, 'r');
  try {
    const header = Buffer.alloc(24);
    const { bytesRead } = await handle.read(header, 0, 24, 0);
    if (bytesRead < 24) throw new Error('file is too short to be a PNG');
    if (!header.subarray(0, 8).equals(SIGNATURE)) throw new Error('not a PNG (bad signature)');
    if (header.subarray(12, 16).toString('ascii') !== 'IHDR') {
      throw new Error('not a PNG (first chunk is not IHDR)');
    }
    const width = header.readUInt32BE(16);
    const height = header.readUInt32BE(20);
    if (width === 0 || height === 0) throw new Error('PNG reports a zero dimension');
    return { width, height };
  } finally {
    await handle.close();
  }
}

export const isPng = async (file: string): Promise<boolean> => {
  try {
    await readPngSize(file);
    return true;
  } catch {
    return false;
  }
};

/** What `add` will accept as a file target. The stored Capture is always PNG. */
export const ACCEPTED_INPUT_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'] as const;

export const isAcceptedImage = (file: string): boolean =>
  ACCEPTED_INPUT_EXTENSIONS.some((ext) => file.toLowerCase().endsWith(ext));
