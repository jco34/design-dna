# 005 taxonomy - the closed vocabulary, and why it is this short

Ticket: [`../tickets/005-taxonomy-and-tagging.md`](../tickets/005-taxonomy-and-tagging.md).
Module: [`005-taxonomy.ts`](005-taxonomy.ts), which is the executable copy of
everything below and the thing the CLI, the app and the prompt actually import.

**Status: closed, with the vocabulary drafted value by value.** Three axes
survive, four proposed axes are rejected, and the rejections are the interesting
half. Section 11 is the block to paste into an agent prompt.

The ticket's framing is that automatic categorization and stable filters pull
against each other. They do, and the resolution is not a compromise between
them: the vocabulary is fully closed, and the thing free tags were supposed to
carry turns out to already have a home.

---

## 1. Closed. And the open half already exists, so there is nothing to trade

**Decided: a fully closed vocabulary. Three axes, fixed value lists, enforced at
generation by `enum` and at the read boundary by Zod. No free tags, no alias
map, no synonym pass, no minimum-use threshold.**

The ticket offers closed, open, or a hybrid spine plus free tags. The hybrid is
the tempting answer and it is wrong here, for four reasons in ascending order of
force.

1. **The sprawl is measured, not hypothetical.** 002 ran the same image twice
   and reported that free-text fields "varied in wording but were consistent in
   substance". The spike's free-tag array is exactly the field that finding was
   about. `brutalist` and `neo-brutalist` on two runs of one image is not a
   pessimistic scenario, it is the documented behaviour of this model on this
   field.

2. **A closed list is enforceable and a free tag is not.** 004 section 2
   established which JSON Schema keywords are known to work against the SDK, and
   `enum` is one of them. So a closed vocabulary is not a convention the prompt
   asks for politely, it is a constraint on generation that the SDK self-retries
   against. Nothing equivalent exists for free tags: every control the ticket
   lists (normalization, aliases, synonyms, a use threshold) is a *repair* pass
   that runs after the damage, and each is a component to build, tune and
   maintain for a library of a few hundred items.

3. **At this scale a free tag never becomes a facet.** Low hundreds of items.
   If a tag needs three uses before it earns a place in a filter, and the agent
   invents its wording per item, most invented tags die below the threshold.
   They would cost tokens on every extraction, add noise to every stored record,
   and never appear in the UI. An axis that only pays at ten thousand items does
   not pay here.

4. **This is the decisive one. The open half is already in the schema, and it is
   not a tag.** 004 decided there is exactly one open field and it is
   `philosophy`, a bounded paragraph with a stated job, plus your `note` on the
   other side of the authorship line. Both are text 009 can search. So the
   question "what carries the thing that fits no column" is already answered,
   and adding free tags would be 004's rejected `observations` bag arriving
   through a different door. The hybrid does not dissolve because it is
   unimportant; it dissolves because its job is taken.

**Rejected: free tags with a normalization pass.** Building a synonym mapper for
a library one person fills is more machinery than the problem. And the mapper
has to be *told* that `raw-concrete` means `brutalist`, which is to say it needs
a controlled vocabulary to normalize toward. Once you have written that
vocabulary you may as well constrain generation with it and skip the pass.

**Rejected: a closed spine with free tags underneath it.** The spine would carry
every filter and the tags would carry nothing, because nothing filters on a
value used once. A field with no consumer is a field that quietly rots.

**Rejected: letting the agent propose new values into a review queue.** A queue
implies a UI, and the app is a pure reader. There is a better pressure gauge and
it is free: **if the same unlisted idiom keeps turning up in `philosophy` prose,
that is the evidence for adding a value.** The vocabulary grows from reading the
library, not from a mechanism.

---

## 2. The admission test, and the axes that failed it

004 admitted traits with four tests. Labels need their own, because the question
is different: not "is this transplantable" but "would you hunt by it".

A candidate axis earned a slot only by passing all five:

1. **It is a Label, not a Trait.** It describes the item so it can be found and
   is never mixed (001 decision 7, locked). If it is design content worth
   transplanting, it belongs in 004.
