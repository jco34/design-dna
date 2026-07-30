/**
 * `dna add` - the only verb that creates Items.
 *
 * One target kind is sniffed rather than declared: `^https?://` is a URL,
 * anything else is a path. A bare scheme-less host is refused rather than
 * guessed, because "example.com" is a perfectly good relative filename and
 * choosing for you would be wrong roughly half the time. That is why there are no
 * `--url` and `--file` flags.
 *
 * `add` only ever creates. It never modifies an Item that already exists,
 * whatever you point it at. Correcting an Item is `re-extract`, `relabel`, `note`
 * or an Override, and keeping those apart is what stops a re-run quietly
 * discarding a value you were happy with.
 */
import { copyFile, readFile, stat, readdir } from 'node:fs/promises';
import path from 'node:path';
import {
  Item,
  SCHEMA_VERSION,
  CURRENT_TAXONOMY_VERSION,
  notApplicableFor,
  stampAuthorship,
  stampBuildAuthorship,
  type Scope,
} from '../../../schema/index.js';
import {
  captureUrl,
  reencodeToPng,
  refuseBeforeNavigation,
  CaptureRefused,
  type MotionObservations,
} from '../lib/capture.js';
import { extractDna, undeterminedDna, undeterminedBuild, ExtractionFailed } from '../lib/extract.js';
import { readClipboardImage } from '../lib/clipboard.js';
import { newId } from '../lib/id.js';
import { isAcceptedImage, readPngSize } from '../lib/png.js';
import {
  capturePath,
  ensureLibrary,
  exists,
  listItemIds,
  readItem,
  writeItem,
  type LibraryPaths,
} from '../lib/library.js';

export interface AddOptions {
  readonly library: LibraryPaths;
  readonly targets: readonly string[];
  readonly paste: boolean;
  readonly scope: Scope;
  readonly source?: string;
  readonly note?: string;
  readonly noteFile?: string;
  readonly noExtract: boolean;
  readonly noExplore: boolean;
  readonly model?: string;
  readonly selector?: string;
  readonly clip?: { x: number; y: number; width: number; height: number };
  readonly headed: boolean;
  readonly waitBeforeCapture?: number;
  readonly resume: boolean | undefined;
  readonly recursive: boolean;
  readonly dryRun: boolean;
}

export interface AddOutcome {
  readonly written: number;
  readonly skipped: number;
  readonly refused: number;
  readonly costUsd: number;
}

const isUrl = (target: string): boolean => /^https?:\/\//i.test(target);

/** A bare host looks like neither and must not be guessed at. */
const looksLikeBareHost = (target: string): boolean =>
  !isUrl(target) && /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/.*)?$/i.test(target) && !isAcceptedImage(target);

/* ------------------------------------------------------------------ */
/* Target expansion                                                    */
/* ------------------------------------------------------------------ */

interface ExpandedTargets {
  readonly targets: readonly string[];
  readonly ignored: number;
}

async function expandTargets(
  raw: readonly string[],
  recursive: boolean,
): Promise<ExpandedTargets> {
  const out: string[] = [];
  let ignored = 0;

  for (const target of raw) {
    if (isUrl(target)) {
      out.push(target);
      continue;
    }
    let info;
    try {
      info = await stat(target);
    } catch {
      out.push(target); // Let the per-target handler report the real error.
      continue;
    }
    if (!info.isDirectory()) {
      out.push(target);
      continue;
    }
    const walk = async (dir: string): Promise<void> => {
      for (const entry of (await readdir(dir, { withFileTypes: true })).sort((a, b) =>
        a.name.localeCompare(b.name),
      )) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (recursive) await walk(full);
          continue;
        }
        if (isAcceptedImage(entry.name)) out.push(full);
        else ignored += 1;
      }
    };
    await walk(target);
  }
  return { targets: out, ignored };
}

/* ------------------------------------------------------------------ */
/* Resume: observed from the library, never journalled                 */
/* ------------------------------------------------------------------ */

/**
 * 008 decision 5. Because each Item is written atomically and independently, the
 * library *is* the record of what succeeded, so a re-run needs no journal that
 * could itself be stale or half-written.
 *
 * **Resume skips; it never re-runs.** That is what keeps it free of 002's
 * non-idempotence: a skipped target is not re-extracted, so no value changes. The
 * known false negative is two same-named files in different folders reading as one
 * target, which is named here rather than observed.
 */
