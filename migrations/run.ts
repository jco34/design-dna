/**
 * The migration runner. Ticket 008 decision, `dna migrate` in the help text.
 *
 *   npx tsx migrations/run.ts [--dry-run] [--force]
 *
 * The runner owns everything except the transform: finding pending scripts,
 * ordering them, applying them, validating the result and writing it. A
 * migration script exports `{ from, to, up }` and is a pure function.
 *
 * Three guarantees, and each one exists because of a specific way this could
 * ruin a library that has no backup but git:
 *
 *   All or nothing.  Every Item is read, transformed and validated in memory
 *                    before the first byte is written. A script that throws on
 *                    Item 7 of 7 leaves the library untouched rather than
 *                    half migrated, so there is no partial state to reason about
 *                    and no "which ones did it get to" forensics.
 *
 *   Refuses a dirty  git history is the only thing that can give back a value a
 *   library.         migration overwrote. If `library/` has uncommitted changes,
 *                    that safety net is not there, so the runner stops. This is
 *                    also what stops two migrations running at once.
 *
 *   Never commits.   Review with `git diff library/`, then commit the script and
 *                    its effect together, so the change reverts as one thing.
 *
 * `runMigrations` is the importable core (a `dna migrate` adapter calls it with
 * a library root of its choosing); the standalone script below is a thin
 * argv-parsing wrapper around it, guarded so it only runs when this file is
 * executed directly rather than imported.
 */
import { readdir, readFile, writeFile, rename, mkdir, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import path from 'node:path';
import { Item, SCHEMA_VERSION } from '../schema/index.js';

const exec = promisify(execFile);

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

/** The version this build writes. Imported so it cannot drift from the schema. */
const CURRENT = SCHEMA_VERSION;

interface Migration {
  readonly file: string;
  readonly from: number;
  readonly to: number;
  readonly up: (record: unknown) => unknown;
}

/** Canonical form: two-space indent, LF, exactly one trailing newline. */
const canonical = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

async function loadMigrations(): Promise<Migration[]> {
  const files = (await readdir(HERE))
    .filter((f) => /^\d{3}-.+\.ts$/.test(f))
    .sort();

  const out: Migration[] = [];
  for (const file of files) {
    // `pathToFileURL`, not a bare path. On Windows the ESM loader reads the
    // drive letter in `C:\...` as a URL scheme and rejects it with
    // ERR_UNSUPPORTED_ESM_URL_SCHEME. A POSIX-slashed path fails the same way.
    const mod = (await import(pathToFileURL(path.join(HERE, file)).href)) as Partial<Migration>;
    if (typeof mod.from !== 'number' || typeof mod.to !== 'number' || typeof mod.up !== 'function') {
      throw new Error(`${file} must export { from: number, to: number, up: function }`);
    }
    out.push({ file, from: mod.from, to: mod.to, up: mod.up });
  }
  return out.sort((a, b) => a.from - b.from);
}

async function libraryIsDirty(libraryRoot: string): Promise<string[]> {
  try {
    const { stdout } = await exec('git', ['status', '--porcelain', '--', libraryRoot], { cwd: REPO });
    return stdout
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l !== '');
  } catch {
    // Not a git repository, or git is unavailable. The safety net the dirty
    // check protects does not exist here, so there is nothing to enforce.
    return [];
  }
}

export interface RunMigrationsOptions {
  /** Absolute path to the library root. Defaults to $LIBRARY_DIR or <repo>/library, same as today, when omitted. */
  readonly libraryRoot?: string;
  readonly dryRun: boolean;
  readonly force: boolean;
}

export interface RunMigrationsOutcome {
  /** How many Items were migrated. 0 when everything was already current. */
  readonly migratedCount: number;
  /** How many files were actually written (0 for a dry run, which writes to .migrate-dry-run/ instead). */
  readonly filesWritten: number;
  /** True when the run stopped early without writing anything: a dirty tree without --force, an unparseable Item, a migration that threw, or a migrated record that failed to validate. */
  readonly refused: boolean;
}

const REFUSED: RunMigrationsOutcome = { migratedCount: 0, filesWritten: 0, refused: true };

