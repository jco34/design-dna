/**
 * schemaVersion 1 -> 2: add the `motion` trait.
 *
 * A migration script is a pure function. It never reads the filesystem, never
 * validates, never writes, and never logs. Finding the pending scripts,
 * ordering them, applying them, validating the result against the current schema
 * and writing it are all the runner's job (`migrations/run.ts`), so that a
 * migration author has exactly one thing to get right.
 *
 * Ticket 008 decision 7 is why this exists as a migration at all rather than as
 * a tolerated absence: the rule is "if `Item.parse` would reject the old file it
 * is `schemaVersion`, else `taxonomyVersion`". A record with no `dna.motion` is
 * rejected outright, so it is a shape change and it migrates.
 *
 * Numbering follows the target `schemaVersion`, not the order of authorship.
 * 008 section "collisions" earmarked 1 -> 2 for `capture.sha256`; motion got
 * here first, so the hash becomes 003 and inherits the same mechanism, now
 * exercised once against a real library rather than reasoned about.
 */

export const from = 1;
export const to = 2;

/**
 * Every leaf Undetermined, and that is the only honest option.
 *
 * `docs/EXTRACTION.md` section B.3 draws the line this depends on: `none` is a
 * claim about the design ("this design does not move"), `undetermined` is a
 * statement about the reading ("the evidence could not say"). A migration has no
 * evidence whatsoever - it never sees the Capture, let alone the live site - so
 * any value other than Undetermined would be a fabrication written by a script.
 *
 * That includes the five seed Items, whose pages `seed/README.md` documents as
 * animation-free. It is very probably `presence: 'none'`, and this migration
 * still must not say so: it does not know, and the whole authorship system
 * exists so that "probably" is never recorded as fact. Run `dna re-extract`, or
 * write an Override, and the value arrives attributed to whoever actually
 * determined it.
 *
 * `authorship: 'agent'` rather than `'override'`, and the choice is load-bearing
 * rather than cosmetic. Neither member is literally true of a script-inserted
 * placeholder, so the tie breaks on consequence: 006's merge rule keeps an
 * `override` trait verbatim and refreshes an `agent` one. Marking this
 * `override` would pin an empty placeholder in place permanently, and the next
 * `re-extract` would dutifully preserve nothing. `agent` makes it replaceable,
 * which is the entire point of writing a placeholder instead of a value.
 */
const UNDETERMINED_MOTION = {
  presence: 'undetermined',
  triggers: [] as string[],
  easing: 'undetermined',
  pace: 'undetermined',
  character: '',
  choreography: '',
  authorship: 'agent',
} as const;

/**
 * Key order is part of the contract, not a formatting preference.
 *
 * `dna validate` rule 4 requires canonical form, which includes "keys in the
 * declaration order of Item". `motion` is declared between `imagery` and
 * `philosophy` in `schema/dna.ts`, so it is rebuilt in that position here rather
 * than spread-appended, which would put it after `labels` and fail the very
 * check this migration exists to pass.
 */
export function up(record: unknown): unknown {
  if (typeof record !== 'object' || record === null) {
    throw new Error('expected an object');
  }

  const item = record as Record<string, unknown>;
  const dna = item.dna;
  if (typeof dna !== 'object' || dna === null) {
    throw new Error('expected `dna` to be an object');
  }

  const {
    palette,
    typography,
    composition,
    spacing,
    surfaceTreatment,
    imagery,
    philosophy,
    labels,
    ...unknownTraits
  } = dna as Record<string, unknown>;

  // `Dna` is `.strict()`, so an unrecognised trait would fail validation in the
  // runner with a path but no explanation. Failing here names the offender, and
  // the all-or-nothing runner means the library is still untouched.
  const leftover = Object.keys(unknownTraits);
  if (leftover.length > 0) {
    throw new Error(`unrecognised trait(s) in dna: ${leftover.join(', ')}`);
  }

  return {
    ...item,
    schemaVersion: to,
    dna: {
      palette,
      typography,
      composition,
      spacing,
      surfaceTreatment,
      imagery,
      motion: UNDETERMINED_MOTION,
      philosophy,
      labels,
    },
  };
}
