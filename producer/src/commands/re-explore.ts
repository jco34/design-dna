/**
 * `dna re-explore` - revisit a live URL and rewrite only the motion trait.
 *
 * This verb exists because of a collision the motion trait created with ticket
 * 008, and it is worth stating plainly rather than leaving in a commit message.
 *
 * 008 specifies that `re-extract` "reads the stored Capture and never visits the
 * network, so a re-run works offline and works after the site has been redesigned
 * or deleted". That is the right rule for the eight traits whose evidence *is* the
 * Capture. Motion's evidence is the live page, so `re-extract` cannot refresh it at
 * any price: no amount of re-reading a PNG will show you a scroll animation.
 *
 * The invariant 008 was actually protecting survives intact here. The Capture is
 * still fixed at the moment of saving and is never re-taken; this verb opens no
 * screenshot path at all. What it relaxes is "never visits the network", and only
 * for the one trait that was never readable from a Capture in the first place.
 *
 * Consequences that follow from that, and are enforced below:
 *
 *   - a `file` Source has no live page, so it is refused by name rather than
 *     quietly leaving motion Undetermined
 *   - an `override` on motion is kept, because 006's merge rule does not stop
 *     applying just because a new verb is doing the writing
 *   - a dead or now-gated URL is refused, so good motion data is never replaced by
 *     observations of a sign-in form
 *   - every other trait, the Capture, the Note, the id and `addedAt` are left
 *     byte-identical
 */
import path from 'node:path';
import {
  ExtractedMotion,
  MOTION_ONLY_SCHEMA,
  PROMPT_VERSION,
  type Item,
} from '../../../schema/index.js';
import { exploreUrl, CaptureRefused, type MotionObservations } from '../lib/capture.js';
import { runAgent, ExtractionFailed, motionBriefing } from '../lib/extract.js';
import { isDirty, isUntracked } from '../lib/git.js';
import { capturePath, itemPath, readItem, writeItem, type LibraryPaths } from '../lib/library.js';

export interface ReExploreOptions {
  readonly library: LibraryPaths;
  readonly ids: readonly string[];
  readonly model?: string;
  readonly dryRun: boolean;
  readonly force: boolean;
}

export interface ReExploreOutcome {
  readonly updated: number;
  readonly unchanged: number;
  readonly refused: number;
  readonly costUsd: number;
}

/** A one-line summary of what a motion trait says, for the before/after report. */
const summarise = (m: Item['dna']['motion']): string => {
  const triggers = m.triggers.length === 0 ? 'no triggers' : m.triggers.join('/');
  return `${m.presence}, ${triggers}, ${m.easing} at ${m.pace} pace`;
};

async function askForMotion(
  capture: string,
  observations: MotionObservations,
  model: string | undefined,
): Promise<{ motion: ExtractedMotion; model: string | null; costUsd: number | null }> {
  const prompt = [
    `Read the image at ${capture} for visual context, then describe how this design`,
    `behaves over time.`,
    ``,
    `The image is a still frame and cannot show you motion. It is here only so you can`,
    `name *what* moves in the design's own terms - "the wordmark", "the tour date rows" -`,
    `rather than describing anonymous elements. The observations below are your actual`,
    `evidence for the motion itself.`,
    ``,
    motionBriefing(observations),
  ].join('\n');

  const result = await runAgent({
    prompt,
    schema: MOTION_ONLY_SCHEMA,
    model,
    allowedTools: ['Read'],
  });

  const payload = result.structured as { motion?: unknown } | undefined;
  const parsed = ExtractedMotion.safeParse(payload?.motion);
  if (!parsed.success) {
    throw new ExtractionFailed(
      'the agent output does not satisfy the motion schema',
      parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
    );
  }
  return { motion: parsed.data, model: result.model, costUsd: result.costUsd };
}

export async function reExplore(options: ReExploreOptions): Promise<ReExploreOutcome> {
  let updated = 0;
  let unchanged = 0;
  let refused = 0;
  let costUsd = 0;
  const started = Date.now();

  for (const id of options.ids) {
    let item: Item;
    try {
      item = await readItem(options.library, id);
    } catch (error) {
      console.error(`fail  ${id}  ${(error as Error).message}`);
      refused += 1;
      continue;
    }

    if (item.source.kind !== 'url') {
      console.error(
        `fail  ${id}  nothing written\n` +
          `      this Item was saved from a file, so there is no live page to explore. ` +
          `Motion can only be read from a URL.`,
      );
      refused += 1;
      continue;
    }

    // 006's merge rule, applied by the verb that would otherwise quietly break it.
    if (item.dna.motion.authorship === 'override' && !options.force) {
      console.log(`keep  ${id}  motion is an override; --force to replace it`);
      unchanged += 1;
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

    const url = item.source.url;
    try {
      const observations = await exploreUrl(url);
      const fresh = await askForMotion(
        capturePath(options.library, id),
        observations,
        options.model,
      );
      costUsd += fresh.costUsd ?? 0;

      const before = summarise(item.dna.motion);
      const next: Item = {
        ...item,
        // Only `authoredBy` and `dna.motion` move. Every other trait, the Capture,
        // the Note, the Scope, the id and `addedAt` are carried through untouched.
        authoredBy: {
          kind: 'cli',
          model: fresh.model,
          runAt: new Date().toISOString(),
          promptVersion: PROMPT_VERSION,
        },
        dna: { ...item.dna, motion: { ...fresh.motion, authorship: 'agent' } },
      };
      const after = summarise(next.dna.motion);

      if (options.dryRun) {
        console.log(`dry   ${id}  ${before}  ->  ${after}  (not written)`);
        console.log(JSON.stringify(next.dna.motion, null, 2));
        updated += 1;
        continue;
      }

      await writeItem(options.library, next);
      const cost = fresh.costUsd === null ? '' : `  $${fresh.costUsd.toFixed(3)}`;
      console.log(`ok    ${id}${cost}`);
      console.log(`      was: ${before}`);
      console.log(`      now: ${after}`);
      if (observations.scripted.libraries.length > 0) {
        console.log(`      via: ${observations.scripted.libraries.join(', ')}`);
      }
      console.log(
        `      measured: ${observations.scroll.revealed} revealed, ` +
          `${observations.scroll.parallax} parallax, across ` +
          `${observations.scroll.depthViewports} viewports`,
      );
      updated += 1;
    } catch (error) {
      refused += 1;
      if (error instanceof CaptureRefused) {
        console.error(
          `fail  ${id}  nothing written\n      ${error.message}\n` +
            `      motion is left exactly as it was.`,
        );
      } else if (error instanceof ExtractionFailed) {
        console.error(`fail  ${id}  nothing written\n      ${error.message}`);
        for (const issue of error.issues) console.error(`      ${issue}`);
      } else {
        console.error(`fail  ${id}  nothing written\n      ${(error as Error).message}`);
      }
    }
  }

  const elapsed = ((Date.now() - started) / 1000).toFixed(0);
  const money = costUsd > 0 ? `, $${costUsd.toFixed(2)}` : '';
  console.log(`${updated} updated, ${unchanged} kept, ${refused} refused, ${elapsed}s${money}`);
  return { updated, unchanged, refused, costUsd };
}
