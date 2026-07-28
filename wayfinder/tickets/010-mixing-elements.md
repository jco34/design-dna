---
id: 010
title: Mixing elements from several items
label: wayfinder:grilling
status: closed
assignee: jeb
blocked-by: 001, 007
parent: map
---

## Question

How does taking this palette, that typography, and this other one's layout
approach turn into a single coherent prompt?

This is the most ambitious thing in the brief and the easiest to get wrong.
Naive concatenation produces an incoherent brief: two palettes, two type
systems, and contradictory philosophies pasted together give you mud, not a
design.

Resolve:

- **What is selectable?** Whole items, or named parts of an item (its palette,
  its typography, its motion)? Part-level selection is what "mix and match
  design elements" asks for and depends entirely on 001's answer.
- **The selection gesture.** A cart you add to while browsing, a persistent
  board you drag onto, a multi-select in the grid, a compare view. Prototype
  this if talking about it stalls.
- **Conflict resolution.** Two selected palettes: does one win, do they merge
  into a primary and accent split, or is it refused? Two philosophies that
  genuinely contradict, like dense-editorial and airy-minimal: does the app
  point out the conflict, pick, or hand the mess to the model and hope?
- **Mechanical or synthesized?** Is the mixed prompt assembled by template
  from the selected parts, or does the agent re-synthesize a coherent brief
  from them? Synthesis produces a better prompt and costs another agent round
  trip, and it can quietly invent a design you did not choose.
- **Is a mix a saved thing?** A first-class saved entity with a name you can
  return to, or a transient clipboard operation? If saved, it references items,
  which is what makes deletion a real question (see "Not yet specified"). If
  saved, is a mix itself mixable?
- **How many parts before it stops working?** Three sources is plausible.
  Eight is probably meaningless. Is there a cap, or a warning?

Deliverable: the mixing model, its terms in `CONTEXT.md`, and at least one
hand-built mixed prompt tested the way 007 tested single prompts. If the mixed
output is worse than a single-source prompt, that is a finding worth recording
rather than hiding.

## Resolution

**A Mix is a partial map from Trait to Item: seven named slots, each empty or
holding exactly one Item, so two selected palettes is a state that cannot be
constructed rather than a conflict that gets resolved. It is transient, held only
in the URL, and its prompt is assembled mechanically by calling 007's
`renderPrompt` once per slot, because the map forbids any model call in the app.**
The mixing model, the conflict argument and the rejected alternatives are in
[`../assets/010-mixing-model.md`](../assets/010-mixing-model.md); the render
function is [`../assets/010-mix-render.ts`](../assets/010-mix-render.ts), built on
007's exported render rather than duplicating it.

### What was decided

1. **The selectable unit is the pair (Item, Trait), and a Mix holds at most one
   Item per trait.** This is 001 decision 7 applied rather than a new choice: a
   trait is atomic and taken whole, so the same-trait conflict the ticket asks
   about is unrepresentable. Two palettes cannot coexist; selecting a second puts
   it in the slot and turns the first out, which is what the click asked for. The
   primary/accent merge the ticket offers is **sub-trait selection in disguise**
   (four roles from A, one from B) and is refused by the same locked decision.

2. **Conflict splits in two, and only one half is the app's to see.** Same-trait
   conflict is impossible (decision 1). Cross-trait contradiction is real and
   lives in the **prose**, not the traits: a `philosophy` paragraph describing
   "one warm paper field" sitting above a near-black palette is a false statement
   about the briefed design. The app cannot detect it, because reading it is a
   model task and the map locks that no AI runs in the app. So the app does the
   three things it can: the **frame states the parts were never seen together**,
   the **intent paragraph is labelled and demoted to last** (007 decision 9's fix
   reused), and one advisory (`intent-crosses-sources`) fires beside the rack.

3. **Mechanical, not synthesized, and forced rather than chosen.** The map's first
   lock forecloses a model call in the app. Followed through honestly: synthesis
   would do exactly what the ticket warns of, "quietly invent a design you did not
   choose", since reconciling a print philosophy with a dark palette means
   inventing a third design neither Item holds. 007's three rejections of stored
   prompt text (new field in a closed schema, breaks Override, costs a non-
   idempotent round trip) all transfer. **The human is the synthesizer**, in the
   sentence above the paste, which is what 007's brief voice was built to compose
   with.