2. **It is not derivable from a trait.** If a facet can be computed from stored
   trait data, it is computed, never stored. A stored copy is a second source of
   truth that goes wrong the moment an Override edits the trait it duplicates.
3. **You hunt by it.** You reach for it when the design is half-remembered. If
   it is only ever read after you have already found the item, it is decoration.
4. **It is readable from a still 1440x900 Capture.** 003 locked the input.
5. **Its values can be written down now.** A closed enum only works if a person
   can enumerate it in advance. If not, it is a free-tag axis wearing an axis
   name.

Three passed: **genre**, **style**, **mood**. Here is what did not.

### Rejected: density

Fails test 2 outright. `spacing.density` is already `dense | balanced | airy` on
every Item, and 004 calls it "probably the single most-reached-for filter in the
whole taxonomy". A label restating it would be a second answer to a question
that already has one. 004 predicted this rejection by name.

### Rejected: flat versus dimensional

Fails test 2. That is `surfaceTreatment.elevation`, values `flat | subtle |
pronounced`.

### Rejected: colour temperature

Fails test 2, and this one is worth spelling out because it looks like the most
attractive axis on the list. Temperature is a function of hue angle over five
stored hexes: it is *computed*, and 009's ticket already asks for exactly that
("filtering by colour family and temperature", with "a distance measure"). Store
it and you get a `warm` label sitting on an Item whose accent was later
overridden to blue. Hand it to 009 and it is always right, for free, with no
field, no prompt tokens and no staleness.

**Light versus dark is rejected on the same ground**, and it is the strongest
example: "show me the dark ones" is one of the most common hunts there is, and
it is a luminance test on `palette.background`. The best facet on the list is the
one you must not store.

### Rejected: era

Fails test 5 in a specific way: every value it would carry (`y2k`, `90s-web`,
`mid-century`, `skeuomorphic`) is also a plausible member of **style**. Two axes
with overlapping value sets is the ticket's own sprawl failure with axis names
bolted on, and it puts the agent in the position of choosing which axis to file
a value under, which is a coin flip run to run. Period pastiche is folded into
style as the single member `retro`, and *which* period is prose, in
`philosophy`, where it belongs and where 009 can search it.

### Rejected: industry

Fails test 4, and fails it against a line already written into the generation
schema: the extraction schema's root description says **"Do not describe the
subject matter, the copy, or the company; describe the design."** An industry
label is a reading of the copy. It is also the axis most likely to be inferred
from brand recognition rather than pixels, which is the confabulation 002 was
watching for. Rejected on a locked instruction, not on taste.

### Rejected: part (hero, nav, footer, pricing table, form)

The most painful cut, because "show me nice footers" is a real and frequent
hunt. It fails test 3 on arithmetic. At a few hundred items, perhaps a third are
section or component scoped, and a useful part list runs to twenty values, so
the average facet holds a handful of items and the facet is empty or meaningless
for the majority of the library. The hunt is served anyway: you framed the crop,
so `philosophy` says "a footer", and 009 searches prose. This cut also removes
`pricing` and `auth` from **genre**, for consistency: they are parts of a design
problem, not kinds of design.

### Not a label at all: scope

Scope satisfies CONTEXT's definition of a Label word for word, and it is
deliberately not stored among them. It is producer-supplied fact rather than a
reading (004 section 7), so it carries no authorship question and cannot be
wrong in the way a label can. **Scope is a label by function and not by
authorship, which is why it sits beside `notApplicable` and not inside
`labels`,** and why a filter UI should nonetheless offer it as a fourth facet.
Section 7.

---

## 3. Axis: `genre`. What kind of designed thing this is

**One value, required. Includes `undetermined`.**

Its job, not its look. This is the first filter you reach for, because it bounds
applicability before taste enters: you do not take a marketing hero into a
dashboard.

| value | meaning |
| --- | --- |
| `landing-page` | a marketing or product page whose job is to persuade: a hero, stacked sections, calls to action |
| `product-ui` | the inside of an application, the working interface rather than the page selling it |
| `dashboard` | a product surface whose subject is data: charts, tables, metrics, monitoring |
| `editorial` | writing as the subject: an article, essay, blog or magazine |
| `portfolio` | work shown as a body of work: a personal site, a studio site, a case study |
| `commerce` | buying: a shop, a product page, a basket, a checkout |
| `docs` | reference material: documentation, an API reference, a changelog, a design system site |
| `undetermined` | the capture does not show what kind of design this is |