export async function runMigrations(options: RunMigrationsOptions): Promise<RunMigrationsOutcome> {
  const { dryRun, force } = options;
  const libraryRoot = path.resolve(options.libraryRoot ?? process.env.LIBRARY_DIR ?? path.join(REPO, 'library'));
  const items = path.join(libraryRoot, 'items');

  const migrations = await loadMigrations();
  const files = (await readdir(items)).filter((f) => f.endsWith('.json')).sort();

  if (files.length === 0) {
    console.log('no Items in the library, nothing to migrate');
    return { migratedCount: 0, filesWritten: 0, refused: false };
  }

  /* --- Phase 1: read and group by version --------------------------- */

  const records = new Map<string, Record<string, unknown>>();
  const byVersion = new Map<number, string[]>();

  for (const file of files) {
    const raw = await readFile(path.join(items, file), 'utf8');
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      console.error(`fail  ${file}: not valid JSON (${(error as Error).message})`);
      return REFUSED;
    }
    const record = parsed as Record<string, unknown>;
    const version = typeof record.schemaVersion === 'number' ? record.schemaVersion : NaN;
    if (Number.isNaN(version)) {
      console.error(`fail  ${file}: no numeric schemaVersion`);
      return REFUSED;
    }
    if (version > CURRENT) {
      console.error(
        `fail  ${file}: schemaVersion ${version} is newer than this build knows (${CURRENT}). ` +
          `Refusing rather than downgrading.`,
      );
      return REFUSED;
    }
    records.set(file, record);
    byVersion.set(version, [...(byVersion.get(version) ?? []), file]);
  }

  const versions = [...byVersion.keys()].sort();
  for (const v of versions) {
    console.log(
      `${byVersion.get(v)!.length} Item${byVersion.get(v)!.length === 1 ? '' : 's'} at ` +
        `schemaVersion ${v}, current is ${CURRENT}`,
    );
  }

  const pending = versions.filter((v) => v < CURRENT);
  if (pending.length === 0) {
    console.log('nothing to migrate');
    return { migratedCount: 0, filesWritten: 0, refused: false };
  }

  /* --- Phase 2: the dirty check, before anything is transformed ------ */

  const dirty = await libraryIsDirty(libraryRoot);
  if (dirty.length > 0 && !force && !dryRun) {
    console.error(
      `\nrefusing: ${dirty.length} uncommitted change(s) under ${path.relative(REPO, libraryRoot)}/\n`,
    );
    for (const line of dirty) console.error(`  ${line}`);
    console.error(
      '\ngit history is the only thing that can undo a migration. Commit these first,\n' +
        'or pass --force to migrate anyway and accept that they cannot be recovered.\n' +
        'A `--dry-run` needs no clean tree and is always safe.',
    );
    return REFUSED;
  }

  /* --- Phase 3: transform and validate, all in memory --------------- */

  const migrated = new Map<string, unknown>();
  const applied = new Set<string>();

  for (const [file, record] of records) {
    let current: unknown = record;
    let version = (record.schemaVersion as number) ?? 0;

    while (version < CURRENT) {
      const step = migrations.find((m) => m.from === version);
      if (step === undefined) {
        console.error(`fail  ${file}: no migration from schemaVersion ${version}`);
        return REFUSED;
      }
      try {
        current = step.up(current);
      } catch (error) {
        console.error(`fail  ${file}: ${step.file} threw: ${(error as Error).message}`);
        console.error('nothing was written');
        return REFUSED;
      }
      applied.add(step.file);
      version = step.to;
    }

    const check = Item.safeParse(current);
    if (!check.success) {
      console.error(`fail  ${file}: migrated record does not validate`);
      for (const issue of check.error.issues) {
        console.error(`      ${issue.path.join('.') || '(root)'} - ${issue.message}`);
      }
      console.error('nothing was written');
      return REFUSED;
    }
    migrated.set(file, check.data);
  }

  for (const step of migrations.filter((m) => applied.has(m.file))) {
    console.log(`${path.relative(REPO, path.join(HERE, step.file))}  ${step.from} -> ${step.to}`);
  }

  /* --- Phase 4: write ----------------------------------------------- */

  if (dryRun) {
    const scratch = path.join(REPO, '.migrate-dry-run');
    await rm(scratch, { recursive: true, force: true });
    await mkdir(scratch, { recursive: true });
    for (const [file, record] of migrated) {
      await writeFile(path.join(scratch, file), canonical(record), 'utf8');
    }
    console.log(
      `\ndry run: ${migrated.size} Item(s) written to ${path.relative(REPO, scratch)}/\n` +
        `${path.relative(REPO, libraryRoot)}/ was not touched.`,
    );
    return { migratedCount: migrated.size, filesWritten: 0, refused: false };
  }

  // Temp-then-rename per 006 section 9, so a crash mid-write cannot leave a
  // reader looking at half a JSON document. rename is atomic within a volume.
  for (const [file, record] of migrated) {
    const target = path.join(items, file);
    const temp = `${target}.tmp`;
    await writeFile(temp, canonical(record), 'utf8');
    await rename(temp, target);
  }

  console.log(`ok  ${migrated.size} Item(s) migrated, ${migrated.size} file(s) written`);
  console.log('Review with `git diff library/` and commit the script with its effect.');
  return { migratedCount: migrated.size, filesWritten: migrated.size, refused: false };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const force = argv.includes('--force');

  const unknownFlag = argv.find((a) => a !== '--dry-run' && a !== '--force');
  if (unknownFlag !== undefined) {
    console.error(`unknown option ${unknownFlag}\nusage: run.ts [--dry-run] [--force]`);
    process.exitCode = 2;
    return;
  }

  const outcome = await runMigrations({ dryRun, force });
  process.exitCode = outcome.refused ? 1 : 0;
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
