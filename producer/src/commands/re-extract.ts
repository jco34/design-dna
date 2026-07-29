/**
 * `dna re-extract` - re-read the stored Capture of an existing Item and merge
 * the fresh reading in.
 *
 * This is 008's other half of "re-extraction is not idempotent": unlike
 * `re-explore`, source kind does not matter here, because this verb reads
 * `library/captures/<id>.png`, which exists for both a `url` and a `file`
 * Source. There is no live page involved and none is needed.
 *
 * `dna.motion` and `dna.labels` are never touched by this command. Motion's
 * only valid evidence is a live page, which is `re-explore`'s job; a fresh read
 * of a still image is honestly always Undetermined per the extraction
 * doctrine, so merging it here would silently destroy good motion data on
 * every re-run. Labels belong to `relabel`. Both are carried through
 * byte-identical from what `readItem` returned.
 *
 * The remaining 11 units (5 palette swatches, 6 traits) are merged one at a
 * time: an `override` is kept verbatim, anything else is replaced by the fresh
 * reading and stamped `agent`. A `--scope` correction can then force a unit
 * back to Undetermined regardless of authorship, when the new Scope excludes
 * a trait the old one did not - that is a third outcome, `reset`, kept apart
 * from `replaced` and `kept` in both the counts and the log lines.
 */
import {
  CURRENT_TAXONOMY_VERSION,
  notApplicableFor,
  PROMPT_VERSION,
  type Authorship,
  type Dna,
  type ExtractedDna,
  type Item,
  type Scope,
  type TraitName,
} from '../../../schema/index.js';
import { extractDna, undeterminedDna, ExtractionFailed } from '../lib/extract.js';
import { isDirty, isUntracked } from '../lib/git.js';
import { capturePath, itemPath, readItem, writeItem, type LibraryPaths } from '../lib/library.js';

export interface ReExtractOptions {
  readonly library: LibraryPaths;
  readonly ids: readonly string[];
  readonly scope?: Scope;
  readonly model?: string;
  readonly dryRun: boolean;
  readonly force: boolean;
}

export interface ReExtractOutcome {
  readonly updated: number;
  readonly unchanged: number;
  readonly refused: number;
  readonly costUsd: number;
}

/* ------------------------------------------------------------------ */
/* Per-unit merge                                                      */
/* ------------------------------------------------------------------ */

interface MergeResult<T> {
  readonly value: T;
  readonly replaced: boolean;
  /** Set only when the unit was kept, ready to print as-is. */
  readonly keptLine: string | null;
}

type PaletteRole = keyof Dna['palette'];
type PaletteSwatch = Dna['palette']['background'];

function mergeSwatch(
  role: PaletteRole,
  stored: PaletteSwatch,
  fresh: ExtractedDna['palette'][PaletteRole],
): MergeResult<PaletteSwatch> {
  if (stored.authorship === 'override') {
    return {
      value: stored,
      replaced: false,
      keptLine: `palette.${role} kept: ${stored.hex} (override)`,
    };
  }
  return { value: { ...fresh, authorship: 'agent' }, replaced: true, keptLine: null };
}

function mergeTrait<T extends { authorship: Authorship }>(
  name: string,
  stored: T,
  fresh: Omit<T, 'authorship'>,
): MergeResult<T> {
  if (stored.authorship === 'override') {
    return { value: stored, replaced: false, keptLine: `${name} kept (override)` };
  }
  return { value: { ...fresh, authorship: 'agent' } as T, replaced: true, keptLine: null };
}

/* ------------------------------------------------------------------ */
/* The scope-driven forced reset, applied on top of a merge             */
/* ------------------------------------------------------------------ */

type Fate = 'replaced' | 'kept' | 'reset';

interface FinalUnit<T> {
  readonly value: T;
  readonly fate: Fate;
  readonly line: string | null;
}

/** `resetValue` is non-null exactly when a `--scope` change excludes this unit. */
function finalize<T>(merged: MergeResult<T>, resetValue: T | null): FinalUnit<T> {
  if (resetValue !== null) return { value: resetValue, fate: 'reset', line: null };
  return { value: merged.value, fate: merged.replaced ? 'replaced' : 'kept', line: merged.keptLine };
}

/* ------------------------------------------------------------------ */
/* The command                                                         */
/* ------------------------------------------------------------------ */

