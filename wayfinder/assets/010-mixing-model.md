# 010 mixing model - how traits from several items become one prompt

Ticket: [`../tickets/010-mixing-elements.md`](../tickets/010-mixing-elements.md).
Artifact: [`010-mix-render.ts`](010-mix-render.ts), built on 007's
[`007-prompt-template.ts`](007-prompt-template.ts).

**Status: settled by derivation from 001, 006 and 007 wherever one of them
reached, and by judgement in five places named in section 13. The mixed prompts
in section 9 were rendered by running the code, not written by hand.** The
ticket calls this the most ambitious thing in the brief and the easiest to get
wrong, and it names the failure precisely: two palettes, two type systems and
contradictory philosophies pasted together give you mud. Most of the defence
against that turns out to be already locked, and the single largest finding of
this ticket is where the mud actually comes from once the obvious source of it
has been made impossible.

Sections 1, 2 and 9 are the ones with teeth. Section 1 is the type that makes
same-trait conflict unrepresentable. Section 2 is the conflict argument, which
is what the ticket is really asking. Section 9 is the honest answer to whether
the mixed output is worse than a single-source prompt, and part of it is yes.

---

## 1. The central move: a Mix is at most one Item per trait

> **A Mix is a partial map from Trait to Item.** Seven named slots, each empty
> or holding exactly one Item. Selecting a trait that is already seated replaces
> the occupant.

That is `MixRack` in the module, and it decides the ticket's hardest question
before the question can be asked. Two selected palettes is not a case that gets
resolved. It is a state that cannot be constructed.

**This is derived, not preferred.** 001 decision 7 makes a trait atomic: "a
palette is taken whole, and sub-trait selection is refused, because a palette is
coherent through the relationships between its colours and one value pulled out
of it carries none of that." CONTEXT.md carries the same sentence into the
glossary. Now look at what merging two palettes into a primary and accent split
would actually be: take `background`, `surface`, `ink` and `muted` from A, and
`accent` from B. **That is sub-trait selection wearing a disguise**, and it is
refused by a locked decision rather than by taste. The same argument kills every
other merge that was on the table.

Three consequences worth stating separately, because each one removes work:

- **There is no conflict-resolution rule for a trait, because there is no
  conflict.** No precedence order, no "first wins", no merge strategy, no
  refusal dialog. The ticket offers three options for two palettes; the answer is
  that the second one takes the slot and the first one leaves it, which is what
  the user just asked for by clicking.
- **The cap is structural.** Seven traits, one Item each, so a Mix has at most
  seven parts and at most seven donors without anyone imposing a number. Section
  5 is about the soft limit that sits well under that.
- **The unit of selection is the pair (Item, Trait)**, which is exactly what 001
  handed down: "the selectable unit is a trait, traits are atomic, and a narrowly
  scoped item is a pure trait donor with nothing to conflict." Whole-item
  selection is sugar for filling seven slots from one Item, and it degenerates
  into 007's prompt (section 7).

