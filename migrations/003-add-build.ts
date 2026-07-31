/**
 * schemaVersion 2 -> 3: add the `build` field.
 *
 * A migration script is a pure function: never reads the filesystem, never
 * validates, never writes, never logs. `migrations/run.ts` finds it, orders
 * it, applies it, validates the result against the current schema and writes
 * it. See `002-add-motion.ts` for the fuller version of this rule.
 *
 * Every leaf Undetermined, for the same reason `002` seeded motion that way:
 * a migration has no evidence whatsoever, so any other value would be a
 * fabrication written by a script. `authorship: 'suggested'` rather than
 * `'written'` for the same load-bearing reason `002` chose `agent` over
 * `override` for motion - it has to stay replaceable. `dna re-build --all`
 * is what actually fills this in; see `docs/EXTRACTION.md` section 6.
 */

export const from = 2;
export const to = 3;

const UNDETERMINED_BUILD = {
  stack: [] as string[],
  techniques: '',
  authorship: 'suggested',
} as const;

/**
 * Key order is part of the contract, not a formatting preference: `dna
 * validate` rule 4 requires canonical form, keys in `Item`'s declaration
 * order. `build` is declared immediately after `dna`, so it is rebuilt in
 * that position here rather than spread-appended.
 */
export function up(record: unknown): unknown {
  if (typeof record !== 'object' || record === null) {
    throw new Error('expected an object');
  }
  const item = record as Record<string, unknown>;

  if ('build' in item) {
    throw new Error('record already has a `build` field');
  }

  return {
    schemaVersion: to,
    id: item.id,
    addedAt: item.addedAt,
    source: item.source,
    capture: item.capture,
    scope: item.scope,
    taxonomyVersion: item.taxonomyVersion,
    notApplicable: item.notApplicable,
    note: item.note,
    authoredBy: item.authoredBy,
    dna: item.dna,
    build: UNDETERMINED_BUILD,
  };
}