export async function reExtract(options: ReExtractOptions): Promise<ReExtractOutcome> {
  let updated = 0;
  const unchanged = 0;
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
      const extracted = await extractDna(capturePath(options.library, id), {
        model: options.model,
      });
      costUsd += extracted.costUsd ?? 0;

      const bg = mergeSwatch('background', item.dna.palette.background, extracted.dna.palette.background);
      const surface = mergeSwatch('surface', item.dna.palette.surface, extracted.dna.palette.surface);
      const ink = mergeSwatch('ink', item.dna.palette.ink, extracted.dna.palette.ink);
      const muted = mergeSwatch('muted', item.dna.palette.muted, extracted.dna.palette.muted);
      const accent = mergeSwatch('accent', item.dna.palette.accent, extracted.dna.palette.accent);
      const typography = mergeTrait('typography', item.dna.typography, extracted.dna.typography);
      const composition = mergeTrait('composition', item.dna.composition, extracted.dna.composition);
      const spacing = mergeTrait('spacing', item.dna.spacing, extracted.dna.spacing);
      const surfaceTreatment = mergeTrait(
        'surfaceTreatment',
        item.dna.surfaceTreatment,
        extracted.dna.surfaceTreatment,
      );
      const imagery = mergeTrait('imagery', item.dna.imagery, extracted.dna.imagery);
      const philosophy = mergeTrait('philosophy', item.dna.philosophy, extracted.dna.philosophy);

      // Which trait names a `--scope` correction newly excludes. `motion` is
      // filtered out on purpose: it is never touched by this command, scope
      // change or not, for the reason given at the top of this file.
      let scope = item.scope;
      let notApplicable = item.notApplicable;
      const resetTraitNames: TraitName[] = [];

      if (options.scope !== undefined && options.scope !== item.scope) {
        scope = options.scope;
        const nextNotApplicable = notApplicableFor(options.scope);
        for (const trait of nextNotApplicable) {
          if (trait !== 'motion' && !item.notApplicable.includes(trait)) {
            resetTraitNames.push(trait);
          }
        }
        notApplicable = nextNotApplicable;
      }
      const resetting = (trait: TraitName): boolean => resetTraitNames.includes(trait);
      const und = resetTraitNames.length > 0 ? undeterminedDna() : null;
      const undeterminedSwatch: PaletteSwatch = { hex: '', weight: 'undetermined', authorship: 'agent' };

      const bgFinal = finalize(bg, resetting('palette') ? undeterminedSwatch : null);
      const surfaceFinal = finalize(surface, resetting('palette') ? undeterminedSwatch : null);
      const inkFinal = finalize(ink, resetting('palette') ? undeterminedSwatch : null);
      const mutedFinal = finalize(muted, resetting('palette') ? undeterminedSwatch : null);
      const accentFinal = finalize(accent, resetting('palette') ? undeterminedSwatch : null);
      const typographyFinal = finalize(
        typography,
        resetting('typography') && und !== null
          ? { ...und.typography, authorship: 'agent' as const }
          : null,
      );
      const compositionFinal = finalize(
        composition,
        resetting('composition') && und !== null
          ? { ...und.composition, authorship: 'agent' as const }
          : null,
      );
      const spacingFinal = finalize(
        spacing,
        resetting('spacing') && und !== null
          ? { ...und.spacing, authorship: 'agent' as const }
          : null,
      );
      const surfaceTreatmentFinal = finalize(
        surfaceTreatment,
        resetting('surfaceTreatment') && und !== null
          ? { ...und.surfaceTreatment, authorship: 'agent' as const }
          : null,
      );
      const imageryFinal = finalize(
        imagery,
        resetting('imagery') && und !== null ? { ...und.imagery, authorship: 'agent' as const } : null,
      );
      const philosophyFinal = finalize(
        philosophy,
        resetting('philosophy') && und !== null
          ? { ...und.philosophy, authorship: 'agent' as const }
          : null,
      );

      const dna: Dna = {
        palette: {
          background: bgFinal.value,
          surface: surfaceFinal.value,
          ink: inkFinal.value,
          muted: mutedFinal.value,
          accent: accentFinal.value,
        },
        typography: typographyFinal.value,
        composition: compositionFinal.value,
        spacing: spacingFinal.value,
        surfaceTreatment: surfaceTreatmentFinal.value,
        imagery: imageryFinal.value,
        // Carried through untouched. See the file header.
        motion: item.dna.motion,
        philosophy: philosophyFinal.value,
        labels: item.dna.labels,
      };

      const allFinals = [
        bgFinal,
        surfaceFinal,
        inkFinal,
        mutedFinal,
        accentFinal,
        typographyFinal,
        compositionFinal,
        spacingFinal,
        surfaceTreatmentFinal,
        imageryFinal,
        philosophyFinal,
      ];
      const replacedCount = allFinals.filter((f) => f.fate === 'replaced').length;
      const keptCount = allFinals.filter((f) => f.fate === 'kept').length;
      const resetCount = allFinals.filter((f) => f.fate === 'reset').length;
      const keptLines = allFinals
        .map((f) => f.line)
        .filter((line): line is string => line !== null);
      // One line per reset *trait*, not per unit: a hypothetical palette-wide
      // reset is still one sentence about one trait, not five.
      const resetLines = resetTraitNames.map((trait) => `${trait} reset: scope now excludes it`);

      const next: Item = {
        ...item,
        scope,
        notApplicable,
        taxonomyVersion: CURRENT_TAXONOMY_VERSION,
        authoredBy: {
          kind: 'cli',
          model: extracted.model,
          runAt: new Date().toISOString(),
          promptVersion: PROMPT_VERSION,
        },
        dna,
      };

      const summaryParts = [`${replacedCount} replaced`, `${keptCount} kept (override)`];
      if (resetCount > 0) summaryParts.push(`${resetCount} reset`);
      const summary = summaryParts.join(', ');

      if (options.dryRun) {
        console.log(`dry   ${id}  ${summary}  (not written)`);
        for (const line of [...keptLines, ...resetLines]) console.log(`      ${line}`);
        console.log(JSON.stringify(next, null, 2));
        updated += 1;
        continue;
      }

      await writeItem(options.library, next);
      const seconds = (extracted.durationMs / 1000).toFixed(1);
      const cost = extracted.costUsd === null ? '' : `  $${extracted.costUsd.toFixed(3)}`;
      console.log(`ok    ${id}  ${summary}  ${seconds}s${cost}`);
      for (const line of [...keptLines, ...resetLines]) console.log(`      ${line}`);
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