**Single-valued, and the case that looks like it needs multi resolves cleanly.**
A landing page containing a product screenshot is a `landing-page`: the genre is
the thing you are looking at, and the thing inside it is already recorded as
`imagery.kind: ui-screenshot`. A design cannot be two kinds of thing at once in
the way it can plausibly be two styles.

**`undetermined` will be common on component-scoped Items, and that is correct
rather than a defect.** A crop of a button does not show what kind of page it
came from. 004's rule applies exactly: the agent looked and could not tell, so
this is Undetermined at a leaf, not a Not applicable, because labels are never
excluded by Scope.

**Rejected values:** `pricing` and `auth` (section 2, part). `experimental`
(that is a style, and the pages it would name are already landing pages or
portfolios with an unusual look). `marketing-site` (`landing-page` covers it).
`blog` (that is `editorial`). `mobile-app` (a platform, not a genre; 003 fixes
the viewport at 1440x900, and a handed-over phone screenshot is `product-ui`).

---

## 4. Axis: `style`. Which visual idiom it belongs to

**Nought to two values.**

Its look, not its job. This is the axis the ticket's failure case lives on, so
it is the one that has to be right.

| value | meaning |
| --- | --- |
| `brutalist` | raw and hard-edged: exposed structure, blunt type, harsh contrast, deliberate anti-polish. Covers the whole family, from unstyled-HTML revival to the thick-border hard-shadow strain |
| `swiss` | grid and typographic rationalism: a strict grid, neutral grotesk type, information ordered rather than expressed |
| `technical` | engineered rather than decorated: monospace or tightly tracked type, dense data, precise surfaces, a developer-tool register |
| `organic` | soft and hand-made: irregular shapes, hand-drawn or natural elements, warm texture, curves in place of a grid |
| `maximalist` | deliberate excess: many typefaces, saturated colour, layered ornament, density used as expression |
| `retro` | a period look revived on purpose, whatever the period |
| `glassmorphism` | translucent frosted layers, blurred depth, light passing through surfaces |
| `experimental` | convention deliberately broken: unusual navigation or scroll behaviour, canvas or 3D as the medium, layout that refuses the grid |

### The answer to `brutalist` / `neo-brutalist` / `brutalism` / `raw-concrete`

There is **one member**, and its definition is written wide enough to absorb all
four. This is the whole mechanism, and it is worth being explicit that the
mechanism is the *definition*, not the enum. An enum alone would let the agent
file the hard-shadow style under `maximalist` on one run and `brutalist` on the
next; the gloss saying "covers the whole family" is what stops that. This is why
`STYLE_GLOSS` lives in the module and why `LABELS_JSON_SCHEMA` builds its
descriptions from it: 004 section 6 established that descriptions are prompt
surface rather than documentation, so the definitions must be in the artifact
the prompt is generated from or they will drift out of it.

**Rejected: splitting `neo-brutalist` out as its own member.** It is a genuinely
distinct look and I still refused it. 002 measured that readings near a
judgement boundary flip between runs of the same image, and these two sit on
exactly such a boundary. A filter whose value changes on re-run is worse than a
coarser filter that does not. If the library ever holds enough of both to make
the split useful, that is an append and a version bump.

### Other rejected values

- **`minimal`.** Two failures at once. It restates `spacing.density: airy`,
  `surfaceTreatment.borders: none` and `elevation: flat` (test 2), and it is the
  catch-all every second design attracts. A value applied to sixty per cent of
  the library destroys a facet exactly as thoroughly as sprawl does.
- **`editorial`.** A real idiom, and cut for two reasons. It collides with the
  genre member of the same name, which is precisely the ambiguity this ticket
  exists to prevent. And what it names (serif display, strong hierarchy, a wide
  measure, restrained colour) is literally the content of `typography` and
  `composition`, so it fails test 2.
