---
id: 004
title: The extraction schema, or what the agent must return
label: wayfinder:grilling
status: closed
assignee: jeb
blocked-by: 001
parent: map
---

> **Promoted 2026-07-26.** With extraction moved out of the app, this schema is
> no longer an internal detail of one program - it is the **hand-off contract**
> between the producer CLI, a Claude session writing an entry by hand, and the
> web app reading it. It is now the load-bearing ticket on the map, and 002
> unblocked it. Two findings from 002 constrain it directly; see the bottom.

## Question

Exactly which fields does a design analysis contain, and how strictly are they
typed?

This is the contract at the centre of the app. Storage stores it, search
searches it, filters filter on it, the prompt is rendered from it, and mixing
merges it. Everything downstream is shaped here, so it is worth being pedantic.

The brief names palette, typography and design philosophy explicitly, and
"etc." implicitly. Resolve what "etc." covers and what it does not.

Per candidate field, settle the type, not just the name:

- **Palette.** A flat list of hex values, or roles (background, surface, ink,
  accent, muted)? Roles make mixing and prompt rendering far better and are
  much harder for the agent to get right. Are proportions captured, given that
  a design using an accent at 2% reads nothing like one using it at 40%?
- **Typography.** Named families, or a description when the family is
  unidentifiable from a screenshot? A pairing (display plus body), the scale,
  the weight range, the tracking and leading character? What is stored when the
  agent guesses a font wrong, which it will.
- **Design philosophy.** Free prose, or prose plus structured axes (dense
  versus airy, warm versus cool, playful versus severe, flat versus
  dimensional)? Axes are filterable, prose is not. Prose carries the nuance
  that makes a prompt good.
- **What else earns a field.** Spacing and density, corner and border
  treatment, shadow and depth, motion, imagery and illustration style, layout
  and grid, iconography, texture.
- **Fields that are not the agent's to fill.** Your own note on why you saved
  it. Provenance: source URL, capture date. Confidence, where the agent is
  guessing.

Cross-cutting:

- **Strict or open?** A closed schema is filterable and predictable. An open
  bag of observations captures the thing that made this design worth saving and
  fits no column. Can both coexist without the open half becoming a dumping
  ground?
- **Nullability.** A cropped button screenshot has no typography and no
  philosophy. Are fields optional, or is there a "not applicable" that reads
  differently from "the agent missed it"?
- Whether the schema attaches to a source or an element, which is 001's answer.

## What 002 already constrains

- **Author it as JSON Schema first, Zod second.** The SDK constrains generation
  natively via `outputFormat: { type: 'json_schema', schema }` and self-retries
  on violation, which is why 002 saw zero invented and zero missing fields. That
  only works for a schema expressible as JSON Schema, so that is the real
  constraint on this design. Zod becomes a redundant check at the read boundary,
  not the primary mechanism.
- **Palette is the hard case, and not for the reason expected.** Roles are fine -
  the agent fills them. The problem is fidelity: hex values are *eyeballed, not
  sampled*, so they are consistently a few units off and **change between runs of
  the same image**. `typography.scale` was likewise unstable on identical input.
  So decide explicitly:
  - Is a palette value **"what the agent read"** (honest, approximate, and must
    never be presented as exact) or **ground truth** (which means sampling the
    actual pixels for the regions the agent names - a real CLI component, not a
    prompt tweak)?
  - Is there a **precision** or **approximate** marker on numeric traits, so 007
    can render "around #ff6b35" rather than asserting a false exact value?
  - Does instability change the **Undetermined** vs **Not applicable** design? A
    third state - read, but not reliably - may be needed, or may be one state too
    many.
- **Do not add a confidence field on the agent's word alone.** 002 showed the
  agent is well-calibrated in prose (it volunteered "no glyphs visible" rather
  than inventing a font family) but that is not the same as a trustworthy numeric
  self-score.

Deliverable: the schema as JSON Schema **and** the derived Zod definition, plus
commentary on each field's rationale and the palette-fidelity decision, and the
vocabulary added to `CONTEXT.md`.

## Resolution

**There are two schemas, not one: `ExtractedDna` is the closed object the agent
returns under `outputFormat`, and `Item` is that plus everything the agent may
not write, with seven traits, a hex that is honestly "what the agent read" rather
than ground truth, and two absence states rather than three.** Artifacts:
[`../assets/004-extraction-schema.json`](../assets/004-extraction-schema.json),
[`../assets/004-extraction-schema.ts`](../assets/004-extraction-schema.ts),
commentary in
[`../assets/004-schema-commentary.md`](../assets/004-schema-commentary.md).

### What was decided

