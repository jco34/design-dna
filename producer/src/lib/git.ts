/**
 * Is this file safe to overwrite?
 *
 * Ticket 008's answer to "re-extraction is not idempotent" is that git history is
 * the only thing that can give back a value a re-run replaced. A verb that
 * overwrites agent-authored values therefore refuses to touch a file with
 * uncommitted changes, and `--force` is how you say you accept losing them.
 *
 * A repo-less checkout is not treated as dirty. The protection this offers depends
 * entirely on git being there; when it is not, there is nothing to enforce and
 * pretending otherwise would just block the command for no benefit.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);

export async function isDirty(file: string): Promise<boolean> {
  try {
    const { stdout } = await exec('git', ['status', '--porcelain', '--', file]);
    return stdout.trim() !== '';
  } catch {
    return false;
  }
}

/**
 * Untracked counts as dirty, and that is the important case rather than an edge
 * one: a brand new Item has never been committed, so git cannot restore it at all.
 * `git status --porcelain` reports it as `??`, which the trimmed-non-empty test
 * above already catches; this exists to name the distinction in a message.
 */
export async function isUntracked(file: string): Promise<boolean> {
  try {
    const { stdout } = await exec('git', ['status', '--porcelain', '--', file]);
    return stdout.trimStart().startsWith('??');
  } catch {
    return false;
  }
}
