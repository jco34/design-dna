# Design DNA - the v1 spec

A local-first, single-user library of the web design and UI work worth keeping,
where everything saved is analysed into its design DNA and can be turned into a
copyable prompt.

This document is the destination of the `wayfinder` map. It gathers every closed
ticket into one place a build session can implement without making further design
decisions. Where it summarises, the linked asset or module carries the full
detail, and **the code under `schema/` is authoritative** over any prose here.

The single least obvious thing about this design, stated once up front because it
is the easiest to "fix" by accident: **the web app is a pure reader and contains
no AI.** It makes no model calls, spawns no subprocess, has no ingest, no job
queue and no waiting state. The library is written entirely out of band by the
producer CLI and by hand in a Claude session. If you find yourself adding an
upload form, a progress spinner, or an extraction call inside the app, stop; that
is a different product.

---

## 1. The two programs, and the module between them

There are two programs and one shared module.

- **The producer** (`dna`, ticket 008) writes the library: it screenshots a URL
  or ingests an image, calls the Claude Agent SDK to extract the DNA, and writes
  a validated Item to disk. A hand-authored entry written in a Claude session is
  an equally valid second producer through the same schema and validator.
- **The web app** (`web/`, tickets 009, 010, 011) reads the library and never
  writes it.
- **The shared schema module** (`schema/`, tickets 004, 005, 007, 010, 009) is
  the whole of the boundary between them: the record shape, the taxonomy, the
  validators, and the pure functions that render a prompt, mix traits, and query
  the grid. Both programs import it; nothing else is shared.

```
design-dna/
  CONTEXT.md              the glossary (ticket 001, extended by 004, 005, 006)
  SPEC.md                 this file
  schema/                 the shared module, authoritative
    dna.ts                004: ExtractedDna, the Item record, stampAuthorship
    taxonomy.ts           005: the three label axes and Scope
    prompt.ts             007: renderPrompt(item, options)
    mix.ts                010: renderMix(parts), the rack, advisories
    query.ts              009: runQuery, facets, colour distance, URL codec
    index.ts              the barrel both programs import as "@schema"
    check-library.ts      the library:check integrity pass (006, 008)
  library/                the whole library, one portable folder (006)
    items/<id>.json       one Item per file
    captures/<id>.png     one Capture per Item, 2880x1800
    README.md
  migrations/             one numbered script per schemaVersion bump (006, 008)
  seed/                   the five seed designs and their capture script (011)
  web/                    the reader app (Next.js 16, React 19, Tailwind v4)
  wayfinder/              the map and the ticket record of every decision
  docs/adr/               0001 unit of storage, 0002 library as committed files
```

---

## 2. Domain model and glossary

The ubiquitous language is [`CONTEXT.md`](CONTEXT.md) and it is load-bearing:
the words there are the words in the type system by construction. The terms, in
brief, with the ticket that fixed each:

- **Item** (001): one saved thing - one Source, one Capture, one DNA. The unit
  of storage and what one grid card represents.
- **Source** (001): where an Item came from, a URL or an uploaded file.
  Provenance, not a place you browse to.
- **Capture** (001, 003): the single image an Item holds, fixed at save time and
  never changed. A **1440x900 viewport shot at `deviceScaleFactor: 2`**, so
  every Capture is 2880x1800 and 1.6:1.
- **Scope** (001, 003, 004, 005): how much of a design a Capture holds, one of
  `page | section | component`. Producer-supplied, never the agent's to write.
  It governs which traits an Item can have at all.
- **DNA** (001): the analysis of one Item; its traits and its labels. An Item has
  exactly one.
- **Trait** (001, 004): one facet of a DNA that is design content worth
  transplanting on its own. The unit of mixing, taken whole or not at all. Seven
  of them: palette, typography, composition, spacing, surfaceTreatment, imagery,
  philosophy.
- **Swatch** (004): one colour of a palette - its role and how much of the design
  it carries.
