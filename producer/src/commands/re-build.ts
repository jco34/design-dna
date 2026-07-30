/**
 * `dna re-build` - regenerate only the Build: the suggested stack and
 * techniques for replicating an Item.
 *
 * This is the Build's equivalent of `re-explore` for motion, but simpler: the
 * Build's evidence is the stored Capture plus the already-stored DNA, not a
 * live page, so this command works for both a `url` and a `file` Source and
 * never visits the network. It exists as its own verb rather than folding
 * into `re-extract` for the same reason `re-explore` is its own verb:
 * backfilling a Build should not disturb DNA you are already happy with, and
 * `re-extract` already has its own cost and its own "no --all" rule for a
 * different reason (it re-rolls hexes you may have overridden).
 *
 * Every trait, the Note, the Scope, the id and addedAt are left
 * byte-identical; only `build` and `authoredBy` move. A Build you wrote by
 * hand (`authorship: 'written'`) is kept unless `--force`.
 */
import {
  BUILD_ONLY_SCHEMA,
  ExtractedBuild,
  PROMPT_VERSION,
  type Item,
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

export interface ReBuildOptions {
  readonly library: LibraryPaths;
  readonly ids: readonly string[];
  readonly all: boolean;
  readonly model?: string;
  readonly dryRun: boolean;
  readonly force: boolean;
}

export interface ReBuildOutcome {
  readonly updated: number;
  readonly unchanged: number;
  readonly refused: number;
  readonly costUsd: number;
}

const summarise = (b: Item['build']): string =>
  b.stack.length === 0 ? 'undetermined' : b.stack.join(' + ');

/**
 * The Build's only grounding, since this command never re-reads the Capture
 * as evidence for the other eight traits. Plain text, not JSON, because it is
 * read by the same model that reads the image - it is a briefing, not a
 * payload.
 */
function buildBriefing(item: Item): string {
  const lines: string[] = [
    'What is already known about this design, read from its stored analysis:',
    '',
  ];

  const imagery = item.dna.imagery;
  lines.push(
    imagery.kind === 'undetermined'
      ? '- imagery: not read'
      : `- imagery: ${imagery.kind}${imagery.treatment ? `, ${imagery.treatment}` : ''}`,
  );

  const motion = item.dna.motion;
  lines.push(
    motion.presence === 'undetermined'
      ? '- motion: not observed'
      : `- motion: ${motion.presence}${motion.character ? `, ${motion.character}` : ''}${motion.choreography ? `; ${motion.choreography}` : ''}`,
  );

  const composition = item.dna.composition;
  lines.push(
    composition.structure === ''
      ? '- composition: not read'
      : `- composition: ${composition.structure} (${composition.contentWidth})`,
  );

  return lines.join('\n');
}

async function askForBuild(
  capture: string,
  item: Item,
  model: string | undefined,
): Promise<{ build: ExtractedBuild; model: string | null; costUsd: number | null }> {
  const prompt = [
    `Read the image at ${capture} for visual context, then suggest how you would`,
    `actually replicate this design.`,
    '',
    buildBriefing(item),
    '',
    'Key off the above: a 3D or heavily animated design calls for a real 3D/motion',
    'stack; a plain static page calls for almost nothing distinctive, and an empty',
    'stack with empty techniques is the honest answer for it. Never invent internals',
    'you cannot see from the design alone - no state management, no backend, no data',
    'layer claims. Name candidate tools, most load-bearing first, then the 2-4',
    'techniques specific to this design.',
  ].join('\n');

  const result = await runAgent({
    prompt,
    schema: BUILD_ONLY_SCHEMA,
    model,
    allowedTools: ['Read'],
  });

  const payload = result.structured as { build?: unknown } | undefined;
  const parsed = ExtractedBuild.safeParse(payload?.build);
  if (!parsed.success) {
    throw new ExtractionFailed(
      'the agent output does not satisfy the build schema',
      parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
    );
  }
  return { build: parsed.data, model: result.model, costUsd: result.costUsd };
}

export async function reBuild(options: ReBuildOptions): Promise<ReBuildOutcome> {
  let updated = 0;
  let unchanged = 0;
  let refused = 0;
  let costUsd = 0;
  const started = Date.now();

  const ids = options.all ? await listItemIds(options.library) : options.ids;

  for (const id of ids) {
    let item: Item;
    try {
      item = await readItem(options.library, id);
    } catch (error) {
      console.error(`fail  ${id}  ${(error as Error).message}`);
      refused += 1;
      continue;
    }

    // 006's merge rule, applied by the verb that would otherwise quietly
    // break it: a Build you wrote by hand stays put unless you ask otherwise.
    if (item.build.authorship === 'written' && !options.force) {
      console.log(`keep  ${id}  build is written by hand; --force to replace it`);
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

    try {
      const fresh = await askForBuild(capturePath(options.library, id), item, options.model);
      costUsd += fresh.costUsd ?? 0;

      const before = summarise(item.build);
      const next: Item = {
        ...item,
        // Only `authoredBy` and `build` move. Every other trait, the Capture,
        // the Note, the Scope, the id and `addedAt` are carried through
        // untouched.
        authoredBy: {
          kind: 'cli',
          model: fresh.model,
          runAt: new Date().toISOString(),
          promptVersion: PROMPT_VERSION,
        },
        build: { ...fresh.build, authorship: 'suggested' },
      };
      const after = summarise(next.build);

      if (options.dryRun) {
        console.log(`dry   ${id}  ${before}  ->  ${after}  (not written)`);
        console.log(JSON.stringify(next.build, null, 2));
        updated += 1;
        continue;
      }

      await writeItem(options.library, next);
      const cost = fresh.costUsd === null ? '' : `  $${fresh.costUsd.toFixed(3)}`;
      console.log(`ok    ${id}${cost}`);
      console.log(`      was: ${before}`);
      console.log(`      now: ${after}`);
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
  console.log(`${updated} updated, ${unchanged} kept, ${refused} refused, ${elapsed}s${money}`);
  return { updated, unchanged, refused, costUsd };
}
