# 007 candidates - four prompts from one Item

Ticket: [`../tickets/007-what-the-copied-prompt-is.md`](../tickets/007-what-the-copied-prompt-is.md).
Chosen template: [`007-prompt-template.ts`](007-prompt-template.ts).

**Status: settled by argument and by a rendered artifact, not by the experiment
the ticket asked for.** The ticket says to paste each candidate into a fresh
session and compare what gets built. That comparison **was not run**; see
section 7 and the ticket's "What was not verified". What was done instead is
that all four candidates are written out in full against one Item, so the
difference between them is visible as text rather than described, and the
chosen one is a running function whose every branch has been executed.

Read section 3 and section 5. Section 3 is the voice decision, which is the one
that decides the ticket. Section 5 is where approximation surfaces, which 004
handed over explicitly.

---

## 1. The worked example, and it is constructed

**Everything below is invented.** `meridian.build` is not a site I analysed and
may not exist; the Item was hand-written to conform to
[`004-extraction-schema.ts`](004-extraction-schema.ts) and validated by
`Item.parse()` before any of these prompts were rendered. It is a constructed
example chosen to be internally consistent and to exercise the awkward parts: a
heading face the agent could not name, a `weight` spread that is not uniform,
and a Note that is about one region of the page rather than the whole design.

It is deliberately **not** a dark SaaS landing page. 002 names "a paragraph that
would be equally true of any other page of its kind" as the failure mode to
watch, and a template tuned on the house style of the last five years would hide
that failure rather than expose it.

```jsonc
{
  "schemaVersion": 1,
  "id": "itm_8f31c2a0",
  "addedAt": "2026-07-19T21:14:02.000Z",
  "source": { "kind": "url", "url": "https://meridian.build/pricing" },
  "capture": {
    "file": "captures/itm_8f31c2a0.png",
    "takenAt": "2026-07-19T21:14:02.000Z",
    "pixelWidth": 2880, "pixelHeight": 1800,   // 003's 1440x900 at dSF 2
    "mode": "viewport"
  },
  "scope": "page",
  "notApplicable": [],
  "note": "Kept for the pricing row. Three tiers that read like a table in a book instead of three boxes shouting at each other - that is the trick I keep failing to pull off",
  "authoredBy": { "kind": "cli", "model": "claude-sonnet-4-5", "runAt": "2026-07-19T21:14:29.000Z", "promptVersion": "extract-v1" },
  "dna": {
    "palette": {
      "background": { "hex": "#faf7f2", "weight": "dominant",   "authorship": "agent" },
      "surface":    { "hex": "#ffffff", "weight": "supporting", "authorship": "agent" },
      "ink":        { "hex": "#1a1714", "weight": "supporting", "authorship": "agent" },
      "muted":      { "hex": "#8a8178", "weight": "occasional", "authorship": "agent" },
      "accent":     { "hex": "#c8452d", "weight": "occasional", "authorship": "agent" }
    },
    "typography": {
      "headingFamily": "",                      // read, but not named. 004 decision 8.
      "headingCharacter": "high-contrast serif at display size, tight leading, generous tracking on the small-caps kicker above each band",
      "bodyFamily": "Inter",
      "bodyCharacter": "neutral grotesque, comfortable leading, set at one size for everything except the tier prices",
      "scale": "dramatic",
      "weightRange": "paired",
      "authorship": "agent"
    },
    "composition": {
      "structure": "a single centred column with a full-width three-card pricing row breaking out of it, and a thin rule closing each band",
      "contentWidth": "contained",
      "authorship": "agent"
    },
    "spacing": { "density": "airy", "rhythm": "large uniform vertical bands, tight clusters inside each card", "authorship": "agent" },
    "surfaceTreatment": {
      "corners": "slight", "borders": "hairline", "elevation": "flat",
      "finish": "plain flat fills with a faint paper grain over the page background",
      "authorship": "agent"
    },
    "imagery": { "kind": "none", "treatment": "the type and the hairlines do all the work", "authorship": "agent" },
    "philosophy": {
      "text": "The page reads as a printed prospectus rather than a web app: one warm paper field, one serif voice carrying every claim, and a single burnt red that appears exactly four times. Hierarchy is done entirely with size and space, never with boxes or colour, so the three pricing tiers feel like a table in a book rather than a control panel. The restraint is the argument: nothing on the page is asking to be clicked except the one thing that is.",
      "authorship": "agent"
    },
    "labels": [
      { "value": "editorial", "authorship": "agent" },
      { "value": "warm-neutral", "authorship": "agent" },
      { "value": "serif-forward", "authorship": "agent" },
      { "value": "print-inflected", "authorship": "agent" },
      { "value": "airy", "authorship": "agent" }
    ]
  }
}
```

