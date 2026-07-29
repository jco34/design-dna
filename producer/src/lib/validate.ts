/**
 * One validator, two scopes. `dna validate` runs the per-record rules; `dna check`
 * runs those over every Item plus the rules that only exist across a whole
 * library. Splitting them into two implementations would guarantee they drift, so
 * they are the same functions called with different inputs.
 *
 * This extends `schema/check-library.ts` rather than replacing it. That file
 * already implements JSON validity, `Item.parse`, stem-equals-id, capture
 * existence, orphan captures, and `notApplicable` agreeing with Scope. Added
 * here: canonical form, the absolute-path scan, the id alphabet, duplicate ids,
 * unexpected files, real PNG dimensions, and the stale-taxonomy note.
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import {
  Item,
  SCHEMA_VERSION,
  TAXONOMY_VERSION,
  notApplicableFor,
} from '../../../schema/index.js';
import { canonical, canonicalise, type LibraryPaths } from './library.js';
import { isPortableId } from './id.js';
import { readPngSize } from './png.js';

export interface Problem {
  readonly where: string;
  readonly what: string;
}

export interface Note {
  readonly what: string;
}

export interface RecordReport {
  readonly file: string;
  readonly id: string | null;
  readonly problems: readonly Problem[];
  readonly notes: readonly Note[];
  /** The capture filename this record claims, when it got far enough to have one. */
  readonly capture: string | null;
}

/* ------------------------------------------------------------------ */
/* Rule 5: no absolute path anywhere in the record                     */
/* ------------------------------------------------------------------ */

/**
 * The library must survive being copied somewhere else, which is ADR 0002's whole
 * premise: "copy it and you have moved it". An absolute path breaks that and leaks
 * the author's directory layout into a file that gets committed. `originalPath` is
 * the field that tempts this, and every existing Item stores it repo-relative.
 */
const ABSOLUTE_PATH = /^(?:[A-Za-z]:[\\/]|\\\\|\/(?:home|Users|mnt|var|tmp)\/)/;

function scanForAbsolutePaths(value: unknown, trail: string[], found: Problem[]): void {
  if (typeof value === 'string') {
    if (ABSOLUTE_PATH.test(value)) {
      found.push({
        where: trail.join('.') || '(root)',
        what: `contains an absolute path ("${value}"); the library must stay portable`,
      });
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, i) => scanForAbsolutePaths(entry, [...trail, String(i)], found));
    return;
  }
  if (typeof value === 'object' && value !== null) {
    for (const [key, entry] of Object.entries(value)) {
      scanForAbsolutePaths(entry, [...trail, key], found);
    }
  }
}

/* ------------------------------------------------------------------ */
/* The per-record pass (rules 1 to 8, and 12)                          */
/* ------------------------------------------------------------------ */

export interface ValidateRecordOptions {
  /** Absolute path of the file being checked. */
  readonly file: string;
  /** Set when the file lives in the library: enables rules 7 and 8. */
  readonly library?: LibraryPaths;
}

export async function validateRecord(options: ValidateRecordOptions): Promise<RecordReport> {
  const { file, library } = options;
  const display = library === undefined ? file : path.basename(file);
  const problems: Problem[] = [];
  const notes: Note[] = [];

  let raw: string;
  try {
    raw = await readFile(file, 'utf8');
  } catch (error) {
    return {
      file: display,
      id: null,
      capture: null,
      notes,
      problems: [{ where: '(file)', what: `could not be read: ${(error as Error).message}` }],
    };
  }

  // Rule 1
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch (error) {
    return {
      file: display,
      id: null,
      capture: null,
      notes,
      problems: [{ where: '(file)', what: `not valid JSON: ${(error as Error).message}` }],
    };
  }

  // Rule 3, before rule 2, so an old record reports its version rather than a
  // wall of shape errors that all say the same thing.
  const declared = (parsedJson as Record<string, unknown>).schemaVersion;
  if (typeof declared === 'number' && declared !== SCHEMA_VERSION) {
    const direction = declared < SCHEMA_VERSION ? 'older' : 'newer';
    return {
      file: display,
      id: null,
      capture: null,
      notes,
      problems: [
        {
          where: 'schemaVersion',
          what:
            `is ${declared}, which is ${direction} than this build's ${SCHEMA_VERSION}. ` +
            (declared < SCHEMA_VERSION
              ? 'Run `dna migrate`.'
              : 'Refusing rather than downgrading; update the CLI.'),
        },
      ],
    };
  }

  // Rule 2
  const parsed = Item.safeParse(parsedJson);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      problems.push({ where: issue.path.join('.') || '(root)', what: issue.message });
    }
    return { file: display, id: null, capture: null, problems, notes };
  }
  const item = parsed.data;

  // Rule 4
  if (raw !== canonical(canonicalise(item))) {
    problems.push({
      where: '(formatting)',
      what:
        'not in canonical form (two-space indent, LF, one trailing newline, keys in ' +
        'declaration order). `dna check --fix` rewrites this.',
    });
  }

  // Rule 5
  scanForAbsolutePaths(item, [], problems);

  // Rule 12
  if (!isPortableId(item.id)) {
    problems.push({
      where: 'id',
      what: `"${item.id}" contains characters outside [0-9A-Za-z-]`,
    });
  }

  // Rule 6
  if (path.basename(item.capture.file) !== item.capture.file) {
    problems.push({
      where: 'capture.file',
      what: `"${item.capture.file}" must be a bare filename, not a path`,
    });
  } else if (!item.capture.file.endsWith('.png')) {
    problems.push({
      where: 'capture.file',
      what: `"${item.capture.file}" must end in .png; every stored Capture is a PNG`,
    });
  }

  // notApplicable versus Scope. Carried over from check-library.ts, and it belongs
  // in the per-record pass because it is judgeable from one record.
  const expected = notApplicableFor(item.scope).slice().sort().join(',');
  const actual = item.notApplicable.slice().sort().join(',');
  if (expected !== actual) {
    problems.push({
      where: 'notApplicable',
      what: `is [${actual}] but scope "${item.scope}" excludes [${expected}]`,
    });
  }

  // Rule 13, a note rather than a failure: a stale Item is valid.
  if (item.taxonomyVersion < TAXONOMY_VERSION) {
    notes.push({
      what: `labelled under taxonomyVersion ${item.taxonomyVersion}, current is ${TAXONOMY_VERSION}`,
    });
  }

  if (library !== undefined) {
    // Rule 8
    const stem = path.basename(file, '.json');
    if (item.id !== stem) {
      problems.push({ where: 'id', what: `"${item.id}" does not match its filename "${stem}"` });
    }

    // Rule 7
    const capture = path.join(library.captures, item.capture.file);
    try {
      const info = await stat(capture);
      if (info.size === 0) {
        problems.push({ where: 'capture.file', what: `"${item.capture.file}" is empty` });
      } else {
        const size = await readPngSize(capture);
        if (size.width !== item.capture.pixelWidth || size.height !== item.capture.pixelHeight) {
          problems.push({
            where: 'capture',
            what:
              `record says ${item.capture.pixelWidth}x${item.capture.pixelHeight}, ` +
              `the PNG header says ${size.width}x${size.height}`,
          });
        }
      }
    } catch {
      problems.push({
        where: 'capture.file',
        what: `"${item.capture.file}" is missing from captures/`,
      });
    }
  }

  return { file: display, id: item.id, capture: item.capture.file, problems, notes };
}

