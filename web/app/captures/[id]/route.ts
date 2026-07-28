/**
 * Serves a Capture PNG out of the library folder.
 *
 * Captures live in `library/captures/`, outside `web/public`, because the
 * library is one portable folder (006) and the app must not require copying its
 * bytes into the build. This route streams them read-only. It is the only way
 * the browser reaches a Capture.
 */
import { readFile } from 'node:fs/promises';
import { captureFile } from '@/lib/library';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const path = await captureFile(id);
  if (!path) {
    return new Response('Not found', { status: 404 });
  }
  const bytes = await readFile(path);
  return new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': 'image/png',
      // Captures are immutable once written (001), so cache them hard.
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
