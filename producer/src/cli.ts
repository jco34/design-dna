/**
 * `dna` - the Design DNA producer. The only thing that writes the library.
 *
 * The command surface is specified verbatim in
 * `wayfinder/assets/008-cli-usage.txt`, and that file is the contract this
 * implements rather than a summary of it.
 *
 * Exit codes are load-bearing, because this is a thing you run over a directory
 * and walk away from:
 *   0  everything asked for succeeded
 *   1  at least one target was refused, or at least one check failed
 *   2  the command was used wrongly and nothing was attempted
 */
import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import {
  SCHEMA_VERSION,
  TAXONOMY_VERSION,
  SCOPES,
  type Scope,
} from '../../schema/index.js';
import { add } from './commands/add.js';
import { reExplore } from './commands/re-explore.js';
import { reExtract } from './commands/re-extract.js';
import { reBuild } from './commands/re-build.js';
import { relabel } from './commands/relabel.js';
import { note, type NoteMode } from './commands/note.js';
import { migrate } from './commands/migrate.js';
import { listItems } from './commands/list.js';
import { newId } from './lib/id.js';
import {
  canonical,
  canonicalise,
  resolveLibrary,
  readItem,
  listItemIds,
  type LibraryPaths,
} from './lib/library.js';
import { checkLibrary, validateRecord, type RecordReport } from './lib/validate.js';

const USAGE = `dna - the Design DNA producer. The only thing that writes the library.

USAGE
  dna <command> [options]

COMMANDS
  add         Capture a URL or take a file, extract its DNA, write a new Item
  re-explore  Revisit a live URL and rewrite only the motion trait
  re-extract  Re-read the stored Capture of an existing Item and merge the result
  re-build    Regenerate the Build: suggested stack and techniques, for an existing Item
  relabel     Re-ask the label question only, against the stored Capture
  note        Write, replace or clear your Note on an existing Item
  list        Report every Item in the library, for finding an id to act on
  validate    Validate one record, several, or the whole library, against the schema
  check       Run every library integrity rule
  migrate     Run pending schema migrations over the whole library
  id          Print a fresh Item id

GLOBAL OPTIONS
  --library <dir>  Library root. Default: $LIBRARY_DIR if set, else ./library
  -h, --help       Show help for the command
  -V, --version    Print the CLI, schema and taxonomy versions

Run \`dna <command> --help\` for a command's own options.
The extraction doctrine is docs/EXTRACTION.md. Read that before changing how a
design is read; it is authoritative for both this CLI and a Claude session.`;

const ADD_USAGE = `dna add - write new Items into the library.

USAGE
  dna add <target>...   [options]
  dna add <directory>   [options]
  dna add --paste       [options]

A target is either an http(s) URL or a path to an image file. A bare host with no
scheme is refused rather than guessed: write "https://example.com" for a URL or
"./example.com" for a file.

Accepted input: .png .jpg .jpeg .webp. The stored Capture is always <id>.png, so
a supplied .jpg or .webp is re-encoded once at ingest.

INPUT
  --paste                     Take the image from the clipboard instead of a path.
                              Handles a bitmap (Win+Shift+S, Copy Image) and a
                              file copied in Explorer. Windows only.

CAPTURE OPTIONS (URL targets only)
  --selector <css>            Capture one element rather than the viewport.
                              Requires --scope section or component.
  --clip <x,y,w,h>            Capture a pixel rectangle. Requires --scope.
  --headed                    Run the browser visibly.
  --wait-before-capture <ms>  Pause before the shot, so you can dismiss a consent
                              banner yourself.

ITEM OPTIONS
  --scope <page|section|component>   Default page. Frozen at write time.
  --source <url>              Provenance for a file target.
  --note <text>               Your Note. Refused for a batch.
  --note-file <path>          Your Note, from a file. Refused for a batch.

RUN OPTIONS
  --no-extract                Write the Item with an all-Undetermined DNA and
                              never call the agent. Costs nothing.
  --no-explore                Skip the interactive exploration pass on a URL, so
                              motion stays Undetermined. Faster and cheaper.
  --model <id>                Model for the extraction. Default: the SDK's.
  --resume / --no-resume      Skip a target already in the library. On by default
                              for a batch, off for a single explicit target.
  --recursive                 Descend into subdirectories of a directory target.
  --dry-run                   Do everything except write, and print the Item.`;

/* ------------------------------------------------------------------ */
/* Argument parsing                                                    */
/* ------------------------------------------------------------------ */

