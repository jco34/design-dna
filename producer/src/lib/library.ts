/**
 * The library on disk: where it is, how a record is written, and how a record is
 * written *safely*.
 *
 * Ticket 006 owns this contract. Two rules matter more than the rest:
 *
 *   Canonical form.  Two-space indent, LF, exactly one trailing newline, keys in
 *                    the declaration order of `Item`. `dna validate` rule 4
 *                    enforces it, and the reason is that the library is committed
 *                    to git: a record whose key order drifts produces a diff that
 *                    is all noise and hides the one line that actually changed.
 *
 *   Temp then rename. A crash halfway through a write must not leave a reader
 *                    looking at half a JSON document. `rename` is atomic within a
 *                    volume, so a reader sees either the old file or the new one
 *                    and never a torn one. No lock is needed: 008 decision 2
 *                    establishes there is one human-initiated writer at a time.
 */
import { readdir, readFile, writeFile, rename, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { Item, SCHEMA_VERSION } from '../../../schema/index.js';

export interface LibraryPaths {
  readonly root: string;
  readonly items: string;
  readonly captures: string;
}

/**
 * `--library`, then `$LIBRARY_DIR`, then `./library`. The flag wins so a single
 * command can target a scratch copy without touching the environment.
 */
export function resolveLibrary(explicit?: string): LibraryPaths {
  const root = path.resolve(explicit ?? process.env.LIBRARY_DIR ?? 'library');
  return {
    root,
    items: path.join(root, 'items'),
    captures: path.join(root, 'captures'),
  };
}

export async function ensureLibrary(lib: LibraryPaths): Promise<void> {
  await mkdir(lib.items, { recursive: true });
  await mkdir(lib.captures, { recursive: true });
}

/** Canonical form. The trailing newline is part of it, not an afterthought. */
export const canonical = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

/**
 * Key order, imposed rather than hoped for.
 *
 * `JSON.stringify` serialises in insertion order, so canonical form depends on
 * the object being *built* in declaration order. An Item assembled by spreading
 * an older record would serialise in whatever order that record happened to
 * have. Rebuilding both levels explicitly is what makes the output stable
 * regardless of how the input was shaped.
 */
export function canonicalise(item: Item): Item {
  return {
    schemaVersion: item.schemaVersion,
    id: item.id,
    addedAt: item.addedAt,
    source: item.source,
    capture: item.capture,
    scope: item.scope,
    taxonomyVersion: item.taxonomyVersion,
    notApplicable: item.notApplicable,
    note: item.note,
    authoredBy: item.authoredBy,
    dna: {
      palette: item.dna.palette,
      typography: item.dna.typography,
      composition: item.dna.composition,
      spacing: item.dna.spacing,
      surfaceTreatment: item.dna.surfaceTreatment,
      imagery: item.dna.imagery,
      motion: item.dna.motion,
      philosophy: item.dna.philosophy,
      labels: item.dna.labels,
    },
    build: item.build,
  };
}

export const itemPath = (lib: LibraryPaths, id: string): string =>
  path.join(lib.items, `${id}.json`);

export const capturePath = (lib: LibraryPaths, id: string): string =>
  path.join(lib.captures, `${id}.png`);

export async function listItemIds(lib: LibraryPaths): Promise<string[]> {
  try {
    return (await readdir(lib.items))
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace(/\.json$/, ''))
      .sort();
  } catch {
    return [];
  }
}

/**
 * Read and validate. Validating on read is 008 decision 3, and 006 measured it
 * free: a full scan with `Item.parse` on every Item is 31ms at 300 Items, so a
 * hand-written typo surfaces as one named broken record rather than as a silently
 * wrong one somewhere in the grid.
 */
export async function readItem(lib: LibraryPaths, id: string): Promise<Item> {
  const raw = await readFile(itemPath(lib, id), 'utf8');
  return Item.parse(JSON.parse(raw));
}

/** Read without validating, for the paths that must report *why* it is invalid. */
export async function readItemRaw(lib: LibraryPaths, id: string): Promise<unknown> {
  return JSON.parse(await readFile(itemPath(lib, id), 'utf8'));
}

/**
 * Validate, canonicalise, write to a temp file, rename over the target.
 *
 * Validation happens here rather than at the call sites because this is the last
 * place before bytes land in the library, and 006's invariant is that nothing
 * invalid is ever written - not that nothing invalid is ever *constructed*.
 */
export async function writeItem(lib: LibraryPaths, item: Item): Promise<void> {
  const validated = Item.parse(item);
  const target = itemPath(lib, validated.id);
  const temp = `${target}.tmp`;
  await writeFile(temp, canonical(canonicalise(validated)), 'utf8');
  await rename(temp, target);
}

export async function exists(target: string): Promise<boolean> {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

/** The version this build writes, for `--version` and the migration gate. */
export const WRITES_SCHEMA_VERSION = SCHEMA_VERSION;
