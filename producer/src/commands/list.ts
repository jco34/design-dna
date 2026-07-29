/**
 * `dna list` - a read-only report of every Item in the library.
 *
 * Before this verb, finding an Item's id meant opening the web app or grepping
 * filenames directly. That is a real gap: `re-extract`, `re-explore`, `relabel`
 * and `note` all take an id as their first argument, and nothing on the CLI side
 * could answer "which id do I hand it". This exists to answer exactly that
 * question, so the columns are chosen for deciding what to act on next, not for
 * a full dump of an Item's DNA.
 */
import { isStale, TAXONOMY_VERSION, type Item } from '../../../schema/index.js';
import { listItemIds, readItem, type LibraryPaths } from '../lib/library.js';

export interface ListOptions {
  readonly library: LibraryPaths;
  readonly stale: boolean;
  readonly json: boolean;
}

export interface ListOutcome {
  readonly count: number;
}

interface Row {
  readonly id: string;
  readonly source: string;
  readonly scope: string;
  readonly motion: string;
  readonly reExplorable: boolean;
  readonly stale: boolean;
}

interface UnreadableRow {
  readonly id: string;
  readonly unreadable: string;
}

const describeSource = (item: Item): string => {
  if (item.source.kind === 'url') return item.source.url;
  return item.source.url === null
    ? item.source.originalPath
    : `${item.source.originalPath} (${item.source.url})`;
};

const toRow = (id: string, item: Item): Row => ({
  id,
  source: describeSource(item),
  scope: item.scope,
  motion: item.dna.motion.presence,
  reExplorable: item.source.kind === 'url',
  stale: isStale(item),
});

export async function listItems(options: ListOptions): Promise<ListOutcome> {
  const ids = await listItemIds(options.library);
  const rows: Row[] = [];
  const unreadable: UnreadableRow[] = [];

  for (const id of ids) {
    try {
      const item = await readItem(options.library, id);
      rows.push(toRow(id, item));
    } catch (error) {
      unreadable.push({ id, unreadable: (error as Error).message });
    }
  }

  const filteredRows = options.stale ? rows.filter((r) => r.stale) : rows;
  // An unreadable record can't be judged stale, so `--stale` never hides it:
  // filtering out a broken record here would be worse than showing it as broken.
  const count = filteredRows.length + unreadable.length;

  if (options.json) {
    for (const row of filteredRows) {
      console.log(
        JSON.stringify({
          id: row.id,
          source: row.source,
          scope: row.scope,
          motion: row.motion,
          reExplorable: row.reExplorable,
          stale: row.stale,
        }),
      );
    }
    for (const row of unreadable) {
      console.log(JSON.stringify({ id: row.id, unreadable: row.unreadable }));
    }
    return { count };
  }

  const idWidth = Math.max(2, ...[...filteredRows, ...unreadable].map((r) => r.id.length));
  const scopeWidth = Math.max(5, ...filteredRows.map((r) => r.scope.length));
  const motionWidth = Math.max(6, ...filteredRows.map((r) => r.motion.length));
  const reExploreWidth = 'no (file)'.length;

  console.log(
    `${'ID'.padEnd(idWidth)}  ${'SCOPE'.padEnd(scopeWidth)}  ${'MOTION'.padEnd(motionWidth)}  ` +
      `${'RE-EXPLORE'.padEnd(reExploreWidth)}  ${'STALE'.padEnd(5)}  SOURCE`,
  );

  for (const row of filteredRows) {
    const reExplore = row.reExplorable ? 'yes' : 'no (file)';
    const stale = row.stale ? 'stale' : '';
    console.log(
      `${row.id.padEnd(idWidth)}  ${row.scope.padEnd(scopeWidth)}  ${row.motion.padEnd(motionWidth)}  ` +
        `${reExplore.padEnd(reExploreWidth)}  ${stale.padEnd(5)}  ${row.source}`,
    );
  }

  for (const row of unreadable) {
    console.log(`${row.id.padEnd(idWidth)}  (unreadable: ${row.unreadable})`);
  }

  const reExplorableCount = filteredRows.filter((r) => r.reExplorable).length;
  const staleCount = filteredRows.filter((r) => r.stale).length;
  const staleClause = staleCount > 0 ? `, ${staleCount} stale (taxonomyVersion behind ${TAXONOMY_VERSION})` : '';
  console.log(`${count} Item(s), ${reExplorableCount} re-explorable${staleClause}`);

  return { count };
}