---

## 2. The four candidates, in full

They are four different **ideas**, not four settings of one. Two axes are being
crossed: whether the artifact is shaped as prose or as structure, and whether it
speaks as a brief or as an instruction.

| | brief voice | instruction voice |
| --- | --- | --- |
| **prose** | **A. The Paragraph** | (empty by construction: an instruction that is a paragraph is A with verbs) |
| **structure** | **B. The Record**, **C. The Brief** | **D. The Directive** |

B and C share a cell and are still different ideas: B is shaped by the schema
and C is shaped by the reader. That difference is the whole of section 4.

### Candidate A - The Paragraph

Pure prose. No headings, no bullets, no structure of any kind. Everything the
Item knows, woven into three paragraphs.

```text
A pricing page that reads as a printed prospectus rather than a web app: one warm
paper field, one serif voice carrying every claim, and a single burnt red that
appears exactly four times. Hierarchy is done entirely with size and space, never
with boxes or colour, so the three pricing tiers feel like a table in a book
rather than a control panel. The restraint is the argument: nothing on the page is
asking to be clicked except the one thing that is.

The canvas is a warm paper off-white, around #faf7f2, carrying most of the visible
area, with panels a shade cleaner at around #ffffff and text a warm near-black at
around #1a1714. Secondary copy and hairlines drop back to around #8a8178, and one
burnt red at around #c8452d appears in small deliberate moments only. Headings are
set in an unnamed high-contrast serif at display size with tight leading and
generous tracking on the small-caps kicker above each band; body copy is Inter, a
neutral grotesque with comfortable leading, held at one size for everything except
the tier prices. The size range between the largest and smallest text is dramatic,
and two weights do the work as a pair.

Structurally it is a single centred column with a full-width three-card pricing row
breaking out of it, a thin rule closing each band, and content held in a contained
measure rather than running the full width. Spacing is airy: large uniform vertical
bands with tight clusters inside each card. Surfaces are slightly softened at the
corners, separated by hairlines rather than shadows, with no elevation at all and
plain flat fills carrying a faint paper grain over the page background. There is no
imagery; the type and the hairlines do all the work. I kept this for the pricing
row, because three tiers that read like a table in a book instead of three boxes
shouting at each other is a trick I keep failing to pull off. Captured from
https://meridian.build/pricing on 19 July 2026.
```

**What it gets right.** It reads like something a person wrote, which is the
highest compliment available to a design brief. Nothing in it is jargon and
nothing has to be decoded. The philosophy paragraph and the trait content sit in
one voice rather than two.

**Why it loses.** Three specific failures, and the third is fatal.

1. **The palette dissolves.** Five roles are five colours doing five jobs, and
   in the second paragraph they become a list of hex values in a sentence. 004
   section 3.2 asked specifically that accent restraint sit *next to* the value
   rather than be "buried in a paragraph", and this buries it in a paragraph.
2. **It cannot be skimmed back.** You paste this, get a result, and want to
   change one thing about the colour. There is nowhere to look.
3. **It cannot be rendered for a subset.** 010 needs a palette-only prompt.
   Extracting the palette from candidate A means writing a second prose template
   for palettes alone, and then a third for palette-plus-type, and so on. Prose
   does not decompose. **This is the argument that ends candidate A**, and it
   comes from the map rather than from taste: 010 is blocked by 007, so 007 owes
   it a shape that survives being cut into pieces.

### Candidate B - The Record

Structured markdown that mirrors the schema. The field names are the headings,
the enum members are the values.