1. **Two schemas, related mechanically.** `ExtractedDna` is exactly what the
   agent produces. `Item.dna = stampAuthorship(ExtractedDna)`, nine lines that
   add authorship and nothing else. Every field that is not the agent's to fill
   is not *marked* as such, it is **absent from the object the agent is asked to
   produce**: 002's finding is that schema mode works by constraining generation,
   so a field in the schema is a field the model will fill, and inviting a guess
   at a URL the CLI already knows is how provenance stops being fact.

2. **The real constraint is the JSON Schema keyword budget, and it is nine
   keywords.** 002 exercised only `type`, `properties`, `required`,
   `additionalProperties`, `enum`, `items`, `minItems`, `maxItems` and
   `description`. `pattern`, `minLength`, `$ref`, `oneOf` and `if`/`then` are
   unevidenced, and the asymmetry is decisive: an unsupported keyword fails the
   load-bearing path totally, while a missing constraint fails recoverably at the
   Zod boundary. So the hex pattern, the prose bounds and the swatch definition
   are not in the generation schema, and the swatch object is written out five
   times rather than `$ref`-ed. This is not a hedge: 002 saw **zero malformed hex
   across every run** with the constraint expressed as `description` alone.

3. **Palette is roles, five of them, each with an ordinal weight.**
   `background`, `surface`, `ink`, `muted`, `accent`, the ticket's own list.
   Proportions are captured as `dominant | supporting | occasional`, never a
   percentage: 002 proved the model cannot get a hex right to three units, so a
   percentage would be a fabrication with a decimal point on it. A flat list was
   rejected because no prompt written from it can say what a colour is *for*; an
   overflow array for extra brand colours was rejected because 001 makes a trait
   atomic, so an unlabelled sixth hex is noise appended to every prompt.

4. **A palette value is "what the agent read", and pixel sampling is deferred,
   not declined.** The payoff is a prompt (locked), and a three-unit hex delta is
   invisible in whatever the receiving model builds. Naive quantisation is also
   worst exactly where it matters: an accent used on one button is a fraction of
   a percent of the image and will not survive a snap to a dominant cluster.
   Deferral is safe because every swatch carries
   `authorship: agent | sampled | override`: a sampler built later rewrites
   values in place and flips the marker, with no schema change and no ambiguity
   about which swatches it touched. `sampled` is unreachable in v1 on purpose.

5. **The approximate marker is `authorship`, not a new field.** 007 hedges iff
   `authorship === 'agent'`. A boolean `approximate` was rejected because while
   the agent is the only writer it is `true` on every value in the library, and a
   constant is not information. **There is no confidence field from either
   party**, per 002.

6. **Authorship sits per trait, with the palette as the sole exception.** 001
   decision 7 makes a trait atomic when mixed, so it is atomic when attributed.
   The palette carries it per swatch because 007 must hedge per value (correcting
   one hex must not silently un-hedge the other four) and because a sampler
   upgrades swatches one at a time. A per-leaf wrapper everywhere was rejected as
   ceremony that only the palette can use, against 006's hand-editability
   requirement; a sidecar list of overridden paths was rejected as stringly-typed
   pointers into a schema 008 already expects to drift.

7. **Seven traits, admitted by four tests**: readable from a still Capture (003),
   mixable alone (001), changes the prompt (007), and not a restatement of
   another field (001). `palette`, `typography`, `composition`, `spacing`,
   `surfaceTreatment`, `imagery`, `philosophy`. **Motion is rejected on a locked
   fact**: 003 locked the input as a still PNG, so the field would be permanently
   Undetermined on every Item, which is worse than no field. **Iconography is
   cut** as the weakest survivor of test 2. **Corners, borders, elevation and
   texture are merged** into `surfaceTreatment` because they jointly define a
   material and splitting them invites the incoherent mix 010 exists to prevent.

