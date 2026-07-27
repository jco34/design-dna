---
id: 005
title: Taxonomy and tagging, closed vocabulary or agent-invented
label: wayfinder:grilling
status: closed
assignee: jeb
blocked-by: 004
parent: map
---

## Question

When the agent "automatically categorizes" something, what is it choosing
from?

The brief asks for automatic categorization and for filters that let you find
the design you have in mind. Those two pull against each other: filters need a
stable vocabulary, and an agent inventing tags per item will not produce one.
Left free, you get `brutalist`, `neo-brutalist`, `brutalism` and `raw-concrete`
as four separate facets across four items, and the filter becomes useless at
exactly the scale where you need it.

Resolve:

- **Closed, open, or hybrid?** A fixed taxonomy the agent must pick from, free
  tags it invents, or a fixed spine (style, mood, industry, surface type) plus
  free tags underneath.
- **If closed, what are the categories?** Draft the actual list. Style, mood,
  era, density, colour temperature, surface type (landing page, dashboard, app
  UI, editorial, portfolio, e-commerce), industry. Which axes do you genuinely
  filter by when hunting for a design, and which just feel tidy?
- **How does the vocabulary evolve?** A closed list you cannot extend will be
  wrong within a month. Who adds a category, and what happens to items
  categorized before it existed. Is there a backfill, or do old items stay
  stale?
- **Tag sprawl control** if free tags are allowed: normalization, an alias
  map, a synonym pass, a minimum-use threshold before a tag becomes a filter
  facet.
- **Multi-label or single?** One design is plausibly both editorial and
  brutalist. Are categories exclusive per axis, or can an item carry several
  values on one axis?
- **Correcting a bad category.** The narrow case of the broader correction
  question sitting in the map's "Not yet specified". Enough here to know
  whether a human-set category and an agent-set one are distinguishable in
  storage, which constrains ticket 006.

Deliverable: the taxonomy itself, and its terms added to `CONTEXT.md`.

## Resolution

**The vocabulary is fully closed, three axes wide, and there are no free tags,
because the open half the hybrid was meant to provide already exists as
`philosophy` and your `note`.** The axes are `genre` (one value), `style` (0-2)
and `mood` (0-2); density, colour temperature, light/dark, era, industry and a
hero/nav/footer "part" axis are all rejected, most of them because they restate
a trait 004 already stores or are computable from one. Vocabulary in
[`../assets/005-taxonomy.md`](../assets/005-taxonomy.md), module in
[`../assets/005-taxonomy.ts`](../assets/005-taxonomy.ts).

### What was decided

1. **Closed, not hybrid, and the hybrid dissolves rather than losing on
   points.** Four arguments, ascending. The sprawl is measured rather than
   feared: 002 ran one image twice and reported free-text fields "varied in
   wording but were consistent in substance", and the spike's free-tag array is
   the field that finding is about. A closed list is *enforceable*, because
   `enum` is inside 004's proven keyword budget and the SDK self-retries against
   it, where every sprawl control the ticket lists (normalization, aliases,
   synonyms, a use threshold) is a repair pass that runs after the damage. At a
   few hundred items an invented tag never reaches a use threshold, so it costs
   tokens and yields no facet. And decisively, **004 already ruled there is
   exactly one open field and it is `philosophy`**, with your `note` beside it,
   both searchable by 009 - so free tags would be 004's rejected `observations`
   bag arriving through a different door.

2. **Three axes, admitted by five tests**: it is a label and not a trait (001
   decision 7), it is **not derivable from a trait**, you actually hunt by it, it
   is readable from a still Capture (003), and its values can be written down
   now. `genre`, `style`, `mood`.

3. **The rejections carry more weight than the admissions, and most are forced.**
   **Density** restates `spacing.density`, which 004 calls the most-reached-for
   filter there is. **Flat/dimensional** restates `surfaceTreatment.elevation`.
   **Colour temperature and light/dark** are computed from `palette` hues and
   `palette.background` luminance, and 009's ticket already asks for exactly
   that: storing them would put a `warm` label on an Item whose accent was later
   overridden to blue. **Era** is rejected because every value it would carry is
   also a plausible `style` value, and two axes with overlapping value sets is
   the ticket's own sprawl failure with axis names bolted on; period pastiche
   becomes the single style member `retro` and the period itself is prose.
   **Industry** is rejected on a line already in the generation schema: "Do not
   describe the subject matter, the copy, or the company; describe the design."
   A **part** axis (hero, nav, footer, pricing table) is the painful cut: it
   fails on arithmetic, since a twenty-value list over the third of the library
   that is section- or component-scoped leaves a handful of items per facet, and
   the hunt is served by prose search instead. Cutting `part` is what also cuts
   `pricing` and `auth` from `genre`.