```text
# Design DNA - meridian.build/pricing

scope: page
labels: editorial, warm-neutral, serif-forward, print-inflected, airy

## palette
- background: #faf7f2 (dominant)
- surface: #ffffff (supporting)
- ink: #1a1714 (supporting)
- muted: #8a8178 (occasional)
- accent: #c8452d (occasional)

## typography
- headingFamily: (unrecognised)
- headingCharacter: high-contrast serif at display size, tight leading, generous tracking on the small-caps kicker above each band
- bodyFamily: Inter
- bodyCharacter: neutral grotesque, comfortable leading, set at one size for everything except the tier prices
- scale: dramatic
- weightRange: paired

## composition
- structure: a single centred column with a full-width three-card pricing row breaking out of it, and a thin rule closing each band
- contentWidth: contained

## spacing
- density: airy
- rhythm: large uniform vertical bands, tight clusters inside each card

## surfaceTreatment
- corners: slight
- borders: hairline
- elevation: flat
- finish: plain flat fills with a faint paper grain over the page background

## imagery
- kind: none
- treatment: the type and the hairlines do all the work

## philosophy
The page reads as a printed prospectus rather than a web app: one warm paper field,
one serif voice carrying every claim, and a single burnt red that appears exactly
four times. Hierarchy is done entirely with size and space, never with boxes or
colour, so the three pricing tiers feel like a table in a book rather than a control
panel. The restraint is the argument: nothing on the page is asking to be clicked
except the one thing that is.

## note
Kept for the pricing row. Three tiers that read like a table in a book instead of
three boxes shouting at each other - that is the trick I keep failing to pull off.
```

**What it gets right.** It is the cheapest possible template: the render function
is a loop over the schema, and it can never fall out of date with 004 because it
*is* 004. Every value is exactly where you would look for it. It decomposes for
010 trivially.

**Why it loses.** Four failures, and two of them are violations of locked
decisions rather than matters of taste.

1. **It asserts exact hexes, which 002 proved are false.** `#faf7f2` with no
   hedge is a claim the library cannot support. This is not a stylistic
   complaint: 004 decision 5 exists specifically so that 007 hedges.
2. **It ships `labels`, and it must not.** CONTEXT defines a Label as something
   that "describes an item rather than contributing to a prompt", so a label is
   how you *find* this item and never part of what it *says*. Candidate B
   putting them in the header is the visible form of that mistake, and noticing
   it settles a question the ticket did not think to ask.
3. **It hands the reader raw enum members.** `weightRange: paired` and
   `contentWidth: contained` are vocabulary invented by 004 for filtering. The
   receiving model has to guess what they mean, and its guess is not
   necessarily 004's `description` text.
4. **It reads as a record to be complied with rather than a design to be
   understood**, which pushes it toward candidate D's failure mode without
   candidate D's clarity about what it wants.

The general finding here is worth stating on its own: **the storage shape is not
the prompt shape.** They have different readers. B is what you get when that is
forgotten.

### Candidate C - The Brief (chosen)

A frame line, the philosophy as a lead paragraph, then labelled sections whose
contents are clauses rather than key-value pairs, then your Note, then
provenance. This is the exact output of `renderPrompt(item)` in
[`007-prompt-template.ts`](007-prompt-template.ts), pasted from the verification
run rather than written by hand.

