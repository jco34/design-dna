/**
 * The library reader. Server-only.
 *
 * The app is a pure reader (ticket 006): it scans `library/` on disk, validates
 * every Item through the shared schema, and never writes. 006 measured a fully
 * validated scan of 300 Items at 31ms, so there is no index and no cache beyond
 * React's per-request memoization; the scan is simply run.
 *
 * The library location follows 006's `LIBRARY_DIR` escape hatch, defaulting to
 * the `library/` folder one level up from the web app.
 */
import 'server-only';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { cache } from 'react';
import { Item, notApplicableFor, traitState } from '@schema';
import type { Item as ItemType, TraitName, TraitState } from '@schema';

export type LibraryItem = ItemType;

export function libraryDir(): string {
  return process.env.LIBRARY_DIR
    ? resolve(process.env.LIBRARY_DIR)
    : resolve(process.cwd(), '..', 'library');
}

export type LoadReport = {
  items: LibraryItem[];
  /** Files that failed to parse or validate, surfaced rather than hidden. */
  broken: { file: string; problem: string }[];
};

async function scan(): Promise<LoadReport> {
  const itemsDir = join(libraryDir(), 'items');
  const items: LibraryItem[] = [];
  const broken: LoadReport['broken'] = [];

  let files: string[];
  try {
    files = (await readdir(itemsDir)).filter((f) => f.endsWith('.json')).sort();
  } catch {
    return { items, broken };
  }

  for (const file of files) {
    let raw: unknown;
    try {
      raw = JSON.parse(await readFile(join(itemsDir, file), 'utf8'));
    } catch (error) {
      broken.push({ file, problem: `not valid JSON: ${(error as Error).message}` });
      continue;
    }
    const parsed = Item.safeParse(raw);
    if (!parsed.success) {
      broken.push({ file, problem: parsed.error.issues[0]?.message ?? 'failed validation' });
      continue;
    }
    items.push(parsed.data);
  }

  // 009's default sort is recency: newest first by addedAt.
  items.sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  return { items, broken };
}

/** Memoized for the duration of one request, per React's `cache`. */
export const loadLibrary = cache(scan);

export const getItem = cache(async (id: string): Promise<LibraryItem | null> => {
  const { items } = await loadLibrary();
  return items.find((item) => item.id === id) ?? null;
});

/** Resolve a capture file on disk, guarding against path traversal. */
export async function captureFile(id: string): Promise<string | null> {
  if (!/^[A-Za-z0-9-]+$/.test(id)) return null;
  const path = join(libraryDir(), 'captures', `${id}.png`);
  try {
    const info = await stat(path);
    if (info.isFile() && info.size > 0) return path;
  } catch {
    /* fall through */
  }
  return null;
}

/** The seven traits in the order 007 renders them, with their read state. */
export function traitStates(item: LibraryItem): { trait: TraitName; state: TraitState }[] {
  const traits: TraitName[] = [
    'palette',
    'typography',
    'composition',
    'spacing',
    'surfaceTreatment',
    'imagery',
    'philosophy',
  ];
  return traits.map((trait) => ({ trait, state: traitState(item, trait) }));
}

export { notApplicableFor };