async function alreadyPresent(
  library: LibraryPaths,
  target: string,
): Promise<string | null> {
  const ids = await listItemIds(library);
  const wanted = isUrl(target) ? null : path.basename(target);

  for (const id of ids) {
    let item: Item;
    try {
      item = await readItem(library, id);
    } catch {
      continue; // A broken record is `dna check`'s problem, not resume's.
    }
    if (isUrl(target)) {
      if (item.source.kind === 'url' && item.source.url === target) return id;
    } else if (wanted !== null && item.source.kind === 'file') {
      if (path.basename(item.source.originalPath) === wanted) return id;
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* One target                                                          */
/* ------------------------------------------------------------------ */

interface Prepared {
  readonly pngPath: string;
  readonly takenAt: string | null;
  readonly pixelWidth: number;
  readonly pixelHeight: number;
  readonly mode: Item['capture']['mode'];
  readonly source: Item['source'];
  readonly observations: MotionObservations | null;
  readonly warnings: readonly string[];
  readonly cleanup: () => Promise<void>;
}

async function prepareUrl(target: string, options: AddOptions): Promise<Prepared> {
  const shot = await captureUrl(target, {
    selector: options.selector,
    clip: options.clip,
    headed: options.headed,
    waitBeforeCapture: options.waitBeforeCapture,
    explore: !options.noExplore,
  });
  return {
    pngPath: shot.file,
    takenAt: shot.takenAt,
    pixelWidth: shot.pixelWidth,
    pixelHeight: shot.pixelHeight,
    mode: shot.mode,
    source: { kind: 'url', url: target },
    observations: shot.observations,
    warnings: shot.warnings,
    cleanup: shot.cleanup,
  };
}

async function prepareFile(target: string, options: AddOptions): Promise<Prepared> {
  if (!(await exists(target))) throw new CaptureRefused('no such file');
  if (!isAcceptedImage(target)) {
    throw new CaptureRefused(
      `not an accepted image (.png, .jpg, .jpeg, .webp): "${path.basename(target)}"`,
    );
  }

  let pngPath = path.resolve(target);
  let cleanup = async () => {};
  const warnings: string[] = [];

  if (!target.toLowerCase().endsWith('.png')) {
    const encoded = await reencodeToPng(target);
    pngPath = encoded.file;
    cleanup = encoded.cleanup;
    warnings.push(`re-encoded to PNG from ${path.extname(target).slice(1)}`);
  }

  const size = await readPngSize(pngPath);

  // Stored relative when the file is inside the working tree, so the record stays
  // portable. `dna validate` rule 5 refuses an absolute path outright.
  const relative = path.relative(process.cwd(), path.resolve(target));
  const originalPath = relative.startsWith('..')
    ? path.basename(target)
    : relative.split(path.sep).join('/');

  return {
    pngPath,
    // Null, and deliberately: 004 says a handed-over file's true capture moment is
    // unknown. The file's mtime is when it was written, not when the design was
    // photographed, and recording a guess as an instant would be worse than
    // recording nothing.
    takenAt: null,
    pixelWidth: size.width,
    pixelHeight: size.height,
    mode: 'supplied',
    source: { kind: 'file', originalPath, url: options.source ?? null },
    // A still image cannot show motion. `undefined` here is what makes the
    // extraction prompt take its Undetermined branch.
    observations: null,
    warnings,
    cleanup,
  };
}

/* ------------------------------------------------------------------ */
/* The command                                                         */
/* ------------------------------------------------------------------ */

export async function add(options: AddOptions): Promise<AddOutcome> {
  await ensureLibrary(options.library);

  let targets: readonly string[];
  let ignored = 0;
  /** Set for a pasted bitmap, whose temp directory this function owns. */
  let pasteCleanup: (() => Promise<void>) | null = null;

  if (options.paste) {
    // An empty clipboard is the single most likely way this command is used
    // wrongly, so it reports as a refusal with an instruction rather than as a
    // stack trace. Nothing has been attempted at this point, so nothing leaks.
    let pasted;
    try {
      pasted = await readClipboardImage();
    } catch (error) {
      console.error(`fail  --paste  nothing written\n      ${(error as Error).message}`);
      return { written: 0, skipped: 0, refused: 1, costUsd: 0 };
    }
    targets = [pasted.file];
    pasteCleanup = pasted.cleanup;
    console.log(`1 target from the clipboard (${pasted.kind})`);
  } else {
    const expanded = await expandTargets(options.targets, options.recursive);
    targets = expanded.targets;
    ignored = expanded.ignored;
  }

  if (targets.length === 0) {
    console.error('nothing to add');
    return { written: 0, skipped: 0, refused: 0, costUsd: 0 };
  }

  const isBatch = targets.length > 1;
  const resume = options.resume ?? isBatch;

  if (!options.paste) {
    const parts = [`${targets.length} target${targets.length === 1 ? '' : 's'}`];
    if (ignored > 0) parts.push(`${ignored} other file(s) ignored`);
    parts.push(`resume ${resume ? 'on' : 'off'}`);
    if (options.noExtract) parts.push('extraction off');
    if (options.noExplore) parts.push('exploration off');
    if (options.dryRun) parts.push('dry run');
    console.log(parts.join(', '));
  }

  if (isBatch && (options.note !== undefined || options.noteFile !== undefined)) {
    console.error('--note and --note-file are refused for a batch: a Note is about one Item');
    return { written: 0, skipped: 0, refused: targets.length, costUsd: 0 };
  }

  let note: string | null = null;
  if (options.noteFile !== undefined) note = (await readFile(options.noteFile, 'utf8')).trim();
  else if (options.note !== undefined) note = options.note;

  let written = 0;
  let skipped = 0;
  let refused = 0;
  let costUsd = 0;
  const started = Date.now();

  for (const target of targets) {
    const label = isUrl(target) ? target : path.basename(target);

    if (looksLikeBareHost(target)) {
      console.error(
        `fail  ${label}  nothing written\n` +
          `      a bare host is ambiguous. Write "https://${target}" for a URL or ` +
          `"./${target}" for a file.`,
      );
      refused += 1;
      continue;
    }

    if (isUrl(target)) {
      const preflight = refuseBeforeNavigation(target);
      if (preflight !== null) {
        console.error(`fail  ${label}  nothing written\n      ${preflight}`);
        refused += 1;
        continue;
      }
    }

    if (resume) {
      const present = await alreadyPresent(options.library, target);
      if (present !== null) {
        console.log(`skip  ${label}  already in library as ${present}`);
        skipped += 1;
        continue;
      }
    }

    let prepared: Prepared | null = null;
    try {
      prepared = isUrl(target)
        ? await prepareUrl(target, options)
        : await prepareFile(target, options);

      const id = newId();
      const extracted = options.noExtract
        ? {
            dna: undeterminedDna(),
            build: undeterminedBuild(),
            model: null,
            costUsd: null,
            durationMs: 0,
            promptVersion: null,
          }
        : await extractDna(prepared.pngPath, {
            model: options.model,
            observations: prepared.observations,
          });

      costUsd += extracted.costUsd ?? 0;

      const item: Item = Item.parse({
        schemaVersion: SCHEMA_VERSION,
        id,
        addedAt: new Date().toISOString(),
        source: prepared.source,
        capture: {
          file: `${id}.png`,
          takenAt: prepared.takenAt,
          pixelWidth: prepared.pixelWidth,
          pixelHeight: prepared.pixelHeight,
          mode: prepared.mode,
        },
        scope: options.scope,
        taxonomyVersion: CURRENT_TAXONOMY_VERSION,
        notApplicable: notApplicableFor(options.scope),
        note,
        authoredBy: {
          // `--no-extract` produces the mechanical half of a hand-written entry, so
          // it is honestly attributed to a hand rather than to a run that never
          // asked the agent anything.
          kind: options.noExtract ? 'hand' : 'cli',
          model: extracted.model,
          runAt: new Date().toISOString(),
          promptVersion: extracted.promptVersion,
        },
        dna: stampAuthorship(extracted.dna),
        build: stampBuildAuthorship(extracted.build),
      });

      if (options.dryRun) {
        console.log(`dry   ${label}  ${id}  ${options.scope}  (not written)`);
        console.log(JSON.stringify(item, null, 2));
        written += 1;
      } else {
        // Capture first, then the record. If the process dies between the two,
        // the residue is an orphan PNG that `dna check` names and you can delete.
        // The other order would leave an Item pointing at a Capture that does not
        // exist, which is a broken card in the grid rather than a stray file.
        await copyFile(prepared.pngPath, capturePath(options.library, id));
        await writeItem(options.library, item);

        const seconds = (extracted.durationMs / 1000).toFixed(1);
        const cost = extracted.costUsd === null ? '' : `  $${extracted.costUsd.toFixed(3)}`;
        const verdict = prepared.warnings.length > 0 ? 'warn' : 'ok  ';
        console.log(`${verdict}  ${label}  ${id}  ${options.scope}  ${seconds}s${cost}`);
        for (const warning of prepared.warnings) console.error(`      ${warning}`);
        written += 1;
      }
    } catch (error) {
      refused += 1;
      if (error instanceof ExtractionFailed) {
        console.error(`fail  ${label}  nothing written`);
        console.error(`      ${error.message}`);
        for (const issue of error.issues) console.error(`      ${issue}`);
      } else if (error instanceof CaptureRefused) {
        console.error(`fail  ${label}  nothing written\n      ${error.message}`);
      } else {
        console.error(`fail  ${label}  nothing written\n      ${(error as Error).message}`);
      }
    } finally {
      if (prepared !== null) await prepared.cleanup().catch(() => {});
    }
  }

  if (pasteCleanup !== null) await pasteCleanup().catch(() => {});

  const elapsed = ((Date.now() - started) / 1000).toFixed(0);
  const money = costUsd > 0 ? `, $${costUsd.toFixed(2)}` : '';
  console.log(`${written} written, ${skipped} skipped, ${refused} refused, ${elapsed}s${money}`);

  return { written, skipped, refused, costUsd };
}