- **`illustrative`, `photographic`.** Restate `imagery.kind` (test 2).
- **`flat`.** Restates `surfaceTreatment.elevation` (test 2).
- **`gradient` / `aurora`.** A technique rather than an idiom. The axis is
  defined as the recognised school a design belongs to, and admitting techniques
  reopens it to `neon`, `noise`, `blur` and every other effect.
- **`corporate`.** In practice a quality judgement, not a style, and nobody
  saves a design to a taste library in order to find it again by being generic.
- **`collage` / `zine`, `skeuomorphic`.** Both real, both too rare here to earn
  a facet. These are the two most likely first additions, which is a fine place
  for them to sit.

---

## 5. Axis: `mood`. How it feels

**Nought to two values.**

| value | meaning |
| --- | --- |
| `calm` | quiet and unhurried; nothing competes for attention |
| `bold` | loud and confident; scale, colour or contrast used to hit hard |
| `playful` | humour and warmth; irregularity and delight over correctness |
| `serious` | sober and institutional; weight and authority over charm |
| `refined` | precise and considered; craft and restraint read as quality |

**The strongest objection to this axis, stated properly:** it is the softest
thing in the taxonomy, it has no ground truth, and 002 proved the agent is
unstable near judgement boundaries. `calm` and `refined` are adjacent. Every
argument that killed `minimal` can be pointed at `serious`.

Three answers. First, mood is the axis that serves the ticket's own framing most
directly: 009 says "you are not searching for a known item by name, you are
hunting by half-remembered feel", and feel is what mood is. Style tells you
which school a design is from; mood is what you actually remember about it a
month later. Second, instability here is bounded and benign: a flip from `calm`
to `refined` is a near miss between neighbours, where a genre flip would be a
wrong answer, and the two-value cap means the neighbour is often carried
anyway. Third, an Override fixes it in one edit and the axis is then permanently
correct for that Item.

Stated plainly so a later session does not have to rediscover it: **if any axis
proves useless in practice, this is the one, and it is the first to cut.**

**Rejected values:** `warm` (confusable with colour temperature, which is
derived, not stored), `energetic` (absorbed by `bold`), `raw` (that is the
`brutalist` style), `nostalgic` (that is the `retro` style), `luxurious`
(absorbed by `refined`), `severe` (the ticket's own pole, absorbed by `serious`,
which is the word a person actually says).

---

## 6. Cardinality, and why the ticket's own example splits across two axes

| axis | cardinality | empty means |
| --- | --- | --- |
| `genre` | exactly one | n/a, `undetermined` is a member |
| `style` | 0 to 2 | no named idiom is close |
| `mood` | 0 to 2 | nothing in the list is more than half true |

The ticket motivates multi-labelling with "one design is plausibly both
editorial and brutalist". Under this taxonomy that example resolves into two
different axes: `genre: editorial` and `style: [brutalist]`. **The strongest
argument for multi-value turned out to be an argument for splitting the axes
correctly.** Multi-value survives anyway on its own merits, because a real
design can be `[swiss, brutalist]` or `[retro, maximalist]`, but the cap is the
load-bearing part.

**The cap is 2, and it is deliberate.** An uncapped style array degrades the
filter by the opposite route from sprawl: if every Item carries four styles,
every query matches everything, and a facet that matches everything is as
useless as a facet nobody shares. Two forces commitment. `maxItems` is inside
004's proven keyword budget, so the cap is enforced at generation and not merely
requested.

**An empty array is a legitimate answer, not a failure.** This is 004's
`headingFamily` rule applied to labels: an unnamed thing is normal, and a design
with no recognisable idiom is fully described by its seven traits and its
philosophy paragraph. The alternative, forcing at least one style, guarantees
that the closest-but-wrong member gets applied, which pollutes the facet with
false members. A false `brutalist` is worse than no style at all, because you
cannot filter away something you do not know is there.

**Rejected: distinguishing "no idiom fits" from "the agent did not look".** 004
disambiguates this for typography using the family/character pair. Here it has
no consumer: nobody filters for Items whose style the agent failed at, and
`genre` and `mood` being present already evidences that the agent engaged with
the labelling. Not worth a field.