```text
Design brief. Work in the spirit of the design described below rather than reproducing it. It describes a whole page.

The page reads as a printed prospectus rather than a web app: one warm paper field, one serif voice carrying every claim, and a single burnt red that appears exactly four times. Hierarchy is done entirely with size and space, never with boxes or colour, so the three pricing tiers feel like a table in a book rather than a control panel. The restraint is the argument: nothing on the page is asking to be clicked except the one thing that is.

Palette
- Background, around #faf7f2, carrying most of the visible area
- Surface, around #ffffff, a substantial secondary share
- Ink, around #1a1714, a substantial secondary share
- Muted, around #8a8178, small deliberate moments only
- Accent, around #c8452d, small deliberate moments only

Type
- Headings: High-contrast serif at display size, tight leading, generous tracking on the small-caps kicker above each band.
- Body: Inter. Neutral grotesque, comfortable leading, set at one size for everything except the tier prices.
- A dramatic size range between the largest and smallest text, carried by two weights working as a pair.
The heading face is not named; match the character rather than hunting for the name.

Composition
A single centred column with a full-width three-card pricing row breaking out of it, and a thin rule closing each band. Content sits in a contained measure rather than running the full width.

Space
Airy overall. Large uniform vertical bands, tight clusters inside each card.

Surfaces
Slightly softened corners, hairline borders, no elevation. Plain flat fills with a faint paper grain over the page background.

Imagery
No imagery. The type and the hairlines do all the work.

What I wanted from this: Kept for the pricing row. Three tiers that read like a table in a book instead of three boxes shouting at each other - that is the trick I keep failing to pull off.

Captured from https://meridian.build/pricing on 19 July 2026. Provenance only: work from the description above rather than from memory of the site.
```

**Why it wins** is sections 3 through 6. Its own weaknesses are in section 7.

### Candidate D - The Directive

Instruction voice. Numbered rules, a things-to-do list and a things-not-to-do
list, written at whatever is about to be built.

```text
Build a pricing page using the following design system. Follow it exactly.

COLOURS - use these and no others:
- Page background: #faf7f2
- Card and panel background: #ffffff
- Body and heading text: #1a1714
- Secondary text, captions, rules: #8a8178
- Accent (primary action only): #c8452d

TYPE:
1. Set all headings in a high-contrast serif at display size. Use tight leading.
2. Add a small-caps kicker above each band, with generous letter-spacing.
3. Set all body copy in Inter at a single size, except the tier prices.
4. Use exactly two weights across the whole page.
5. Make the jump between your largest and smallest type dramatic.

LAYOUT:
6. Use a single centred column, max-width 1100px.
7. Break the three-card pricing row out to full width.
8. Close each band with a 1px rule in #8a8178.
9. Use generous vertical padding between bands, around 120px.

SURFACES:
10. Border-radius: 4px on all cards.
11. Use 1px hairline borders. Never use box-shadow.
12. Fill surfaces flat. Add a subtle paper grain over the page background.

DO NOT:
- Do not add any photography, illustration or iconography.
- Do not introduce a second accent colour.
- Do not use the accent for anything except the primary action.
- Do not use shadows, gradients or elevation of any kind.
```

**What it gets right.** It is by far the most likely of the four to be obeyed
literally, and the "do not" list is genuinely load-bearing content: restraint is
the hardest thing to transmit, and a negative constraint transmits it better than
an adjective. That list is the one idea worth stealing from candidate D, and
section 6 explains why it was stolen only partly.

**Why it loses.** Four failures, and the first two are disqualifying.

1. **It invents measurements that no part of this system knows.** `1100px`,
   `4px`, `120px` and `1px` appear nowhere in the Item. 004's `composition`
   description explicitly forbids the agent asserting pixel measurements, for the
   same reason 002 forbids percentages. Candidate D has to fabricate them,
   because an instruction that says "generous vertical padding" is not an
   instruction. **The instruction voice structurally demands precision the data
   does not have**, and that is not fixable by writing it more carefully.
2. **It assumes a deliverable.** "Build a pricing page" is a decision the library
   cannot make. The Item knows what a design looked like; it has no idea what you
   are about to make with it, and the answer is usually not another pricing page.
3. **It collides with your own sentence.** You paste this under "help me redo the
   settings screen", and now the message contains two instructions that disagree
   about what is being built. A brief composes with your instruction. An
   instruction competes with it.
4. **It does not survive mixing.** 010 takes a palette from one item and type
   from another. Two directives concatenated are two sets of numbered rules, two
   "DO NOT" lists, and two assumed deliverables.

---

## 3. Voice: a design brief, and this is the ticket's real answer

**Decided: the prompt is a design brief that happens to be pasteable, not
instructions to an AI. It contains exactly one imperative, it is the first line,
and it is about the block rather than about what to build.**

This is the decision the other five follow from, so it is worth stating the
argument in order rather than asserting a preference.

