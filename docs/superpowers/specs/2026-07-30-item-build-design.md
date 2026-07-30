# Design: the Build — a suggested stack + techniques for replicating an Item

- **Date:** 2026-07-30
- **Status:** Approved, ready for planning
- **Scope:** New agent-suggested `build` field on every Item; a producer path to
  write it; a migration + `re-build` command to backfill the 10 existing Items;
  a read-only panel in the app. The Prompt and the DNA are left untouched.

> Filed here per the brainstorming workflow default. This project records
> decisions as numbered documents under `wayfinder/tickets/`; if this should
> become ticket 013 instead, it can be moved wholesale — the content is the same.

---

## 1. Why

When you find a design worth replicating, the DNA already tells you *what* it
looks like — palette, type, motion, and so on. It does not tell you *how to
build it*. For an ordinary static page that gap is small. For a 3D or heavily
animated site it is the whole problem: reaching for plain React is the wrong
start, and the right start is something like Three.js + React Three Fiber + a
scroll library. The Build is the agent's suggestion for closing that gap.

## 2. The collision this design avoids

The obvious move — "put the stack into the prompt" — breaks a load-bearing rule.
[`CONTEXT.md`](../../../CONTEXT.md) defines the Prompt as **"A design brief,
never code."** The prompt frame at [`schema/prompt.ts`](../../../schema/prompt.ts)
deliberately never says *what* to build, so your own sentence can supply the
task: "Two instructions in one message collide. A brief composes." A stack
instruction is exactly that colliding second instruction.

A Build is also not a Trait. A Trait is **"design content read off the
capture."** A stack is *inferred*, not read. The honesty rules in
[`docs/EXTRACTION.md`](../../EXTRACTION.md) §6 warn that a plausible-sounding
fabrication costs the credibility of every field beside it.

The design therefore keeps the Build **separate from both the DNA and the
Prompt**, and labels it as a suggestion everywhere it appears.

## 3. Vocabulary (CONTEXT.md addition)

A new subsection, "The replication", with one term:

> **Build**: The agent's *suggested* toolset and techniques for replicating an
> Item — candidate libraries and the few methods that matter for this specific
> design. A suggestion drawn from the DNA, never a fact read off the capture,
> and never part of the Prompt. An Item has one.
> _Avoid_: Stack, Recipe, Implementation, Blueprint

The load-bearing word is **suggested**: this is the one place the agent is
allowed to infer rather than read, and it is labelled so it can never be
mistaken for a Trait.

## 4. Schema shape

`build` is a **sibling of `dna`** on the Item — not nested inside `dna`, because
`dna` is defined as "read off the capture" and this is not. Keeping it outside
`dna` also means the prompt renderer (which reads only `item.dna`) needs **no
change**, so the "design brief, never code" rule holds for free.

```ts
// schema/dna.ts
export const Build = z
  .object({
    /**
     * Candidate tools, most load-bearing first, e.g.
     * ["Three.js", "React Three Fiber", "GSAP"]. Freeform strings, NOT a closed
     * vocabulary: the tooling universe is open-ended and any fixed list goes
     * stale. This is a deliberate departure from the closed-list habit elsewhere
     * in the schema, justified by that churn.
     */
    stack: z.array(z.string().min(1)).max(12),
    /** The 2-4 techniques that matter for replicating THIS design. Prose. */
    techniques: z.string().max(4000),
    /**
     * 'suggested' = written by the agent (approximate, hedged in the UI).
     * 'written'   = an owner Override.
     */
    authorship: z.enum(['suggested', 'written']),
  })
  .strict();
```

Added to the Item object as `build: Build`.

**Undetermined Build** = `stack: []` and `techniques: ''`. Rendered as silence,
the same convention traits use. A Build is Undetermined when the design calls for
nothing distinctive (a plain static page) *or* when it has not been generated
yet (freshly migrated Items, before `re-build`).

**Version bump.** Adding a field to a `.strict()` Item makes older files invalid,
so `SCHEMA_VERSION` goes **2 → 3**, exactly as `002-add-motion` did for the
motion trait.

