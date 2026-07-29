/**
 * `DELETE /api/items/<id>` - the app's one write endpoint.
 *
 * Gated to loopback requests. This is a local-first single-user tool, so the
 * endpoint has no authentication and is never meant to be reachable from anywhere
 * but the machine running it. Without the check, `next build && next start` on a
 * box with an open port would expose an unauthenticated endpoint that deletes
 * design work, which is not a tradeoff worth making for a convenience button.
 *
 * The guard is deliberately about *where the request came from* rather than
 * `NODE_ENV`, because a production build served on localhost is a perfectly normal
 * way to run this app and should keep working.
 */
import { NextResponse } from 'next/server';
import { deleteItem } from '@/lib/mutate';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

function isLoopback(request: Request): boolean {
  const host = request.headers.get('host');
  if (host === null) return false;
  // Strip the port: `localhost:3000` -> `localhost`. An IPv6 literal keeps its
  // brackets, which is why `[::1]` is in the set above.
  const hostname = host.startsWith('[')
    ? host.slice(0, host.indexOf(']') + 1)
    : (host.split(':')[0] ?? '');
  return LOOPBACK_HOSTS.has(hostname);
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (!isLoopback(request)) {
    return NextResponse.json(
      { problem: 'deletion is only available to the machine running the library' },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const result = await deleteItem(id);

  if (!result.ok) {
    return NextResponse.json({ problem: result.problem }, { status: result.status });
  }
  return NextResponse.json(result.deleted, { status: 200 });
}
