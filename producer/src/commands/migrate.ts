/**
 * `dna migrate` - thin adapter over the standalone migration runner.
 *
 * `migrations/run.ts` owns everything about the migration itself (finding
 * pending scripts, the all-or-nothing guarantee, the dirty-tree refusal, the
 * `.migrate-dry-run/` scratch write). This module only threads the CLI's
 * resolved `LibraryPaths` through to it and reshapes the result to the
 * producer's command outcome shape.
 */
import { runMigrations } from '../../../migrations/run.js';
import type { LibraryPaths } from '../lib/library.js';

export interface MigrateOptions {
  readonly library: LibraryPaths;
  readonly dryRun: boolean;
  readonly force: boolean;
}

export interface MigrateOutcome {
  readonly migrated: number;
  readonly refused: boolean;
}

export async function migrate(options: MigrateOptions): Promise<MigrateOutcome> {
  const outcome = await runMigrations({
    libraryRoot: options.library.root,
    dryRun: options.dryRun,
    force: options.force,
  });
  return { migrated: outcome.migratedCount, refused: outcome.refused };
}