1. **The prompt does not know what it is for.** The map locks that "the copy
   button is the only export surface" and that the output is "always a prompt,
   never code". So the artifact's entire life is: it goes on a clipboard, and it
   is pasted somewhere the library will never see. A brief works in every one of
   those destinations. An instruction works in exactly one, the one where you
   wanted the same kind of page again, which is the least interesting reason to
   keep a design.
2. **Two instructions in one message is a bug, not a style.** You do not paste
   this into an empty box. You paste it under a sentence of your own. Candidate D
   makes your message argue with itself; candidate C makes your message the
   instruction and the paste the material.
3. **010 forces it.** A Mix is "a selection of traits drawn from several items,
   rendered into a single prompt". Five traits from five sources cannot be phrased
   as one coherent instruction without inventing a deliverable that none of the
   five items contains. They can trivially be phrased as one brief. Since 010 is
   blocked by 007, 007 does not get to hand it a shape that does not compose.
4. **The precision argument, which is the one I did not expect.** An instruction
   must be specific enough to follow, so writing candidate D *required* inventing
   `4px` and `120px`. The brief voice is not merely more pleasant, it is the
   voice in which this data can be stated honestly. Vagueness where the library is
   vague is a feature of the brief and a defect of the directive.

**The one imperative, and why it is not zero.** Text pasted with no frame is
ambiguous: a receiving model reasonably asks whether it is being shown a design
to critique, a spec to implement, or a description to acknowledge. One line
removes that, and it costs twenty words:

> Design brief. Work in the spirit of the design described below rather than
> reproducing it. It describes a whole page.

The second clause is doing real work beyond politeness. "Rather than reproducing
it" is the single defence against the whole system's characteristic failure,
which is producing a pastiche of the saved design instead of a new design in its
spirit. The third clause carries Scope, and section 6 explains why that is not
optional.

**Stack-agnostic, and it is derived rather than chosen.** No CSS, no Tailwind, no
React, no framework, no `--token` names, no px. The map rules storing or
generating code out of scope on the grounds that a prompt "keeps the app
stack-agnostic", so a prompt that names a stack spends the exact thing that
decision bought. The rendered artifact contains no technology noun at all, which
is checkable rather than aspirational.

---

## 4. Form: labelled sections of clauses, and why that is not candidate B

**Decided: plain-text section labels, contents written as English clauses, the
palette as a role-keyed list, and no markdown headings.**

Three separate calls sit inside that.

**Structure, but shaped by the reader rather than by the schema.** Candidate A
proved prose cannot be cut up and candidate B proved the schema shape is not the
prompt shape. What is left is structure whose sections are how a designer talks
(Palette, Type, Composition, Space, Surfaces, Imagery) rather than how the schema
stores (`surfaceTreatment`, `contentWidth`, `weightRange`). The section labels are
therefore hand-written English and are not derived from `TraitName`, which is a
small maintenance cost paid deliberately.

**Enum members are rendered as the English that defined them.** `occasional`
becomes "small deliberate moments only", which is verbatim the `description` text
004's JSON Schema used to tell the agent what `occasional` means. This is the
nicest property in the template: the writer of the value and the reader of the
value are working from one definition, and there is no third place where the
vocabulary could drift. `weightRange: paired` becomes "two weights working as a
pair"; `contentWidth: contained` becomes "content sits in a contained measure
rather than running the full width".

**No `#` headings.** The prompt is a guest inside someone else's message, not a
document. `## Palette` rendered in a chat client produces a heading that visually
outranks the sentence you actually wrote, and the prompt should never be the
loudest thing in your message. A capitalised word on its own line gives the same
structure in plain text and in rendered markdown without hijacking either.

**The palette is a list and not a sentence, and this is 004's instruction.**
Section 3.1 of the commentary wrote the target rendering itself: "a near-black
canvas, off-white ink, one warm orange used only on the primary action" is what a
role-keyed palette buys over five bare hexes. Section 3.2 then required that the
weight sit inside the token block rather than in a paragraph. The line

```text
- Accent, around #c8452d, small deliberate moments only
```

satisfies both: it is role-keyed with the weight adjacent to the value, and it
reads as English rather than as `accent: #c8452d (occasional)`.

