/**
 * `dna note` - write, replace or clear the Note on an existing Item.
 *
 * The Note is the one field neither producer ever generates: it is the user's own
 * words on why an Item was worth saving. That is why this verb never calls the
 * agent and never touches any other field. `writeItem` still runs the value
 * through the full `Item` schema on the way out, but the only thing that ever
 * differs between the record read in and the record written back is `note`.
 *
 * Five modes, one Item at a time (see `wayfinder/assets/008-cli-usage.txt`: every
 * `dna note` usage line takes a single `<id>`, never `<id>...`, because a Note is
 * about one Item and there is no sensible batch form of "write your own words").
 * The CLI layer parses `--set` / `--from` / `--clear` / `--print` / a bare id into
 * exactly one `NoteMode` before calling this function, so no flag validation
 * happens here.
 *
 * Trimming only ever removes trailing whitespace/newlines, never interior
 * whitespace - a Note is prose, and collapsing its internal spacing would be an
 * unasked-for edit of someone's words. An empty result after trimming becomes
 * `null` rather than `""`, because the schema already treats "no note" as the
 * absence of the field's meaning, not as an empty string sitting in it; storing
 * `""` would just be a second spelling of the same thing.
 */
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { isDirty, isUntracked } from '../lib/git.js';
import { itemPath, readItem, writeItem, type LibraryPaths } from '../lib/library.js';

export type NoteMode =
  | { readonly kind: 'editor' }
  | { readonly kind: 'set'; readonly text: string }
  | { readonly kind: 'from'; readonly path: string }
  | { readonly kind: 'clear' }
  | { readonly kind: 'print' };

export interface NoteOptions {
  readonly library: LibraryPaths;
  readonly id: string;
  readonly mode: NoteMode;
  readonly force: boolean;
}

export interface NoteOutcome {
  readonly updated: number;
  readonly unchanged: number;
  readonly refused: number;
}

/** Trailing whitespace/newlines only. An empty result means "no note", not `""`. */
const normalise = (text: string): string | null => {
  const trimmed = text.replace(/\s+$/, '');
  return trimmed === '' ? null : trimmed;
};

async function readViaEditor(id: string, current: string | null): Promise<string | null> {
  const editor = process.env.VISUAL || process.env.EDITOR || (process.platform === 'win32' ? 'notepad' : 'nano');
  const dir = await mkdtemp(path.join(tmpdir(), 'dna-note-'));
  const file = path.join(dir, 'note.txt');
  try {
    await writeFile(file, current ?? '', 'utf8');

    await new Promise<void>((resolve, reject) => {
      const child = spawn(editor, [file], { stdio: 'inherit' });
      child.on('error', (error) => {
        reject(
          new Error(
            `fail  ${id}  nothing written\n      could not launch editor "${editor}": ${error.message}`,
          ),
        );
      });
      child.on('exit', () => resolve());
    });

    const text = await readFile(file, 'utf8');
    return normalise(text);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function note(options: NoteOptions): Promise<NoteOutcome> {
  const { library, id, mode } = options;

  let item;
  try {
    item = await readItem(library, id);
  } catch (error) {
    console.error(`fail  ${id}  ${(error as Error).message}`);
    return { updated: 0, unchanged: 0, refused: 1 };
  }

  if (mode.kind === 'print') {
    console.log(item.note ?? '(no note)');
    return { updated: 0, unchanged: 0, refused: 0 };
  }

  const file = itemPath(library, id);
  if (!options.force && (await isDirty(file))) {
    const untracked = await isUntracked(file);
    console.error(
      `fail  ${id}  nothing written\n` +
        `      the Item file has uncommitted changes, and ${
          untracked
            ? 'it has never been committed, so git cannot restore it at all'
            : 'git history is the only thing that could undo this'
        }. Commit it first, or pass --force.`,
    );
    return { updated: 0, unchanged: 0, refused: 1 };
  }

  let newNote: string | null;
  switch (mode.kind) {
    case 'clear':
      newNote = null;
      break;
    case 'set':
      newNote = normalise(mode.text);
      break;
    case 'from':
      try {
        newNote = normalise(await readFile(mode.path, 'utf8'));
      } catch (error) {
        console.error(
          `fail  ${id}  nothing written\n      could not read "${mode.path}": ${(error as Error).message}`,
        );
        return { updated: 0, unchanged: 0, refused: 1 };
      }
      break;
    case 'editor':
      try {
        newNote = await readViaEditor(id, item.note);
      } catch (error) {
        console.error((error as Error).message);
        return { updated: 0, unchanged: 0, refused: 1 };
      }
      break;
  }

  if (newNote === item.note) {
    console.log(`same  ${id}  note unchanged`);
    return { updated: 0, unchanged: 1, refused: 0 };
  }

  await writeItem(library, { ...item, note: newNote });

  if (newNote === null) {
    console.log(`ok    ${id}  note cleared`);
  } else {
    console.log(`ok    ${id}  note set (${newNote.length} chars)`);
  }
  return { updated: 1, unchanged: 0, refused: 0 };
}