4. **The `brutalist`/`neo-brutalist`/`brutalism`/`raw-concrete` case is answered
   by one member and a wide definition, and the definition is the mechanism.**
   An enum alone would let the hard-shadow style land on `maximalist` one run
   and `brutalist` the next; the gloss saying "covers the whole family" is what
   stops it. Splitting `neo-brutalist` out was refused even though it is a
   genuinely distinct look, because 002 measured that boundary readings flip
   between runs and **a filter whose value changes on re-run is worse than a
   coarser filter that does not**. This is why `STYLE_GLOSS` lives in the module
   and `LABELS_JSON_SCHEMA` builds its descriptions from it: 004 established
   descriptions are prompt surface, so definitions kept anywhere else drift out
   of the prompt.

5. **Multi-value on style and mood, capped at 2; genre is single.** The ticket's
   own example for multi-labelling ("plausibly both editorial and brutalist")
   turns out to be an argument for splitting the axes: that is
   `genre: editorial` plus `style: [brutalist]`. Multi-value survives on its own
   merits, but **the cap is the load-bearing half**, because an uncapped array
   degrades a filter by the opposite route from sprawl: four styles per Item
   means every query matches everything. `maxItems` is in the proven budget, so
   the cap binds at generation. **An empty array is a legitimate answer**, which
   is 004's `headingFamily` rule applied to labels: forcing at least one style
   guarantees the closest-but-wrong member gets applied, and a false `brutalist`
   is worse than no style, because you cannot filter away what you do not know
   is there.

6. **Authorship sits once per axis, using 004's existing `agent | override`.** No
   parallel mechanism, as instructed. 004 keyed authorship granularity to mixing
   atomicity, but labels are never mixed, so that argument is silent here and the
   correction case settles it instead: **an axis's value set is a single
   judgement, so it is attributed as one.** Per-value authorship would leave
   `swiss` marked `agent` inside a `['brutalist', 'swiss']` pair the agent never
   saw. Both reasons 004 gave the palette per-value authorship were checked and
   both fail here: no future sampler upgrades labels one at a time, and 007 never
   hedges a label, because a label is a pick from a list rather than an
   approximate reading. Correcting a bad category is therefore an Override on one
   axis, which is the constraint 006 asked for.

7. **Evolution is append-only; old Items go stale and stale is correct.** Adding
   a value is an array edit plus a `TAXONOMY_VERSION` bump, and the gloss records
   are typed `Record<Genre, string>` so a value with no definition does not
   compile. Nothing stored changes, because an Item's DNA is a record of a
   reading at a time (001 decision 4), and staleness is findable because every
   Item stores `taxonomyVersion`. Removals and renames are migrations owned by
   006 and 008, not edits.

8. **Backfill is a narrow relabel pass and must never be re-extraction.** This is
   forced by a measurement: 002 proved re-extraction is not idempotent, so
   re-running the agent to fix one label would destroy a palette you were happy
   with. The relabel pass re-asks the label question only, writes `dna.labels`
   and `taxonomyVersion` and nothing else, and **the rule that makes it safe is
   `authorship`**: it rewrites only axes still marked `agent`. Automatic backfill
   on version bump is rejected as a side effect that changes an Item under you
   and spends $0.05-0.13 unasked.

9. **Nobody proposes new values but you, and the pressure gauge is free.** A
   review queue implies a UI and the app is a pure reader. If the same unlisted
   idiom keeps turning up in `philosophy` prose, that is the evidence for adding
   a value. The vocabulary grows from reading the library.