**Rejected: `uniqueItems` in the generation schema.** Outside 004's proven
keyword budget. A repeated value is caught by Zod at the read boundary instead,
which is precisely the asymmetry 004 section 2 relies on: a missing generation
constraint fails recoverably, an unsupported keyword fails totally.

---

## 7. Scope: 004's provisional enum, confirmed, and the table it was waiting for

**Decided: `page | section | component`, unchanged from 004's placeholder.**

Confirming rather than replacing needs its own argument, so here it is.
**CONTEXT.md's definition of Scope, written by 001 before any of this, already
names both endpoints**: "from a whole page down to a single component". The
middle value is the one 003 created when it found that `locator.screenshot()`
makes section framing free, which is what let it revise 001 decision 9. The enum
is therefore not a guess that happened to survive; it is the union of what two
closed tickets already committed to.

| value | meaning |
| --- | --- |
| `page` | a whole viewport of a design as it was published |
| `section` | one band of a page framed on its own: a hero, a pricing block, a footer |
| `component` | one interface part in isolation: a button, a card, a nav, an input |

**The boundary rule is operational, and it is derived from the consequence
rather than asserted:** if the capture tells you anything about page layout, it
is at least a `section`; if it does not, it is a `component`; a whole viewport
is a `page`. That is the same test as "does `composition` mean anything here",
which is exactly what the scope decides.

### The scope-to-`notApplicable` table

004 section 5.2 specified this table, said it needed 005's vocabulary, and left
it unwritten. It lives in the module as `NOT_APPLICABLE_BY_SCOPE`.

| scope | not applicable |
| --- | --- |
| `page` | none |
| `section` | none |
| `component` | `composition` |

**One non-empty cell out of three, and that is a finding rather than an
oversight.** 004's absence rule ("a state describes the reading, a value
describes the design") gave every enum a member for the case where the design
genuinely lacks the thing, and that rule ate almost everything a Scope could
have excluded. A component crop has no pictures, but that is
`imagery.kind: 'none'`, a value. It has fewer than five colour roles, but those
are Undetermined swatches, a partial read. It may have no glyphs, which 004
already handles as both typography fields empty. What is left is `composition`,
whose `contentWidth` (`full-bleed | wide | contained | narrow`) has no meaning
for a picture of a button, and which 004 itself names as this mechanism's
"primary customer".

Worth surfacing honestly: **the `notApplicable` machinery ends up carrying one
entry.** It still earns its place, because the distinction it preserves is 001
decision 6 and cannot be retrofitted, and because the cost is one array. But a
reader who expected a rich table should know that the richness went into 004's
enum members instead, which is the better place for it.

**Rejected: `section` merged into `page`.** They exclude the same traits, so the
merge is tempting. Rejected because Scope's second job is filtering ("just the
small stuff"), because 003 made section framing a first-class CLI path, and
because a section capture has an arbitrary aspect ratio where a page capture is
always 1.6:1, which 011 will care about.

**Rejected: a fourth `flow` or `multi-screen` value** for a board showing
several screens at once. 003 already rejects the URLs that produce these, and a
handed-over board is a `page` with an honest philosophy paragraph.

**Rejected: an `undetermined` member.** Scope is producer-supplied fact with a
`--scope` default of `page` (004 section 7). There is nobody to be uncertain.

---

## 8. Authorship: use the mechanism 004 built, at axis granularity

**Decided: `authorship` sits once per axis, using 004's existing
`agent | override` enum. No parallel mechanism.**

The ticket asks whether a human-set category and an agent-set one are
distinguishable in storage. They are, and nothing new was needed. The stored
shape is 004's trait shape applied to labels:

```ts
labels: {
  genre: { value: 'dashboard',            authorship: 'agent' },
  style: { values: ['technical'],         authorship: 'override' },
  mood:  { values: ['calm', 'refined'],   authorship: 'agent' },
}
```

**Why per axis and not per value.** 004 keyed authorship granularity to mixing
atomicity, but labels are never mixed (001 decision 7), so that argument gives
no guidance and the question has to be settled from the correction case instead.
You correct an axis: you look at an Item labelled `swiss` that is plainly
brutalist and you rewrite the answer. If the new value set is
`['brutalist', 'swiss']`, per-value authorship would keep `swiss` marked
`agent`, which asserts that the agent endorsed *that pair*. It never saw the
pair. **An axis's value set is a single judgement, so it is attributed as one.**