- **Label / Axis / Genre / Style / Mood** (005): a taxonomy value that describes
  an Item so it can be found, and is never mixed. Three closed axes.
- **Note** (001, 008): your own words on why an Item was worth saving. Never
  written by the agent.
- **Not applicable / Undetermined / Authorship / Override** (004): the vocabulary
  of absence and authorship. A trait a Scope excludes is Not applicable; a trait
  the agent could not read is Undetermined; every value carries Authorship
  (`agent | sampled | override`) and an agent-read value is approximate.
- **Mix / Prompt** (001, 007, 010): a selection of traits from several Items
  rendered into one Prompt, which is the text the clipboard receives. Always a
  design brief, never code.

---

## 3. The extraction contract (002, 004)

The schema is **two schemas**, and the split is the point.

- **`ExtractedDna`** is exactly what the agent returns under the SDK's
  `outputFormat: { type: 'json_schema', schema }`. It is a closed object: seven
  traits plus the three label axes, and nothing the agent has no business
  authoring. The JSON Schema is
  [`wayfinder/assets/004-extraction-schema.json`](wayfinder/assets/004-extraction-schema.json),
  built from the nine JSON-Schema keywords 002 measured the SDK to honour.
- **`Item`** is the whole stored record. The producer composes it from an
  `ExtractedDna` plus everything the agent may not write: `id`, `addedAt`,
  `source`, `capture`, `scope`, `notApplicable`, `note`, `authoredBy`,
  `schemaVersion`, `taxonomyVersion`. The transformation is mechanical
  (`stampAuthorship`).

Both are defined in [`schema/dna.ts`](schema/dna.ts), which is the Zod read
boundary and the derived TypeScript types. Rationale per field is in
[`wayfinder/assets/004-schema-commentary.md`](wayfinder/assets/004-schema-commentary.md).

**Palette fidelity (002, 004).** Palette is **five roles** (background, surface,
ink, muted, accent), each with an ordinal `weight` (`dominant | supporting |
occasional | undetermined`), never a percentage. A hex is **"what the agent
read"**: 002 measured that hexes are eyeballed, biased a few units and unstable
between runs, so every swatch carries `authorship` and an agent-read hex is
**approximate and must never be presented as exact**. The `sampled` authorship
value exists so that building a real pixel sampler later is not a breaking
change. There is no numeric confidence field: 002 showed the agent is calibrated
in prose but not in self-scores.

**Two absence states, not three.** A state describes the reading; a value
describes the design. `Undetermined` sits on a leaf the agent looked for and
could not read; `Not applicable` is derived from Scope by the producer (only
`component` excludes `composition`). `flat` borders and `none` imagery are
answers, not gaps, so no third "read but unstable" state is needed. `traitState`
derives the three cases; nothing stores them.

---

## 4. Taxonomy (005)

The label vocabulary is **fully closed with no free tags**. Three axes, defined
with their glosses in [`schema/taxonomy.ts`](schema/taxonomy.ts) and argued in
[`wayfinder/assets/005-taxonomy.md`](wayfinder/assets/005-taxonomy.md):

- **`genre`** - what kind of designed thing this is. Exactly one of:
  `landing-page, product-ui, dashboard, editorial, portfolio, commerce, docs,
  undetermined`.
- **`style`** - the visual idiom. Nought to two of: `brutalist, swiss,
  technical, organic, maximalist, retro, glassmorphism, experimental`. Empty is a
  legitimate answer ("no named idiom").
- **`mood`** - how it feels. Nought to two of: `calm, bold, playful, serious,
  refined`.

The `brutalist`/`neo-brutalist`/`brutalism` sprawl the ticket feared is answered
by a single member with a deliberately wide gloss, because 002 measured boundary
readings as unstable and a coarse-but-stable facet beats a fine one that flips on
re-run. The gloss is the definition and the prompt: `LABELS_JSON_SCHEMA` builds
the agent's field descriptions from the same records.