10. **Scope is confirmed as `page | section | component`, not replaced.**
    Confirming needs its own argument, and it is that **CONTEXT.md's definition
    of Scope, written by 001, already names both endpoints** ("from a whole page
    down to a single component"), while the middle value is the one 003 created
    when `locator.screenshot()` made section framing free. The boundary rule is
    operational and derived from the consequence: if the capture tells you
    anything about page layout it is at least a `section`, which is the same test
    as "does `composition` mean anything here". Merging `section` into `page` was
    rejected because it still filters, 003 made it a first-class CLI path, and it
    is the only scope with an arbitrary aspect ratio, which 011 will care about.

11. **The scope-to-`notApplicable` table 004 left unwritten is written, and it
    has one non-empty cell.** `component` excludes `composition`; `page` and
    `section` exclude nothing. That is a finding rather than an oversight: 004's
    rule that a value describes the design ate almost everything a Scope could
    exclude, since a component crop has `imagery.kind: 'none'` (a value) and
    Undetermined swatches (a partial read), not exclusions. Surfaced honestly:
    **004's `notApplicable` machinery ends up carrying one entry**, and it earns
    its place on the distinction it preserves rather than on its volume.

12. **The taxonomy is only three of sixteen filter surfaces, which is why it
    could be cut this hard.** Three label axes, Scope, eight trait enums 004
    already built, two derived colour facets, and free-text search. Labels only
    have to carry genre, idiom and feel.

### Collisions with earlier tickets, deliberately surfaced

- **004's `labels` shape is replaced outright, as 004 permitted.** The flat
  `Label[]` with `minItems: 3, maxItems: 8` becomes an object of three
  authored axes. The cardinality bound 004 inherited from 002's spike is gone,
  replaced by per-axis caps that use the same proven `maxItems` keyword. Because
  **no library exists yet, this is an edit to `schemaVersion: 1` rather than a
  migration to 2** - a real choice, and the honest one, since version inflation
  before any data exists buys nothing. 004's `LabelValue` slug format survives as
  the format every value here conforms to.

- **004's `Item` gains `taxonomyVersion`, and it is deliberately not a
  literal.** `schemaVersion` is `z.literal(1)` because an Item in the old shape
  is *invalid*; an Item labelled under an older vocabulary is *valid and merely
  behind*, so `taxonomyVersion` is a positive integer and nothing refuses to
  parse because of it. That asymmetry is what lets rule 7 be "old Items stay as
  they are" instead of "old Items break".

- **004's provisional `Scope` export is superseded rather than contradicted.**
  The values are identical; ownership moves. The dependency direction is now 005
  upstream of 004: 004's module should import `SCOPES` from here and delete its
  placeholder. 005 therefore imports `TraitName` from 004 as a **type only**, so
  there is no runtime cycle, and redeclares the two-member authorship enum
  locally for the same reason, flagged in the module as the line to delete when
  the two files are assembled into the real repo.

- **001 decision 5's remaining clause is now fully spent.** 001 said Scope's
  "vocabulary belongs to ticket 005"; 003 challenged its agent-inference half and
  004 revised it. This settles the last piece, and 001 decision 5 has now been
  revised by 004 and completed by 005 with nothing left open in it.

- **The map's "correcting the agent" item is narrowed, not resolved.** The
  ticket asked only whether human and agent categories stay distinguishable in
  storage, and they do, per axis. What a correction *looks like* is still parked,
  but two things are now fixed for it: an override is per axis, and a relabel is
  a different operation from a re-extraction.

### What was not verified

- **`enum` nested inside `items` was never exercised against the SDK.** 002 used
  `enum` on a scalar and `items` on an array of plain strings; this fragment
  combines them. If it degrades, the fallback is plain strings with the
  vocabulary carried in the `description` alone, which 002 showed is enough for
  hex formatting. Everything else in the fragment is inside the proven budget,
  verified by walking the object rather than by eye.
- **Nobody has measured whether the agent uses a closed list confidently or
  abstains into empty arrays.** 002 points both ways: it refused to invent font
  families, which is the behaviour you want, but the same instinct applied to
  `style` would empty the axis on Items that plainly have an idiom. This is the
  single most important thing to watch on the first real run, and the lever is
  the gloss wording rather than the schema.
- **Run-to-run stability of `style` and `mood` is unmeasured.** They are the same
  kind of boundary judgement 002 found unstable in `typography.scale`, so expect
  the same until measured. If any axis proves useless, `mood` is the one, and it
  is the first to cut.
- **The value lists are drawn from design vocabulary in general use, not from
  your library**, which does not exist yet. Nothing here is calibrated against
  what you actually save; section 9 of the asset exists because that calibration
  will move the lists.
- **The relabel pass does not exist**, so the claim that it can rewrite labels
  while leaving traits byte-identical is unexercised. 008 builds it.
- **`authoredBy` will describe the extraction, not the relabelling.** After a
  relabel, `model` and `promptVersion` still refer to the run that produced the
  traits, and `taxonomyVersion` is the only provenance the new labels carry.
  Accepted as cheaper than a second provenance block; revisit in 006 if it bites.
- **Verified by running it** (29 checks, against zod 4.4.3, ajv draft 2020-12 in
  strict mode, typescript 7.0.2 strict, Node 22.14.0): gloss completeness for
  every enum, the `notApplicable` table against 004's own `TraitName`, parsing of
  good and empty payloads, rejection of invented values, invented axes, over-cap
  arrays, repeated values and a scalar sent as an array, the authorship stamp,
  the relabel and staleness predicates, ajv compilation in strict mode, and
  keyword-budget conformance. **The module's extensionless `import type`
  typechecks under `moduleResolution: bundler` and needs a `.js` suffix under
  `nodenext`**; whoever assembles the repo picks one, and the import is type-only
  either way.