4. **A Mix is not saved.** 006 decision 13 already writes "no saved Mixes" and
   parks any persisted Mix as a producer/hand-written unit needing its own schema.
   010 does not want one: the **URL is the save** (bookmarkable, holds
   `(trait, itemId)` pairs and never trait content, so it inherits 007's
   retroactive-improvement property), a stored Mix would be the only entity the
   app cannot create, and it would be the first item-to-item reference, which the
   map parks. **This removes the deletion question the map said "waits on 010":**
   nothing stored can dangle; a stale URL drops the missing slot, names it, and
   renders the rest.

5. **The cap is seven by construction; an advisory fires at four or more distinct
   donors; there is never a refusal.** One Item per slot makes eight unreachable.
   A refusal would overrule a deliberate selection on no evidence and silence
   would hide a gradual failure, so the middle path is one honest line. Four is a
   named judgement call.

6. **The render is 007's, section by section.** `renderMix` calls
   `renderPrompt(item, { traits: [trait] })` per slot and lifts out the section,
   so per-swatch hedging, silent Undetermined leaves, vanished Not applicable
   traits and enum-English all come from 007 and cannot drift. **A Mix of one
   donor is byte-identical to 007's subset prompt** (verified), because a mixed
   frame would otherwise assert a brief was assembled when it was read off one
   design. The seam is a string split on 007's block joining and its fragility is
   flagged; the clean fix is 007 exporting `renderTraitSection`, recommended not
   made.

### The finding the ticket asked for, stated honestly

The worked three-donor mix (model note section 9.1) is rendered in full. Compared
to a single-source prompt: the six-section version **without** the intent slot is
**not worse** than 007's single prompt, since every trait arrived whole and stayed
coherent, which confirms 007's open claim that subset renders compose. The version
**with** the intent slot **is worse**, because the intent paragraph is flatly false
about the mixed design and a brief with one false paragraph beats none only in the
wrong direction. The label and demotion contain it; they do not fix it. **A
single-source prompt cannot contradict itself and a mixed one can, and that is a
real, only-partly-mitigated cost of the feature.** The five-donor counterexample
(9.3) renders perfectly and is worthless, which is why the advisory exists.

### Costs accepted knowingly

- **Scope is dropped from a multi-donor mix**: a palette off a cropped card is
  presented like a palette off a whole page. Per-section annotation was the
  alternative and loses on stronger grounds (it invites site-memory pastiche).
- **Attribution is not in the artifact**, only in the URL and the rack.
- **`intent-crosses-sources` fires on most multi-donor mixes with an intent
  slot**, so it is close to always-on; kept because it is true and the
  alternatives are arbitrary.
- **The 007 seam is string surgery** and breaks if 007's joining changes.

### What was verified, by running it

A throwaway driver in the system temp scratchpad built five schema-valid Items
(A is 007's published Item byte-for-byte), validated each with `Item.parse()`, and
ran `renderMix`, `mixRack` and `mixAdvisories` through **42 checks, all passing**:
slot exclusivity and last-wins, order-independent byte-identical output, purity, a
Mix of one equal to 007's subset render, silent Not applicable and Undetermined
slots, `imagery.kind: none` rendering as content, an override swatch bare beside
four hedged siblings, provenance naming each source once with no path or date
leak, the frame and intent label, all five advisories, a stale rack dropping one
slot, and no em dash, en dash, technology noun or label in any output. Typechecked
under `strict` and `noUncheckedIndexedAccess`, `tsx` on Node 22.14.0, zod 4.4.3.

### What was not verified

- **No mixed prompt was pasted into a fresh session.** 007 left the same gap.
  Every claim about how a receiving model handles the 9.1 contradiction is an
  argument. The settling experiment is the 9.1 and 9.2 mixes under one instruction
  in two fresh sessions.
- **The four-donor threshold is a guess** with two constructed data points.
- **Nothing rendered from a real extraction**; real prose may over-reach more than
  mine, and section 2.2's finding can only worsen under real data.
- **No UI exists**, so section 6's rack behaviour is untested, and no URL has been
  round-tripped.