**Evolution** is append-only. `taxonomyVersion` (an integer, not a literal)
stamps each Item; an Item labelled under an older vocabulary is valid and merely
stale, findable via `isStale`. Backfill is a narrow relabel pass that respects
`authorship` and is never a re-extraction, because 002 proved re-extraction
destroys palettes. Authorship sits once per axis.

---

## 5. Storage and persistence (006)

Decided in [`wayfinder/assets/006-storage-contract.md`](wayfinder/assets/006-storage-contract.md)
and [ADR 0002](docs/adr/0002-library-as-committed-files.md).

- **`library/`, a committed folder.** One JSON file per Item under `items/`, one
  PNG per Capture under `captures/` named after its Item. Read by a full
  directory scan; 006 measured a fully Zod-validated scan of 300 Items at 31ms,
  so there is no index and no query engine.
- **JSON, not SQLite.** Hand-editability is a hard requirement (a Claude session
  is a first-class second writer), and SQLite fails it on every count. The store
  is diffable, greppable and safe to edit without a client.
- **Committed, including the PNGs.** A Capture is write-once (001) so there is no
  churn, and it is the only irreplaceable byte: a DNA re-extracts for a few
  cents, a Capture never returns. A `deviceScaleFactor: 2` Capture measured a
  mean of 1,114 KB across six real sites (the five seed Captures span 190 KB flat
  to 2.0 MB photographic), so 300 Items is 0.2-0.4 GB.
- **Portability.** The folder is the export. Copy `library/` and you have moved
  the library. `LIBRARY_DIR` overrides the location.
- **Versioning is git.** A re-run overwrites the Item file as an
  authorship-respecting merge that keeps every Override verbatim; `git log -p` on
  the file is the history 002's non-idempotence demanded. The producer refuses to
  overwrite an Item with uncommitted changes.
- **Migrations** are one numbered script under `migrations/` per `schemaVersion`
  bump, and one revertable commit.
- **The app writes nothing.** Confirmed read-only. Transient Mix and filter state
  live only in the browser URL.

An example Item rendered in full is in section 7.1 of the storage contract.
`schema/check-library.ts` is the integrity pass and passes over the five seed
Items.

---

## 6. The producer CLI and the write boundary (003, 008)

The full command surface is [`wayfinder/assets/008-cli-usage.txt`](wayfinder/assets/008-cli-usage.txt)
and the protocol is [`wayfinder/assets/008-cli-and-boundary.md`](wayfinder/assets/008-cli-and-boundary.md).

- **One binary, `dna`, writes `library/` directly.** The boundary is the shared
  `schema/` module, not a wire format, because the app is already a pure reader
  and there is no importer to decouple.
- **Input is sniffed, not a verb:** `dna add <url|file>`. Capture follows 003's
  recipe exactly (viewport 1440x900 at `deviceScaleFactor: 2`, never full-page,
  reduced motion, animations disabled, a bounded wait; no `networkidle`, no fixed
  sleeps). `--selector` crops to a section or component and sets Scope. Capture
  failure refuses the Item, preserving the one-capture invariant.
- **The hand-authored path** is first-class: `dna add --no-extract`, `dna id`,
  and `dna validate` make writing an entry in a Claude session cheap. `dna
  validate` / `library:check` align with `schema/check-library.ts`.
- **Batch and resume:** a directory of images is a real batch (002 measured
  18-48s per Item). Resume is **observed from the library**, not journalled: each
  Item is atomic, so a re-run skips what is already present and never re-runs it,
  which is why resume carries none of 002's non-idempotence.
- **Validation residue** after the SDK's self-retry **refuses the Item** rather
  than writing it degraded; there is no `failed` state on disk.
- **Mutation** is explicit and rare: `re-extract` (destructive, no `--all`) and
  the non-destructive `relabel` (`--stale` / `--all`).