interface Parsed {
  readonly positional: string[];
  readonly flags: Map<string, string | true>;
}

const VALUE_FLAGS = new Set([
  '--library',
  '--scope',
  '--source',
  '--note',
  '--note-file',
  '--model',
  '--selector',
  '--clip',
  '--wait-before-capture',
  '--concurrency',
  '--set',
  '--from',
]);

function parseArgs(argv: readonly string[]): Parsed {
  const positional: string[] = [];
  const flags = new Map<string, string | true>();

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (!arg.startsWith('-')) {
      positional.push(arg);
      continue;
    }
    if (VALUE_FLAGS.has(arg)) {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('-')) {
        throw new UsageError(`${arg} needs a value`);
      }
      flags.set(arg, value);
      i += 1;
      continue;
    }
    flags.set(arg, true);
  }
  return { positional, flags };
}

class UsageError extends Error {}

const str = (parsed: Parsed, flag: string): string | undefined => {
  const value = parsed.flags.get(flag);
  return typeof value === 'string' ? value : undefined;
};

const bool = (parsed: Parsed, flag: string): boolean => parsed.flags.get(flag) === true;

/* ------------------------------------------------------------------ */
/* validate                                                            */
/* ------------------------------------------------------------------ */

function printRecord(report: RecordReport, quiet: boolean): void {
  if (report.problems.length === 0) {
    if (!quiet) console.log(`ok    ${report.file}`);
    for (const note of report.notes) if (!quiet) console.log(`note  ${note.what}`);
    return;
  }
  console.error(`fail  ${report.file}`);
  for (const problem of report.problems) {
    console.error(`      ${problem.where}: ${problem.what}`);
  }
}

async function runValidate(parsed: Parsed, library: LibraryPaths): Promise<number> {
  const quiet = bool(parsed, '--quiet');
  const asJson = bool(parsed, '--json');
  const reports: RecordReport[] = [];

  if (parsed.positional.length === 0) {
    for (const id of await listItemIds(library)) {
      reports.push(await validateRecord({ file: path.join(library.items, `${id}.json`), library }));
    }
  } else {
    for (const target of parsed.positional) {
      // A candidate outside the library skips rules 7 and 8: there is nothing yet
      // for a filename or a Capture to be consistent with.
      const inLibrary = path.resolve(target).startsWith(library.items);
      reports.push({
        ...(await validateRecord({
          file: path.resolve(target),
          library: inLibrary ? library : undefined,
        })),
      });
    }
  }

  if (asJson) {
    for (const report of reports) console.log(JSON.stringify(report));
  } else {
    for (const report of reports) printRecord(report, quiet);
  }

  const failures = reports.filter((r) => r.problems.length > 0).length;
  if (!quiet && !asJson) {
    console.log(
      failures === 0
        ? `${reports.length} record(s) valid`
        : `${failures} of ${reports.length} record(s) failed`,
    );
  }
  return failures === 0 ? 0 : 1;
}

/* ------------------------------------------------------------------ */
/* check                                                               */
/* ------------------------------------------------------------------ */

async function runCheck(parsed: Parsed, library: LibraryPaths): Promise<number> {
  const report = await checkLibrary(library);
  const fix = bool(parsed, '--fix');

  if (bool(parsed, '--json')) {
    console.log(JSON.stringify(report, null, 2));
    return report.problems.length === 0 &&
      report.records.every((r) => r.problems.length === 0)
      ? 0
      : 1;
  }

  let fixed = 0;
  if (fix) {
    // --fix rewrites canonical form and nothing else. Every other failure is a
    // decision a program cannot make: a Capture whose header stopped matching its
    // record has either been replaced or been corrupted, and no amount of
    // inspection distinguishes those.
    for (const record of report.records) {
      const only = record.problems.every((p) => p.where === '(formatting)');
      if (record.problems.length === 0 || !only || record.id === null) continue;
      const item = await readItem(library, record.id);
      await writeFile(path.join(library.items, record.file), canonical(canonicalise(item)), 'utf8');
      fixed += 1;
    }
  }

  const after = fix ? await checkLibrary(library) : report;
  const recordProblems = after.records.reduce((n, r) => n + r.problems.length, 0);
  const total = recordProblems + after.problems.length;

  const gb = (after.totalBytes / 1_000_000_000).toFixed(2);
  if (total === 0) {
    console.log(
      `ok    ${after.records.length} Items, ${after.captureCount} Captures, ${gb} GB`,
    );
  }

  for (const record of after.records) {
    if (record.problems.length === 0) continue;
    console.error(`fail  library/items/${record.file}`);
    for (const problem of record.problems) {
      console.error(`      ${problem.where}: ${problem.what}`);
    }
  }
  for (const problem of after.problems) {
    console.error(`fail  ${problem.where}\n      ${problem.what}`);
  }
  for (const note of after.notes) console.log(`note  ${note.what}`);

  if (fixed > 0) console.log(`fixed ${fixed} file(s) into canonical form`);
  if (total > 0) console.error(`${total} failure(s)`);
  return total === 0 ? 0 : 1;
}

