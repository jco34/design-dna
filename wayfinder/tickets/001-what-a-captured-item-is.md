---
id: 001
title: What a captured item is
label: wayfinder:grilling
status: closed
assignee: jeb
blocked-by: none
parent: map
---

## Question

What is the unit of storage in this library, and what is its identity?

The brief pulls in two directions at once. "All the web design and UI elements
that I like" reads element-level (a palette, a type pairing, a nav bar, a card
treatment). "Store screenshots, URLs and pictures" reads source-level (one
website, one image). Mixing and matching "several design elements from different
resources" only means something once this is settled.

Resolve at least:

- Is the stored thing a **source** (a URL, an uploaded image) that carries one
  design analysis, or an **element** (a palette, a type system, a motion
  approach) that a source yields several of?
- If both exist, which one is the thing you browse, search, and drop into a
  mix? Which one does a grid card represent?
- Can one source yield several items? A long landing page has a hero, a
  pricing table, and a footer that may not share a design approach at all.
- What is item identity? Two screenshots of the same site: one item or two?
  The same URL captured a year apart, after a redesign?
- Are items ever partial? A screenshot cropped to just a button is an element
  with no philosophy behind it, but it is exactly the kind of thing worth
  saving.

Deliverable: the resolved terms written into a new `CONTEXT.md` at the repo
root, per the `domain-modeling` skill. This ticket creates that glossary, which
is why the map has none yet.

This is the deepest ticket on the map. Almost everything downstream inherits
its answer.

## Resolution

The unit of storage is the **Item**: one source, one capture, one DNA. Elements
are not stored at all; the mixable unit is a **trait** of an item's DNA. The
glossary is now at [`CONTEXT.md`](../../CONTEXT.md), and the root decision is
recorded as
[ADR 0001](../../docs/adr/0001-item-as-the-unit-of-storage.md), which is the
only decision here that warranted one. No assets were produced; this was
resolved by discussion.

### What was decided

1. **Source, not element, and the human chooses scope.** One thing saved is one
   item with one analysis. A long landing page whose hero, pricing table and
   footer share no design approach is not one item that the agent takes apart;
   it is three items, because you framed it three times. Element-level mixing
   comes from traits, which are fields of an analysis rather than entities.

2. **One capture per item.** One source, one capture, one DNA is the invariant
   the rest of the map is built on. Three screenshots of one site are three
   items, related only by their shared source. Anything cropped or downscaled to
   make a card is a rendition of the capture, derived and reproducible, and
   therefore not a domain concept. Adding a second angle to an existing item is
   not supported; it is a new item.

3. **Vocabulary.** Item, Source, Capture, Scope, DNA, Trait, Label, Note,
   Not applicable, Undetermined, Override, Mix, Prompt. **Element** is retired
   under `_Avoid_`, because it meant three different things in this project (the
   brief's design elements, the per-element entity rejected above, and DOM
   elements) and every future sentence containing it would have been ambiguous.
   Item and Capture are split so that ticket 003's existing usage ("the capture
   and the live site diverge") stays unambiguous.

4. **Identity is the act of saving.** An item gets an opaque id when you save
   it, and nothing about the source or the capture bytes contributes to it. The
   same address is not a unique key, there is no upsert on it, and saving the
   same page twice is permitted. The same address captured after a redesign is a
   new item and a sibling, not a version or a successor: an identity rule that
   treated it as an update would destroy the older capture, which by then is the
   only surviving record of a design that no longer exists. Because the capture
   is stored, an item outlives its source, and a dead address costs nothing.

5. **Scope is recorded on every item and is agent-inferred,** not entered by
   hand, since telling a cropped button from a landing page is easy for the
   agent and asking at ingest time taxes the most common action in the app. Its
   vocabulary belongs to ticket 005, but the concept belongs here, because scope
   is structural rather than merely filterable: it determines which traits an
   item can have.

6. **Two empty-trait states, kept distinct in storage.** *Not applicable* means
   the scope excludes the trait and nothing is missing. *Undetermined* means the
   agent looked and could not tell, and is what a re-run or an override targets.
   Collapsing both into `null` loses information that cannot be recovered later.
   Item-level `pending` and `failed` are a separate axis and belong to 008.

7. **A trait is defined by being mixable.** Design content read off the capture
   and worth transplanting alone. That splits an item's fields four ways: traits
   (mixable), labels (for finding, never mixed, because a label is a compressed
   restatement of trait content and mixing one either duplicates a trait you
   also took or contradicts one you did not), the note (yours, not extracted),
   and provenance (fact, not design). **Traits are atomic:** a palette is taken
   whole, and sub-trait selection is refused, because a palette is coherent
   through the relationships between its colours and one value pulled out of it
   carries none of that.

8. **One current DNA per item, never shared between items,** and **every trait
   and label value records whether the agent wrote it or you did.** A
   human-written value is an **Override**. That single bit is all this ticket
   settles: how an override is made, whether a re-run respects one, and what the
   correction UI looks like all stay parked in the map's "Not yet specified". It
   is settled here because without it the first re-run of the agent silently
   destroys every correction ever made, with nothing in the data to show that it
   happened, and the distinction cannot be retrofitted once the library holds
   real items.

9. **URL items are whole-capture scope in v1.** Human-chosen scope works for
   uploads, where you crop before the app ever sees the file. It does not work
   for a web address, where the app does the capturing. Rather than add a crop
   step to the ingest path (which taxes every URL ingest to serve the minority
   case) or crop-any-item-later (which is the right long-term answer but forces
   open the parked item-relationship question), v1 has no crop affordance: to
   keep a section on its own, screenshot it yourself and upload it.

### Costs accepted knowingly

- **No grouping for sibling crops.** Three crops of one site are three items
  with nothing but a matching source between them. Deliberate: the map parks
  relationships between items, and inventing grouping here would pre-empt it.
- **Scope is only fully human-chosen for uploads.** This is the first asymmetry
  between the two source kinds, and it means a narrowly scoped item usually
  arrives as a file with no address, so provenance is systematically thinner on
  exactly the items that make the best mix ingredients.
- **Nothing prevents near-duplicate accumulation.** A hash of the capture bytes
  is worth having as an advisory "you may already have this" signal, but it is
  not identity, and whether that warning exists stays in "Not yet specified".

### What this hands downstream

- **003:** a rendition of a capture is not a domain concept. If capture research
  concludes that a viewport shot is genuinely a different artifact rather than a
  crop of the full-page shot, that reopens decision 2 explicitly rather than
  being pre-permitted by it.
- **004:** every candidate field must be classified as trait, label, or neither,
  and justified as such. Nullability has three cases to type, not one:
  applicable-and-present, not applicable, undetermined.
- **005:** *Label* is the umbrella term and is deliberately left undivided, so
  the taxonomy is free to distinguish closed categories from free tags beneath
  it. Scope needs a value list. Agent-set and human-set values must stay
  distinguishable, which decision 8 already commits to.
- **006:** identity is a surrogate assigned at save time; the capture is
  immutable once ingested; the DNA is mutable and identity does not track it, so
  versioning versus overwriting is a free choice; the agent-or-override bit must
  survive whichever is picked.
- **007:** the note may be rendered into a single-item prompt, but a mix never
  carries notes, since your reason for saving item A says nothing about the
  traits taken from B and C.
- **010:** the selectable unit is a trait, traits are atomic, and a narrowly
  scoped item is a pure trait donor with nothing to conflict.
- **011:** a card is exactly one item.
