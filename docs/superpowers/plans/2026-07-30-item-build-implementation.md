# Item Build Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `build` field to every Item — the agent's suggested stack and
techniques for replicating the design — as a sibling of `dna`, never part of
the Prompt, backed by a producer path (`dna add`, `dna re-extract`, new
`dna re-build`), a migration for the 10 existing Items, and a read-only panel
in the app.

**Architecture:** `Build` is a new Zod object (`stack: string[]`,
`techniques: string`, `authorship: 'suggested' | 'written'`) living beside
`Dna` in `schema/dna.ts`, added to `Item` as `build`. The single agent call in
`producer/src/lib/extract.ts` is extended to also return a Build (same image,
same cost); `dna re-extract` merges it like any other unit; a new
`dna re-build` command regenerates only the Build, offline from the stored
Capture plus the already-stored DNA, for backfilling existing Items.
`schema/prompt.ts` is untouched by design, so the copyable brief never
mentions implementation.

**Tech Stack:** TypeScript, Zod v3-syntax (project runs zod 4.4.3), the
`@anthropic-ai/claude-agent-sdk` `query()` call already used throughout
`producer/`, Next.js app router (`web/`) for the read-only panel.

**Approved design doc:** [`docs/superpowers/specs/2026-07-30-item-build-design.md`](../specs/2026-07-30-item-build-design.md)

## Global Constraints