/* ------------------------------------------------------------------ */
/* add                                                                 */
/* ------------------------------------------------------------------ */

function parseScope(raw: string | undefined): Scope {
  if (raw === undefined) return 'page';
  if ((SCOPES as readonly string[]).includes(raw)) return raw as Scope;
  throw new UsageError(`--scope must be one of ${SCOPES.join(', ')}`);
}

function parseClip(raw: string | undefined) {
  if (raw === undefined) return undefined;
  const parts = raw.split(',').map((p) => Number(p.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    throw new UsageError('--clip must be four numbers: x,y,w,h');
  }
  return { x: parts[0]!, y: parts[1]!, width: parts[2]!, height: parts[3]! };
}

async function runAdd(parsed: Parsed, library: LibraryPaths): Promise<number> {
  const paste = bool(parsed, '--paste');
  if (!paste && parsed.positional.length === 0) {
    throw new UsageError('add needs at least one target, or --paste');
  }
  if (paste && parsed.positional.length > 0) {
    throw new UsageError('--paste takes the image from the clipboard, so it takes no target');
  }

  const scope = parseScope(str(parsed, '--scope'));
  const selector = str(parsed, '--selector');
  const clip = parseClip(str(parsed, '--clip'));

  if ((selector !== undefined || clip !== undefined) && scope === 'page') {
    throw new UsageError(
      '--selector and --clip capture less than a page, so --scope must be section or component',
    );
  }
  if (selector !== undefined && clip !== undefined) {
    throw new UsageError('--selector and --clip are two ways to do the same thing; pick one');
  }

  const waitRaw = str(parsed, '--wait-before-capture');
  const waitBeforeCapture = waitRaw === undefined ? undefined : Number(waitRaw);
  if (waitBeforeCapture !== undefined && !Number.isFinite(waitBeforeCapture)) {
    throw new UsageError('--wait-before-capture must be a number of milliseconds');
  }

  const resume = bool(parsed, '--no-resume') ? false : bool(parsed, '--resume') ? true : undefined;

  const outcome = await add({
    library,
    targets: parsed.positional,
    paste,
    scope,
    source: str(parsed, '--source'),
    note: str(parsed, '--note'),
    noteFile: str(parsed, '--note-file'),
    noExtract: bool(parsed, '--no-extract'),
    noExplore: bool(parsed, '--no-explore'),
    model: str(parsed, '--model'),
    selector,
    clip,
    headed: bool(parsed, '--headed'),
    waitBeforeCapture,
    resume,
    recursive: bool(parsed, '--recursive'),
    dryRun: bool(parsed, '--dry-run'),
  });

  return outcome.refused > 0 ? 1 : 0;
}

/* ------------------------------------------------------------------ */
/* re-explore                                                          */
/* ------------------------------------------------------------------ */

const RE_EXPLORE_USAGE = `dna re-explore - revisit a live URL and rewrite only the motion trait.

USAGE
  dna re-explore <id>... [options]

Motion is the one trait whose evidence is the live page rather than the stored
Capture, so it is the one trait \`re-extract\` can never refresh: no amount of
re-reading a PNG will show you a scroll animation. This verb revisits the page
instead.

The Capture is not re-taken. Nothing about it changes, and no screenshot is
opened. Every other trait, the Note, the Scope, the id and addedAt are left
byte-identical; only dna.motion and authoredBy move.

Refused rather than guessed:
  - an Item saved from a file, which has no live page
  - a URL that now serves a login screen or a dead page, so good motion data is
    never replaced by observations of a sign-in form
  - an Item file with uncommitted changes, unless --force

An override on motion is kept. --force replaces it.

OPTIONS
  --model <id>  Model for the reading. Default: the SDK's.
  --dry-run     Print the new motion trait and what would change. Write nothing.
                Still spends a reading.
  --force       Replace an override, and write even though the file is dirty.`;

async function runReExplore(parsed: Parsed, library: LibraryPaths): Promise<number> {
  if (parsed.positional.length === 0) {
    throw new UsageError('re-explore needs at least one Item id. `dna check` lists them.');
  }
  const outcome = await reExplore({
    library,
    ids: parsed.positional,
    model: str(parsed, '--model'),
    dryRun: bool(parsed, '--dry-run'),
    force: bool(parsed, '--force'),
  });
  return outcome.refused > 0 ? 1 : 0;
}

/* ------------------------------------------------------------------ */
/* re-extract                                                          */
/* ------------------------------------------------------------------ */

const RE_EXTRACT_USAGE = `dna re-extract - re-read the stored Capture of an existing Item.

USAGE
  dna re-extract <id>... [options]

Reads library/captures/<id>.png and never visits the network, so a re-run works
offline and works after the site has been redesigned or deleted. The Capture is
fixed at the moment of saving and is never re-taken. Works for both a url and a
file Source, since both have a stored Capture, unlike re-explore.

The result is merged, not written over the top:
  - a trait whose authorship is "override" is kept verbatim
  - the palette merges per swatch, so a corrected accent survives while the
    other four are refreshed
  - dna.motion and dna.labels are never touched: motion's only valid evidence is
    a live page, which is re-explore's job, and labels belong to relabel
  - note, id, addedAt, source and capture are never touched
  - scope and notApplicable change only if you pass --scope, and any trait the
    new scope newly excludes is forced back to Undetermined regardless of
    authorship
  - authoredBy and taxonomyVersion are replaced by this run

Re-extraction is not idempotent. The same image gives different hexes and
sometimes a different typography.scale, so this command changes values you may
have preferred. It refuses to write an Item file with uncommitted changes,
because git history is the only thing that can give them back.

There is no --all. A library-wide re-extraction costs real money per Item and
discards every agent-authored value in one command. If you mean it, expand the
ids in your shell.

OPTIONS
  --scope <page|section|component>
                     Correct the Scope. Recomputes notApplicable, and resets any
                     trait the new Scope excludes to Undetermined, naming it.
  --model <id>       Model for the extraction. Default: the SDK's.
  --dry-run          Print the merged Item and the traits that would change.
                     Write nothing. Still spends an extraction.
  --force            Write even though the Item file has uncommitted changes.`;

const RE_BUILD_USAGE = `dna re-build - regenerate the Build: suggested stack and techniques.

USAGE
  dna re-build <id>... [options]
  dna re-build --all    [options]

Reads library/captures/<id>.png plus the Item's already-stored DNA (imagery,
motion, composition) and asks only for the Build: candidate tools and the
techniques that matter for replicating this design. Never visits the network.
Every trait, the Note, the Scope, the id and addedAt are left byte-identical;
only build and authoredBy move.

A Build you wrote by hand (authorship "written") is kept. --force replaces it.

OPTIONS
  --all         Every Item in the library.
  --model <id>  Model for the suggestion. Default: the SDK's.
  --dry-run     Print the new Build and what would change. Write nothing.
                Still spends a reading.
  --force       Replace a written Build, and write even though the file is
                dirty.`;

function parseOptionalScope(raw: string | undefined): Scope | undefined {
  if (raw === undefined) return undefined;
  if ((SCOPES as readonly string[]).includes(raw)) return raw as Scope;
  throw new UsageError(`--scope must be one of ${SCOPES.join(', ')}`);
}

async function runReExtract(parsed: Parsed, library: LibraryPaths): Promise<number> {
  if (parsed.positional.length === 0) {
    throw new UsageError('re-extract needs at least one Item id. `dna list` finds them.');
  }
  const outcome = await reExtract({
    library,
    ids: parsed.positional,
    scope: parseOptionalScope(str(parsed, '--scope')),
    model: str(parsed, '--model'),
    dryRun: bool(parsed, '--dry-run'),
    force: bool(parsed, '--force'),
  });
  return outcome.refused > 0 ? 1 : 0;
}

/* ------------------------------------------------------------------ */
/* re-build                                                            */
/* ------------------------------------------------------------------ */

async function runReBuild(parsed: Parsed, library: LibraryPaths): Promise<number> {
  const all = bool(parsed, '--all');
  const ids = parsed.positional;

  if (ids.length === 0 && !all) {
    throw new UsageError('re-build needs at least one Item id, or --all.');
  }
  if (ids.length > 0 && all) {
    throw new UsageError('pass either Item ids or --all, not both.');
  }

  const outcome = await reBuild({
    library,
    ids,
    all,
    model: str(parsed, '--model'),
    dryRun: bool(parsed, '--dry-run'),
    force: bool(parsed, '--force'),
  });
  return outcome.refused > 0 ? 1 : 0;
}

/* ------------------------------------------------------------------ */
/* relabel                                                             */
/* ------------------------------------------------------------------ */

const RELABEL_USAGE = `dna relabel - re-ask the label question only.

USAGE
  dna relabel <id>... [options]
  dna relabel --stale [options]
  dna relabel --all   [options]

Writes dna.labels and taxonomyVersion. Every trait is left byte-identical. This
is the backfill path for a taxonomy that has grown a value, and it is
deliberately not the same command as re-extract: re-running extraction to fix
one label would destroy a palette you were happy with.

Only an axis whose authorship is "agent" is rewritten. An axis you overrode is
kept, and an Item whose three axes are all overridden skips the agent entirely
and only has its taxonomyVersion bumped, which costs nothing.

An Item labelled under an older vocabulary is valid and merely stale. Nothing
relabels automatically.

OPTIONS
  --stale       Every Item whose taxonomyVersion is behind the current one.
  --all         Every Item in the library.
  --model <id>  Model for the labelling. Default: the SDK's.
  --dry-run     Print the labels that would change. Write nothing.
  --force       Write even though an Item file has uncommitted changes.`;

async function runRelabel(parsed: Parsed, library: LibraryPaths): Promise<number> {
  const stale = bool(parsed, '--stale');
  const all = bool(parsed, '--all');
  const ids = parsed.positional;

  const modeCount = [ids.length > 0, stale, all].filter(Boolean).length;
  if (modeCount === 0) {
    throw new UsageError('relabel needs at least one Item id, --stale, or --all.');
  }
  if (modeCount > 1) {
    throw new UsageError('pass exactly one of: Item ids, --stale, --all.');
  }

  const outcome = await relabel({
    library,
    ids: ids.length > 0 ? ids : undefined,
    stale,
    all,
    model: str(parsed, '--model'),
    dryRun: bool(parsed, '--dry-run'),
    force: bool(parsed, '--force'),
  });
  return outcome.refused > 0 ? 1 : 0;
}

/* ------------------------------------------------------------------ */
/* note                                                                */
/* ------------------------------------------------------------------ */

const NOTE_USAGE = `dna note - write your words on why an Item was worth saving.

USAGE
  dna note <id>                  Open your editor on the current Note
  dna note <id> --set <text>     Replace it with this text
  dna note <id> --from <path>    Replace it with the contents of a file
  dna note <id> --clear          Set it to null
  dna note <id> --print          Print it and change nothing

The Note is the one field the agent never writes and the one field you are
expected to write on a machine-authored file.

The editor is $VISUAL, then $EDITOR, then notepad on Windows and nano
elsewhere. The buffer holds the Note text alone, not the JSON, so the record
cannot be broken by an editing accident.

OPTIONS
  --set <text>   Replace the Note with this text
  --from <path>  Replace the Note with the contents of this file
  --clear        Set the Note to null
  --print        Print the current Note and exit
  --force        Write even though the Item file has uncommitted changes`;

async function runNote(parsed: Parsed, library: LibraryPaths): Promise<number> {
  if (parsed.positional.length === 0) {
    throw new UsageError('note needs exactly one Item id.');
  }
  if (parsed.positional.length > 1) {
    throw new UsageError('note takes exactly one Item id, not a batch: a Note is about one Item.');
  }
  const id = parsed.positional[0]!;

  const set = str(parsed, '--set');
  const from = str(parsed, '--from');
  const clear = bool(parsed, '--clear');
  const print = bool(parsed, '--print');

  const modeCount = [set !== undefined, from !== undefined, clear, print].filter(Boolean).length;
  if (modeCount > 1) {
    throw new UsageError('pass at most one of --set, --from, --clear, --print.');
  }

  let mode: NoteMode;
  if (set !== undefined) mode = { kind: 'set', text: set };
  else if (from !== undefined) mode = { kind: 'from', path: from };
  else if (clear) mode = { kind: 'clear' };
  else if (print) mode = { kind: 'print' };
  else mode = { kind: 'editor' };

  const outcome = await note({ library, id, mode, force: bool(parsed, '--force') });
  return outcome.refused > 0 ? 1 : 0;
}

/* ------------------------------------------------------------------ */
/* migrate                                                             */
/* ------------------------------------------------------------------ */

const MIGRATE_USAGE = `dna migrate - move every Item to the current schema version.

USAGE
  dna migrate [options]

It is all or nothing. Every Item is read, transformed and validated against the
current schema in memory before the first byte is written, so a script that
fails on one Item leaves the library untouched rather than half migrated.

It refuses to run when anything under library/ has uncommitted changes, which
is also what stops two migrations running at once. It never commits: review the
result with \`git diff\`, then commit the script and its effect together.

OPTIONS
  --dry-run   Write the migrated library into a scratch directory and report
              what changed. Touch nothing under library/.
  --force     Run even though the work tree is dirty.`;

async function runMigrate(parsed: Parsed, library: LibraryPaths): Promise<number> {
  const outcome = await migrate({
    library,
    dryRun: bool(parsed, '--dry-run'),
    force: bool(parsed, '--force'),
  });
  return outcome.refused ? 1 : 0;
}

/* ------------------------------------------------------------------ */
/* list                                                                */
/* ------------------------------------------------------------------ */

const LIST_USAGE = `dna list - report every Item in the library.

USAGE
  dna list [options]

Prints one row per Item: id, scope, motion presence, whether it can be
re-explored (a url Source can, a file Source cannot), whether it is labelled
under a stale taxonomyVersion, and its source. This is where you find the id to
hand to re-extract, re-explore, relabel or note.

OPTIONS
  --stale  Only Items whose taxonomyVersion is behind the current one.
  --json   One JSON object per line instead of a table.`;

async function runList(parsed: Parsed, library: LibraryPaths): Promise<number> {
  await listItems({
    library,
    stale: bool(parsed, '--stale'),
    json: bool(parsed, '--json'),
  });
  return 0;
}

/* ------------------------------------------------------------------ */
/* Dispatch                                                            */
/* ------------------------------------------------------------------ */

async function main(): Promise<number> {
  const argv = process.argv.slice(2);

  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
    console.log(USAGE);
    return argv.length === 0 ? 2 : 0;
  }
  if (argv[0] === '--version' || argv[0] === '-V') {
    console.log(`dna 0.1.0`);
    console.log(`writes schemaVersion ${SCHEMA_VERSION}`);
    console.log(`labels with taxonomyVersion ${TAXONOMY_VERSION}`);
    return 0;
  }

  const command = argv[0]!;
  const parsed = parseArgs(argv.slice(1));

  if (parsed.flags.has('--help') || parsed.flags.has('-h')) {
    if (command === 'add') console.log(ADD_USAGE);
    else if (command === 're-explore') console.log(RE_EXPLORE_USAGE);
    else if (command === 're-extract') console.log(RE_EXTRACT_USAGE);
    else if (command === 're-build') console.log(RE_BUILD_USAGE);
    else if (command === 'relabel') console.log(RELABEL_USAGE);
    else if (command === 'note') console.log(NOTE_USAGE);
    else if (command === 'migrate') console.log(MIGRATE_USAGE);
    else if (command === 'list') console.log(LIST_USAGE);
    else console.log(USAGE);
    return 0;
  }

  const library = resolveLibrary(str(parsed, '--library'));

  switch (command) {
    case 'id':
      console.log(newId());
      return 0;
    case 'add':
      return runAdd(parsed, library);
    case 're-explore':
      return runReExplore(parsed, library);
    case 're-extract':
      return runReExtract(parsed, library);
    case 're-build':
      return runReBuild(parsed, library);
    case 'relabel':
      return runRelabel(parsed, library);
    case 'note':
      return runNote(parsed, library);
    case 'list':
      return runList(parsed, library);
    case 'validate':
      return runValidate(parsed, library);
    case 'check':
      return runCheck(parsed, library);
    case 'migrate':
      return runMigrate(parsed, library);
    default:
      console.error(`unknown command "${command}"\n\n${USAGE}`);
      return 2;
  }
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    if (error instanceof UsageError) {
      console.error(`${error.message}\n\nRun \`dna --help\`.`);
      process.exitCode = 2;
      return;
    }
    console.error(error);
    process.exitCode = 1;
  });