8. **Typography splits family from character, which is the answer to "what is
   stored when the agent guesses a font wrong".** `*Family` is a named typeface
   and is empty unless the letterforms are actually recognised; `*Character` is a
   required style description ("geometric grotesk, tight tracking, all-caps at
   display size"). A wrong guess damages only the field whose job is to be a
   name. The pair also disambiguates the two reasons a family is empty: empty
   family with a non-empty character means the type was read but not named. Both
   empty means no glyphs were visible, which is exactly what 002 watched the
   agent volunteer. Tracking and leading are folded into the prose rather than
   given enums, on the general rule that **an enum is for something you will
   filter on and prose is for everything else**.

9. **Strict and closed, with exactly one open field, and it already existed.**
   `additionalProperties: false` everywhere; the open half is `philosophy`. The
   dumping-ground question dissolves rather than being managed: there is nowhere
   to dump because the only open field is one bounded paragraph with a stated
   job. An `observations` map was rejected outright, and a second short free-text
   field for "the thing that made this distinctive" was rejected because that is
   the **Note**, which is yours. The split is clean: what makes the design work is
   the agent's `philosophy`, why it was worth saving is your `note`.

10. **Two absence states, not three, and the rule that settles it is that a state
    describes the reading and a value describes the design.** A flat design is not
    missing a depth reading, it has one and it is `flat`; a typographic design
    has `imagery.kind: none`. So the third state that felt necessary is content,
    and every enum was given a member for the case where the design genuinely
    lacks the thing. **Undetermined lives at the leaf** (`""` for prose,
    `"undetermined"` for enums), which makes partial reads expressible.
    **Not applicable lives once per Item** as `notApplicable: TraitName[]`, next
    to Scope. Instability does not earn a state: it would be a constant, it is a
    different axis from presence, it is already spelled `authorship: 'agent'`,
    and only the agent could report it, which 002 forbids.

11. **Not applicable is derived from Scope by the producer and frozen at write
    time.** CONTEXT defines it as what the scope structurally excludes, 001 makes
    Scope structural, and the producer knows the Scope. So it is not the agent's
    to write and has no member in the extraction schema, whose only absence state
    is Undetermined. Frozen rather than derived on read, because the scope table
    will be tuned and an Item should not silently change which traits it claims.
    The table itself needs 005's vocabulary and is not written here.

12. **The philosophy axes the ticket imagined are labels, not traits.** 001
    defines a label as "a compressed restatement of trait content" that is never
    mixed, which is precisely what dense/airy and flat/dimensional are, and two
    of the four proposed axes now restate real traits. `philosophy` is prose
    only. **The axes belong to 005.** 004 declares the `labels` slot, its
    cardinality (3-8, the bound 002 ran) and its authorship rule, and leaves the
    vocabulary open for 005 to replace.

### Three collisions with earlier tickets, deliberately surfaced

- **001 decision 5 is revised: Scope is producer-supplied and the agent must not
  write it.** This is the question 003 handed over. Three arguments, and the
  third is the one that decides it. First, the premise moved: 001 chose agent
  inference because asking "taxes the most common action in the app", and after
  the re-charter there is no ingest in the app, only a CLI that already takes
  flags. Second, 003 established the producer knows the capture mode exactly,
  which beats inferring it from pixels. Third, **Scope is structural and 002
  proved boundary readings are unstable**, so inferring it would let an Item's
  trait set change between extractions of the same image. The cost, stated
  plainly: the file-handover path now wants a `--scope` flag, which is a manual
  step on the path 001 designed to be effortless. It defaults to `page`, it
  restates a decision the person already made when they cropped the file, and a
  forgotten flag is wrong in a known, overridable direction where an inferred
  scope is wrong invisibly.

- **001 decision 8 gains a third author it did not anticipate.** 001 requires one
  bit, agent or you. `authorship` has three values because a deterministic pixel
  sampler is neither. The bit 001 requires survives exactly (`override` versus
  not); this adds a value rather than redefining the ones 001 named.

- **001 decision 6's three cases are all typed, but at two different levels.**
  001 handed over "applicable-and-present, not applicable, undetermined" as
  though they were one enum. They are not: two are about the reading and one is
  about the Scope, so Undetermined sits on the leaf and Not applicable sits
  beside Scope. Both stay recoverable and neither collapses to `null`, which is
  what 001 actually required. `traitState()` in the module is the derivation, so
  007 and 009 do not each invent their own.

### What was not verified

- **Nothing has been run through the Agent SDK against this schema.** Every claim
  about what the SDK accepts is inherited from 002's provisional schema, which is
  a strictly smaller object: no nesting three levels deep, no eight-member enums,
  four top-level fields rather than eight. The first real run is the test.
- **The keyword budget is inferred, not documented.** Section 2 of the commentary
  lists what the spike happened to use, which is evidence those keywords work and
  no evidence the others fail. If `pattern` and `$ref` turn out to be supported,
  the JSON Schema gets shorter and stricter. Worth ten minutes against the spike
  before 008 builds anything.
- **The eight-field ask is untested for quality regression.** 002 asked for four
  fields and got a real read; this asks for roughly 25 leaves, and 002 names
  generic filler as the failure mode to watch. If quality drops, the cut list is
  the commentary's rejected traits in reverse order.
- **The scope-to-notApplicable table does not exist**, only the rule. It waits on
  005's Scope vocabulary.
- **The Zod file was typechecked under zod 4.4.3, not zod 3.** It is written in v3
  syntax and every construct used runs identically under v4, but v4 is what this
  repo actually has installed (the 002 spike depends on `^4.4.3`), so the version
  choice is worth confirming in 006 or 008.
- **No sampler exists**, so `authorship: 'sampled'` is unreachable and untested.
