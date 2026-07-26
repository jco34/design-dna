# 004 commentary - why the extraction schema has the shape it has

Ticket: [`../tickets/004-extraction-schema.md`](../tickets/004-extraction-schema.md).
Artifacts: [`004-extraction-schema.json`](004-extraction-schema.json) (what the
SDK constrains generation with) and
[`004-extraction-schema.ts`](004-extraction-schema.ts) (what both programs
import).

**Status: settled by derivation wherever a locked decision or a measurement
reached, and by judgement in eight places that are named in section 10.** This
document exists because the schema is the one artifact on the map that three
parties have to agree on, and a field list with no argument behind it is a field
list the next session will relitigate.

Sections 3 and 5 are the ones with teeth. Section 3 is the palette-fidelity
decision, which 002 handed over explicitly. Section 5 is the absence model, and
it is the section that decides the ticket's "is a third state needed" question.

---

## 1. The central move: two schemas, not one

The ticket asks "what must the agent return". The map asks for "a hand-off
contract between two programs". Those are different objects, and collapsing them
was the first mistake available.

| | `ExtractedDna` | `Item` |
| --- | --- | --- |
| written by | the agent, under `outputFormat` | the producer, or you by hand |
| authored as | JSON Schema first (002's recommendation) | Zod only |
| holds | the design read off the Capture | that, plus everything the agent may not write |
| keyword budget | only what 002 exercised (section 2) | anything Zod expresses |

The relationship between them is mechanical and one-directional:
`Item.dna = stampAuthorship(ExtractedDna)`. That function is nine lines in the
module and it is the whole of the producer's transformation. Nothing about the
agent's output is rewritten, reinterpreted or repaired on the way in.

**Why the split earns its keep.** Every field the agent does not write is a field
it cannot get wrong, cannot spend tokens on, and cannot be retried over. The
ticket asks which fields are "not the agent's to fill"; the answer is not a note
in a document, it is that they are absent from the object the agent is asked to
produce. Scope, provenance, authorship, the capture record, your Note and the
`notApplicable` list are all invisible to it.

**Rejected: one schema with the non-agent fields marked optional or ignored.**
Rejected because 002's whole finding is that schema mode works by *constraining
generation*. A field present in the schema is a field the model will fill.
`additionalProperties: false` stops invention; nothing stops an invited guess.
Asking the agent for `source.url` when the CLI already knows it is inviting a
hallucinated URL into provenance, which is the one part of an Item that must be
fact.

**Rejected: 004 defines only the DNA and lets 006 define the record.** Tempting,
because 006 is the storage ticket. Rejected because 008 states that a
hand-written entry "goes through the same schema and the same validator", so the
validated unit is the entry, not a fragment of it. 006 still owns where the file
lives, what it is called, whether the DNA is versioned or overwritten, and the
image store. This module owns the shape only, and says so.

---

## 2. The real constraint is the JSON Schema keyword budget, and it is small

002 recommends authoring as JSON Schema first. What it does not say, and what
matters more, is **which keywords are known to work**. Reading the spike's
`PROVISIONAL_JSON_SCHEMA`, the keywords actually exercised against
`outputFormat` are:

`type`, `properties`, `required`, `additionalProperties: false`, `enum`,
`items`, `minItems`, `maxItems`, `description`.

That is the entire evidence base. Not exercised, and therefore not used in the
generation schema: `pattern`, `minLength`, `maxLength`, `format`, `$ref`,
`$defs`, `oneOf`, `anyOf`, `allOf`, `if`/`then`, `const`, `nullable`,
`propertyNames`.

The asymmetry decides it. If an unsupported keyword makes the SDK reject the
schema, the load-bearing path fails outright. If a constraint is merely absent
from generation, a bad value arrives, Zod catches it at the boundary, and 008
decides whether to retry or refuse. **One failure mode is total and the other is
recoverable, so the generation schema uses only proven keywords and every finer
constraint lives in Zod.**

Three concrete consequences:

- **The hex pattern is not in the JSON Schema.** It is a `description` that
  spells out `#rrggbb` and a Zod regex that enforces lowercase. This is not a
  hedge: 002 saw **zero malformed hex across every run in both modes** with the
  constraint expressed as `description` alone. Descriptions demonstrably work on
  this model for this constraint.
- **Prose lengths are not in the JSON Schema.** `minLength`/`maxLength` were
  never exercised, so the bounds are stated in prose in the `description` and
  enforced in Zod. The philosophy bound (80-1200 characters) is 002's, kept
  because it is the one bound that has actually been run.
- **The palette swatch object is written out five times instead of `$ref`-ing a
  definition.** Verbose and slightly ugly. `$ref` would be correct JSON Schema
  and is unverified against this backend, and a duplicated shape that works
  beats a shared definition that might not. The Zod file has no such problem and
  defines `ExtractedSwatch` once.

`minItems`/`maxItems` *were* exercised (the spike bounded `tags` to 3-8), which
is why `labels` is the one place the generation schema carries a real numeric
constraint.

**Everything is required and every object is closed.** No optional properties
anywhere in the generation schema. Optionality would have been the natural way
to express absence, and section 5 explains why it is not used: conditional
requiredness needs `if`/`then`, which is outside the budget, so an optional
field is a field the agent may silently drop with nothing catching it.

---

## 3. Palette, and the fidelity decision 002 handed over

### 3.1 Roles, not a flat list

002 already settled the part that was expected to be hard: "Roles are fine, the
agent fills them." So the argument is only about which roles and whether roles
beat a list at all.

Roles win on all three downstream consumers. 007 renders a prompt, and "a
near-black canvas, off-white ink, one warm orange used only on the primary
action" is a design brief where five bare hex values are a colour-by-numbers.
009 wants colour search, and "find me warm-accented dark designs" is a query
against roles, not against an unordered set. 010 mixes traits whole, and a
role-keyed palette merges against another role-keyed palette in a way two lists
cannot.

**Rejected: a flat list of hex values.** No prompt written from it can say what
any colour is *for*, which is the only thing that makes a palette transplantable.

**Rejected: roles plus an overflow array for extra brand colours.** Real designs
do carry six or seven colours. Rejected because 001 decision 7 makes a trait
atomic: the palette is taken whole, so an unlabelled sixth hex is not an
opportunity, it is noise appended to every prompt that uses this item. If a
design's *colourfulness* is the point, that belongs in `philosophy` and in
005's labels, both of which carry it better than an extra hex does.

**The five roles are the ticket's own list**: `background`, `surface`, `ink`,
`muted`, `accent`. `surface` earns its place because layering is what makes a
dark design read as depth rather than as a flat field. `muted` earns its place
because the ink/muted gap is the single most legible signal of how a design
handles hierarchy. A second accent was considered and cut: a design with two
genuine accents is described accurately enough by naming the primary one and
letting `philosophy` say there is a second.

### 3.2 Proportions: an ordinal weight, not a percentage

The ticket is right that an accent at 2% reads nothing like one at 40%, and this
is the field that answers it. Each swatch carries
`weight: dominant | supporting | occasional`.

**Rejected: a percentage per role.** The model does not sample pixels. 002 proved
it cannot get a hex right to three units; a percentage would be a fabrication
with a decimal point on it, and false precision is the exact failure 002 warns
about.

**Rejected: nothing, on the grounds that `philosophy` can say it.** Prose is not
filterable, and 007 needs accent restraint inside the token block, not buried in
a paragraph.

`weight` is uniform across all five roles even though `background: dominant` is
close to a tautology. Uniformity costs two redundant fields and buys a shape
with no special cases in it. A full-bleed photographic background is the one
case where a non-dominant background is informative, and it is a real case.

### 3.3 The fidelity decision: a hex is what the agent read

**Decided: a palette value is "what the agent read". It is approximate, it is
recorded as approximate in the data rather than in a comment, and pixel sampling
is deferred rather than absorbed.**

The case for sampling now is real and worth stating properly. The CLI holds the
Capture bytes, so a quantisation pass that snaps each agent hex to the nearest
dominant cluster centroid is tractable. It would make the palette reproducible,
which is the single largest source of the non-idempotence 002 found. It would
make 009's colour distance measure a measure over signal rather than over noise.
And it would let 007 stop hedging.

Four reasons it is not done here:

1. **The payoff is a prompt, not a token file.** The map locks that "the
   copyable output is always a prompt, never code". `#fb6b3e` against `#ff6b35`
   is a delta invisible in whatever the receiving model builds, and what it
   builds is a new design in the spirit of the saved one, not a reproduction.
   The exactness that would justify a sampler is exactness this product does not
   spend.
2. **Snapping has a failure mode precisely where the accent matters most.** An
   accent used on one button is a fraction of a percent of the image. It will not
   appear in the top clusters of a naive quantisation, so the snap either misses
   it or drags it to a nearby neutral. The trait most worth fixing is the trait
   sampling is worst at without region-aware work.
3. **It is a component, not a schema decision.** 002 says this outright. 004
   blocks eight tickets; turning it into a build ticket for an image pipeline
   would be the most expensive possible place to put that work.
4. **Deferring it costs nothing later**, because of the next paragraph.

**What makes deferral safe is `authorship`.** Every swatch carries
`agent | sampled | override`. A sampler built later rewrites values in place and
flips `agent` to `sampled` on the ones it is confident about, with no schema
change, no migration, and no ambiguity about which swatches it touched. The
`sampled` member is unreachable in v1 and is in the enum on purpose: it is the
deferred decision written into the type system rather than into a document
nobody reads.

### 3.4 The approximate marker is `authorship`, not a separate field

The ticket asks for "a precision or approximate marker on numeric traits, so 007
can render 'around #ff6b35'". There is one, and it is not a new field.

**Rejected: a boolean `approximate` per value.** While the agent is the only
writer it is `true` on every value in the library, and a constant is not
information. It also splits one fact across two fields: `authorship: 'agent'`
already means eyeballed, `sampled` already means measured, `override` already
means authoritative. 007's rule is one line and it is in the module:
`isApproximate(swatch) === (swatch.authorship === 'agent')`.

**Rejected: a numeric confidence.** 002 forbids it directly, and the ban is
well-founded: the agent is well calibrated *in prose* (it volunteered "no glyphs
visible" rather than inventing a family) and that is not evidence it can score
itself on a scale.

### 3.5 Where authorship sits, and the one exception

001 decision 8 requires that "every trait and label value records whether the
agent wrote it or you did". The granularity question it leaves open is settled by
001 decision 7: **a trait is atomic when mixed, so it is atomic when attributed.**
Authorship therefore sits once per trait, and overriding any part of a trait
marks that trait as yours.

The palette is the exception, with authorship on each of the five swatches. Two
reasons, and both are specific to the palette rather than general:

- 007 must hedge per value. With trait-level authorship, correcting one hex would
  silently stop 007 hedging the other four, which are still eyeballed. That is a
  correctness bug, not an inconvenience.
- A sampler upgrades swatches one at a time and will not always get all five.

**Rejected: a per-leaf authorship wrapper everywhere.** Uniform and correct, and
it doubles the nesting depth of every trait for a distinction that only the
palette can make use of. 006 requires the store be hand-editable; that rules
out ceremony that buys nothing.

**Rejected: a sidecar list of overridden paths, `["palette.accent", ...]`.**
Compact and very hand-editable. Rejected because stringly-typed paths into a
schema that 008 already expects to drift is a class of staleness nothing
validates, and because it cannot express `sampled`.

**Surfaced deliberately: `sampled` is a third author 001 did not anticipate.**
001 decision 8 speaks of one bit, agent or you. A deterministic pixel reader is
neither. The bit 001 requires is preserved exactly (`override` versus not); this
adds a value rather than changing the meaning of the ones 001 named.

---

## 4. The rest of the fields, and the four tests each had to pass

A candidate earned a trait slot only by passing all four:

1. **Readable from a still 1440x900 Capture.** 003 locked what the input is.
2. **Mixable alone.** 001 decision 7 defines a trait as design content "worth
   transplanting on its own".
3. **Changes the prompt.** If naming it does not make a materially different
   brief, 007 gains nothing and pays in length.
4. **Not a compressed restatement of another field.** 001 decision 7 uses exactly
   this argument to explain why labels are never mixed.

Seven traits passed.

### `palette`
Section 3.

### `typography`
Six leaves: `headingFamily`, `headingCharacter`, `bodyFamily`, `bodyCharacter`,
`scale`, `weightRange`.

**The family/character split is the answer to "what is stored when the agent
guesses a font wrong, which it will".** `*Family` is a named typeface and is
empty unless the letterforms are actually recognised. `*Character` is a specific
style description and is always required. So a wrong guess damages one field
whose only job is to be a name, while the field that actually feeds a good
prompt ("geometric grotesk, wide apertures, very tight tracking, all-caps at
display size") is unharmed. Correcting the name is an `Override` on the
typography trait.

The split also removes the need for a self-report. "Did you recognise this face
or are you describing it" is answered by whether `headingFamily` is empty, which
is a fact about the data rather than the agent's opinion of itself. 002 evidences
the agent behaves correctly here already: handed a wireframe it refused to invent
families rather than filling the field.

There are two reasons `headingFamily` can be empty, and the pair disambiguates
them: empty family with a non-empty character means the type was read but not
named; both empty means no glyphs were visible at all.

`scale` is kept in the ticket's `tight | moderate | dramatic` form even though
002 measured it flipping between `moderate` and `dramatic` on identical input. It
is kept because it is the most useful single typographic filter and prompt token
there is, and the instability is a property of judgement boundaries that no
vocabulary removes. Adding a fourth member would add a boundary, not remove one.

`weightRange` is `uniform | paired | wide`. A numeric range (100-900) was
rejected for the same reason as palette percentages: the agent is eyeballing, and
a number invites belief.

**Rejected: separate `tracking` and `leading` enums.** Both are genuinely
design-defining, and both are near-boundary judgements that nobody will ever
filter by. They are folded into `*Character`, where prose carries them with more
nuance than three-member enums would. This is the general rule the schema
follows: **an enum is for something you will filter on; prose is for everything
else.**

### `composition`
`structure` (prose) and `contentWidth` (enum). This is the trait a component-scoped
Capture most obviously excludes, which makes it the primary customer of the
`notApplicable` mechanism. `structure` is explicitly told not to assert pixel
measurements, for the palette reason.

### `spacing`
`density` (`dense | balanced | airy`) and `rhythm` (prose). `density` is probably
the single most-reached-for filter in the whole taxonomy, which is why it is an
enum rather than left inside prose.

### `surfaceTreatment`
`corners`, `borders`, `elevation`, `finish`. Four aspects of one question: what
are the surfaces made of.

**Rejected: separate `shape`, `depth` and `texture` traits.** Three traits rather
than one, and each individually mixable in theory. Rejected because they are not
independently *coherent*: brutalist square corners taken from A with soft iOS
elevation from B and film grain from C is exactly the mud 010 exists to prevent.
Corner treatment, separation and elevation jointly define a material, and 001
makes traits atomic so that coherent things move together. Merging them is that
principle applied rather than a saving.

`finish` is explicitly told that "plain flat fills" is an answer rather than a
gap, which is section 5's rule in the description text.

### `imagery`
`kind` (enum, with `none` as a first-class member) and `treatment` (prose).
Imagery is one of the largest design levers in current work and is invisible in
every other field. `none` being a value rather than an absence state is section 5.

### `philosophy`
One field, `text`. One paragraph, roughly 80-1200 characters, the bound 002
actually ran.

002 found free-text traits "varied in wording but were consistent in substance"
across runs, which makes this the **most stable thing the agent produces** and an
argument for leaning on it rather than treating it as decoration.

### Rejected traits

- **Motion.** Rejected on a locked fact, not on taste: 003 locked the input as a
  still PNG at a fixed viewport with `animations: 'disabled'`. A still cannot
  show motion, so the field would be permanently Undetermined on every Item in
  the library, which is worse than no field because it makes Undetermined look
  common and unremarkable. If motion ever matters, it arrives with a capture
  format that can carry it, and that is a change to 003, not to 004.
- **Iconography.** Passes tests 1 and 3 weakly and fails test 2: "outlined
  monoline icons" almost never survives as an independent thing anyone takes from
  one design into another. 007 has an open question about whether naming twelve
  attributes beats naming five, and adding a marginal twelfth before that
  question is answered is the wrong order.
- **Structured philosophy axes** (dense/airy, warm/cool, playful/severe,
  flat/dimensional). This is the ticket's "prose or prose plus structured axes"
  question, and the answer is that the axes are **labels, not traits**, by 001's
  own definition: a label is "a compressed restatement of trait content" and is
  "never mixed". Two of the four proposed axes restate traits that now exist
  (`spacing.density`, `surfaceTreatment.elevation`) and would violate test 4
  outright. The rest are filterable descriptions of an item rather than
  transplantable design content, which is the definition of a label. **They
  belong to 005.**

### `labels`, and what 004 does and does not claim

CONTEXT.md defines a DNA as "its traits *and* its labels", so labels sit inside
`dna` rather than beside it. 004 declares the slot, the authorship rule and the
cardinality (3-8, the bound 002 exercised) and types the value as a lowercase
hyphenated slug. **The vocabulary is 005's and 005 may replace this shape
entirely**, which is a schema version bump under 008. Typing it as an open map of
axis to values was considered so that 005 could fill in axes without changing the
shape; rejected because an open map is the dumping ground section 6 rules out,
and because `propertyNames` is outside the keyword budget.

---

## 5. Absence: two states, and the line between a gap and an answer

The ticket asks whether instability forces a third state. It does not, and the
pressure that looked like it came from instability actually comes from somewhere
else. Getting this right required separating three things that all look like
emptiness.

### 5.1 The rule

> **A state describes the reading. A value describes the design.**

A design with no shadows is not missing a depth reading; it has one, and the
reading is `flat`. A design with no pictures is not missing an imagery reading;
`imagery.kind` is `none`. A design with no texture gets `finish: "plain flat
fills"`, and the schema says so in the description.

This is why `none` and `flat` are enum members rather than absence states, and it
is why the third state that felt necessary turns out not to be. **"Read
successfully, and the answer is nothing" is content.** Every enum in the schema
was checked against this rule and given an appropriate member where the design
can genuinely lack the thing.

### 5.2 The two states that remain, and where each lives

- **Undetermined** lives at the **leaf**: `""` for prose, `"undetermined"` for
  every enum. Every leaf can be undetermined independently, so a partial read is
  expressible: the families read but the scale not, the roles read but one hex
  not. Trait-level-only absence would have forced all or nothing.
- **Not applicable** lives once per **Item**, as `notApplicable: TraitName[]`,
  next to `scope`.

**Not applicable is not the agent's to write, and this follows from locked
decisions rather than preference.** CONTEXT defines it as "a trait the item's
scope structurally excludes". 001 decision 5 makes Scope structural: it
"determines which traits an item can have at all". 003 established that the
producer knows the Capture mode exactly. So Not applicable is a **function of
Scope**, and Scope is producer-supplied (section 7). It is therefore derived by
the producer from a scope table and frozen into the entry at write time, and the
extraction schema has no member for it at all. The agent's only absence state is
Undetermined.

Freezing it rather than deriving it on read is deliberate: the scope table lives
in code and will be tuned, and an Item should not silently change which traits it
claims to have because a table moved under it.

The two states stay perfectly distinguishable, which is 001 decision 6's
requirement: leaves empty **and** the trait listed in `notApplicable` means the
scope excluded it; leaves empty and **not** listed means the agent looked and
could not tell. Neither collapses to `null`.

### 5.3 Why there is no third state for instability

Four arguments, in ascending order of force.

1. **It would be a constant.** `palette.*.hex` is *always* eyeballed and
   `typography.scale` is *always* a boundary judgement. Marking every instance
   "unstable" writes a fact about the *schema* into every row of the data.
2. **It is a different axis.** Not applicable and Undetermined are about the
   presence of a reading. "Read, but not reliably" is about the quality of a
   reading that is present. Stacking them into one enum makes every downstream
   switch statement wrong, because a consumer asking "do I have a value" would
   have to treat a state that means "yes, with caveats" as a fourth kind of no.
3. **The state already exists under a better name.** `authorship: 'agent'` means
   eyeballed and approximate. That is the third state the ticket sensed, sitting
   on the axis where it belongs.
4. **The agent would have to report it, and 002 forbids that.** Only the agent
   can say whether a particular reading sat near a boundary, and "how sure are
   you" is a confidence self-score however it is spelled. This is the decisive
   argument, and it is a locked constraint rather than a judgement.

---

## 6. Strict or open, and why the open half cannot become a dumping ground

**Decided: strict, closed, `additionalProperties: false` everywhere, with exactly
one open field, and that field is `philosophy`, which already exists.**

The ticket asks whether an open bag of observations can coexist with a closed
schema without going bad. The answer is that the question dissolves once you
notice the open half is already in the field list. `philosophy` is unbounded
prose with a stated job, and everything that fits no column goes there and
nowhere else.

**Rejected: an `observations` map or an `extra` bag.** A map with free keys is
the dumping ground by construction, cannot be filtered, cannot be mixed
coherently, and would drift into a second unversioned schema that nobody
documents.

**Rejected: a second short free-text field for "the thing that made this
distinctive".** Two prose fields for one job means the agent splits hairs between
them and 007 renders both, which reads as repetition. Worse, it duplicates
something that already exists on the other side of the authorship line: the
ticket's "the thing that made this design worth saving" is the **Note**, which
CONTEXT defines as yours and explicitly never written by the agent. The intuition
behind the open bag splits cleanly and completely:

| the question | the field | who writes it |
| --- | --- | --- |
| what makes this design work | `philosophy` | the agent |
| why this was worth saving | `note` | you |

The three things that keep `philosophy` from becoming a bag: it is one field
rather than a map, it is bounded at 1200 characters, and its description names
the failure mode outright ("a paragraph that would be equally true of any other
page of its kind is a failure", which is 002's own phrasing of what to watch
for).

**A note on `description` strings.** Because value constraints could not go in
the JSON Schema (section 2), the descriptions carry them, which makes this file
part of the prompt surface rather than pure documentation. The map's parked
"extraction prompt tuning" item will edit this file, not just the system prompt.
Worth knowing before someone treats the descriptions as comments and trims them.

---

## 7. Scope: producer-supplied, and 001 decision 5 is revised

003 challenged 001 decision 5 and handed the settlement here.

**Decided: `scope` is a required field on the Item, supplied by the producer, and
the agent must not write it.**

Overturning a locked decision needs more than a preference, so, in order:

1. **The premise 001 reasoned from no longer exists.** 001 chose agent inference
   because asking at ingest "taxes the most common action in the app". After the
   2026-07-26 re-charter there is no ingest in the app. The producer CLI already
   takes flags, and `--selector` *is* a scope declaration. The tax 001 was
   avoiding is not on the table. This is the same shape of argument 003 used to
   revise decision 9, and it is honest: the architecture moved, not the reasoning.
2. **The producer knows, where the agent infers.** 003 established that the CLI
   knows whether a Capture was whole-viewport, `--selector`-scoped or
   `--clip`-scoped. A fact known exactly beats the same fact read off pixels.
3. **This is the decisive one.** Scope is structural: it decides which traits an
   Item has at all. 002 measured that agent readings near judgement boundaries
   are unstable run to run. Deriving a *structural* property from an unstable
   read means an Item's trait set could change between extractions of the same
   image. Making Scope producer-supplied makes Not applicable deterministic,
   which is the whole reason section 5's design holds together.

**The strongest objection to my own decision**, stated so it is not lost: for the
file-handover path the producer has no automatic knowledge, so this reintroduces
a manual step on exactly the path 001 designed to be effortless. The answer is
that for uploads the scope decision has *already been made physically* by the
person who cropped the file, so a `--scope` flag restates a decision rather than
adding one, and it defaults to `page`. And the failure modes are not comparable:
a forgotten flag is wrong in a known direction and fixable by an Override, where
an inferred scope is wrong unpredictably and invisibly.

The agent is still *told* the Scope in the prompt so it does not hunt for page
layout in a picture of a button. Being told is not the same as writing it.

The value list stays 005's. `Scope` is typed here as a provisional
`page | section | component` purely so `notApplicable` is derivable in the
meantime, and 005 should feel free to replace it.

---

## 8. The fields that are not the agent's to fill

| field | who writes it | why |
| --- | --- | --- |
| `id` | producer | 001 decision 4: identity is the act of saving, opaque, nothing about the source contributes |
| `schemaVersion` | producer | 008 calls drift "the single most likely source of pain"; a literal `1` is the cheapest possible answer |
| `source` | producer | provenance is fact, not design. Asking the agent for a URL it was handed invites a hallucinated citation |
| `capture` | producer | file, dimensions, `takenAt`, and `mode` as the evidence behind `scope` |
| `scope` | producer | section 7 |
| `notApplicable` | producer | section 5.2 |
| `note` | you | CONTEXT: "Never written by the agent" |
| `authorship` | producer | stamped mechanically; asking the agent to write `"agent"` on every value is tokens spent on a field it could only get wrong |
| `authoredBy` | producer | which of 008's two writers made this entry, plus the model and prompt version |
| **confidence** | **nobody** | there is no confidence field. 002: the agent is calibrated in prose, and that is not a trustworthy numeric self-score |

`capture.takenAt` is nullable and `addedAt` is not, which is a real distinction
rather than tidiness: for a URL capture they are the same moment, and for a
handed-over screenshot the moment it was taken is genuinely unknown.

`authoredBy.promptVersion` exists because the map parks extraction prompt tuning
as a loop rather than a decision, and a tuning loop you cannot attribute results
to is not a loop. It costs one nullable string.

---

## 9. What was verified, and what was not

Verified by running it, against `ajv` 8.20.0 (draft 2020-12, `strict: true`),
`zod` 4.4.3, `typescript` 7.0.2 in strict mode, Node 22.14.0:

1. the JSON Schema parses and compiles under ajv in strict mode, so it contains
   no unknown keywords and no malformed subschemas;
2. a realistic sample validates against both the JSON Schema and the Zod schema;
3. the two schemas agree on top-level keys, on every trait's key set, on every
   object being closed, on every property being required, and on all **13**
   enums value for value;
4. strictness bites: an invented field is rejected by both, an uppercase hex is
   rejected by Zod, a two-item label list is rejected;
5. a fully undetermined trait validates in both;
6. `Item.parse(stampAuthorship(extracted))` round-trips;
7. `traitState` returns `not_applicable`, `undetermined` and `present` correctly
   for a component-scoped Item;
8. the cross-field refinements fire (duplicate `notApplicable`, a URL Source with
   a `supplied` Capture).

The Zod file was typechecked under **zod 4.4.3**, not zod 3. It is written in v3
syntax and every construct used (`.strict()`, `.extend()`, `.superRefine()`,
`z.discriminatedUnion`, `z.literal`, `z.infer`) typechecks and runs identically
under v4. Note that the 002 spike depends on zod `^4.4.3`, so **v4 is the version
this repo has actually installed** and the v3 request may be worth revisiting in
006 or 008.

Not verified, and each is a real gap:

- **Nothing has been run through the Agent SDK against this schema.** Every claim
  about what the SDK accepts is inherited from 002's `PROVISIONAL_JSON_SCHEMA`,
  which is a strictly smaller and simpler object: it had no nesting three levels
  deep, no eight-member enums, and no eight top-level fields. The first real run
  is the test, and the specific things to watch are whether depth or enum size
  degrade fill quality.
- **The keyword budget is inferred, not documented.** Section 2's list is what
  the spike happened to use, which is evidence that those keywords work and *no
  evidence at all* that the others fail. If `pattern`, `$ref` and `minLength`
  turn out to be supported, the JSON Schema gets shorter and stricter and the
  five duplicated swatch definitions collapse. Worth ten minutes against the
  spike before 008 builds anything.
- **The eight-field ask is untested for prompt-quality regression.** 002 asked
  for four fields and got a good read. This asks for seven traits plus labels,
  roughly 25 leaves. More fields is more surface for filler, and 002 names
  generic filler as the failure mode to watch. If quality drops, the cut list is
  section 4's rejected traits in reverse.
- **The scope-to-notApplicable table is not written.** Only the rule is settled.
  The table needs 005's Scope vocabulary and should live wherever 005 puts it.
- **No sampler exists**, so `authorship: 'sampled'` is unreachable and untested.
- **The `philosophy` length bound is inherited, not re-derived.** 80-1200 is 002's
  and worked there; 007 may well want a different shape once it has tested real
  prompts.

---

## 10. The judgement calls, named

Everything above is either derived from a locked decision, forced by a
measurement, or one of these eight. A reviewer who wants to disagree efficiently
should start here.

1. **Five palette roles, no overflow.** Defensible either way; the atomicity
   argument is the one doing the work.
2. **`weight` as a three-member ordinal.** The buckets and their names are mine.
3. **Merging corners, borders, elevation and texture into `surfaceTreatment`.**
   The coherence argument is real, and three separate traits would also have
   been defensible.
4. **Cutting iconography.** The weakest cut. It nearly passed.
5. **Folding tracking and leading into prose rather than giving them enums.**
6. **Trait-level authorship with the palette as the sole exception.** The
   asymmetry is justified but it is an asymmetry, and a reviewer may prefer
   uniform per-leaf.
7. **The provisional `page | section | component` Scope enum**, which is 005's to
   set and is here only so `notApplicable` is derivable now.
8. **Defining the whole Item record here rather than only the DNA**, which
   reaches into 006's territory on shape while leaving it storage.