**Why not per-value even so.** The two reasons 004 gave the palette per-swatch
authorship both fail here, and checking them was the test: there is no future
sampler that would upgrade labels one at a time, and 007 never hedges a label,
because a label is a pick from a list rather than an approximate reading. With
both reasons absent, the general rule applies.

**Why not once for all labels.** Correcting the style must not silently claim
you also wrote the genre.

**Correcting a bad category** is therefore an Override on one axis: replace the
values, flip `authorship` to `override`. That is the whole answer to the
ticket's last bullet, and it constrains 006 exactly as the ticket asked: the
store must keep `authorship` per axis and must let a hand edit set it.

**This replaces 004's provisional `labels: Label[]` with `minItems: 3,
maxItems: 8`.** 004 explicitly reserved the right for 005 to do this. Since no
library exists yet, this is an edit to `schemaVersion: 1` rather than a
migration to 2, and 004's `LabelValue` slug format (lowercase, hyphenated)
survives as the format every value in this vocabulary conforms to.

---

## 9. Evolution: append-only, stale by default, backfill on demand

The ticket is right that a list you cannot extend is wrong within a month. Four
rules, and the second is the one with teeth.

1. **Adding a value is an append plus a version bump.** Edit the const array in
   `005-taxonomy.ts`, extend the gloss record (the type system forces this: the
   gloss is a `Record<Genre, string>`, so a value with no definition does not
   compile), bump `TAXONOMY_VERSION`. Values are added by you, never by the
   agent.

2. **Adding a value changes no stored Item. Old Items go stale, and stale is the
   correct default.** An Item's DNA is a record of a reading at a time, and 001
   decision 4 already establishes that an Item is a record which outlives its
   source. Silently rewriting old Items when a list is edited is the same class
   of error as re-capturing a redesigned page.

3. **Staleness is findable, which is what makes rule 2 acceptable.** Every Item
   stores `taxonomyVersion`, so `item.taxonomyVersion < TAXONOMY_VERSION` is the
   query. Note the deliberate asymmetry with 004's `schemaVersion`, which is a
   `z.literal(1)`: a shape change is a migration and an old shape is *invalid*,
   whereas an Item labelled under an older vocabulary is perfectly *valid* and
   merely behind. So `taxonomyVersion` is an integer and nothing refuses to
   parse because of it.

4. **Backfill is a narrow, opt-in relabel pass, and it is not re-extraction.**
   A CLI command re-asks the agent the label question only, against the stored
   Capture, and writes only `dna.labels` and `taxonomyVersion`. Every trait is
   left byte-identical.

**Rejected: backfill by re-running extraction.** This is the decisive rejection
on this section, and it is forced by a measurement rather than a preference. 002
proved re-extraction is not idempotent: same image, different palette, different
`typography.scale`. Re-running extraction to fix one label would destroy a
palette you were happy with. Because the relabel pass touches one field, it
carries none of that risk, and the two operations must never be the same
command.

**The rule that makes the relabel pass safe is `authorship`, and it needs no new
mechanism:** relabel rewrites only axes whose authorship is `agent`, and skips
any axis you have overridden. `isRelabelable()` in the module is that rule.

**Rejected: automatic backfill on version bump.** It would make an Item's labels
change under it as a side effect of an unrelated edit, and it would spend real
money (002: $0.05 to $0.13 per item) without being asked.

**Removals and renames are migrations, not edits.** Retiring `glassmorphism`
would strand every Item carrying it, so it requires a rewrite of the store owned
by 006 and 008. Append-only is the cheap path and it is the only one this ticket
authorises. `glassmorphism` is the likeliest first candidate for retirement,
which means that path will get exercised.

**Adding an *axis* is a schema change, not a taxonomy change,** because it
alters the shape of `labels`. That bumps `schemaVersion` and goes through 008.

---

## 10. The filter surface, all of it

The obvious objection to a three-axis taxonomy is that the filter will be thin.
It is not, because labels were never going to be the whole filter. Counting what
009 can actually offer:

| facet | source | kind |
| --- | --- | --- |
| genre | label | closed, single |
| style | label | closed, 0-2 |
| mood | label | closed, 0-2 |
| scope | Item field | closed, single |
| density | `spacing.density` | trait enum |
| content width | `composition.contentWidth` | trait enum |
| type scale | `typography.scale` | trait enum |
| weight range | `typography.weightRange` | trait enum |
| corners | `surfaceTreatment.corners` | trait enum |
| borders | `surfaceTreatment.borders` | trait enum |
| elevation | `surfaceTreatment.elevation` | trait enum |
| imagery kind | `imagery.kind` | trait enum |
| light / dark | `palette.background` luminance | derived |
| colour temperature, colour distance | `palette` hues | derived |
| free text | `philosophy`, `note`, font families | search |

**Sixteen filter surfaces, of which the taxonomy contributes three.** That is
the real reason the axis list could be cut so hard: 004 had already built eight
enum facets, and every axis this ticket rejected was either one of those
restated or something computable from the palette. Labels only have to carry
what nothing else can, which is genre, idiom and feel.

---

## 11. The vocabulary, for pasting into a prompt

Generated from the same records the module exports, so this block and
`LABELS_JSON_SCHEMA` cannot drift apart.

```
How this design is filed so it can be found again. These are not design content
to be transplanted; they are the shelf it sits on. Choose only from the listed
values. Never invent one.

