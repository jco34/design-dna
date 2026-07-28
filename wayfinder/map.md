---
label: wayfinder:map
title: Design DNA
---

# Design DNA

A local web app holding the web design and UI work I like (URLs, screenshots,
images), where anything I drop in gets categorized and analysed by an AI agent
into its design DNA (palette, typography, design philosophy), searchable and
filterable, with a copyable prompt per item and the ability to mix elements from
several items into one prompt.

## Destination

A locked v1 design spec for Design DNA, written into this repo: the domain
model, the storage and persistence contract, the producer CLI and the import
boundary, the taxonomy, the search and filter model, prompt generation and
mixing behaviour, and the UI surface inventory. Complete enough that a build
session can implement v1 without making any further design decisions.

The app itself is *not* built by this map. Reaching the destination means
handing off a spec, not running `npm run dev`. The spec covers two programs:
the **web app** that reads the library, and the **producer CLI** that writes it.

## Notes

**Domain:** local-first, single-user personal design inspiration library.

**Stack (assumed, from the sibling projects in `/Personal Projects`):** Next.js
+ React 19 + Tailwind v4 + TypeScript for the web app. The producer CLI is plain
Node + TypeScript in the same repo, sharing the schema module with the app and
nothing else. Ticket 006 may revise the data layer; nothing else should re-open
the stack.

**Skills every session should consult:** `grilling` and `domain-modeling` by
default, `prototype` for the prototype-typed tickets, `frontend-design` or
`ui-ux-pro-max` for ticket 011.

**Standing preferences:**
- Never use the em dash character. Plain hyphens only. (From `AGENTS.md`.)
- Weigh quality, simplicity, robustness and long-term maintainability over
  development cost. (From `AGENTS.md`.)
- [`CONTEXT.md`](../CONTEXT.md) at the repo root is the glossary, created by
  ticket 001. Read it at the start of every session, and extend it when a ticket
  resolves a term. It is a glossary only: no schema, no rationale, no
  implementation detail.

