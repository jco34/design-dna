/**
 * `dna relabel` - re-ask only the label question against the stored Capture.
 *
 * This exists as its own verb rather than a flag on `re-extract` because the two
 * commands have opposite risk profiles. Re-running the full extraction to pick up
 * one new label value would re-roll all nine traits and could quietly replace a
 * palette or a philosophy paragraph you were happy with. Labels are a pick from a
 * closed list, not a measurement, so they can be re-asked in isolation with
 * nothing else at stake.
 *
 * `isRelabelable` is the gate that makes vocabulary evolution non-destructive: an
 * axis you overrode is a judgement call you made on purpose, and a later taxonomy
 * bump does not get to overwrite it. Only an axis still owned by the agent
 * (`authorship: 'agent'`) is ever replaced here. An Item whose three axes are all
 * overridden has nothing left for the agent to contribute, so it skips the call
 * entirely - a `free` Item costs nothing, in money or in risk.
 *
 * Every other trait, the Capture, the Note, the Scope, the id and `addedAt` are
 * left byte-identical. Only `dna.labels`, `taxonomyVersion` and (when a real
 * agent call happened) `authoredBy` move.
 */
import {
  CURRENT_TAXONOMY_VERSION,
  ExtractedLabels,
  isRelabelable,
  isStale,
  LABELS_JSON_SCHEMA,
  PROMPT_VERSION,
  type Item,
  type Labels,
} from '../../../schema/index.js';
import { runAgent, ExtractionFailed } from '../lib/extract.js';
import { isDirty, isUntracked } from '../lib/git.js';
import {
  capturePath,
  itemPath,
  listItemIds,
  readItem,
  writeItem,
  type LibraryPaths,
} from '../lib/library.js';

export interface RelabelOptions {
  readonly library: LibraryPaths;
  readonly ids?: readonly string[];
  readonly stale: boolean;
  readonly all: boolean;
  readonly model?: string;
  readonly dryRun: boolean;
  readonly force: boolean;
}

export interface RelabelOutcome {
  readonly updated: number;
  readonly unchanged: number;
  readonly refused: number;
  readonly costUsd: number;
}

/**
 * Wraps `LABELS_JSON_SCHEMA` the same way `MOTION_ONLY_SCHEMA` wraps
 * `MOTION_JSON_SCHEMA` in `schema/generation.ts`: one required top-level key so
 * the agent's structured output has somewhere to put the answer, built from the
 * same fragment the full extraction schema uses so the two can never describe
 * the taxonomy differently.
 */
const LABELS_ONLY_SCHEMA = {
  title: 'Design DNA labels',
  description:
    'How this design is filed so it can be found again. Report only the labels; every other trait of this design is untouched by this pass.',
  type: 'object',
  additionalProperties: false,
  required: ['labels'],
  properties: { labels: LABELS_JSON_SCHEMA },
} as const;

/** Order-insensitive equality for the (already-distinct) `style`/`mood` arrays. */
const sameSet = (a: readonly string[], b: readonly string[]): boolean => {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((v) => setB.has(v));
};

async function askForLabels(
  capture: string,
  model: string | undefined,
): Promise<{ labels: ExtractedLabels; model: string | null; costUsd: number | null }> {
  const prompt = [
    `Read the image at ${capture} and file this design under the label taxonomy below.`,
    ``,
    `This is a relabel pass: the design has not changed, only the vocabulary available`,
    `to describe it may have grown since it was first filed. Read the image as if for`,
    `the first time and choose fresh values; do not try to guess what an earlier pass`,
    `might have said.`,
    ``,
    `Choose only from the listed values. Never invent one. An empty style or mood`,
    `array is a normal, honest answer when nothing in the list is close, not a`,
    `failure to find something. Genre has no honest empty answer short of`,
    `"undetermined", so reach for that only when the capture truly does not show`,
    `what kind of design this is.`,
  ].join('\n');

  const result = await runAgent({
    prompt,
    schema: LABELS_ONLY_SCHEMA,
    model,
    allowedTools: ['Read'],
  });

  const payload = result.structured as { labels?: unknown } | undefined;
  const parsed = ExtractedLabels.safeParse(payload?.labels);
  if (!parsed.success) {
    throw new ExtractionFailed(
      'the agent output does not satisfy the labels schema',
      parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
    );
  }
  return { labels: parsed.data, model: result.model, costUsd: result.costUsd };
}