---

## 5. Approximation, which 004 handed over by name

**Decided: the hedge is the word "around", it is applied per value, and an
unhedged hex means somebody measured or wrote it.**

004 section 3.4 did not just ask for a hedge, it constrained where the hedge can
live. Authorship sits on each swatch rather than on the palette trait
specifically so that "correcting one hex would not silently stop 007 hedging the
other four, which are still eyeballed", and it calls that outcome "a correctness
bug, not an inconvenience". A single footnote line saying "colour values are
approximate" is therefore **wrong by construction**: it cannot distinguish four
eyeballed swatches from one corrected one. The rule in the module is one line and
it is 004's:

```ts
isApproximate(swatch) === (swatch.authorship === 'agent')
```

**The marker is a word rather than a symbol.** `~#c8452d` is shorter and is what
a token file would use. It was rejected because a tilde is a glyph both a person
and a model may skim past, and because the prompt has two readers with the same
requirement. "Around #c8452d" cannot be misread.

**Marked-approximate rather than marked-exact.** In v1 every swatch is `agent`,
so every line says "around" and the repetition is a true statement about the
whole library rather than a rendering flaw. The payoff arrives the moment
anything changes: the component render in section 6 shows four hedged values and
one bare `#5e6ad2`, and the Override is visible in the artifact without a legend.
If a sampler is ever built, its results appear the same way.

**Nothing else in the prompt is hedged, and that is deliberate.** 002 found
free-text traits "varied in wording but were consistent in substance" across runs,
so `philosophy` and the `*Character` fields need no caveat. `typography.scale` is
genuinely unstable at the boundary, and it is still stated flatly, because "a
dramatic size range, approximately" is not a sentence and because the cost of
being wrong is that the receiving model picks a slightly different ratio. The
hedge is spent where a false claim would be specific and checkable.

---

## 6. The remaining four questions

### How much is too much: a structural answer rather than a number

The ticket asks whether naming twelve attributes beats naming five. The template
does not answer that with a number, because the right number is not a constant.
It answers with a rule: **the render never emits a line for a leaf that carries
no information.**

- An **Undetermined** leaf is omitted entirely. Rendering "type scale:
  undetermined" spends tokens saying nothing and invites the model to fill the
  gap on your authority. Silence lets it choose freely, which is the honest
  instruction.
- An **Undetermined trait** disappears completely, section label included.
- A **Not applicable** trait likewise, and the Scope line explains the shape of
  what is left, so nothing needs to announce the absence.

So the count is fixed at seven traits above and floats below: a thin Item renders
a short prompt automatically, and length tracks how much was actually read. The
worked example renders all seven and comes to roughly 2,100 characters, which is
the ceiling this design can produce for one item.

**The falsifiable prediction this makes**, stated so the untested part is
testable: naming twelve attributes is worse than naming five *only when the extra
seven are hedged, generic, or restatements*. 004's four admission tests already
filtered for exactly that, so the seven traits should not drown the reader. If
they do, the cut list is 004's rejected traits in reverse, starting with
`imagery.treatment` and `spacing.rhythm`.

### Provenance: named, last, and defused in the same breath

The ticket names the tension exactly: grounding if the model knows the site, a
bias toward copying it if it does. Both are real, so the decision is about
placement rather than inclusion.

**Decided: the Source is rendered as the final line, never in the lead, and
carries one clause that tells the reader what to do with it.**

> Captured from https://meridian.build/pricing on 19 July 2026. Provenance only:
> work from the description above rather than from memory of the site.

Leading with the URL would make everything above it decorative: a model that
recognises the site will answer from its memory of the site, and then the seven
traits, the schema, the hedging and the whole producer CLI exist for nothing.
Omitting it entirely was the other serious option and was rejected because the
prompt outlives the tab it was copied from. It lands in a chat log, a scratch
file, a document, and provenance in the artifact is the only thing that lets it
be traced back to the Item. CONTEXT already calls Source "provenance, not a place
you can browse to", and this line is that definition rendered.