**Locked while charting (not tickets, do not re-litigate):**
- **No AI runs inside the web app.** The app is a pure reader of a library that
  was written out-of-band. It makes no model calls, spawns no subprocess, and
  has no asynchronous ingest, no job queue, and no waiting state. *(Re-chartered
  2026-07-26, superseding the original "Agent SDK as a local subprocess inside
  the app" lock. See ticket 002's resolution.)*
- The library is written by a **producer CLI** living in this repo, which
  screenshots URLs with a headless browser, calls the **Claude Agent SDK** using
  existing Claude Code auth rather than a metered API key, and writes validated
  entries into the store. A hand-written entry produced in a Claude session is
  an equally valid second path through the same schema and the same validator.
- Because of the two above, the extraction schema is a **hand-off contract**
  between two programs, not an internal detail of one. That makes ticket 004 the
  load-bearing ticket on this map.
- The copyable output is **always a prompt**, never code.
- Scale is **low hundreds of items, local forever**: no auth, no deploy, no
  multi-user, no sync.
- The **copy button is the only export surface**.

## Decisions so far

<!-- one line per closed ticket -->

- **001** The unit of storage is the **Item**: one source, one capture, one DNA.
  Elements are not stored; the mixable unit is a **trait** of an item's DNA, and
  scope is chosen by cropping rather than derived by the agent. Glossary in
  [`CONTEXT.md`](../CONTEXT.md), root decision in
  [ADR 0001](../docs/adr/0001-item-as-the-unit-of-storage.md).
  ([ticket](tickets/001-what-a-captured-item-is.md))
- **002** The Agent SDK **does** work headlessly on Windows on existing Claude
  Code auth, and has native JSON-Schema output that self-retries, so schema
  validity is not the risk it was thought to be. Superseded in the same session
  by the decision to move extraction out of the app entirely, but two findings
  outlive that: palette hexes are **eyeballed, not sampled** (biased and
  unstable run-to-run), so re-extraction is not idempotent. Findings in
  [`002-agent-sdk-findings.md`](assets/002-agent-sdk-findings.md).
  ([ticket](tickets/002-prove-agent-sdk-extraction.md))
- **003** A **Capture** is a fixed **1440x900 viewport shot at
  `deviceScaleFactor: 2`**, never full-page: measured across ten real sites, a
  full-page Capture would span 0.63:1 to 10.25:1 (median **7.57:1**), which no
  card grid survives, so **011 may treat 1.6:1 as fixed**. Consent banners are
  captured as noise rather than dismissed (signature detection missed the
  first-party dialogs that design-conscious sites ship). Capture failure
  **refuses the Item**, keeping 001's one-capture invariant. Cropping becomes a
  CLI `--selector` flag backed by `locator.screenshot()`, which **revises 001's
  decision 9** and makes Scope human-chosen for URL items too. Findings in
  [`003-capture-findings.md`](assets/003-capture-findings.md).
  ([ticket](tickets/003-how-a-url-becomes-an-item.md))
- **004** The extraction schema is **two schemas**: `ExtractedDna`, the closed
  object the agent returns under `outputFormat`, and the **Item** record that
  adds everything the agent may not write, related by nine mechanical lines.
  Seven traits; palette is **five roles each with an ordinal weight** (never a
  percentage), and a hex is **"what the agent read"**, stored as approximate,
  with per-swatch `authorship` (`agent | sampled | override`) so building a pixel
  sampler later is not a breaking change. **Two absence states, not three:**
  a state describes the reading and a value describes the design, so
  Undetermined sits on the leaf and **Not applicable is derived from Scope by
  the producer** - which **revises 001's decision 5** and settles 003's
  challenge, making Scope CLI-supplied and never the agent's to write. Motion is
  rejected because a still Capture cannot show it, and the philosophy "axes" turn
  out to be labels by 001's own definition, so they go to 005. Schema in
  [`004-extraction-schema.json`](assets/004-extraction-schema.json), module in
  [`004-extraction-schema.ts`](assets/004-extraction-schema.ts), commentary in
  [`004-schema-commentary.md`](assets/004-schema-commentary.md).
  ([ticket](tickets/004-extraction-schema.md))
- **007** The clipboard gets a **design brief, never an instruction**: one
  template **rendered on demand** from the stored Item and nothing else, so
  editing it improves every prompt retroactively and an **Override** reaches the
  prompt where a stored string could not. Structured as labelled sections of
  English clauses (schema shape is *not* prompt shape), with enum members
  rendered as the same English 004's `description` used to define them. Every
  eyeballed hex is hedged **per value** as "around #c8452d", which 004 section
  3.4 forced: a single footnote cannot un-hedge one swatch without un-hedging
  four. Undetermined and Not applicable both render as **silence**, so length
  tracks what was actually read. The Source is named **last** with an
  anti-pastiche clause, and **labels never appear** (CONTEXT: a label describes
  an item rather than contributing to a prompt). **010's partial prompts are the
  same code path**, not a second template. **This closes a door in 006:** the
  store needs no prompt field, cache or invalidation. Candidates in
  [`007-prompt-candidates.md`](assets/007-prompt-candidates.md), template in
  [`007-prompt-template.ts`](assets/007-prompt-template.ts).
  ([ticket](tickets/007-what-the-copied-prompt-is.md))
- **005** The label vocabulary is **fully closed** with **no free tags**, because
  the open half the hybrid was meant to supply already exists as `philosophy`
  plus your `note`: three axes only, **`genre` (one of seven), `style` (0-2 of
  eight), `mood` (0-2 of five)**, each value carrying a definition that lives in
  the module so it reaches the prompt. `brutalist`/`neo-brutalist`/`brutalism`/
  `raw-concrete` is answered by **one member with a deliberately wide gloss**,
  since 002 measured that boundary readings flip run to run and a filter that
  changes on re-run is worse than a coarse one. Density, flat/dimensional, colour
  temperature and light/dark are **rejected as derivable** from traits 004
  already stores; era collapses into `style: retro`; industry is refused by the
  schema's own "describe the design, not the company". Authorship sits **once per
  axis**, evolution is **append-only with old items stale and findable via
  `taxonomyVersion`**, and backfill is a **narrow relabel pass, never a
  re-extraction**, because 002 proved re-extraction is not idempotent. **Scope is
  confirmed as `page | section | component`** and the `notApplicable` table 004
  left unwritten has **one non-empty cell**: `component` excludes `composition`.
  Vocabulary in [`005-taxonomy.md`](assets/005-taxonomy.md), module in
  [`005-taxonomy.ts`](assets/005-taxonomy.ts).
  ([ticket](tickets/005-taxonomy-and-tagging.md))
- **006** The library is **`library/`, a committed folder**: one JSON file per
  Item, one PNG per Capture named after it, read by a full directory scan. The
  ticket's four questions are one decision, because choosing text is what makes
  git history meaningful and committing is what makes an overwrite safe.
  **SQLite fails the hand-editability requirement on all four of its parts** and
  would delete the git decision with it; a full scan of 300 Items **fully Zod-
  validated measures 31ms**, so there is no query to accelerate. **003's deferred
  file-size number is closed**: a `deviceScaleFactor: 2` Capture is a **mean of
  1,114 KB** across six real sites (median 610 KB, tail to 3.0 MB, 2.32-3.38x
  over 1x), so 300 Items is 0.2-0.4 GB and metadata is **0.3% of the library**.
  Committing PNGs is safe because 001 makes each Capture write-once, so there is
  no churn; **ignoring them would ignore the only irreplaceable bytes**, since a
  DNA re-extracts for $0.05-0.13 and a Capture never returns. **An overwrite is
  an authorship-respecting merge** that keeps every Override verbatim, and
  `git log -p` on an Item file is the version history 002's non-idempotence
  demanded. **The app writes nothing**, which dissolves locking, transactions and
  migration-on-write. Contract in
  [`006-storage-contract.md`](assets/006-storage-contract.md), root decision in
  [ADR 0002](../docs/adr/0002-library-as-committed-files.md).
  ([ticket](tickets/006-storage-and-persistence.md))
- **010** A **Mix is a partial map from Trait to Item**: seven named slots, at
  most one Item each, so 001's atomic-trait rule makes two-palette conflict
  **unrepresentable rather than resolved**, and the primary/accent merge is
  sub-trait selection in disguise and refused. It is **transient** (the URL is
  the save, holding `(trait, itemId)` pairs and never content, per 006), which
  **dissolves the map's parked deletion question** since nothing stored can
  dangle. The prompt is **assembled mechanically** by calling 007's
  `renderPrompt` once per slot (the map forbids a model call in the app), and a
  Mix of one donor is byte-identical to 007's subset prompt. **Cross-trait prose
  contradiction is the real, only-partly-mitigated cost**: a mix carrying
  `philosophy` can contradict itself where a single-source prompt cannot,
  defended by a frame, a demoted and labelled intent paragraph, and an advisory.
  Model in [`010-mixing-model.md`](assets/010-mixing-model.md), render in
  [`010-mix-render.ts`](assets/010-mix-render.ts).
  ([ticket](tickets/010-mixing-elements.md))
- **009** Browsing beats searching at this scale, so there is **one grid in a
  stable order and every control subtracts from it**, not a query engine: 006's
  31ms scan means a facet pass over 300 Items measures **0.035ms** and the worst
  case (text + facets + colour + hue sort) **0.38ms**, so "no index needed" is
  measured. Search and filters compose by **conjunction** (text AND facets AND
  colour); within a facet values **OR**, across facets they **AND**, and
  OR-within is forced because 005's two-value caps make AND-within provably empty
  at a fixed click count. Colour is a whole-palette **minimum distance in OKLab**
  (`deltaEOK`), chosen over CIEDE2000 because 002's eyeballed hexes sit
  ~0.004-0.06 apart so lab-grade precision is measuring noise. **Light/dark and
  temperature are derived at read time** (005's "the best facet is the one you
  must not store"), favourites are the existing **`note`** because the app cannot
  write (006), and empty results are a **diagnosis** (`facetCounts` disables
  dead-end values, `explainEmpty` names what to clear). Model in
  [`009-search-and-filter.md`](assets/009-search-and-filter.md), module in
  [`009-query.ts`](assets/009-query.ts).
  ([ticket](tickets/009-search-and-filter-model.md))
- **008** The library is written by **one binary `dna` that writes `library/`
  directly**, the boundary being the shared **`schema/` module** rather than a
  wire format, since 006 already made the app a pure reader and there is no
  importer to decouple from. Input kind is **sniffed, not a verb**
  (`add <url|file>`); `dna add --no-extract`, `dna id` and `dna validate` make
  the hand-authored path cheap. **Resume is observed from the library, not
  journalled** (each Item is atomic, so a re-run skips what is present), which
  carries none of 002's non-idempotence because resume skips and never re-runs;
  that risk lives only in `re-extract`, which has **no `--all`** while the
  non-destructive `relabel` does. Validation residue after the SDK's self-retry
  **refuses the Item** rather than writing it degraded, keeping the no-`failed`-
  state rule. **Drift is two counters that must never merge:** `schemaVersion`
  (`z.literal`, governs shape, old is invalid, moved by `migrate`) and
  `taxonomyVersion` (integer, governs vocabulary, old is stale, moved by
  `relabel`); the rule is "if `Item.parse` would reject it, it is
  `schemaVersion`". **No ADR: this is ADR 0002 applied.** CLI in
  [`008-cli-and-boundary.md`](assets/008-cli-and-boundary.md) and
  [`008-cli-usage.txt`](assets/008-cli-usage.txt).
  ([ticket](tickets/008-producer-cli-and-import-boundary.md))
- **011** The app is **two routes plus one overlay** (library grid, item detail,
  a Mix drawer reachable from either), with **no add surface** because the app
  writes nothing; the empty state names the `dna add` CLI. Identity is the strict
  reading of "neutral": **zero saturated colour in the chrome**, so every
  selected state is an inversion of ink and the Captures plus their palette bars
  are the only colour on screen, with type carrying the character (a grotesque
  for the interface, a monospace for every read value). The card is
  **Capture-dominant with a palette weight bar** beneath it, each role sized by
  its ordinal weight so a 2 percent accent reads as a sliver and an Undetermined
  swatch is a hatched blank, which answers 011's hardest question without the
  swatches fighting the screenshot. Every eyeballed hex reads `~`-hedged
  everywhere (004, 007). Uniform grid, because 003 fixed the Capture at 1.6:1.
  The whole surface is **subtractive and URL-addressable**: 009's facets disable
  their zero-count values, and 009's query and 010's rack share one URL by
  patching disjoint keys. Prototyped as the real v1 app under
  [`web/`](../web), not a throwaway.
  ([ticket](tickets/011-ui-surfaces.md))

## Not yet specified

In scope, but not yet sharp enough to ticket. Graduates as the frontier
advances.

- **Correcting the agent.** What happens when extraction is wrong or thin: a
  re-run, a manual override, a partial edit. Not statable until the extraction
  schema (004) and storage (006) exist, since the shape of a correction depends
  on what is stored and whether agent output and human edits stay
  distinguishable. **002 sharpened this:** a re-run is not idempotent (same
  input, different palette and different type scale), so re-running is a
  *destructive* act on a trait you may have been happy with. That argues for
  **Override** as the primary correction mechanism and re-running as the
  exception. Also now partly a CLI question rather than a UI one: the app may
  not be able to correct anything at all if it is read-only.
- **Extraction prompt tuning.** The actual system prompt that makes design
  analysis good is a tuning loop against real inputs, not a single decision.
  Waits on 004 locking the target schema.
- **Duplicates and near-duplicates.** Saving the same site twice, or a
  screenshot of a site already captured by URL. No longer blocked: 001 settled
  that identity is the act of saving, so two items with one source are both
  legitimate and nothing prevents them. What remains is whether a hash of the
  capture bytes drives an advisory "you may already have this" signal, and where
  it would surface.
- **Deletion and archival.** Whether items are deletable or archivable, and
  what happens to a saved mix that references a removed item. Waits on 010 only;
  001 settled that an item has stable identity and that a mix draws on the traits
  of items, so what is left open is what a saved mix does when an item it drew
  from is gone.
- **Importing the existing backlog.** Bulk-ingesting screenshot folders that
  already exist on disk. No longer a special case: it is the producer CLI
  pointed at a directory, and the only open question is cost and rate at volume.
  002 measured ~$0.05-0.13 and 18-48s per item, so a few hundred items is a
  bounded, affordable batch. Waits on 008.
- **Relationships between items.** Whether items need edges beyond mixes
  (collections, boards, "this influenced that"). Too dim to phrase while 001
  and 010 are open.

## Out of scope

Ruled beyond the destination. Never graduates. Returns only if the destination
is redrawn, and then as a fresh effort.

- **Storing or generating code.** No AI-generated components, no captured
  snippets, no scraped computed CSS as ground truth. Decided while charting:
  the payoff is a prompt, which keeps the app stack-agnostic and sidesteps
  generated code rotting against whatever project it lands in.
- **Anything reading the library back out except the copy button.** An MCP
  server, a query CLI, or a file export that lets Claude Code consume this
  library directly remains declined for v1. The clipboard is still the boundary
  *on the way out*. Note this was narrowed on 2026-07-26: a **write**-side CLI is
  now in scope and is how the library gets filled at all. The read side did not
  move.
- **Deployment, hosting, auth, multi-user, sync.** Follows from the locked
  local-forever scale.
- **Vector or embedding-backed semantic search infrastructure.** At low
  hundreds of items it does not earn its complexity. Ticket 009 designs search
  within that constraint.
- **A browser extension for one-click capture.** A different product surface
  than a local web app, however natural a fit it is for grabbing URLs.