- **Schema drift is two counters that must never merge:** `schemaVersion`
  (`z.literal`, governs shape, old is invalid, moved by a migration) and
  `taxonomyVersion` (integer, governs vocabulary, old is stale, moved by
  relabel). The rule: if `Item.parse` would reject it, it is `schemaVersion`.

The Note goes in via its own verb, never prompted mid-batch, because a good Note
needs the Capture in front of you.

---

## 7. Prompt generation, single and mixed (007, 010)

**Single (007).** The clipboard receives a **design brief, never an
instruction**, rendered on demand from the stored Item by
[`schema/prompt.ts`](schema/prompt.ts) `renderPrompt(item, options)` and nothing
else, so improving the template improves every Item retroactively and an Override
reaches the prompt. It is labelled sections of English clauses (schema shape is
not prompt shape); enum members render as the same English the schema used to
define them; the philosophy leads; every eyeballed hex is hedged per value as
`around #c8452d`; Undetermined and Not applicable both render as silence; the
Source is named last with an anti-pastiche clause; labels never appear. Options
select a trait subset, toggle the Note, and toggle the Source. Candidates and the
worked example are in
[`wayfinder/assets/007-prompt-candidates.md`](wayfinder/assets/007-prompt-candidates.md).

**Mixed (010).** A **Mix is a partial map from Trait to Item**: seven named
slots, at most one Item each, so 001's atomic-trait rule makes a two-palette
conflict unrepresentable rather than resolved.
[`schema/mix.ts`](schema/mix.ts) `renderMix(parts)` assembles the brief
**mechanically** by calling `renderPrompt` per slot (the map forbids a model call
in the app); a Mix of one donor is byte-identical to 007's subset prompt. It is
**transient**: the URL is the save, holding `(trait, itemId)` pairs and never
content, which dissolves the deletion question. The honest cost, recorded rather
than hidden: a mix carrying `philosophy` can contradict itself across sources
where a single-source prompt cannot; it is defended by a frame, a demoted and
labelled intent paragraph, and an advisory, and a four-plus-donor mix triggers a
"many sources" advisory. Advisories sit beside the rack and never enter the
prompt.

---

## 8. Search and filter (009)

The model is [`wayfinder/assets/009-search-and-filter.md`](wayfinder/assets/009-search-and-filter.md),
implemented in [`schema/query.ts`](schema/query.ts).

- **Browsing beats searching at this scale**, so there is one grid in a stable
  order and every control subtracts from it. A facet pass over 300 Items measures
  0.035ms; there is no engine.
- **Composition:** text AND facets AND colour; **OR within a facet, AND across
  facets.** OR-within is forced by 005's two-value caps. Adding a value can only
  widen the grid, so no sequence of facet clicks reaches an empty page.
- **Facets** are `FACETS`: eight primary (genre, style, mood, scope, lightness,
  temperature, density, noted) and seven secondary trait enums. **Light/dark and
  temperature are derived at read time** from the palette and stored nowhere;
  favourites are the existing Note.
- **Colour** is a whole-palette **minimum distance in OKLab** (`deltaEOK`), not
  the dominant swatch, chosen over CIEDE2000 because eyeballed hexes make
  lab-grade precision meaningless. A typed `#hex` in the search box routes to a
  colour query; a colour picker sets the same field. The matched swatch comes
  back per Item with its authorship so the UI hedges an approximate match.
- **Empty results are a diagnosis:** `facetCounts` disables any value whose count
  is zero, and `explainEmpty` names which single constraint to drop and how many
  it recovers.
- **The URL is the state:** `encodeQuery` / `decodeQuery` are the codec, so the
  back button and a bookmark behave.

---

## 9. UI surfaces and the card (011)

Prototyped as the real v1 app under [`web/`](web), resolved in
[`wayfinder/tickets/011-ui-surfaces.md`](wayfinder/tickets/011-ui-surfaces.md).