**A local path is never rendered.** For a file Source with no `--source` URL the
line is "Captured from an image supplied by hand." `originalPath` is a citation
for the library; on a clipboard it is noise to the reader and a leak of your
directory structure to whoever you paste in front of.

### Generated when: on demand, and this closes a door in 006

**Decided: rendered on demand, purely from the stored Item. No prompt text is
ever stored, and the agent never writes one.**

Four arguments, ascending.

1. **Retroactive improvement**, which the ticket already identified as strong.
   Editing the template improves every item in the library at once, and a
   template that will be tuned against real use is worth much more when tuning is
   free.
2. **An agent-written prompt is a new field in a closed schema.** 004 locked
   `ExtractedDna` with `additionalProperties: false` and the principle that "every
   field the agent does not write is a field it cannot get wrong". A `promptText`
   field would also fail 004's own fourth admission test outright, since it is by
   definition a restatement of the other seven traits.
3. **Storing it breaks Override, which is the correction mechanism the map
   prefers.** 002 established that re-extraction is not idempotent, which is why
   the map argues for Override over re-running. If the prompt is a stored string,
   correcting `palette.accent` updates the trait and leaves the prompt asserting
   the old value. The one artifact that matters would silently fail to reflect the
   correction. This is decisive on its own.
4. **It costs money and latency for a strictly worse artifact.** 002 measured
   $0.05 to $0.13 and 18 to 48 seconds per agent call. A stored prompt spends that
   to freeze one sample of an unstable process.

**What this hands 006:** the store needs no prompt field, no prompt cache and no
prompt invalidation. Whether a DNA is versioned or overwritten is still 006's
question, but it no longer drags a derived text artifact along behind it. The
prompt is a pure function of the Item, so it is exactly as versioned as the Item
is and never separately.

### One prompt or several: one template, parameterised

**Decided: one function. The full prompt is the subset render with every trait
selected.**

`renderPrompt(item, { traits: ['palette'] })` is how 010 gets a palette-only
prompt. Two templates were rejected because 010 immediately needs a third: a Mix
is a subset render across several items, so if a palette-only prompt were a
separate template, a mixed prompt's palette section would be a third thing to
keep good, and the three would drift.

There is exactly one thing a subset render must add, and it is the reason the
distinction exists in the API at all. A palette-only prompt that simply omits the
other sections reads as a complete brief about a design with no typographic
opinions. So the frame changes:

> Design brief, covering only the colour system. Work in its spirit rather than
> reproducing it. It is drawn from a whole page and says nothing about the rest of
> that design; the rest is yours to choose.

Selection order is ignored and canonical order is imposed, so two selections of
the same traits render byte-identical. The Note defaults off for a subset, since
"kept for the pricing row" is misdirection inside a palette-only prompt.

### The Note: included, labelled, and last

Not one of the ticket's listed questions, but the template cannot avoid answering
it. 004 section 6 split the two prose fields cleanly: `philosophy` is the agent
saying what makes the design work, `note` is you saying why it was worth saving.
Both belong in a brief, and they are different voices, so rendering them as
undifferentiated paragraphs would be a wall in which the human sentence is
indistinguishable from the machine one. The label does the work:

> What I wanted from this: Kept for the pricing row. [...]

Last, so it is the thing read most recently before the model starts; labelled, so
it is not mistaken for another observation; and suppressed in subset renders.

---

## 7. What candidate C gets wrong, and the branches that were run

### Its own weaknesses, stated rather than hidden

- **The Note can misdirect.** "Kept for the pricing row" is a sentence about one
  region of one page, and it is rendered into a prompt you might be using to
  build something else entirely. Mitigated by the label and by the position, not
  eliminated. Suppressing it in full renders too was considered and rejected: it
  is the only human-authored sentence in the whole artifact and it is usually the
  highest-signal thing in it.
- **The palette is repetitive in v1.** Five consecutive lines beginning "around".
  This is the honest cost of per-value hedging and it is the price of section 5's
  correctness argument.
- **A one-line orphan sits under the Type bullets.** "The heading face is not
  named" is a sentence following a bullet list, which is slightly awkward. The
  alternative was repeating a disclaimer on each face line, which is worse.