/* ------------------------------------------------------------------ */
/* The library-wide pass (rules 9 to 11, 13)                           */
/* ------------------------------------------------------------------ */

export interface LibraryReport {
  readonly records: readonly RecordReport[];
  readonly problems: readonly Problem[];
  readonly notes: readonly Note[];
  readonly captureCount: number;
  readonly totalBytes: number;
}

export async function checkLibrary(library: LibraryPaths): Promise<LibraryReport> {
  const problems: Problem[] = [];
  const notes: Note[] = [];

  let entries: string[];
  try {
    entries = await readdir(library.items);
  } catch {
    return {
      records: [],
      problems: [{ where: library.items, what: 'no library here' }],
      notes,
      captureCount: 0,
      totalBytes: 0,
    };
  }

  // Rule 11, items side
  for (const entry of entries) {
    if (!entry.endsWith('.json')) {
      problems.push({
        where: `items/${entry}`,
        what:
          'unexpected file under items/; only <id>.json belongs here. A .tmp file is ' +
          'the residue of a crashed write and is safe to delete.',
      });
    }
  }

  const records: RecordReport[] = [];
  const seenIds = new Map<string, string>();
  const referenced = new Set<string>();

  for (const entry of entries.filter((f) => f.endsWith('.json')).sort()) {
    const report = await validateRecord({ file: path.join(library.items, entry), library });
    records.push(report);
    if (report.capture !== null) referenced.add(report.capture);

    // Rule 9
    if (report.id !== null) {
      const previous = seenIds.get(report.id);
      if (previous !== undefined) {
        problems.push({ where: `items/${entry}`, what: `id "${report.id}" is also used by ${previous}` });
      } else {
        seenIds.set(report.id, entry);
      }
    }
  }

  // Rules 10 and 11, captures side
  let captureCount = 0;
  let totalBytes = 0;
  try {
    for (const entry of (await readdir(library.captures)).sort()) {
      const full = path.join(library.captures, entry);
      const info = await stat(full);
      totalBytes += info.size;
      if (!entry.endsWith('.png')) {
        problems.push({
          where: `captures/${entry}`,
          what: 'unexpected file under captures/; only <id>.png belongs here',
        });
        continue;
      }
      captureCount += 1;
      if (!referenced.has(entry)) {
        problems.push({
          where: `captures/${entry}`,
          what:
            'orphaned, no Item references it. Never deleted automatically: a Capture is ' +
            'the only irreplaceable thing in the library.',
        });
      }
    }
  } catch {
    problems.push({ where: library.captures, what: 'no captures/ directory' });
  }

  const stale = records.filter((r) => r.notes.length > 0).length;
  if (stale > 0) {
    notes.push({
      what:
        `${stale} Item(s) are labelled under an older taxonomyVersion (current is ` +
        `${TAXONOMY_VERSION}). Run \`dna relabel --stale\` to bring them forward. ` +
        `A stale Item is valid, so this is a note rather than a failure.`,
    });
  }

  return { records, problems, notes, captureCount, totalBytes };
}
