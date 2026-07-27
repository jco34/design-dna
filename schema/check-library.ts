/**
 * `library:check` - the integrity pass ticket 006 section 10 specified.
 *
 * This is what makes hand-editability real: the second producer is a Claude
 * session editing JSON directly, and that only works if there is a command that
 * says whether the edit is still valid. Run it after any hand edit.
 *
 * Checks, in order:
 *   1. every Item file parses as JSON
 *   2. every Item satisfies the Zod schema from `./dna`
 *   3. the filename stem equals the `id` inside the file
 *   4. `capture.file` exists on disk under `library/captures/`
 *   5. every capture on disk is referenced by exactly one Item (no orphans)
 *   6. `notApplicable` agrees with what the Scope actually excludes
 *
 * Exits non-zero on any failure so it can gate a commit.
 */
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Item } from './dna';
import { notApplicableFor } from './taxonomy';

const here = dirname(fileURLToPath(import.meta.url));
const libraryDir = process.env.LIBRARY_DIR ?? resolve(here, '..', 'library');
const itemsDir = join(libraryDir, 'items');
const capturesDir = join(libraryDir, 'captures');

const problems: string[] = [];
const referenced = new Set<string>();
let checked = 0;

if (!existsSync(itemsDir)) {
  console.error(`no library at ${itemsDir}`);
  process.exit(1);
}

for (const file of readdirSync(itemsDir).filter((f) => f.endsWith('.json')).sort()) {
  const path = join(itemsDir, file);
  const stem = basename(file, '.json');
  let raw: unknown;

  try {
    raw = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    problems.push(`${file}: not valid JSON - ${(error as Error).message}`);
    continue;
  }

  const parsed = Item.safeParse(raw);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      problems.push(`${file}: ${issue.path.join('.') || '(root)'} - ${issue.message}`);
    }
    continue;
  }

  const item = parsed.data;
  checked += 1;

  if (item.id !== stem) {
    problems.push(`${file}: id "${item.id}" does not match its filename`);
  }

  const capturePath = join(capturesDir, item.capture.file);
  if (!existsSync(capturePath)) {
    problems.push(`${file}: capture "${item.capture.file}" is missing from captures/`);
  } else {
    referenced.add(item.capture.file);
    const bytes = statSync(capturePath).size;
    if (bytes === 0) problems.push(`${file}: capture "${item.capture.file}" is empty`);
  }

  const expected = notApplicableFor(item.scope).slice().sort().join(',');
  const actual = item.notApplicable.slice().sort().join(',');
  if (expected !== actual) {
    problems.push(
      `${file}: notApplicable is [${actual}] but scope "${item.scope}" excludes [${expected}]`,
    );
  }
}

if (existsSync(capturesDir)) {
  for (const capture of readdirSync(capturesDir).filter((f) => f.endsWith('.png'))) {
    if (!referenced.has(capture)) {
      problems.push(`captures/${capture}: orphaned, no Item references it`);
    }
  }
}

if (problems.length > 0) {
  console.error(`library:check FAILED - ${problems.length} problem(s)\n`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}

console.log(`library:check ok - ${checked} item(s), ${referenced.size} capture(s), 0 problems`);