- **The section labels are hand-maintained.** If 005 or 008 adds a trait, this
  file needs a label, an English name and a renderer. Candidate B would have got
  that free. Paid deliberately.

### The branches that were executed

Verified by running it, not by reading it. A throwaway driver in the system temp
scratchpad (outside the repo) built three Items, validated each with 004's
`Item.parse()` so no branch was exercised with an Item that could not exist, and
printed the render. Typechecked under `typescript` 5.9 with `strict` and
`noUncheckedIndexedAccess`, run under `tsx` on Node 22.

| branch | result |
| --- | --- |
| full render, all seven traits present | 2,116 characters, section 2 above |
| approximate hexes | five values hedged with "around" |
| an `override` swatch beside four `agent` ones | `#5e6ad2` bare, the other four hedged |
| an Undetermined trait (`philosophy`) | section absent entirely, no trace |
| Undetermined leaves inside a present trait | `scale` and `weightRange` lines absent, Type section still rendered |
| a Not applicable trait (`composition`, `imagery`) | sections absent; the Scope clause carries the explanation |
| absent Note (`null`) | no `What I wanted from this` block |
| a file Source with no url and `takenAt: null` | "Captured from an image supplied by hand." |
| partial render, `['palette']` | subset frame, palette only, provenance kept, Note suppressed |
| partial render, selection order reversed | byte-identical to canonical order |
| partial render of a Not applicable trait only | "This item has nothing readable to say about the composition: this item is a single component, which has none." |
| partial render of an Undetermined trait only | "...the analysis could not read it." |
| an Item with nothing readable at all | "This item has no readable design analysis to render." |
| purity | two calls on one Item produce identical strings |
| house style | no em dash and no en dash in any render |

The component-scoped render, which is the one that exercises the most branches at
once:

```text
Design brief. Work in the spirit of the design described below rather than reproducing it. It describes a single component.

Palette
- Background, around #0e0f13, carrying most of the visible area
- Ink, around #ffffff, small deliberate moments only
- Accent, #5e6ad2, a substantial secondary share

Type
- Body: Tight geometric sans, medium weight, slight positive tracking, sentence case.
The body face is not named; match the character rather than hunting for the name.

Space
Dense overall.

Surfaces
Clearly rounded corners, no borders, subtle elevation. A single soft vertical gradient across the fill.

Captured from an image supplied by hand.
```

Note what is visible in it without being announced: `#5e6ad2` is unhedged, so
somebody corrected it. Surface and Muted are absent, so their colours were not
read. There is no Composition or Imagery section, and the first line says why.

### What was not verified

- **The experiment the ticket asked for was not run.** No candidate was pasted
  into a fresh Claude session, nothing was built from any of them, and no outputs
  were compared. Every claim in sections 3 through 6 about how a receiving model
  behaves is an argument, not a measurement. The four candidates are real text and
  the chosen one is running code; the A/B is absent. **What would settle it:** one
  fixed build instruction ("a settings page for a small team tool"), each of the
  four candidates pasted beneath it into a fresh session with no project context,
  four results screenshotted, and the question asked in one form only, which is
  whether the result looks like a relative of the saved design. Candidates A and D
  are the informative pair, since they differ on both axes at once.
- **Nothing has been rendered from a real extraction.** The worked example is
  hand-written. Real agent prose may be longer, may already be punctuated as full
  sentences, and may repeat itself across `philosophy` and `*Character`, which the
  template does nothing to deduplicate. The first real CLI run is the test.
- **The 2,100-character ceiling is one item's.** Whether that is comfortable to
  paste, and whether it is comfortable to read, is a judgement nobody has made
  against a real one yet.
- **The sentence-casing helper is a heuristic.** It leaves `iOS` and `eBay` alone
  by pattern, and it will still mangle a lowercase-by-design name that does not
  match that pattern.
- **No mixed prompt exists.** 010's Mix is asserted to compose out of subset
  renders and that has not been demonstrated. The subset render is verified; the
  joining of several is 010's work.
- **The Note-misdirection risk is unmeasured.** Whether a receiving model treats
  "kept for the pricing row" as scope or as flavour is exactly the kind of thing
  the A/B would answer.