**Rejected: allow several Items per trait and merge them.** The primary/accent
split is the seductive one and section 2.1 kills it above. The variant where two
palettes render as two labelled palette blocks ("one design's colours, then
another's") was rejected for a different reason: it hands the receiving model a
choice the library was supposed to make, and a brief that offers two colour
systems is not a brief.

**Rejected: allow several Items per trait and refuse to render.** This is the
"is it refused" option in the ticket. It has one virtue, which is that it never
silently drops anything, and two defects. It makes an error state out of a
gesture the user cannot avoid making, since the way you discover you already had
a palette in the mix is by adding another one. And it needs an error surface, an
error string and a dead copy button for a condition that the slot model simply
does not have.

**Rejected: sub-trait selection, honestly considered once.** The strongest case
for it is the real desire behind this whole ticket: A's warm paper background
with B's electric accent. That desire is not served by the Mix, and it should be
said plainly rather than designed around. It is served by taking A's palette and
writing "but use a colder accent" in your own sentence above the paste, which
costs nothing and is where 007's brief voice was designed to compose. Reopening
it here would overturn 001 decision 7 on a preference, and 004 built the whole
palette trait on top of that decision.

---

## 2. Conflict, and only one of the two kinds is one the app can see

The ticket asks whether the app points out the conflict, picks, or hands the mess
to the model and hopes. The honest answer needs the question split, because there
are two different things called conflict here and they have opposite answers.

### 2.1 Same-trait conflict is impossible

Section 1. Two palettes, two type systems, two philosophies: none of them can
exist in a Mix. The app does not point this out, pick between them, or hand it to
anyone, because there is nothing to hand over. **What the user sees** is that the
palette slot, which was showing one item, now shows the other, and the item that
left is named in the advisory so that a replacement is never silent.

### 2.2 Cross-trait contradiction is real, and the app cannot detect it

This is the finding of the ticket, and it survived being made impossible in the
obvious place only to reappear one level down.

The traits do not contradict each other. **The prose inside them does**, because
several prose leaves describe more of a design than the trait that owns them. Two
examples from the rendered mix in section 9, and neither was contrived:

- `philosophy` from the warm print-inflected page says "one warm paper field, one
  serif voice carrying every claim, and a single burnt red that appears exactly
  four times", sitting in a brief whose palette is near-black with a signal
  green. It is not vague enough to survive the transplant; it is a **flatly false
  statement about the design being briefed**.
- `imagery.treatment` from the same page says "the type and the hairlines do all
  the work", in a brief whose surface treatment came from a card with **no
  borders at all**. Smaller, quieter, and the same defect.

**`philosophy` is the worst offender by construction, not by accident.** 004
section 6 gives it the job of saying "what makes this design work", and a
paragraph doing that job well will name the colour, the type and the space,
because that is what makes a design work. So the one trait that carries the most
value is the one that over-reaches the most. That tension is inherent and cannot
be rendered away.

**What the app can do about it, honestly bounded.** Detecting that a paragraph
about warm paper disagrees with a near-black palette is a reading task. The map
locks that **no AI runs inside the web app**: it makes no model calls and spawns
no subprocess. So the app cannot read either the paragraph or the contradiction,
and any design that says "the app notices and warns" is a design the app cannot
execute. Three things are available, and all three are used:

1. **The frame states the truth.** "These parts were chosen separately and were
   never seen together, so work them into one coherent design rather than
   reproducing any of the sources." This is not politeness. It is the difference
   between handing over a mess and handing over a mess **labelled as one**, and
   it is the only defence in the artifact against the receiving model quietly
   reconciling everything toward whichever source spoke loudest.
2. **The intent paragraph is labelled and demoted.** It renders under "Intent,
   taken from one of the sources and describing that whole design", last among
   the sections, immediately before provenance. In a single-Item prompt it leads,
   correctly, because every fact below it was read off the same design. In a Mix
   it cannot lead, because an unlabelled opening paragraph silently claims
   authorship of six sections it does not describe. **007 decision 9 already
   established the shape of this fix** for the Note: a block that speaks for
   something other than this brief gets a label and gets moved out of the lead.
   This applies the same rule to the same problem.
3. **One advisory, and it is the only structural over-reach the app can compute
   without reading anything.** `intent-crosses-sources` fires when the philosophy
   slot is filled and any other filled slot has a different donor. It appears
   beside the rack, never in the prompt.

**Rejected: excluding `philosophy` from mixes entirely.** This was seriously
considered and it is the strongest rejected option in the ticket, because it
removes the failure mode completely. Rejected on two grounds. It would make
philosophy not a trait, since 001 defines a trait by being mixable, and that
reaches into 004's locked trait list on the strength of one constructed example.
And it throws away the most valuable thing in the library to avoid a problem that
is worst in the one case a user can see coming: 002 found the free-text traits
"varied in wording but were consistent in substance", making `philosophy` the most
stable and most substantive thing the agent produces. A mix with no intent is a
spec sheet. The advisory is the smaller instrument, and section 13 names the
choice as a judgement call.

**Rejected: rewriting the prose to fit.** Stripping colour words out of a
philosophy paragraph, or templating around them, is either a model call the app
cannot make or a regular expression pretending to understand English. The second
is worse than doing nothing, because it would silently damage the one paragraph
worth reading.

**Rejected: affinity constraints, such as forcing `palette` and
`surfaceTreatment` to come from the same Item.** There is a real argument for it:
004 merged corners, borders, elevation and texture into one trait precisely
because "brutalist square corners taken from A with soft iOS elevation from B and
film grain from C is exactly the mud 010 exists to prevent", and `finish` prose
routinely references the page colour. Rejected because 004 already merged the
things that had to be merged and deliberately left the rest separable, and
because a constraint that refuses a selection the user deliberately made, on a
guess, spends trust the app has no evidence to spend.

---

## 3. Mechanical, and the lock does almost all of the work

**Decided: the mixed prompt is assembled by template from the selected traits.
Nothing is synthesised, and this is forced rather than chosen.**

The map's first lock: "No AI runs inside the web app. The app is a pure reader of
a library that was written out-of-band. It makes no model calls, spawns no
subprocess, and has no asynchronous ingest, no job queue, and no waiting state."
A synthesis pass is a model call. There is nowhere in the app to put one, and the
lock explicitly forecloses the waiting state such a call would need.

Following it through honestly rather than stopping at the lock, because the
ticket asks whether synthesis would be better:

- **Synthesis in the producer CLI is technically available and destroys the
  gesture.** You would assemble a rack in the browser and then go to a terminal
  to render it, which breaks "the copy button is the only export surface" and
  turns a one-click action into a two-program workflow.
- **007 already rejected agent-written prompt text on three grounds that transfer
  without modification.** It would be a new field in a schema 004 closed; it would
  break Override, which the map makes the preferred correction mechanism, because
  a frozen string keeps asserting a corrected value; and 002 measured $0.05-0.13
  and 18-48 seconds per call, spent to freeze one sample of a process the same
  ticket proved non-idempotent. A mix multiplies the third cost, since a rack is
  edited far more often than an Item is captured.
- **The ticket's own warning is the decisive argument, and it points the same
  way.** Synthesis "can quietly invent a design you did not choose". Given
  section 2.2, that is exactly what it would do: handed a print-inflected
  philosophy and a near-black palette, a synthesiser's job is to reconcile them,
  and reconciling them means inventing a third design that neither Item contains
  and that you never selected. **The mechanical render leaves the tension
  visible, which is the honest artifact.** The reconciliation still happens, but
  it happens in the open, in the receiving model, under your own instruction.

**Where synthesis legitimately lives: your sentence above the paste.** 007's
whole voice decision is that the prompt is a brief that composes with your
instruction rather than competing with it. The human is the synthesiser, and that
is not a consolation prize.

---

## 4. A Mix is not a saved thing

**Decided: a Mix is transient. It is not stored, it has no schema, no id and no
name, and the URL is the only thing that persists it.**

006 decision 13 settles this and even names the outcome: the app writes zero
bytes to `library/`, "no Notes, no Overrides, no re-runs, no deletions, **no
saved Mixes**", and what it does write is "transient UI state (in-progress Mix
selection, filters, search text) in the URL and `localStorage`". Its collision
note spells out the alternative: "if a Mix must persist, the app still cannot be
what writes it. A saved Mix would be a separate unit under
`library/mixes/<id>.json`, written by the producer or by hand through the same
validator, and it would need its own schema. If 010 wants saved mixes it is
opening a writer question, not a UI one."

010 does not want them, for three reasons of its own on top of that one:

1. **A stored Mix would be the only entity in the library that the app cannot
   create.** You would assemble it in the browser and then run a CLI command to
   save it, which is an absurd sentence to write into a spec.
2. **The URL already is the save.** It is bookmarkable, pasteable into a note,
   survives a reload, restores the rack exactly, and costs nothing: no schema, no
   writer, no `library:check` rule, no migration, no deletion semantics.
3. **A stored Mix would be the first thing in the library that references another
   thing in it**, and the map parks "relationships between items" precisely
   because nothing has needed edges yet. Transience keeps that parked instead of
   pre-empting it.

**Nothing is persisted about a Mix, so there is nothing to hand 006.** This is the
handoff and it is subtraction: 006 needs no `Mix` record, no `library/mixes/`
directory and no reference integrity. That is now confirmed from 010's side rather
than assumed from 006's.

### What the URL must hold, at the level of behaviour

The parameter name and encoding belong to 011 and 012. The properties are 010's:

- **It holds `(trait, itemId)` pairs and never trait content.** So a Mix URL
  bookmarked last week renders today's Items: correct one swatch with an Override
  and every mix that draws on that Item improves, which is 007 decision 7's
  retroactive-improvement property inherited whole.
- **It is complete.** The rack is fully reconstructible from the URL alone, since
  that is what makes it the save.
- **It is canonical.** The same rack produces the same URL whatever order the
  slots were filled in, which matches the render property in section 7.

### What happens to a Mix when an Item is deleted

The map parks deletion and archival and says it "waits on 010 only", the open part
being "what a saved mix does when an item it drew from is gone". **010 answers it
by removing the question.** No Mix is stored, so no stored thing can dangle, and
deletion needs no cascade, no tombstone and no reference count.

The residue is a stale URL you bookmarked, and it needs a rule, so: **a Mix URL
naming an Item that no longer exists drops that slot and renders the rest.** It
does not refuse, because losing a working brief over one absent donor is worse
than losing one section, and it is not silent, because the UI says which slot
vanished. The prompt itself says nothing about it: a clipboard artifact must never
contain a sentence about the state of the library.

### Is a Mix itself mixable?

The question dissolves. A Mix is a map from trait to Item, so mixing two of them
is a map merge, and section 1 already says what happens to a contested slot. There
is no saved Mix to reach for and therefore no gesture to design. Dragging one
bookmarked mix URL onto another is not a feature anybody has asked for and it
would produce a rack you could have built by clicking.

---

## 5. The cap: seven by construction, an advisory at four, and never a refusal

The structural cap is seven, one Item per slot, and it needs no defending because
it falls out of section 1.

The ticket's real question is where it stops working, and it offers its own
guess: "Three sources is plausible. Eight is probably meaningless." Eight is now
unreachable. What is left is whether the app says anything between four and seven.

**Decided: an advisory at four or more distinct donors, and no refusal at any
number.**

- **A refusal is wrong at every threshold.** The selection is deliberate, the
  render is free, and the app has no evidence that four donors are worse than
  three. Refusing would be the app overruling a user on a guess.
- **Silence is also wrong**, because the failure is gradual and invisible: a
  five-donor brief still reads fluently, section by section, and only fails as a
  whole. That is exactly the kind of thing worth one line of text.
- **Four is a judgement call and section 13 names it.** The reasoning that
  survives scrutiny is thin but real: at three donors most of the seven slots
  share a source with some other slot, so the cross-references inside the prose
  mostly still land; at five, section 9's counterexample shows the brief
  describing five different designs in seven sections. What would settle it is
  rendering one fixed trait set sourced from one, two, three, five and seven
  Items and asking, of each, whether it still reads as one design. Two points on
  that curve exist in section 9 and they point the right way.

The advisory counts **distinct donors of readable slots**, not slots. Four traits
from two Items is not a committee, and a slot whose trait is Undetermined on its
donor contributes nothing to the prompt and so does not count as a source.

---

## 6. The selection gesture, at the level of behaviour

011 owns the pixels and is blocked on this ticket, so this section is a list of
things the UI must support, not a design.

**The gesture is a persistent rack of seven named slots, not a cart.** A cart is
an unbounded list of homogeneous things with no replacement rule, and the Mix is
a bounded set of seven distinguishable positions with a replacement rule on every
one of them. Naming it wrongly would design the wrong widget. **Rejected: a
compare view as the mixing surface**, because comparing two Items is a browsing
act that belongs to 009 and 011, and it offers no place to put the other five
slots.

What 011 must support:

1. **Selection happens where traits are legible**, which means the item detail
   view at minimum. A card in the grid may offer it, but a card cannot show seven
   traits, so the grid cannot be the only place. One action from where the trait
   is displayed adds it to the rack.
2. **The rack shows all seven slots, including the empty ones.** An empty slot is
   an offer, not an absence, and it is how you discover that composition is
   mixable at all.
3. **Filling a filled slot replaces the occupant, visibly.** The item that left is
   named, and the action is undoable. This is the entire user-facing surface of
   the conflict question, so it cannot be a silent swap.
4. **Only readable traits are offerable.** A trait whose `traitState` is
   `not_applicable` or `undetermined` on that Item contributes nothing to the
   prompt, so offering it produces a mix with an invisible hole. Showing it
   disabled with the reason is better than hiding it, because "this crop has no
   composition" is information.
5. **The rack lives in the URL** (section 4), so it survives reload, is
   bookmarkable, and needs no save button. There is no other persistence, and
   there is no mix library.
6. **One copy action, on the rack**, producing `renderMix`. There is no per-slot
   copy: a single trait from a single Item is 007's subset prompt and belongs to
   that Item's own surface.
7. **The rack surface shows the rendered text before it is copied.** This is a
   requirement rather than a suggestion, and it is the one place 010 pushes into
   011's territory on purpose. A single Item's prompt is predictable from looking
   at the Item. **A mix is assembled, so its text is the first place the seams
   become visible**, and section 2.2's contradictions are things you can only
   catch by reading. Copying blind would hide the ticket's central failure mode
   behind a button.
8. **Advisories from `mixAdvisories` appear beside the rack, never in the
   prompt.** Five kinds, all with default English in the module: `empty`,
   `duplicate-trait`, `unreadable-trait`, `intent-crosses-sources`,
   `many-sources`.
9. **A stale URL degrades**: missing Items drop their slots and are named.
10. **Clearing is per-slot and all-at-once.** A rack you cannot empty in one
    action is a rack you stop using.

Optional and permitted, not required: a "take everything from this item"
shortcut, which is seven replacements in one gesture and renders as 007's subset
prompt (section 7); and drag as an additional way to fill a slot, which must not
be the only one, since drag-only excludes the keyboard.

---

## 7. The render, and the seam with 007

`renderMix(parts)` in [`010-mix-render.ts`](010-mix-render.ts) takes the selection
list, normalises it into the rack, and returns one string.

**Every trait section comes from 007.** The function calls
`renderPrompt(item, { traits: [trait], includeNote: false, includeSource: false })`
once per slot and lifts the section out of the returned block list. So the palette
hedges per swatch, an Undetermined leaf is silent, a Not applicable trait
vanishes, and every enum member renders as the English 004 defined it with,
because **none of that logic exists in this file to be got wrong**. 007 decision 8
said partial prompts are the same code path, not a second template; this is that
sentence cashed rather than repeated.

**The seam is a string operation and it is the ugliest thing in this ticket.** It
depends on one property of 007's output: blocks are joined with a blank line and
no single block contains one, so a one-trait render with no Note and no Source is
exactly two blocks, frame then section. The better shape is that **007 exports
`renderTraitSection(item, trait)` and its `TRAIT_ENGLISH` map, and this seam
becomes a function call**. That is a change to a closed ticket's artifact, so it
is recommended here and not made. The third option, duplicating 007's seven
section renderers, is the one thing this ticket must not do: a mixed palette that
hedges differently from a single palette is precisely the drift 007 decision 8
refused.

Two small duplications survive and are marked in the module: the seven-entry
`TRAIT_ENGLISH` map and a three-line list joiner, both copied verbatim so the two
files cannot describe the same trait in two ways. Recovering the trait names by
regular expression from 007's rendered frame was considered and is worse than
duplicating them.

### What the mix adds on top of the borrowed sections

- **A frame** that says the brief is assembled rather than read off one design,
  names the traits it covers, carries the one imperative, and adds "The rest is
  yours to choose" only when the covered set is a strict subset of the seven.
- **The intent label** (section 2.2).
- **A provenance block** naming every distinct Source once, in first-appearance
  order, with 007's anti-pastiche clause widened to all of them. **Capture dates
  are dropped**: one date is grounding, three dates are a changelog, and the thing
  worth tracing a mix back to is the mix URL. A local path is never rendered, for
  007's reasons.
- **Nothing else.** No Note, because 001's hand-off to 007 says a mix never
  carries one, "since your reason for saving item A says nothing about the traits
  taken from B and C". No labels, which are never mixed. No Scope, which is
  discussed under costs.

### Section order, and the one departure from 007

Canonical order is 007's `PROMPT_TRAIT_ORDER` with `philosophy` moved from first
to last: palette, typography, composition, spacing, surface treatment, imagery,
intent. Selection order is ignored, so **the same rack renders byte-identical
whatever order the slots were filled in**, which is 007's property inherited and
extended across Items.

**Rejected: grouping the sections by donor** ("from one design: palette and type;
from another: composition"). It makes the seams explicit, which is honest, and it
loses on three counts: it reintroduces per-section attribution, which the next
paragraph rejects on its own merits; it invites the receiving model to treat the
groups as alternatives or as three separate things to build; and it turns the
artifact into a table of contents of your library rather than a brief.

**Rejected: naming the source Item inline in each section.** 007 put the URL last
and defused it in the same breath, because "a model that recognises the site
answers from memory of the site and the whole extraction apparatus becomes
ornamental". A mix multiplies that risk rather than dividing it: three URLs
scattered through the body is three invitations to rebuild a site from memory,
each one adjacent to the traits it would overwrite.

### A Mix of one is exactly 007's prompt

When every readable slot has the same donor, `renderMix` delegates to
`renderPrompt(item, { traits, includeNote: false })` and returns its output
unchanged. Verified byte-for-byte. This is not a convenience:

- The mixed frame would otherwise **assert something false**, namely that a brief
  read off one design was assembled from several.
- 007's frame carries Scope correctly when there is exactly one design, and no
  frame can carry it when there are several.
- It means a user who fills the rack from a single Item gets that Item's brief,
  which is the only non-surprising outcome.

The Note stays suppressed at every size, including this one, because 001's rule is
unconditional. The visible consequence is that the mix surface and the item's own
copy button can produce nearly the same text differing by the Note block, and that
is the right seam: the copy button on an Item is that Item's brief, and the rack is
where you make something that is not any Item.

---

## 8. The Items behind the worked examples

Five constructed Items, each validated with 004's `Item.parse()` before any render
so that no branch could be exercised with an Item that could not exist. **Item A
is byte-for-byte the one 007 published**, which is deliberate: it makes section 9's
comparison between a mixed prompt and a single-source prompt a comparison over the
same data rather than over two different examples.

| | A | B | C | D | E |
| --- | --- | --- | --- | --- | --- |
| what | warm print-inflected pricing page | dark technical console | a card, cropped | neo-brutalist page | swiss-modernist section |
| source | `meridian.build/pricing` | `halyard.sh` | a file, no url | `strike.press/about` | `kessler-atelier.ch` |
| scope | page | page | component | page | section |
| palette | warm paper, burnt red accent | near-black, signal green | indigo gradient, violet accent **overridden** | bone, yellow, hard red | white, one red |
| type | unnamed display serif plus Inter | Berkeley Mono throughout | **Undetermined**, no glyphs read | condensed grotesque, huge | Helvetica Now |
| space | airy | dense | balanced | dense | airy |
| surfaces | slight corners, hairlines, flat | sharp, hairlines, flat | rounded, no borders, pronounced | sharp, heavy borders, flat | sharp, no borders, flat |
| notable | 007's Item, has a Note | the opposite of A on every axis | `composition` **Not applicable**, one `override` swatch | | |

A is quoted in full in
[`007-prompt-candidates.md`](007-prompt-candidates.md) section 1. B, C, D and E
were written for this ticket in the same way and against the same schema.

---

## 9. The worked mixes, and whether the output is worse

### 9.1 The main mix: three donors, all seven slots

The rack, and it is a plausible thing to want: **the editorial type, layout and
restraint of A, on the dark dense canvas of B, with C's soft material.**

| slot | donor |
| --- | --- |
| palette | B, the dark console |
| typography | A, the editorial page |
| composition | A |
| spacing | B |
| surface treatment | C, the card |
| imagery | A |
| intent | A |

Rendered by `renderMix`, pasted from the run:

```text
Design brief, assembled from several designs rather than read off one. It covers the colour system, the type system, the composition, the spacing, the surface treatment, the imagery and the design intent. These parts were chosen separately and were never seen together, so work them into one coherent design rather than reproducing any of the sources.

Palette
- Background, around #0b0d10, carrying most of the visible area
- Surface, around #14181d, a substantial secondary share
- Ink, around #d7dde3, a substantial secondary share
- Muted, around #5b6672, small deliberate moments only
- Accent, around #3ddc84, small deliberate moments only

Type
- Headings: High-contrast serif at display size, tight leading, generous tracking on the small-caps kicker above each band.
- Body: Inter. Neutral grotesque, comfortable leading, set at one size for everything except the tier prices.
- A dramatic size range between the largest and smallest text, carried by two weights working as a pair.
The heading face is not named; match the character rather than hunting for the name.

Composition
A single centred column with a full-width three-card pricing row breaking out of it, and a thin rule closing each band. Content sits in a contained measure rather than running the full width.

Space
Dense overall. A single small unit repeated everywhere, no section breaks, information packed to the edges.

Surfaces
Clearly rounded corners, no borders, pronounced elevation. A soft violet-to-indigo gradient across the fill with a lighter hairline inner edge catching the top.

Imagery
No imagery. The type and the hairlines do all the work.

Intent, taken from one of the sources and describing that whole design
The page reads as a printed prospectus rather than a web app: one warm paper field, one serif voice carrying every claim, and a single burnt red that appears exactly four times. Hierarchy is done entirely with size and space, never with boxes or colour, so the three pricing tiers feel like a table in a book rather than a control panel. The restraint is the argument: nothing on the page is asking to be clicked except the one thing that is.

Assembled from https://halyard.sh, https://meridian.build/pricing and an image supplied by hand. Provenance only: work from the description above rather than from memory of any of these designs.
```

2,342 characters. One advisory fires: `intent-crosses-sources`.

**What works.** The first six sections read as one design language and they are a
design I can picture: dark, dense, set in a display serif over Inter, with soft
gradient cards. Nothing in them is mud. The palette is coherent because it came
whole; the type is coherent because it came whole; the fact that they came from
different places is invisible and does no harm, which is the whole premise of the
feature and it holds.

**What breaks, and it is one block.** The intent paragraph describes "one warm
paper field" and "a single burnt red" in a brief whose palette is near-black with
a green accent. The label and the position stop it from framing the sections above
it, and they do not stop it being false. A reader reaches the last paragraph and
finds a description of a different design.

**And a second, quieter one that the label does not cover.** The Imagery section
says "the type and the hairlines do all the work" while the Surfaces section says
"no borders". `imagery.treatment` is a prose leaf reaching outside its trait, which
is exactly section 2.2's defect in a trait nobody would have suspected. This one
was not designed for and was found by reading the output.

### 9.2 The same rack with the intent slot emptied

```text
Design brief, assembled from several designs rather than read off one. It covers the colour system, the type system, the composition, the spacing, the surface treatment and the imagery. These parts were chosen separately and were never seen together, so work them into one coherent design rather than reproducing any of the sources. The rest is yours to choose.
```

followed by the same six sections and the same provenance block. 1,837 characters,
no advisories. **This is a good brief.** It is the best evidence in the ticket that
the mixing model works, and it is also the evidence that the intent slot is where
the risk is concentrated.

### 9.3 The counterexample: five donors, seven slots

Palette from D, type from E, composition from A, spacing from E, surfaces from C,
imagery from D, intent from B. 2,274 characters, and both advisories fire.

```text
Palette
- Background, around #f2f0e9, carrying most of the visible area
- Surface, around #ffe94a, a substantial secondary share
- Ink, around #000000, a substantial secondary share
- Muted, around #6b6b6b, small deliberate moments only
- Accent, around #ff3b1f, small deliberate moments only

Type
- Headings: Helvetica Now. Neo-grotesque, tight tracking, set flush left and ragged right at two sizes only.
- Body: Helvetica Now. The same face at reading size, generous leading, no italics anywhere.
- A moderate size range between the largest and smallest text, carried by two weights working as a pair.

Composition
A single centred column with a full-width three-card pricing row breaking out of it, and a thin rule closing each band. Content sits in a contained measure rather than running the full width.

Space
Airy overall. One baseline unit doubled and quadrupled, nothing between the steps.

Surfaces
Clearly rounded corners, no borders, pronounced elevation. A soft violet-to-indigo gradient across the fill with a lighter hairline inner edge catching the top.

Imagery
Photography. High-contrast black and white cutouts, dropped in at angles and cropped through.

Intent, taken from one of the sources and describing that whole design
This is an instrument panel rather than a page. Everything is one monospace at one size on near-black, and hierarchy is carried entirely by rules, alignment and a single signal green that means the system is alive. [...]
```

Every section is internally coherent and no two agree. Brutalist yellow and hard
red, under Swiss Helvetica at moderate scale, in a centred pricing-page column,
airy, with soft rounded gradient cards, angled black and white photography, and a
closing paragraph about a dark monospace instrument panel. Nothing here is a bug.
**The renderer did its job perfectly and the output is worthless**, which is the
point of including it: the failure at five donors is not a rendering failure and
no rendering rule would catch it.

### 9.4 The honest verdict the ticket asked for

The ticket says: if the mixed output is worse than a single-source prompt, record
it rather than hide it. Compared against 007's published prompt for Item A, at
2,116 characters:

- **The mixed prompt without the intent slot (9.2) is not worse.** It is shorter,
  it loses the intent paragraph and the Note, and what remains is as coherent as
  A's own brief because every section arrived whole. The claim 007 left open, that
  several subset renders compose into one Mix, holds.
- **The mixed prompt with the intent slot (9.1) is worse.** Not in every section,
  but in the one that carries the most meaning, and a brief containing one false
  paragraph is worse than a brief containing none. **A single-source prompt cannot
  contradict itself and a mixed one can.** That is a real cost of the feature and
  it is not fully mitigated, only labelled.
- **The five-donor mix (9.3) is much worse than any of its five sources**, and
  nothing in the model prevents it. The advisory is the whole defence.
- **Length is not the axis it looked like.** The mixed prompt is longer than the
  single one (2,342 against 2,116) despite carrying no Note, because the frame is
  three sentences and the intent label adds a line. 007's structural rule that
  silence tracks what was read still governs, so a mix of thin Items is short.

**The rule this suggests, stated as a falsifiable prediction rather than a
decision:** a Mix is at its best carrying traits that are cheap to describe in
isolation (palette, surfaces, type) and at its worst carrying traits whose prose
describes the design as a whole (philosophy first, then imagery treatment and
surface finish). If that holds under real extractions, the right response is
better extraction prompts telling the agent to keep each trait inside its own
trait, which is the map's parked tuning loop, and not a change to this model.

---

## 10. Costs accepted knowingly

- **Scope is not carried in a multi-donor mix.** 007's frame names it because a
  single Item has one; a Mix has one per donor. So a palette read off a cropped
  card is presented exactly like a palette read off a whole page, and the reader
  cannot tell. The alternative was per-section annotation, which section 7
  rejects for stronger reasons. A component-scoped Item remains, as 001 put it,
  "a pure trait donor".
- **The frame changes shape when a second donor is added**, from 007's subset
  frame to the mixed one. It is correct at both ends and it is a visible jump.
- **Attribution is not recoverable from the artifact.** The prompt names the
  sources but not which trait came from which, so you cannot tell from a pasted
  mix where the type came from. The mix URL can, and the rack shows it. Naming
  them inline costs more than it buys (section 7).
- **The seam with 007 is string surgery**, and it will break if 007's block
  joining ever changes. The fix is named and is a two-line change to 007.
- **`intent-crosses-sources` will fire on most multi-donor mixes that include the
  intent slot.** An advisory that is usually on is close to no advisory. It is
  kept because it is true, because the alternative thresholds are all arbitrary,
  and because the honest thing to tell a user about that paragraph is exactly
  what it says.

---

## 11. What was verified, by running it

A throwaway driver in the system temp scratchpad, outside the repo, built the five
Items of section 8, validated each with `Item.parse()`, and exercised
`renderMix`, `mixRack` and `mixAdvisories`. Typechecked with `tsc` under `strict`
and `noUncheckedIndexedAccess`, run under `tsx` on Node 22.14.0 against zod 4.4.3.
**42 checks, all passing.**

| branch | result |
| --- | --- |
| three donors, seven slots | 2,342 characters, section 9.1 |
| two donors, three slots | 1,409 characters, no advisories |
| five donors, seven slots | 2,274 characters, both advisories |
| a Mix of one donor | byte-identical to `renderPrompt(item, { traits, includeNote: false })` |
| a Mix of one carries no Note | confirmed |
| two Items selected for one trait | one slot, the later wins, one `Palette` section rendered |
| the displaced Item | reported by `mixRack` and by a `duplicate-trait` advisory |
| reversed selection order | byte-identical |
| a third interleaved click order | byte-identical |
| purity | two calls on one rack produce identical strings |
| a Not applicable slot (`composition` on a component) | silent, `unreadable-trait` advisory with state `not_applicable` |
| an Undetermined slot (`typography` with no glyphs read) | silent, absent from the frame's trait list, advisory with state `undetermined` |
| `imagery.kind: none` | renders, because 004 section 5.1 makes it content rather than absence |
| every slot unreadable | "This mix has nothing readable to say about the type system and the composition." |
| an empty rack | "Nothing is selected for this mix.", plus an `empty` advisory |
| an `override` swatch inside a mix | `#7c5cff` bare, its four siblings hedged with "around" |
| provenance | each distinct source once, a file source as "an image supplied by hand" |
| no local path, no capture date in a mixed provenance line | confirmed |
| the frame | "assembled from several designs", and "The rest is yours to choose" only on a strict subset |
| the intent paragraph | labelled, and positioned after the imagery section |
| `intent-crosses-sources` | fires across donors, silent when the intent donor is the only donor |
| `many-sources` | fires at four donors, silent at three, ignores unreadable slots |
| a stale rack missing one Item | renders, losing only that section |
| house style | no em dash and no en dash in any render |
| stack-agnosticism | no technology noun in any render |
| labels | no label value reaches any render |

## 12. What was not verified

- **No mixed prompt has been pasted into a fresh session.** 007 left the same gap
  and this ticket does not close it. Every claim about how a receiving model
  handles the contradiction in section 9.1, and about whether the frame's "never
  seen together" clause does any work at all, is an argument. **What would settle
  it:** the 9.1 mix and the 9.2 mix pasted under one fixed instruction into two
  fresh sessions, and the question of whether the first result looks warmer than
  the second. That is a two-hour experiment and it is the single most valuable
  unrun thing on this ticket.
- **The four-donor threshold is a guess** with two supporting data points, both
  constructed by me.
- **Nothing has been rendered from a real extraction.** Real agent prose may
  over-reach more than my constructed prose does, or less. Section 2.2's finding
  is the one most likely to change magnitude under real data, and it can only
  get worse, since I wrote these paragraphs knowing they would be mixed.
- **No UI exists**, so every claim in section 6 about what a rack feels like is
  untested. The replacement gesture in particular is asserted to be natural and
  has never been clicked.
- **The URL encoding is specified as properties, not as a format**, and no URL has
  been round-tripped.
- **The seam with 007 is verified against 007 as it stands today** and is not
  protected by anything but this note and a comment.

---

## 13. The judgement calls, named

Everything above is either derived from a locked decision, forced by a lock, or
one of these five. A reviewer who wants to disagree efficiently should start here.

1. **Keeping `philosophy` mixable, with a label and a demotion, rather than
   excluding it from mixes.** The strongest call in the ticket and the one my own
   worked example argues against. Section 2.2 states both sides.
2. **Demoting the intent paragraph to last.** Defensible either way: first is
   where the most substantive prose belongs, last is where a block that speaks for
   another design belongs.
3. **The four-donor advisory threshold**, and the decision that it is an advisory
   and never a refusal.
4. **Dropping capture dates and Scope from a mixed prompt.** Both are real
   information and both were cut for length and for the multiplication problem.
5. **Requiring 011 to show the rendered text before copying.** This is 010
   reaching into 011's surface inventory, justified by the mix being the one
   artifact in the app whose content cannot be predicted from what you clicked.