genre - what kind of designed thing this is, its job rather than its look.
Exactly one.
  landing-page  a marketing or product page whose job is to persuade: a hero,
                stacked sections, calls to action
  product-ui    the inside of an application, the working interface rather than
                the page selling it
  dashboard     a product surface whose subject is data: charts, tables,
                metrics, monitoring
  editorial     writing as the subject: an article, essay, blog or magazine
  portfolio     work shown as a body of work: a personal site, a studio site,
                a case study
  commerce      buying: a shop, a product page, a basket, a checkout
  docs          reference material: documentation, an API reference, a
                changelog, a design system site
  undetermined  the capture does not show what kind of design this is

style - the named visual idiom or idioms this design belongs to, its look
rather than its job. Nought to two. Pick the closest member; leave empty when
nothing in the list is close, which is a normal answer and not a failure. Never
stretch a member to fit.
  brutalist      raw and hard-edged: exposed structure, blunt type, harsh
                 contrast, deliberate anti-polish. Covers the whole family,
                 from unstyled-HTML revival to the thick-border hard-shadow
                 strain
  swiss          grid and typographic rationalism: a strict grid, neutral
                 grotesk type, information ordered rather than expressed
  technical      engineered rather than decorated: monospace or tightly tracked
                 type, dense data, precise surfaces, a developer-tool register
  organic        soft and hand-made: irregular shapes, hand-drawn or natural
                 elements, warm texture, curves in place of a grid
  maximalist     deliberate excess: many typefaces, saturated colour, layered
                 ornament, density used as expression
  retro          a period look revived on purpose, whatever the period
  glassmorphism  translucent frosted layers, blurred depth, light passing
                 through surfaces
  experimental   convention deliberately broken: unusual navigation or scroll
                 behaviour, canvas or 3D as the medium, layout that refuses the
                 grid

mood - how the design feels to a first-time viewer. Nought to two. Leave empty
rather than reaching for a member that is only half true.
  calm      quiet and unhurried; nothing competes for attention
  bold      loud and confident; scale, colour or contrast used to hit hard
  playful   humour and warmth; irregularity and delight over correctness
  serious   sober and institutional; weight and authority over charm
  refined   precise and considered; craft and restraint read as quality
