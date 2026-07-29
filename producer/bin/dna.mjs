#!/usr/bin/env node
/**
 * The `dna` binary.
 *
 * A shim rather than a build step. It registers tsx's ESM loader and then imports
 * the TypeScript entry point directly, so there is no compiled `dist/` to keep in
 * sync with the source and no stale build to debug. `schema/` is shared with the
 * web app as TypeScript for the same reason: one source of truth, compiled by
 * whoever is consuming it.
 */
import { register } from 'tsx/esm/api';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

register();

// `fileURLToPath`, not `new URL(...).pathname`. The latter returns a
// percent-encoded path, so any space in the repo path arrives as `%20` and the
// import fails with ERR_MODULE_NOT_FOUND on a path that looks almost right.
const here = path.dirname(fileURLToPath(import.meta.url));
await import(pathToFileURL(path.join(here, '..', 'src', 'cli.ts')).href);
