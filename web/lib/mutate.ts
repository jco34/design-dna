/**
 * The only file in the web app that writes to the library. Server-only.
 *
 * Its existence is a deliberate revision to ADR 0002, recorded in
 * [ADR 0003](../../docs/adr/0003-deletion-from-the-app.md). The short version:
 * ticket 008 removed writing from the app because *ingest* needs a headless
 * browser, an agent, tens of seconds and therefore an async job model with a
 * waiting state. Deletion needs none of that. It is two `unlink` calls, it is
 * synchronous, and it cannot half-succeed in a way that leaves an invalid record.
 *
 * `library.ts` stays a pure reader and its docstring stays true. Everything that
 * writes is here, in one file, named for what it does, so "does the app write?" has
 * a one-file answer rather than a grep.
 *
 * Deletion is the *only* mutation this module will ever hold. Adding an Item still
 * belongs to `dna add`, for exactly the reasons 008 gave.
 */
import 'server-only';
import { unlink, readFile } from 'node:fs/promises';
import { join, resolve, basename } from 'node:path';
import { Item } from '@schema';
import { libraryDir } from './library';

/** The id alphabet `dna check` rule 12 enforces. Also the path-traversal gate. */
const PORTABLE_ID = /^[0-9A-Za-z-]+$/;

export type DeleteResult =
  | { ok: true; deleted: { item: string; capture: string | null } }
  | { ok: false; status: number; problem: string };

/**
 * Remove an Item and its Capture.
 *
 * The id arrives from a URL segment and is about to be interpolated into a
 * filesystem path, which is the classic shape of a path-traversal bug. Two
 * independent defences, because one of them being subtly wrong is survivable and
 * both being wrong is not:
 *
 *   1. the id must match the portable-id alphabet, which excludes `.`, `/` and `\`
 *      and therefore cannot express `..` at all
 *   2. every resolved path is checked to still be inside the library directory it
 *      is supposed to be in, so even a novel bypass of (1) lands nowhere
 *
 * The Capture filename is read from the record rather than assumed to be
 * `<id>.png`. Assuming would be right for every Item the CLI has ever written and
 * wrong for a hand-written one that named its Capture differently, and the failure
 * mode of guessing is an orphaned PNG that nothing references.
 */
export async function deleteItem(id: string): Promise<DeleteResult> {
  if (!PORTABLE_ID.test(id)) {
    return { ok: false, status: 400, problem: 'that is not a valid Item id' };
  }

  const root = libraryDir();
  const itemsDir = join(root, 'items');
  const capturesDir = join(root, 'captures');

  const itemPath = resolve(itemsDir, `${id}.json`);
  if (!itemPath.startsWith(resolve(itemsDir))) {
    return { ok: false, status: 400, problem: 'that id resolves outside the library' };
  }

  let record: unknown;
  try {
    record = JSON.parse(await readFile(itemPath, 'utf8'));
  } catch {
    return { ok: false, status: 404, problem: 'no Item with that id' };
  }

  // Parsed rather than trusted, so a malformed record cannot talk this into
  // unlinking something that is not its own Capture.
  const parsed = Item.safeParse(record);
  const captureName = parsed.success ? basename(parsed.data.capture.file) : null;

  let capturePath: string | null = null;
  if (captureName !== null) {
    const candidate = resolve(capturesDir, captureName);
    if (candidate.startsWith(resolve(capturesDir))) capturePath = candidate;
  }

  // The Capture goes first. If the process dies between the two unlinks, the
  // residue is an Item pointing at a missing Capture, which `dna check` names
  // loudly. The other order would leave an orphaned PNG, which is quieter and
  // therefore easier to never notice.
  if (capturePath !== null) {
    await unlink(capturePath).catch(() => {
      // A Capture that was already gone is not a reason to keep the Item.
    });
  }

  try {
    await unlink(itemPath);
  } catch (error) {
    return {
      ok: false,
      status: 500,
      problem: `could not delete the Item: ${(error as Error).message}`,
    };
  }

  return {
    ok: true,
    deleted: { item: `${id}.json`, capture: captureName },
  };
}