```

Scope is not in this block on purpose. The agent is *told* the Scope so it does
not hunt for page layout in a picture of a button, but it never writes it (004
section 7).

---

## 12. What was verified, and what was not

Verified by running it, against the toolchain 004 used (`zod` 4.4.3, `ajv`
8.x draft 2020-12 with `strict: true`, `typescript` 7.0.2 in strict mode,
Node 22.14.0), 29 checks in total:

1. every gloss record is complete for its enum, so no value can exist without a
   definition reaching the prompt;
2. `NOT_APPLICABLE_BY_SCOPE` contains only real `TraitName` members from 004,
   checked against 004's own enum rather than against a copy;
3. `notApplicableFor('component')` is `['composition']` and the other two scopes
   are empty;
4. a realistic payload parses, and so does one with both arrays empty;
5. strictness bites: an invented style value, an invented axis, three styles, a
   repeated style, and a `genre` sent as an array are each rejected;
6. `stampLabelAuthorship` output parses as `Labels` and marks every axis `agent`;
7. `isRelabelable` is false for an overridden axis and true for an agent one;
8. `isStale` fires on an older version and an Item at an older version still
   validates;
9. `LABELS_JSON_SCHEMA` compiles under ajv in strict mode, and every keyword in
   it is inside 004 section 2's proven budget (verified by walking the object,
   not by eye);
10. against the compiled schema: a good sample validates, empty arrays validate,
    and an invented value, a third style, an extra axis and a missing axis are
    each rejected.

Not verified, and each is a real gap:

- **`enum` nested inside `items` was never exercised against the SDK.** 002 used
  `enum` on a scalar property and `items` on an array of plain strings. This
  fragment combines them, and that combination is inherited rather than
  evidenced. If it degrades, the fallback is to keep an array of plain strings
  and carry the vocabulary in the `description` alone, which 002 showed is
  enough to get hex formatting right on every run.
- **Nothing has been run through the Agent SDK against this vocabulary at all.**
  In particular, nobody has measured **whether the agent uses a closed list
  confidently or abstains into empty arrays.** 002 evidence points both ways:
  the agent refused to invent font families, which is the behaviour you want,
  but the same instinct applied to `style` would leave the axis empty on Items
  that plainly have an idiom. This is the single most important thing to watch
  on the first real run, and the lever is the gloss wording, not the schema.
- **Instability of `mood` and `style` between runs is unmeasured.** 002 measured
  it for `typography.scale` and for hexes. These axes are the same kind of
  boundary judgement, so the same behaviour should be expected until measured.
- **The value lists are drawn from the design vocabulary in general use, not
  from your library.** No real Items exist yet, so nothing here is calibrated
  against what you actually save. Section 9 exists because that calibration will
  change the lists.
- **The relabel pass does not exist**, so nothing has exercised the claim that
  it can rewrite `labels` while leaving traits byte-identical. 008 builds it.
- **`authoredBy` will describe the extraction, not the relabelling.** After a
  relabel pass, `authoredBy.model` and `promptVersion` still refer to the run
  that produced the traits, and `taxonomyVersion` is the only provenance the new
  labels carry. Accepted as cheaper than a second provenance block; worth
  revisiting in 006 if it bites.
- **The module's `import type` of `TraitName` is extensionless**, which
  typechecks under `moduleResolution: bundler` (what the Next.js app uses) and
  requires a `.js` suffix under `nodenext` (what the 002 spike uses). Whoever
  assembles the real repo picks one; the import is type-only either way, so
  there is no runtime cycle with 004 in either direction.

---

## 13. The judgement calls, named

Everything above is either derived from a locked decision, forced by a
measurement, or one of these seven. A reviewer who wants to disagree efficiently
should start here.

1. **Three axes, and specifically the decision to admit `mood` at all.** It is
   the softest thing in the taxonomy and section 5 argues both sides.
2. **The eight style values, and the definition of `brutalist` wide enough to
   swallow `neo-brutalist`.** The values themselves are a curation, not a
   derivation.
3. **The five mood values and their boundaries.** `calm` versus `refined` is the
   pair most likely to prove unusable.
4. **The seven genre values**, and the cuts of `pricing` and `auth` in
   particular, which follow from cutting the `part` axis rather than from
   anything about genre.
5. **The cap of 2 on both multi-value axes.** Defensible at 1 or 3.
6. **Axis-level authorship rather than value-level.** The argument is real but a
   reviewer may prefer per-value for uniformity with a future correction UI.
7. **Confirming 004's `page | section | component` rather than adding a fourth
   value.** Two of the three rows in the `notApplicable` table are empty, which
   is the honest cost of keeping `section`.