- **Two routes plus one overlay:** the library grid (`/`), the item detail
  (`/item/<id>`, where traits are legible enough to select from), and the Mix
  drawer reachable from either. **No add surface**; the empty state names the
  `dna add` CLI, because the app writes nothing.
- **Identity: zero-hue chrome.** Every selected state is an inversion of ink; the
  Captures and their palette bars are the only colour on screen. Type carries the
  character: a grotesque for the interface, a monospace for every read value.
- **The card is Capture-dominant** with a **palette weight bar** beneath it, each
  role sized by its ordinal weight, an Undetermined swatch drawn as a hatched
  blank. Uniform grid, because 003 fixed the Capture at 1.6:1. Every eyeballed
  hex reads `~`-hedged.
- **Copy lives in two places:** the whole-design prompt from the detail view, the
  mixed prompt from the rack (which shows the rendered brief before copying).
- **The whole surface is subtractive and URL-addressable;** 009's query and 010's
  rack share one URL by patching disjoint keys.

Serving: Captures live outside `web/public` and are streamed by the
`/captures/<id>` route handler from the library folder, cached immutable.

---

## 10. Out of scope, restated

These are ruled beyond the v1 destination. They do not graduate. Restated here so
a build session does not helpfully add one back.

- **The web app is read-only and contains no AI.** No model calls, no subprocess,
  no ingest, no queue, no waiting state, no upload form, no progress indication,
  no per-item pending or failed state. This is the single most important line in
  this spec.
- **Storing or generating code.** The payoff is a prompt. No AI-generated
  components, no captured snippets, no scraped CSS as ground truth.
- **Any read path out of the library except the copy button.** No MCP server, no
  query CLI, no file export for another tool to consume. The clipboard is the
  boundary out. (The write-side CLI is in scope; the read side did not move.)
- **Deployment, hosting, auth, multi-user, sync.** Follows from local-forever
  scale.
- **Vector or embedding-backed semantic search.** Does not earn its complexity at
  low hundreds of items; 009 designed search within that constraint.
- **A browser extension for one-click capture.** A different product surface.

---

## 11. Deliberately deferred

Patches of the map's "Not yet specified" that were seen and left alone rather than
forgotten. A build session should not invent answers to these.

- **Correcting the agent** beyond Override and the CLI's `re-extract` / `relabel`
  verbs. 002 made re-running destructive, so Override is the primary correction
  and re-running the exception. A richer in-app correction UI is out, because the
  app cannot write.
- **Extraction prompt tuning.** The system prompt that makes analysis good is a
  tuning loop against real inputs, tracked by `authoredBy.promptVersion`, not a
  v1 decision.
- **Duplicates and near-duplicates.** Identity is the act of saving (001), so two
  Items with one Source are both legitimate. Whether a hash of the Capture bytes
  drives an advisory "you may already have this" is deferred;
  `capture.sha256` is reserved for the first migration.
- **Deletion and archival**, and what a saved Mix does when an Item it drew from
  is gone. 010 dissolved most of this by making a Mix transient URL state that
  references Items and drops missing ones; standing archival is still deferred.
- **Relationships between Items** beyond mixes (collections, boards, influence
  edges). Too dim to phrase for v1.

---

## 12. Build order

A suggested order that respects the dependencies, for a session implementing v1
from this spec. The `schema/` module already exists and is authoritative; the
rest builds outward from it.

1. Confirm `schema/` typechecks and `schema/check-library.ts` passes over
   `library/`. This is the contract everything else depends on.
2. Build the producer `dna` binary against section 6, capture step first
   (the reference implementation is `seed/capture.mjs`), then extraction, then
   `validate` / `id` / `relabel` / `re-extract` / `migrate`.
3. The app (`web/`) is built and running against sections 8 and 9. Extend it
   only within the read-only, no-AI constraint of section 10.
4. Fill the library with real Items via `dna add`, replacing or keeping the five
   seed designs as desired.

The map ends when this spec is complete and every ticket's resolution is
represented above. It is.