export async function relabel(options: RelabelOptions): Promise<RelabelOutcome> {
  let updated = 0;
  let unchanged = 0;
  let refused = 0;
  let costUsd = 0;
  const started = Date.now();

  let ids: readonly string[];
  if (options.ids && options.ids.length > 0) {
    ids = options.ids;
  } else if (options.stale) {
    const all = await listItemIds(options.library);
    const staleIds: string[] = [];
    const versions = new Set<number>();
    for (const id of all) {
      try {
        const item = await readItem(options.library, id);
        if (isStale(item)) {
          staleIds.push(id);
          versions.add(item.taxonomyVersion);
        }
      } catch {
        // An unreadable Item cannot be judged stale; it surfaces as its own
        // `fail` line only if it is selected some other way. `--stale` simply
        // cannot include what it cannot parse.
      }
    }
    ids = staleIds;
    const from = versions.size === 1 ? `${[...versions][0]}` : 'mixed';
    console.log(`${ids.length} stale Items (taxonomyVersion ${from}, current ${CURRENT_TAXONOMY_VERSION})`);
  } else if (options.all) {
    ids = await listItemIds(options.library);
    console.log(`${ids.length} Items`);
  } else {
    return { updated: 0, unchanged: 0, refused: 0, costUsd: 0 };
  }

  for (const id of ids) {
    let item: Item;
    try {
      item = await readItem(options.library, id);
    } catch (error) {
      console.error(`fail  ${id}  ${(error as Error).message}`);
      refused += 1;
      continue;
    }

    const file = itemPath(options.library, id);
    if (!options.force && !options.dryRun && (await isDirty(file))) {
      const untracked = await isUntracked(file);
      console.error(
        `fail  ${id}  nothing written\n` +
          `      the Item file has uncommitted changes, and ${
            untracked
              ? 'it has never been committed, so git cannot restore it at all'
              : 'git history is the only thing that could undo this'
          }. Commit it first, or pass --force.`,
      );
      refused += 1;
      continue;
    }

    const genreRelabelable = isRelabelable(item.dna.labels.genre);
    const styleRelabelable = isRelabelable(item.dna.labels.style);
    const moodRelabelable = isRelabelable(item.dna.labels.mood);

    if (!genreRelabelable && !styleRelabelable && !moodRelabelable) {
      // Fully overridden: there is nothing the agent could contribute, so there
      // is nothing to ask it. Only the vocabulary bookkeeping moves.
      if (item.taxonomyVersion === CURRENT_TAXONOMY_VERSION) {
        console.log(
          `free  ${id}  all axes overridden, taxonomyVersion ${item.taxonomyVersion} -> ${CURRENT_TAXONOMY_VERSION}`,
        );
        unchanged += 1;
        continue;
      }
      console.log(
        `free  ${id}  all axes overridden, taxonomyVersion ${item.taxonomyVersion} -> ${CURRENT_TAXONOMY_VERSION}` +
          (options.dryRun ? '  (not written)' : ''),
      );
      if (!options.dryRun) {
        await writeItem(options.library, { ...item, taxonomyVersion: CURRENT_TAXONOMY_VERSION });
      }
      updated += 1;
      continue;
    }

    try {
      const callStarted = Date.now();
      const fresh = await askForLabels(capturePath(options.library, id), options.model);
      costUsd += fresh.costUsd ?? 0;
      const elapsed = ((Date.now() - callStarted) / 1000).toFixed(1);
      const cost = fresh.costUsd === null ? '' : `  $${fresh.costUsd.toFixed(3)}`;

      const oldGenre = item.dna.labels.genre;
      const oldStyle = item.dna.labels.style;
      const oldMood = item.dna.labels.mood;

      const nextGenre =
        oldGenre.authorship === 'override'
          ? oldGenre
          : { value: fresh.labels.genre, authorship: 'agent' as const };
      const nextStyle =
        oldStyle.authorship === 'override'
          ? oldStyle
          : { values: fresh.labels.style, authorship: 'agent' as const };
      const nextMood =
        oldMood.authorship === 'override'
          ? oldMood
          : { values: fresh.labels.mood, authorship: 'agent' as const };

      const nextLabels: Labels = { genre: nextGenre, style: nextStyle, mood: nextMood };

      const changes: string[] = [];
      if (genreRelabelable && nextGenre.value !== oldGenre.value) {
        changes.push(`genre ${oldGenre.value} -> ${nextGenre.value}`);
      }
      if (styleRelabelable && !sameSet(oldStyle.values, nextStyle.values)) {
        changes.push(`style [${oldStyle.values.join(', ')}] -> [${nextStyle.values.join(', ')}]`);
      }
      if (moodRelabelable && !sameSet(oldMood.values, nextMood.values)) {
        changes.push(`mood [${oldMood.values.join(', ')}] -> [${nextMood.values.join(', ')}]`);
      }

      const next: Item = {
        ...item,
        authoredBy: {
          kind: 'cli',
          model: fresh.model,
          runAt: new Date().toISOString(),
          promptVersion: PROMPT_VERSION,
        },
        taxonomyVersion: CURRENT_TAXONOMY_VERSION,
        dna: { ...item.dna, labels: nextLabels },
      };

      const versionBump = item.taxonomyVersion !== CURRENT_TAXONOMY_VERSION;

      if (changes.length === 0) {
        if (!versionBump) {
          console.log(`same  ${id}  no change  ${elapsed}s${cost}`);
          unchanged += 1;
          continue;
        }
        console.log(
          `same  ${id}  no change, taxonomyVersion ${item.taxonomyVersion} -> ${CURRENT_TAXONOMY_VERSION}  ${elapsed}s${cost}` +
            (options.dryRun ? '  (not written)' : ''),
        );
        if (!options.dryRun) {
          await writeItem(options.library, next);
        }
        unchanged += 1;
        continue;
      }

      if (options.dryRun) {
        console.log(`dry   ${id}  ${changes.join(', ')}  ${elapsed}s${cost}  (not written)`);
        updated += 1;
        continue;
      }

      await writeItem(options.library, next);
      console.log(`ok    ${id}  ${changes.join(', ')}  ${elapsed}s${cost}`);
      updated += 1;
    } catch (error) {
      refused += 1;
      if (error instanceof ExtractionFailed) {
        console.error(`fail  ${id}  nothing written\n      ${error.message}`);
        for (const issue of error.issues) console.error(`      ${issue}`);
      } else {
        console.error(`fail  ${id}  nothing written\n      ${(error as Error).message}`);
      }
    }
  }

  const elapsed = ((Date.now() - started) / 1000).toFixed(0);
  const money = costUsd > 0 ? `, $${costUsd.toFixed(2)}` : '';
  console.log(`${updated} relabelled, ${unchanged} unchanged, ${refused} refused, ${elapsed}s${money}`);
  return { updated, unchanged, refused, costUsd };
}