## 5. Migration

`migrations/003-add-build.ts`, mirroring `002-add-motion.ts`: for every Item,
add `build: { stack: [], techniques: '', authorship: 'suggested' }` (i.e.
Undetermined) and set `schemaVersion: 3`. This makes all 10 existing Items valid
under the new schema without asserting anything about their stack.

## 6. Producer path

Honours the two-producers rule (only the CLI and hand-written sessions write; the
app only reads and deletes):

- **New Items** — `dna add` and `dna re-extract` generate the Build in the *same*
  agent pass as the DNA, keyed off the same Capture image plus the freshly-read
  DNA. One call, no extra round-trip. This extends the structured-output schema
  in `schema/generation.ts` and the mapping in
  [`producer/src/lib/extract.ts`](../../../producer/src/lib/extract.ts).
- **Backfill** — a new command **`dna re-build <id>`** (accepting `--all`),
  mirroring `dna re-explore` (which regenerates only motion). It reads the Item's
  stored Capture + DNA and writes **only** the Build. Offline, no re-capture.
  Chosen over folding backfill into `dna re-extract` so populating a Build does
  not re-roll DNA hexes and labels you are already happy with.

**Retroactive rollout:** `npm run library:migrate` (all 10 become Undetermined) →
`dna re-build --all` (all 10 get populated from their stored Captures).

An owner Override sets `authorship: 'written'`; a later `re-build` must refuse to
overwrite a `written` Build without an explicit force flag, matching the schema's
"an Override, not a re-run, is the primary way to correct a value" posture.

## 7. Extraction doctrine (EXTRACTION.md addition)

A new section, "The Build":

- **Key off** `imagery.kind` (especially `3d-render`), the `motion` trait, and
  `composition`. A 3D + pervasive-motion design suggests a WebGL stack; a still,
  dense, text-first page suggests almost nothing and should stay Undetermined.
- **Say** candidate tools (most load-bearing first) and 2-4 techniques specific
  to this design ("scroll-linked camera", "instanced meshes", "pinned scroll
  sections").
- **Honesty:** it is a suggestion, not a reading. Undetermined is a valid,
  honest answer. **Never invent internals you cannot see** — no "they used
  Redux", no state-management or backend claims. Suggest from the visible design
  language only.

## 8. App panel

A read-only **"How to build"** panel in the Item detail view, below the Source
section:

- `stack` rendered as chips, `techniques` as prose.
- Under a label such as *"Suggested — inferred from the DNA, not read from the
  capture."*
- **Not** added to the copyable design-brief prompt. Display-only for v1 (no
  separate copy button — YAGNI; trivial to add later).
- The change follows [`web/AGENTS.md`](../../../web/AGENTS.md) and is a pure
  read, so it stays within the app's allowed role.

## 9. Explicitly out of scope

- No change to the Prompt or its renderer.
- The Build is not a Trait, not part of the DNA, and never enters a Mix.
- No re-capture — backfill is offline from stored Captures.
- No copy button on the Build panel in v1.

## 10. Validation

After the migration and any `re-build`, `npx tsx schema/check-library.ts` must
pass: every Item valid against schema 3, filenames matching ids, Captures
present. The `check` command and validators must learn the new field.

## 11. Touch list

- `schema/dna.ts` — `Build` schema, `build` on Item, `SCHEMA_VERSION` → 3.
- `schema/generation.ts` — Build in the structured-output schema.
- `schema/prompt.ts` — **no change** (verifies the separation held).
- `migrations/003-add-build.ts` — backfill to Undetermined.
- `producer/src/lib/extract.ts` — map Build out of the agent result.
- `producer/src/commands/re-build.ts` — new command; wire into `producer/src/cli.ts`.
- `producer/src/commands/add.ts`, `re-extract.ts` — carry the Build through.
- `docs/EXTRACTION.md` — "The Build" doctrine section.
- `CONTEXT.md` — the Build term.
- `web/` — read-only "How to build" panel (per `web/AGENTS.md`).
- `wayfinder/assets/008-cli-usage.txt` — document `re-build`.