- `SCHEMA_VERSION` moves from `2` to `3`, and only Task 1 changes that constant.
- Every Item write goes through `Item.parse` (already enforced by
  `producer/src/lib/library.ts`'s `writeItem`); no task bypasses it.
- Canonical JSON form (two-space indent, LF, one trailing newline, keys in
  `Item`'s declaration order) must hold for every record any task constructs.
  `build` is declared immediately after `dna`, so it is always the last key.
- The Prompt (`schema/prompt.ts`) reads only `item.dna` today and must stay
  that way — no task touches it. This is the whole point of the design; Task
  12 explicitly re-verifies it.
- No new test framework. This repo has no unit tests (`npm test` is a
  placeholder) and verifies itself with `npx tsc --noEmit -p tsconfig.json`,
  `npx tsx schema/check-library.ts`, and CLI `--dry-run` invocations. Every
  task's verification follows that existing convention rather than inventing
  one.
- **No git commits.** Per this session's standing instruction, commits happen
  only when the user explicitly asks. Do not run `git commit` at the end of a
  task even though earlier examples of this pattern in the codebase (and the
  general planning convention) commit per task. Leave the working tree with
  the changes staged-or-not as convenient; the final report to the user asks
  whether to commit everything as one change.
- Live agent calls cost real money. Task 12's backfill run is the only one
  that spends non-trivial cost across all 10 Items, and it defaults to
  `claude-haiku-4-5-20251001` to keep that cost low, per the user's own
  cost-consciousness earlier in this conversation. Report total spend in the
  final summary.
- `Build.authorship` values are `'suggested'` / `'written'` — never reuse
  `Dna`'s `'agent'` / `'override'` vocabulary for it. The two are
  deliberately different words for a deliberately different thing (CONTEXT.md:
  a Build is a suggestion, not a reading).

---

### Task 1: The Build schema, on Item

**Files:**
- Modify: `schema/dna.ts`
- Modify: `producer/src/lib/library.ts:56-77` (`canonicalise`)

**Interfaces:**
- Consumes: nothing new; extends existing `text()` helper
  (`schema/dna.ts:77`) and the existing `.strict()` object pattern used by
  every other trait.
- Produces (for every later task):
  - `MAX_BUILD_STACK: number` (12)
  - `ExtractedBuild` (Zod schema) and its inferred type — `{ stack: string[];
    techniques: string }`
  - `BuildAuthorship` (Zod enum `['suggested', 'written']`) and its type
  - `Build` (Zod schema) and its inferred type — `ExtractedBuild & {
    authorship: BuildAuthorship }`
  - `Item.build: Build`, declared immediately after `dna`
  - `stampBuildAuthorship(extracted: ExtractedBuild): Build` — stamps
    `authorship: 'suggested'`
  - `buildState(item: Item): 'present' | 'undetermined'` — `'undetermined'`
    when `stack.length === 0 && techniques.trim() === ''`, else `'present'`
  - `SCHEMA_VERSION` becomes `3`

- [ ] **Step 1: Add the Build schema to `schema/dna.ts`**

  Insert this block immediately after the `ExtractedDna` / `ExtractedDna`
  type export (after line 261, i.e. right before the `/* --- Traits, as they
  are stored --- */` comment block):

  ```ts
  /* ------------------------------------------------------------------ */
  /* The Build, new at schemaVersion 3                                   */
  /* ------------------------------------------------------------------ */

  /*
   * The Build is not a Trait and is deliberately outside `Dna`. Every trait
   * above is design content read off the Capture; the Build is the agent's
   * suggestion for how to replicate the design, and it is labelled as a
   * suggestion everywhere it appears - never as a trait, never in the Prompt
   * (`schema/prompt.ts` reads only `item.dna` and stays that way). CONTEXT.md
   * carries the same distinction in its own words.
   */

  /** How many candidate tools one Build may name. Past this it is a list, not a suggestion. */
  export const MAX_BUILD_STACK = 12;

  export const ExtractedBuild = z
    .object({
      /** Candidate tools, most load-bearing first. Freeform: the tooling universe is open-ended and a closed list would go stale. */
      stack: z.array(z.string().min(1).max(40)).max(MAX_BUILD_STACK),
      /** The 2-4 techniques that matter for replicating THIS design. Empty means nothing distinctive is called for. */
      techniques: text(600),
    })
    .strict();
  export type ExtractedBuild = z.infer<typeof ExtractedBuild>;

  /**
   * 'suggested' - the agent proposed it, keyed off the DNA. Replaceable by a
   *               later `dna re-build`, same as an `agent` trait is replaceable
   *               by `re-extract`.
   * 'written'   - you wrote it. Kept verbatim by `re-build` unless `--force`.
   *
   * Deliberately not `Authorship`'s `agent` / `override` vocabulary: a Build is
   * a suggestion, never a reading, and 006's merge rule for a Trait ("an
   * override is authoritative regardless of how it was arrived at") does not
   * apply to something that was never a fact about the design in the first
   * place.
   */
  export const BuildAuthorship = z.enum(['suggested', 'written']);
  export type BuildAuthorship = z.infer<typeof BuildAuthorship>;

  export const Build = ExtractedBuild.extend({ authorship: BuildAuthorship }).strict();
  export type Build = z.infer<typeof Build>;
  ```

- [ ] **Step 2: Add `build` to `Item` and bump `SCHEMA_VERSION`**

  In `schema/dna.ts`, change line 86:

  ```ts
  export const SCHEMA_VERSION = 2;
  ```

  to:

  ```ts
  export const SCHEMA_VERSION = 3;
  ```

  Then in the `Item` object (around line 388-419), add `build` as the last
  field, immediately after `dna: Dna,`:

  ```ts
    dna: Dna,
    build: Build,
  })
  ```

  Update the doc comment on `schemaVersion` inside `Item` (currently says "2
  adds the `motion` trait. Migration: `migrations/002-add-motion.ts`.") to
  read:

  ```ts
      /**
       * Bumped by 008 when this shape changes. A `literal` rather than an integer
       * because an Item carrying an older shape is *invalid* and must be refused
       * by name, not tolerated. Contrast `taxonomyVersion` below, where being
       * behind is merely stale. 008 decision 7: if `Item.parse` would reject the
       * old file it belongs here, otherwise it belongs there.
       *
       * 2 adds the `motion` trait. Migration: `migrations/002-add-motion.ts`.
       * 3 adds `build`. Migration: `migrations/003-add-build.ts`.
       */
  ```

- [ ] **Step 3: Add `stampBuildAuthorship` and `buildState`**

  In `schema/dna.ts`, immediately after the existing `stampAuthorship`
  function (which ends around line 517), add:

  ```ts
  /** Lift an agent-suggested Build into the stored shape. Mirrors `stampAuthorship`. */
  export function stampBuildAuthorship(extracted: ExtractedBuild): Build {
    return { ...extracted, authorship: 'suggested' };
  }
  ```

  And immediately after `traitState` (around line 485), add:

  ```ts
  /**
   * Whether an Item has a Build worth showing. Same convention as `traitState`:
   * an empty stack and empty techniques together mean nothing was suggested,
   * whether because the migration placeholder never ran through `re-build` yet
   * or because the agent genuinely found nothing distinctive to say.
   */
  export function buildState(item: Item): 'present' | 'undetermined' {
    return item.build.stack.length === 0 && item.build.techniques.trim() === ''
      ? 'undetermined'
      : 'present';
  }
  ```

- [ ] **Step 4: Wire `build` into `canonicalise` in `producer/src/lib/library.ts`**

  This is the step that is easy to skip and silently lose data: `canonicalise`
  rebuilds the Item object key-by-key rather than spreading, so a field left
  out here is dropped from every file `writeItem` writes, and the *next* read
  of that file fails `Item.parse` because `build` is required.

  Change:

  ```ts
      authoredBy: item.authoredBy,
      dna: {
        palette: item.dna.palette,
        typography: item.dna.typography,
        composition: item.dna.composition,
        spacing: item.dna.spacing,
        surfaceTreatment: item.dna.surfaceTreatment,
        imagery: item.dna.imagery,
        motion: item.dna.motion,
        philosophy: item.dna.philosophy,
        labels: item.dna.labels,
      },
    };
  }
  ```

  to:

  ```ts
      authoredBy: item.authoredBy,
      dna: {
        palette: item.dna.palette,
        typography: item.dna.typography,
        composition: item.dna.composition,
        spacing: item.dna.spacing,
        surfaceTreatment: item.dna.surfaceTreatment,
        imagery: item.dna.imagery,
        motion: item.dna.motion,
        philosophy: item.dna.philosophy,
        labels: item.dna.labels,
      },
      build: item.build,
    };
  }
  ```

- [ ] **Step 5: Typecheck**

  Run: `npx tsc --noEmit -p tsconfig.json`

  Expected: fails, loudly, in every file that constructs an `Item` literal
  without `build` (`producer/src/commands/add.ts`, and any migration or
  fixture). That is correct at this point in the plan — those call sites are
  fixed in Tasks 4-6. If the *only* errors are "Property 'build' is missing"
  in those known files, this step has succeeded; do not add a placeholder
  `build` here to silence them.

- [ ] **Step 6: Confirm the shape in isolation**

  Run this one-off check (it exercises the new schema without touching the
  real library or any other unfinished task):

  ```bash
  npx tsx -e "
  import { Build, buildState, stampBuildAuthorship, Item, SCHEMA_VERSION } from './schema/index.ts';
  console.log('SCHEMA_VERSION', SCHEMA_VERSION);
  const b = stampBuildAuthorship({ stack: ['Three.js'], techniques: 'instanced meshes' });
  console.log(Build.parse(b));
  console.log(buildState({ build: b } as any));
  "
  ```

  Expected: prints `SCHEMA_VERSION 3`, the parsed Build object with
  `authorship: 'suggested'`, and `present`.

---

### Task 2: The Build in the generation contract

**Files:**
- Modify: `schema/generation.ts`

**Interfaces:**
- Consumes: `schema/dna.ts`'s `MAX_BUILD_STACK` is not imported here (the JSON
  Schema literal repeats the number `12`, same as `MOTION_JSON_SCHEMA` repeats
  `4` for `MAX_MOTION_TRIGGERS` rather than importing it — this file is kept
  import-light by existing convention).
- Produces:
  - `BUILD_JSON_SCHEMA` (exported, mirrors `MOTION_JSON_SCHEMA`'s export)
  - `GENERATION_SCHEMA` gains a 10th top-level required property, `build`
  - `BUILD_ONLY_SCHEMA` (exported, mirrors `MOTION_ONLY_SCHEMA`)
  - `PROMPT_VERSION` becomes `'3.0.0-build'`

- [ ] **Step 1: Add `BUILD_JSON_SCHEMA`**

  Insert this block after the `MOTION_JSON_SCHEMA` export and before the
  `/* Philosophy */` section (i.e. after the closing `};` of
  `MOTION_JSON_SCHEMA`):

  ```ts
  /* ------------------------------------------------------------------ */
  /* The Build                                                           */
  /* ------------------------------------------------------------------ */

  /**
   * New at schemaVersion 3, and the one block that is a suggestion rather than
   * a reading. Exported for the same reason `MOTION_JSON_SCHEMA` is: both the
   * full schema and a slim schema for a dedicated re-run (`dna re-build`) need
   * to describe it identically.
   */
  export const BUILD_JSON_SCHEMA = {
    type: 'object',
    description:
      'Your suggested toolset for REPLICATING this design, not a fact about it. Candidate libraries and the few techniques that matter for this specific design. Key off imagery, motion and composition: a still, static, typographic page needs almost nothing distinctive here, and an empty stack with empty techniques is the honest answer for it. A 3D or heavily animated design is where this earns its keep. Never invent internals you cannot see from the design alone - no state-management or backend claims.',
    additionalProperties: false,
    required: ['stack', 'techniques'],
    properties: {
      stack: {
        type: 'array',
        description:
          'Candidate tools and libraries, most load-bearing first, for example ["Three.js", "React Three Fiber", "GSAP"]. Empty array if nothing distinctive is called for.',
        minItems: 0,
        maxItems: 12,
        items: {
          type: 'string',
          maxLength: 40,
          description: 'One tool or library name.',
        },
      },
      techniques: {
        type: 'string',
        maxLength: 600,
        description:
          'The 2-4 techniques that matter for replicating THIS design specifically, for example "scroll-linked camera dolly, instanced meshes for the particle field, a pinned hero section". Not a generic build plan. Empty string if the stack is empty. Hard limit: 600 characters, and going over means the whole extraction is rejected. Be concise rather than exhaustive.',
      },
    },
  };
  ```

- [ ] **Step 2: Add `build` to `GENERATION_SCHEMA`**

  In the `GENERATION_SCHEMA` object, add `'build'` to the `required` array and
  `build: BUILD_JSON_SCHEMA` to `properties`:

  ```ts
    required: [
      'palette',
      'typography',
      'composition',
      'spacing',
      'surfaceTreatment',
      'imagery',
      'motion',
      'philosophy',
      'labels',
      'build',
    ],
    properties: {
      palette: PALETTE_JSON_SCHEMA,
      typography: TYPOGRAPHY_JSON_SCHEMA,
      composition: COMPOSITION_JSON_SCHEMA,
      spacing: SPACING_JSON_SCHEMA,
      surfaceTreatment: SURFACE_TREATMENT_JSON_SCHEMA,
      imagery: IMAGERY_JSON_SCHEMA,
      motion: MOTION_JSON_SCHEMA,
      philosophy: PHILOSOPHY_JSON_SCHEMA,
      labels: LABELS_JSON_SCHEMA,
      build: BUILD_JSON_SCHEMA,
    },
  } as const;
  ```

- [ ] **Step 3: Add `BUILD_ONLY_SCHEMA`**

  Insert immediately after `MOTION_ONLY_SCHEMA`'s closing `} as const;`:

  ```ts
  /**
   * Just the Build, for `dna re-build`.
   *
   * Built from the same `BUILD_JSON_SCHEMA` the full schema uses, so the two
   * can never describe the Build differently. Mirrors `MOTION_ONLY_SCHEMA`.
   */
  export const BUILD_ONLY_SCHEMA = {
    title: 'Design DNA build suggestion',
    description:
      'A suggested toolset for replicating one design, given its stored analysis. Report only what is distinctive about this design. Undetermined (empty stack, empty techniques) is correct when nothing about the design calls for particular tools.',
    type: 'object',
    additionalProperties: false,
    required: ['build'],
    properties: { build: BUILD_JSON_SCHEMA },
  } as const;
  ```

- [ ] **Step 4: Bump `PROMPT_VERSION`**

  Change:

  ```ts
  export const PROMPT_VERSION = '2.0.0-motion';
  ```

  to:

  ```ts
  export const PROMPT_VERSION = '3.0.0-build';
  ```

  Update its doc comment's "Bump it whenever..." line is already generic
  enough to need no further edit.

- [ ] **Step 5: Typecheck**

  Run: `npx tsc --noEmit -p tsconfig.json`

  Expected: same "missing `build`" errors as Task 1 Step 5, no new ones from
  this file.

---

### Task 3: Wire the Build into the full extraction call

**Files:**
- Modify: `producer/src/lib/extract.ts`

**Interfaces:**
- Consumes: `ExtractedBuild` (Task 1), `BUILD_JSON_SCHEMA`/`GENERATION_SCHEMA`/
  `PROMPT_VERSION` (Task 2)
- Produces:
  - `ExtractionResult.build: ExtractedBuild`
  - `undeterminedBuild(): ExtractedBuild`, exported, used by Task 5 (`add.ts`'s
    `--no-extract` path)

- [ ] **Step 1: Import `ExtractedBuild`**

  Change line 32:

  ```ts
  import { ExtractedDna, GENERATION_SCHEMA, PROMPT_VERSION } from '../../../schema/index.js';
  ```

  to:

  ```ts
  import { ExtractedBuild, ExtractedDna, GENERATION_SCHEMA, PROMPT_VERSION } from '../../../schema/index.js';
  ```

- [ ] **Step 2: Add `build` to `ExtractionResult`**

  Change:

  ```ts
  export interface ExtractionResult {
    readonly dna: ExtractedDna;
    readonly model: string | null;
    readonly costUsd: number | null;
    readonly durationMs: number;
    readonly promptVersion: string;
  }
  ```

  to:

  ```ts
  export interface ExtractionResult {
    readonly dna: ExtractedDna;
    readonly build: ExtractedBuild;
    readonly model: string | null;
    readonly costUsd: number | null;
    readonly durationMs: number;
    readonly promptVersion: string;
  }
  ```

- [ ] **Step 3: Add the Build instructions to the prompt**

  Add this constant after `POSTURE` (after its closing backtick, before
  `motionBriefing`):

  ```ts
  /**
   * The one instruction that asks the agent to infer rather than read. Kept
   * separate from `POSTURE` because it governs a field with a fundamentally
   * different honesty rule: everywhere else "I cannot tell" is the failure
   * mode to avoid guessing around; here a *plausible, well-reasoned* guess is
   * the actual job, and the honesty rule is narrower - never invent internals
   * that are not visible in the design itself.
   */
  const BUILD_POSTURE = `THE BUILD: alongside the nine design traits above, suggest how you would actually
  replicate this design - the toolset and the few techniques that matter for it
  specifically, not a generic build plan.

  This is the one field where you are allowed to infer rather than read. Key off
  what you are seeing: a 3D or heavily animated design calls for a real 3D/motion
  stack (for example Three.js, React Three Fiber, GSAP); a plain static page calls
  for almost nothing distinctive, and an empty stack with empty techniques is the
  honest answer for it. Never invent internals you cannot see from the design
  alone - no state management, no backend, no data layer claims. Name candidate
  tools, most load-bearing first, then the 2-4 techniques specific to this design.`;
  ```

  Then change `buildPrompt`:

  ```ts
  function buildPrompt(imagePath: string, observations: MotionObservations | null): string {
    return [
      `Read the image at ${imagePath} and extract the design DNA of the design it shows.`,
      '',
      POSTURE,
      '',
      motionBriefing(observations),
    ].join('\n');
  }
  ```

  to:

  ```ts
  function buildPrompt(imagePath: string, observations: MotionObservations | null): string {
    return [
      `Read the image at ${imagePath} and extract the design DNA of the design it shows.`,
      '',
      POSTURE,
      '',
      motionBriefing(observations),
      '',
      BUILD_POSTURE,
    ].join('\n');
  }
  ```

- [ ] **Step 4: Split the parse in `extractDna`**

  The agent now returns one flat object with 10 top-level keys (the 9
  existing plus `build`), but `ExtractedDna` is `.strict()` with exactly 9. So
  `build` must be pulled off before validating the rest as `ExtractedDna`, and
  validated separately as `ExtractedBuild`.

  Change:

  ```ts
  export async function extractDna(
    imagePath: string,
    options: ExtractOptions = {},
  ): Promise<ExtractionResult> {
    const result = await runAgent({
      prompt: buildPrompt(imagePath, options.observations ?? null),
      schema: GENERATION_SCHEMA,
      model: options.model,
      timeoutMs: options.timeoutMs,
    });

    const parsed = ExtractedDna.safeParse(lowercaseHexes(result.structured));
    if (!parsed.success) {
      throw new ExtractionFailed(
        'the agent output does not satisfy the schema',
        parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
      );
    }

    return {
      dna: parsed.data,
      model: result.model,
      costUsd: result.costUsd,
      durationMs: result.durationMs,
      promptVersion: PROMPT_VERSION,
    };
  }
  ```

  to:

  ```ts
  export async function extractDna(
    imagePath: string,
    options: ExtractOptions = {},
  ): Promise<ExtractionResult> {
    const result = await runAgent({
      prompt: buildPrompt(imagePath, options.observations ?? null),
      schema: GENERATION_SCHEMA,
      model: options.model,
      timeoutMs: options.timeoutMs,
    });

    // `build` sits beside the nine trait keys in the one flat object the SDK
    // returns, so it has to come off before the rest validates as
    // `ExtractedDna`, which is `.strict()` with exactly nine keys.
    const payload = result.structured as Record<string, unknown>;
    const { build, ...dnaPayload } = payload;

    const parsedDna = ExtractedDna.safeParse(lowercaseHexes(dnaPayload));
    if (!parsedDna.success) {
      throw new ExtractionFailed(
        'the agent output does not satisfy the schema',
        parsedDna.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
      );
    }

    const parsedBuild = ExtractedBuild.safeParse(build);
    if (!parsedBuild.success) {
      throw new ExtractionFailed(
        'the agent output does not satisfy the build schema',
        parsedBuild.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
      );
    }

    return {
      dna: parsedDna.data,
      build: parsedBuild.data,
      model: result.model,
      costUsd: result.costUsd,
      durationMs: result.durationMs,
      promptVersion: PROMPT_VERSION,
    };
  }
  ```

- [ ] **Step 5: Add `undeterminedBuild`**

  Immediately after the existing `undeterminedDna` function (end of file), add:

  ```ts
  /** The all-Undetermined Build `--no-extract` writes. */
  export function undeterminedBuild(): ExtractedBuild {
    return ExtractedBuild.parse({ stack: [], techniques: '' });
  }
  ```

- [ ] **Step 6: Typecheck**

  Run: `npx tsc --noEmit -p tsconfig.json`

  Expected: the "missing `build`" errors now point only at
  `producer/src/commands/add.ts` (fixed in Task 5) and the migration (fixed
  in Task 4). No errors should remain inside `extract.ts` itself.

---

### Task 4: Migration 003 — backfill Build to Undetermined

**Files:**
- Create: `migrations/003-add-build.ts`

**Interfaces:**
- Consumes: nothing from other tasks (migration scripts are pure functions
  that never import from `schema/` or `producer/`, per the existing
  `002-add-motion.ts` precedent — the runner validates the result against the
  live schema after the fact).
- Produces: `from = 2`, `to = 3`, `up(record: unknown): unknown`, picked up
  automatically by `migrations/run.ts` (it globs `\d{3}-.+\.ts$`).

- [ ] **Step 1: Write the migration**

  ```ts
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
   * is what actually fills this in; see `docs/EXTRACTION.md` section 5.
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
  ```

- [ ] **Step 2: Typecheck**

  Run: `npx tsc --noEmit -p tsconfig.json`

  Expected: no errors from this file (it deliberately types everything as
  `unknown`/`Record<string, unknown>`, same as `002-add-motion.ts`, so it
  cannot fail to compile against the new `Item` shape — that's the point of a
  migration).

- [ ] **Step 3: Dry-run the migration against the real library**

  Run: `npx tsx migrations/run.ts --dry-run`

  Expected: reports "10 Items at schemaVersion 2, current is 3", lists
  `003-add-build.ts  2 -> 3`, and writes 10 files into `.migrate-dry-run/`
  without touching `library/`. Open one written file
  (`.migrate-dry-run/<any-id>.json`) and confirm it parses, has
  `"schemaVersion": 3`, and `"build"` appears as the last key of the object
  with `stack: []`, `techniques: ""`, `authorship: "suggested"`.

  Do **not** run the migration for real yet — Task 12 does that once every
  producer code path that touches an Item has been updated, so nothing writes
  a file the rest of the CLI can't read.

---

### Task 5: Wire the Build into `dna add`

**Files:**
- Modify: `producer/src/commands/add.ts`

**Interfaces:**
- Consumes: `extractDna` now returns `.build` (Task 3); `undeterminedBuild`
  (Task 3); `stampBuildAuthorship` (Task 1)

- [ ] **Step 1: Import `undeterminedBuild` and `stampBuildAuthorship`**

  Change:

  ```ts
  import { extractDna, undeterminedDna, ExtractionFailed } from '../lib/extract.js';
  ```

  to:

  ```ts
  import { extractDna, undeterminedDna, undeterminedBuild, ExtractionFailed } from '../lib/extract.js';
  ```

  And change:

  ```ts
  import {
    Item,
    SCHEMA_VERSION,
    CURRENT_TAXONOMY_VERSION,
    notApplicableFor,
    stampAuthorship,
    type Scope,
  } from '../../../schema/index.js';
  ```

  to:

  ```ts
  import {
    Item,
    SCHEMA_VERSION,
    CURRENT_TAXONOMY_VERSION,
    notApplicableFor,
    stampAuthorship,
    stampBuildAuthorship,
    type Scope,
  } from '../../../schema/index.js';
  ```

- [ ] **Step 2: Cover the `--no-extract` branch**

  Change:

  ```ts
        const extracted = options.noExtract
          ? { dna: undeterminedDna(), model: null, costUsd: null, durationMs: 0, promptVersion: null }
          : await extractDna(prepared.pngPath, {
              model: options.model,
              observations: prepared.observations,
            });
  ```

  to:

  ```ts
        const extracted = options.noExtract
          ? {
              dna: undeterminedDna(),
              build: undeterminedBuild(),
              model: null,
              costUsd: null,
              durationMs: 0,
              promptVersion: null,
            }
          : await extractDna(prepared.pngPath, {
              model: options.model,
              observations: prepared.observations,
            });
  ```

- [ ] **Step 3: Add `build` to the constructed Item**

  Change:

  ```ts
          dna: stampAuthorship(extracted.dna),
        });
  ```

  to:

  ```ts
          dna: stampAuthorship(extracted.dna),
          build: stampBuildAuthorship(extracted.build),
        });
  ```

- [ ] **Step 4: Typecheck**

  Run: `npx tsc --noEmit -p tsconfig.json`

  Expected: no more "missing `build`" errors anywhere under `producer/`
  except `re-extract.ts`, which Task 6 fixes next.

- [ ] **Step 5: Dry-run smoke test (no agent call, no cost)**

  Run:

  ```bash
  npm run dna -- add --no-extract --dry-run https://example.com
  ```

  Expected: prints a `dry` line and a full Item JSON whose last field is
  `"build": { "stack": [], "techniques": "", "authorship": "suggested" }`.
  Nothing is written (`--dry-run`), and no agent was called
  (`--no-extract`), so this costs nothing.

---

### Task 6: Wire the Build into `dna re-extract`

**Files:**
- Modify: `producer/src/commands/re-extract.ts`

**Interfaces:**
- Consumes: `extractDna` now returns `.build` (Task 3); the existing
  `MergeResult<T>` / `finalize` helpers already defined in this file
  (`re-extract.ts:59-111`)

- [ ] **Step 1: Import `ExtractedBuild`**

  Change:

  ```ts
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
  ```

  to:

  ```ts
  import {
    CURRENT_TAXONOMY_VERSION,
    notApplicableFor,
    PROMPT_VERSION,
    type Authorship,
    type Build,
    type Dna,
    type ExtractedBuild,
    type ExtractedDna,
    type Item,
    type Scope,
    type TraitName,
  } from '../../../schema/index.js';
  ```

- [ ] **Step 2: Add a `mergeBuild` function**

  Add this immediately after the existing `mergeTrait` function (after its
  closing `}`, before the "The scope-driven forced reset" section comment):

  ```ts
  /**
   * The Build's own merge rule, parallel to `mergeTrait` but keyed on
   * `'written'` rather than `'override'`: a Build you wrote by hand is kept
   * verbatim, anything `'suggested'` is refreshed. There is no scope-driven
   * reset for the Build - it is not a `TraitName` and no Scope excludes it.
   */
  function mergeBuild(stored: Build, fresh: ExtractedBuild): MergeResult<Build> {
    if (stored.authorship === 'written') {
      return { value: stored, replaced: false, keptLine: 'build kept (written)' };
    }
    return { value: { ...fresh, authorship: 'suggested' }, replaced: true, keptLine: null };
  }
  ```

- [ ] **Step 3: Merge it into the command**

  After the line `const philosophy = mergeTrait('philosophy', item.dna.philosophy, extracted.dna.philosophy);`,
  add:

  ```ts
        const build = mergeBuild(item.build, extracted.build);
  ```

  After the line `const philosophyFinal = finalize(...)` block (which ends
  with a `);` around line 230), add:

  ```ts
        // The Build never resets on a `--scope` change: it is not a TraitName,
        // and no Scope excludes it.
        const buildFinal = finalize(build, null);
  ```

  In the `allFinals` array, add `buildFinal`:

  ```ts
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
          buildFinal,
        ];
  ```

  In the `next: Item` object literal, add `build: buildFinal.value,` right
  after `dna,`:

  ```ts
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
          build: buildFinal.value,
        };
  ```

- [ ] **Step 4: Update the file's header comment for accuracy**

  The comment at the top of the file says "The remaining 11 units (5 palette
  swatches, 6 traits) are merged one at a time". Change it to:

  ```
   * The remaining 12 units (5 palette swatches, 6 traits, and the Build) are
   * merged one at a time: an `override` (or, for the Build, `written`) is kept
   * verbatim, anything else is replaced by the fresh reading and re-stamped.
  ```

- [ ] **Step 5: Typecheck**

  Run: `npx tsc --noEmit -p tsconfig.json`

  Expected: zero errors across the whole `producer/`, `migrations/`,
  `schema/` tree. This is the point where every producer code path
  constructs a fully-shaped `Item`.

- [ ] **Step 6: Dry-run smoke test**

  This cannot run yet against the real library (no Item has `build` on disk
  until Task 12's migration runs), so defer functional verification of this
  command to Task 12. For now, confirm only that the module loads without a
  runtime error:

  ```bash
  npm run dna -- re-extract --help
  ```

  Expected: prints `RE_EXTRACT_USAGE` and exits 0.

---

### Task 7: `dna re-build` — the backfill command

**Files:**
- Create: `producer/src/commands/re-build.ts`

**Interfaces:**
- Consumes: `BUILD_ONLY_SCHEMA`, `ExtractedBuild` (Task 2/1); `runAgent`,
  `ExtractionFailed` (already exported by `producer/src/lib/extract.ts`);
  `isDirty`, `isUntracked` (already exported by `producer/src/lib/git.ts`);
  `capturePath`, `itemPath`, `readItem`, `writeItem`, `listItemIds`,
  `LibraryPaths` (already exported by `producer/src/lib/library.ts`)
- Produces: `ReBuildOptions`, `ReBuildOutcome`, `reBuild(options): Promise<ReBuildOutcome>`
  — consumed by Task 8 (`cli.ts`)

- [ ] **Step 1: Write the command**

  ```ts
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
  ```

- [ ] **Step 2: Typecheck**

  Run: `npx tsc --noEmit -p tsconfig.json`

  Expected: zero errors.

---

### Task 8: Wire `re-build` into the CLI

**Files:**
- Modify: `producer/src/cli.ts`

**Interfaces:**
- Consumes: `reBuild`, `ReBuildOptions` (Task 7)

- [ ] **Step 1: Import the command**

  Change:

  ```ts
  import { add } from './commands/add.js';
  import { reExplore } from './commands/re-explore.js';
  import { reExtract } from './commands/re-extract.js';
  import { relabel } from './commands/relabel.js';
  import { note, type NoteMode } from './commands/note.js';
  import { migrate } from './commands/migrate.js';
  import { listItems } from './commands/list.js';
  ```

  to:

  ```ts
  import { add } from './commands/add.js';
  import { reExplore } from './commands/re-explore.js';
  import { reExtract } from './commands/re-extract.js';
  import { reBuild } from './commands/re-build.js';
  import { relabel } from './commands/relabel.js';
  import { note, type NoteMode } from './commands/note.js';
  import { migrate } from './commands/migrate.js';
  import { listItems } from './commands/list.js';
  ```

- [ ] **Step 2: Add it to the top-level `USAGE`**

  Change:

  ```
    re-explore  Revisit a live URL and rewrite only the motion trait
    re-extract  Re-read the stored Capture of an existing Item and merge the result
    relabel     Re-ask the label question only, against the stored Capture
  ```

  to:

  ```
    re-explore  Revisit a live URL and rewrite only the motion trait
    re-extract  Re-read the stored Capture of an existing Item and merge the result
    re-build    Regenerate the Build: suggested stack and techniques, for an existing Item
    relabel     Re-ask the label question only, against the stored Capture
  ```

- [ ] **Step 3: Add `RE_BUILD_USAGE`**

  Insert this constant immediately after `RE_EXTRACT_USAGE`'s closing
  backtick-semicolon and before the `parseOptionalScope` function:

  ```ts
  const RE_BUILD_USAGE = `dna re-build - regenerate the Build: suggested stack and techniques.

  USAGE
    dna re-build <id>... [options]
    dna re-build --all    [options]

  Reads library/captures/<id>.png plus the Item's already-stored DNA (imagery,
  motion, composition) and asks only for the Build: candidate tools and the
  techniques that matter for replicating this design. Never visits the network.
  Every trait, the Note, the Scope, the id and addedAt are left byte-identical;
  only build and authoredBy move.

  A Build you wrote by hand (authorship "written") is kept. --force replaces it.

  OPTIONS
    --all         Every Item in the library.
    --model <id>  Model for the suggestion. Default: the SDK's.
    --dry-run     Print the new Build and what would change. Write nothing.
                  Still spends a reading.
    --force       Replace a written Build, and write even though the file is
                  dirty.`;
  ```

- [ ] **Step 4: Add `runReBuild`**

  Insert this function immediately after `runReExtract` and before the
  `/* relabel */` section comment:

  ```ts
  /* ------------------------------------------------------------------ */
  /* re-build                                                            */
  /* ------------------------------------------------------------------ */

  async function runReBuild(parsed: Parsed, library: LibraryPaths): Promise<number> {
    const all = bool(parsed, '--all');
    const ids = parsed.positional;

    if (ids.length === 0 && !all) {
      throw new UsageError('re-build needs at least one Item id, or --all.');
    }
    if (ids.length > 0 && all) {
      throw new UsageError('pass either Item ids or --all, not both.');
    }

    const outcome = await reBuild({
      library,
      ids,
      all,
      model: str(parsed, '--model'),
      dryRun: bool(parsed, '--dry-run'),
      force: bool(parsed, '--force'),
    });
    return outcome.refused > 0 ? 1 : 0;
  }
  ```

- [ ] **Step 5: Wire the `--help` dispatch and the command dispatch**

  Change:

  ```ts
      if (command === 'add') console.log(ADD_USAGE);
      else if (command === 're-explore') console.log(RE_EXPLORE_USAGE);
      else if (command === 're-extract') console.log(RE_EXTRACT_USAGE);
      else if (command === 'relabel') console.log(RELABEL_USAGE);
  ```

  to:

  ```ts
      if (command === 'add') console.log(ADD_USAGE);
      else if (command === 're-explore') console.log(RE_EXPLORE_USAGE);
      else if (command === 're-extract') console.log(RE_EXTRACT_USAGE);
      else if (command === 're-build') console.log(RE_BUILD_USAGE);
      else if (command === 'relabel') console.log(RELABEL_USAGE);
  ```

  And change:

  ```ts
      case 're-extract':
        return runReExtract(parsed, library);
      case 'relabel':
        return runRelabel(parsed, library);
  ```

  to:

  ```ts
      case 're-extract':
        return runReExtract(parsed, library);
      case 're-build':
        return runReBuild(parsed, library);
      case 'relabel':
        return runRelabel(parsed, library);
  ```

- [ ] **Step 6: Typecheck and smoke test**

  Run: `npx tsc --noEmit -p tsconfig.json`

  Expected: zero errors.

  Run: `npm run dna -- re-build --help`

  Expected: prints `RE_BUILD_USAGE` and exits 0.

  Run: `npm run dna -- re-build`

  Expected: exits 2 with `re-build needs at least one Item id, or --all.`

---

### Task 9: The extraction doctrine — "The Build"

**Files:**
- Modify: `docs/EXTRACTION.md`

- [ ] **Step 1: Insert a new section 5, and renumber what follows**

  Insert this new section immediately after the end of section 4 (after the
  `philosophy` subsection's last paragraph, "...uses a modern aesthetic with
  clean lines is filler.", and before the `---` / `## 5. Labels` heading):

  ```markdown
  ## 5. The Build

  New alongside the nine traits, and different in kind from all of them: every
  trait above is read off the evidence; the Build is your suggestion, and it is
  labelled as one everywhere it appears - never as a trait, never in the Prompt.

  `stack`: candidate tools and libraries, most load-bearing first, for example
  `["Three.js", "React Three Fiber", "GSAP"]`. Freeform, not a closed
  vocabulary: the tooling universe changes constantly and a fixed list would go
  stale.

  `techniques`: prose, the 2-4 methods that actually matter for replicating
  this design specifically - "scroll-linked camera dolly, instanced meshes for
  the particle field, a pinned hero section" - not a generic build plan.

  Key off `imagery`, `motion` and `composition`. A still, typographic, static
  page calls for almost nothing distinctive, and an empty stack with empty
  `techniques` is the honest answer for it: **Undetermined is a correct answer
  here too.** A 3D or heavily animated design is where the Build earns its
  keep.

  **Never invent internals you cannot see.** No state-management, backend or
  data layer claims - a screenshot cannot show you Redux. Suggest from the
  visible design language only.
  ```

- [ ] **Step 2: Renumber the sections after it**

  - `## 5. Labels` → `## 6. Labels`
  - `## 6. Honesty rules` → `## 7. Honesty rules`
  - `## 7. What this doctrine is worth checking against` → `## 8. What this
    doctrine is worth checking against`

  (Grep for `^## ` in the file to confirm exactly these four headings exist
  before editing, and edit only the number, not the title text.)

- [ ] **Step 3: Add a Build-specific honesty rule**

  In the renumbered "## 7. Honesty rules" section, after the existing
  "**Specificity beats coverage**" paragraph and before the `---` that
  precedes the next section, add:

  ```markdown
  **The Build is a suggestion, not a reading.** Everywhere else Undetermined
  means "I looked and could not tell"; for the Build it can also mean "nothing
  about this design calls for anything distinctive", and that is still the
  honest answer. What it must never mean is a guess at internals the design
  cannot show you.
  ```

- [ ] **Step 4: Verify the renumbering**

  Run: `grep -n "^## " docs/EXTRACTION.md`

  Expected output, in order:

  ```
  ## 1. The two things you are producing, and they are not the same
  ## 2. Protocol A: a URL
  ## 3. Protocol B: an image
  ## 4. Reading the traits
  ## 5. The Build
  ## 6. Labels
  ## 7. Honesty rules
  ## 8. What this doctrine is worth checking against
  ```

---

### Task 10: Vocabulary and CLI contract docs

**Files:**
- Modify: `CONTEXT.md`
- Modify: `wayfinder/assets/008-cli-usage.txt`

- [ ] **Step 1: Add the Build term to `CONTEXT.md`**

  At the end of the file, after the `### The payoff` subsection's last entry
  (`**Prompt**`), add a new subsection:

  ```markdown
  ### The replication

  **Build**:
  The agent's *suggested* toolset and techniques for replicating an Item —
  candidate libraries and the few methods that matter for this specific
  design. A suggestion drawn from the DNA, never a fact read off the capture,
  and never part of the Prompt. An Item has one.
  _Avoid_: Stack, Recipe, Implementation, Blueprint
  ```

- [ ] **Step 2: Add `re-build` to the CLI contract's command list**

  In `wayfinder/assets/008-cli-usage.txt`, find the `COMMANDS` block (near
  the top, alongside the `re-extract` and `relabel` lines you can locate by
  searching for `re-extract  Re-read the stored Capture`). Add a `re-build`
  line immediately after the `re-extract` line, matching the existing
  column alignment:

  ```
    re-build    Regenerate the Build: suggested stack and techniques
  ```

- [ ] **Step 3: Add a `dna re-build --help` block**

  Find the `$ dna re-extract --help` example block (search for
  `dna re-extract - re-read the stored Capture`). Immediately after that
  whole block ends (before the next `$ dna relabel --help` block begins),
  insert a matching block for `re-build`, using the `RE_BUILD_USAGE` text
  from Task 8 Step 3 as the body, formatted in the same
  `$ dna re-build --help` / fenced-usage style as the surrounding blocks in
  this file. Match the file's existing example style: after the usage text,
  include one worked example line and its plausible output, mirroring how
  the `re-extract` block ends with a `$ dna re-extract <id>` example.

- [ ] **Step 4: Spot-check formatting**

  Run: `grep -n "re-build" wayfinder/assets/008-cli-usage.txt`

  Expected: at least two matches (the COMMANDS line and the `--help` block
  heading).

---

### Task 11: The "How to build" panel

**Files:**
- Modify: `web/components/item-detail.tsx`

**Interfaces:**
- Consumes: `buildState` (Task 1, re-exported via `@schema`'s existing
  `export * from './dna'` in `schema/index.ts` — no changes needed there)

- [ ] **Step 1: Import `buildState`**

  Change:

  ```ts
  import {
    renderPrompt,
    traitState,
    type Item,
    type TraitName,
    type TraitState,
  } from "@schema";
  ```

  to:

  ```ts
  import {
    buildState,
    renderPrompt,
    traitState,
    type Item,
    type TraitName,
    type TraitState,
  } from "@schema";
  ```

- [ ] **Step 2: Add the panel after the Source block**

  Change:

  ```tsx
            <div className="mt-2">
              <p className="tag text-faint">Source</p>
              <p className="mono mt-1 break-all text-[12px] text-muted">{sourceLabel(item)}</p>
              <p className="mono mt-1 text-[11px] text-faint">
                {`captured ${formatDate(item.capture.takenAt)} · ${item.capture.pixelWidth}x${item.capture.pixelHeight} · ${item.authoredBy.kind}${item.authoredBy.model ? ` · ${item.authoredBy.model}` : ""}`}
              </p>
            </div>
          </div>
        </div>
  ```

  to:

  ```tsx
            <div className="mt-2">
              <p className="tag text-faint">Source</p>
              <p className="mono mt-1 break-all text-[12px] text-muted">{sourceLabel(item)}</p>
              <p className="mono mt-1 text-[11px] text-faint">
                {`captured ${formatDate(item.capture.takenAt)} · ${item.capture.pixelWidth}x${item.capture.pixelHeight} · ${item.authoredBy.kind}${item.authoredBy.model ? ` · ${item.authoredBy.model}` : ""}`}
              </p>
            </div>

            {buildState(item) === "present" && (
              <div className="mt-2">
                <p className="tag text-faint">How to build</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {item.build.stack.map((tool) => (
                    <span
                      key={tool}
                      className="rounded border border-line-2 px-2 py-0.5 text-[11px] text-ink-2"
                    >
                      {tool}
                    </span>
                  ))}
                </div>
                {item.build.techniques && (
                  <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">
                    {item.build.techniques}
                  </p>
                )}
                <p className="mt-1.5 text-[11px] text-faint">
                  Suggested — inferred from the DNA, not read from the capture.
                </p>
              </div>
            )}
          </div>
        </div>
  ```

  This deliberately hides the whole panel when `buildState(item)` is
  `"undetermined"` (an Item that has never had `dna re-build` run against it,
  or one where the agent genuinely found nothing distinctive to suggest),
  rather than rendering an explicit "not read" line the way a `TraitRow`
  does. A Build absent is not the same kind of gap a Trait's absence is — it
  is either "not asked yet" or "correctly nothing to say" — and there is no
  mix-eligibility affordance riding on this panel the way there is on a
  `TraitRow`, so silence is the simpler and equally honest choice.

- [ ] **Step 3: Typecheck the web app**

  Run: `cd web && npx tsc --noEmit`

  Expected: zero errors. (If `web/` has no standalone `tsc --noEmit` script,
  use whatever `web/package.json` defines for typechecking — check its
  `scripts` block first; do not guess a command that doesn't exist.)

---

### Task 12: End-to-end verification

**Files:** none (this task runs commands and inspects output; if any step
surfaces a real bug, fix it in the file it belongs to and re-run from that
step).

- [ ] **Step 1: Full typecheck**

  Run: `npx tsc --noEmit -p tsconfig.json`

  Expected: zero errors. This is the first point where every file touched by
  Tasks 1-8 is checked together.

- [ ] **Step 2: Confirm the library is clean before migrating**

  Run: `git status --porcelain -- library`

  Expected: empty output. (If not empty, stop and report to the user rather
  than proceeding — do not run a migration over uncommitted library
  changes that aren't part of this plan.)

- [ ] **Step 3: Run the migration for real**

  Run: `npx tsx migrations/run.ts`

  Expected: `ok  10 Item(s) migrated, 10 file(s) written`. Then run
  `git diff --stat -- library` to confirm exactly 10 files under
  `library/items/` changed (no files under `library/captures/` should
  change — the migration never touches Captures).

- [ ] **Step 4: Validate the migrated library**

  Run: `npx tsx schema/check-library.ts`

  Expected: exits 0, reports all 10 Items valid. If it fails, the problem is
  almost certainly a canonical-key-order mismatch between Task 1's
  `canonicalise` and Task 4's migration — compare their field orders.

- [ ] **Step 5: Dry-run the backfill against the real library**

  Run:

  ```bash
  npm run dna -- re-build --all --dry-run --model claude-haiku-4-5-20251001
  ```

  Expected: 10 `dry` lines, each showing `undetermined -> <some stack>`, and
  the full `build` JSON printed for each. Read through all 10: confirm no
  suggestion invents backend/state-management claims, and that at least one
  Item whose `dna.imagery.kind` is `3d-render` or whose `dna.motion.presence`
  is `prominent`/`pervasive` gets a materially different, more specific stack
  than a plain typographic Item. (You already know from the earlier
  conversation in this session that `20260726T203112Z-sw1ss0`,
  `20260726T203344Z-ed1t0r`, `20260726T203519Z-brut41`,
  `20260726T203747Z-aur0r4`, and `20260726T203955Z-t3rm1n` are the five
  Opus-captured seed Items and are a reasonable set to eyeball for variety.)

- [ ] **Step 6: Run the backfill for real**

  Run:

  ```bash
  npm run dna -- re-build --all --model claude-haiku-4-5-20251001
  ```

  Expected: 10 `ok` lines with a small per-Item cost, and a total reported at
  the end. Record this total cost for the final summary to the user.

- [ ] **Step 7: Re-validate**

  Run: `npx tsx schema/check-library.ts`

  Expected: exits 0.

- [ ] **Step 8: Confirm the Prompt is untouched**

  Run:

  ```bash
  npx tsx -e "
  import { readItem, resolveLibrary } from './producer/src/lib/library.ts';
  import { renderPrompt } from './schema/index.ts';
  const lib = resolveLibrary();
  const item = await readItem(lib, '20260726T203519Z-brut41');
  const prompt = renderPrompt(item);
  console.log(/three\.js|react|gsap|stack|library/i.test(prompt) ? 'FAIL: build leaked into prompt' : 'ok: prompt has no build content');
  console.log(prompt);
  "
  ```

  Expected: prints `ok: prompt has no build content`, then the rendered
  prompt, which should read exactly as it did before this plan (only its
  provenance line's date/URL are relevant; the seven trait sections and the
  philosophy paragraph are unaffected by anything in this plan).

- [ ] **Step 9: Verify `re-extract` still works with the new field**

  Pick one Item id from the library (any id from `npx tsx schema/check-library.ts`'s
  output or `library/items/`). Run:

  ```bash
  npm run dna -- re-extract <id> --dry-run --model claude-haiku-4-5-20251001
  ```

  Expected: the summary line now reports out of 12 units (not 11), e.g.
  `X replaced, Y kept (override)`, and the printed Item JSON's `build` field
  is either `kept (written)` (impossible right after a fresh `re-build`,
  since that stamps `'suggested'`) or replaced with a fresh suggestion. Since
  every Item's Build is currently `'suggested'` (Task 12 Step 6 just set
  it), expect it to be replaced here. Confirm no error and no unexpected
  refusal.

- [ ] **Step 10: Verify the web panel renders**

  Start the dev server (`cd web && npm run dev`, or whatever
  `web/package.json` defines), open `/item/20260726T203519Z-brut41` (or
  any id used in Step 9) in a browser, and confirm:
  - a "How to build" section appears below "Source"
  - it shows one chip per stack entry and the techniques paragraph
  - the "Suggested — inferred from the DNA, not read from the capture." line
    is present
  - the existing "Copy prompt" button's output (paste it somewhere) still
    contains no mention of the stack or techniques

  Stop the dev server when done.

- [ ] **Step 11: Final state check**

  Run: `git status`

  Expected: shows modifications across `schema/`, `producer/`, `migrations/`,
  `docs/`, `CONTEXT.md`, `wayfinder/assets/008-cli-usage.txt`, `web/`, and
  `library/items/*.json` (10 files, from the migration + backfill). Per the
  Global Constraints, do not commit. Report this status to the user as part
  of the final summary and ask whether to commit it as one change or split
  it.

---

## Task Dependency Order

Tasks 1 → 2 → 3 must run in that order (each typechecks against the previous).
Tasks 4, 5, 6 all depend on 1-3 and can run in parallel with each other once
those land. Task 7 depends on 1-2 only (it doesn't call `extractDna`). Task 8
depends on 7. Task 9 and Task 10 depend on nothing but the approved design and
can run any time, in parallel with the code tasks. Task 11 depends on 1 only
(needs `buildState` exported). Task 12 depends on everything (1-11).

A reasonable parallel wave plan for subagent dispatch:
- **Wave 1 (serial):** Task 1 → Task 2 → Task 3
- **Wave 2 (parallel):** Task 4, Task 5, Task 6, Task 7, Task 9, Task 10, Task 11
- **Wave 3 (serial, depends on Task 7):** Task 8
- **Wave 4 (serial, depends on everything):** Task 12
