---
id: 007
title: What copying the prompt actually produces
label: wayfinder:prototype
status: closed
assignee: jeb
blocked-by: 004
parent: map
---

## Question

What exact text lands on the clipboard, and does it work?

This is the payoff of the whole app: everything else exists to make this
string good. It is also the one thing that cannot be settled by discussion,
because the only real test is pasting it into Claude in a fresh project and
seeing whether what comes back looks like the design you saved.

Prototype the artifact, do not just specify it. Write three or four candidate
prompts by hand from one real captured design, paste each into a fresh session,
and compare what gets built.

Settle:

- **Form.** A prose paragraph, structured markdown with headings, a token
  block (hex values, font stacks, a spacing scale), or prose plus tokens.
  Prose carries intent, tokens carry precision, and the wrong ratio produces
  either a vague pastiche or a rigid colour-by-numbers.
- **Voice.** Is the prompt written as instructions to an AI ("build a landing
  page using..."), or as a design brief that happens to be pasteable? Does it
  assume a stack, or stay stack-agnostic as the prompt-only decision implies?
- **How much is too much.** Does naming twelve attributes produce a better
  result than naming five, or does the model drown? Test this rather than
  assuming.
- **Provenance.** Does the prompt name the source site? Useful grounding if
  the model knows the site, and a bias toward copying it if it does.
- **Generated when?** Rendered on demand from the stored analysis, or
  generated once by the agent at capture time and stored? On-demand means
  improving the template retroactively improves every item, which is a strong
  argument. Agent-written at capture time may read better. This one interacts
  with 006.
- **Is it one prompt or several?** A full-page prompt, a palette-only prompt,
  a typography-only prompt. Element-level extraction (001) makes partial
  prompts natural.

Deliverable: the candidate prompts and the pasted results under
`wayfinder/assets/007-*`, and the chosen template linked from the resolution.

## Resolution

**The clipboard gets a design brief, never an instruction: one template rendered
on demand from the stored Item and from nothing else, structured as labelled
sections of English clauses, hedging every eyeballed hex per value, naming the
Source only in a trailing line, and parameterised by a trait subset so that 010's
partial prompts are the same code path.** Candidates in
[`../assets/007-prompt-candidates.md`](../assets/007-prompt-candidates.md),
chosen template in
[`../assets/007-prompt-template.ts`](../assets/007-prompt-template.ts).

### What was decided

1. **Voice: a brief that happens to be pasteable, with exactly one imperative,
   and it is about the block rather than about what to build.** Four arguments,
   and the last was the surprise. The prompt's whole life is being pasted
   somewhere the library will never see, so it cannot know the deliverable;
   "build a landing page" is a decision the Item does not contain. You paste
   under a sentence of your own, so an instruction voice makes your message argue
   with itself where a brief composes with it. 010 forces it, because five traits
   drawn from five items cannot be phrased as one coherent instruction without
   inventing a deliverable none of them holds. And **the instruction voice
   structurally demands precision this data does not have**: writing the directive
   candidate required fabricating `1100px`, `4px` and `120px`, because "generous
   vertical padding" is not an instruction. Vagueness where the library is vague
   is a property of the brief and a defect of the directive. The single imperative
   is the opening line, and its "rather than reproducing it" clause is the only
   defence against the system's characteristic failure, which is pastiche.

2. **Stack-agnostic, derived rather than preferred.** No framework, no CSS, no
   token names, no pixels. The map rules code out of scope on the grounds that a
   prompt "keeps the app stack-agnostic", so naming a stack spends exactly what
   that decision bought. The rendered artifact contains no technology noun, which
   is checkable rather than aspirational.

3. **Form: labelled sections whose contents are clauses, shaped by the reader and
   not by the schema.** Prose alone was rejected because it cannot be cut up, and
   010 is blocked by 007 so 007 owes it a decomposable shape. A schema-shaped
   record was rejected because **the storage shape is not the prompt shape**: it
   hands over raw enum members like `weightRange: paired` that only 004's
   `description` text explains. Sections are therefore named in designer English
   (Palette, Type, Composition, Space, Surfaces, Imagery) and **enum members
   render as the same English that defined them in 004's JSON Schema**, so the
   writer and the reader of a value share one definition with no third place to
   drift. No markdown headings: the prompt is a guest in your message and should
   never outrank the sentence you wrote.

4. **Approximation surfaces as the word "around", per value.** This is 004's
   question and 004 constrained the answer: authorship sits per swatch precisely
   so correcting one hex cannot silently un-hedge the other four, which 004 calls
   "a correctness bug, not an inconvenience". A single "values are approximate"
   footnote is therefore **wrong by construction**. A tilde was rejected because
   the prompt has a human reader and a model reader and `~#c8452d` is a glyph
   either may skim. Approximate is marked and exact is bare, so an Override is
   visible in the artifact without a legend. Nothing else is hedged: 002 found
   free-text substance stable across runs, and `typography.scale` is stated flatly
   despite its instability because the hedge is spent only where a false claim
   would be specific and checkable.

5. **How much is too much is answered structurally, not numerically. The render
   never emits a line for a leaf that carries no information.** An Undetermined
   leaf, an Undetermined trait and a Not applicable trait are all rendered as
   silence, section label included. A line reading "type scale: undetermined"
   spends tokens saying nothing and invites the model to fill the gap on your
   authority; saying nothing lets it choose freely, which is the honest
   instruction. Seven traits is the ceiling and thin Items shorten themselves
   automatically. The worked example renders all seven at roughly 2,100
   characters.

6. **Provenance is named, last, and defused in the same breath.** Both halves of
   the ticket's tension are real, so the decision is placement. Leading with the
   URL makes everything above it decorative, because a model that recognises the
   site answers from memory of the site and the whole extraction apparatus becomes
   ornamental. Omitting it entirely was rejected because the prompt outlives the
   tab it was copied from, and provenance in the artifact is the only thing that
   traces it back to the Item. So it is the final line, with one clause: "work
   from the description above rather than from memory of the site." **A local path
   is never rendered** - `originalPath` is a citation for the library, and on a
   clipboard it is noise to the reader and a leak of your directory structure to
   whoever you paste in front of.

7. **Rendered on demand. No prompt text is ever stored and the agent never writes
   one.** Retroactive improvement is the argument the ticket already had, but
   three stronger ones sit behind it. An agent-written prompt would be a new field
   in a schema 004 closed, and it fails 004's own fourth admission test outright
   as a restatement of the other seven traits. **Storing it breaks Override**,
   which 002 and the map make the preferred correction mechanism: correct
   `palette.accent` and a stored string would keep asserting the old value, so the
   one artifact that matters would silently fail to reflect the correction. And
   002 measured $0.05-0.13 and 18-48s per call, spent to freeze one sample of a
   process it also proved non-idempotent.

8. **One template, parameterised by a trait subset.** `renderPrompt(item)` is
   `renderPrompt(item, { traits: <all seven> })` with a different frame. Separate
   palette-only and full templates were rejected because 010 would immediately
   need a third for the mixed case, and three would drift. The one thing a subset
   must add is a frame that says it is partial, since a palette-only prompt that
   merely omits the other sections reads as a complete brief about a design with
   no typographic opinions. Selection order is ignored and canonical order
   imposed, so two selections of the same traits render byte-identical.

9. **The Note is included, labelled and last; labels are excluded entirely.**
   004 section 6 split the prose fields into what makes the design work (the
   agent's `philosophy`) and why it was worth saving (your `note`), and both
   belong in a brief but in visibly different voices, so the Note renders under
   "What I wanted from this:" and is suppressed in subset renders. **Labels never
   appear in a prompt at all**, which CONTEXT settles outright: a Label
   "describes an item rather than contributing to a prompt". Labels are how you
   find an item, never part of what it says.

### Two collisions, deliberately surfaced

- **This closes a door in 006 rather than merely interacting with it.** The ticket
  flagged generated-when as interacting with storage; the interaction turns out to
  be subtraction. Because the prompt is a pure projection of the Item, 006 needs
  no prompt field, no prompt cache and no invalidation, and the prompt is exactly
  as versioned as the Item and never separately. Whether a DNA is versioned or
  overwritten remains 006's question, but it no longer drags a derived text
  artifact behind it.

- **004's `philosophy` bound is left alone, though 004 invited 007 to move it.**
  004 recorded the 80-1200 character range as inherited from 002 and said 007 "may
  well want a different shape once it has tested real prompts". 007 has not tested
  real prompts, so changing an inherited bound on the strength of one hand-written
  example would be worse than leaving it. The paragraph renders as the lead, which
  is the position that most rewards its length, and re-opening the bound belongs to
  the map's parked prompt-tuning loop.

### What was not verified

- **The experiment this ticket asked for was not run.** No candidate was pasted
  into a fresh Claude session, nothing was built from any of them, and no outputs
  were compared. Every claim about how a receiving model behaves is an argument,
  not a measurement. **What would settle it:** one fixed build instruction, each
  of the four candidates pasted beneath it into a fresh session with no project
  context, and the single question of whether the result looks like a relative of
  the saved design. A and D are the informative pair, differing on both axes.
- **Nothing has been rendered from a real extraction.** The worked example is
  hand-written and validated against 004, not produced by the agent. Real prose
  may be longer, may arrive already punctuated, and may repeat itself between
  `philosophy` and the `*Character` fields, which the template does not
  deduplicate.
- **The 2,100-character full render is untested for comfort**, both to paste and
  to read.
- **No mixed prompt exists.** Subset rendering is verified; that several subset
  renders compose into one coherent Mix is asserted and is 010's to demonstrate.
- **The sentence-casing helper is a heuristic** that protects `iOS` and `eBay` by
  pattern and will still mangle a lowercase-by-design name shaped differently.

### What was verified, by running it

A throwaway driver in the system temp scratchpad, outside the repo, built three
Items, validated each with 004's `Item.parse()` so no branch could be exercised
with an Item that could not exist, and printed every render. Typechecked under
`typescript` 5.9 with `strict` and `noUncheckedIndexedAccess`, run under `tsx` on
Node 22. Exercised: the full seven-trait render; per-value hex hedging; an
`override` swatch rendering bare beside four hedged ones; an Undetermined trait
vanishing entirely; Undetermined leaves inside a present trait; two Not
applicable traits with the Scope clause carrying the explanation; an absent Note;
a file Source with no url and a null `takenAt`; the palette-only subset render;
reversed selection order producing byte-identical output; subset renders of a Not
applicable and of an Undetermined trait; an Item with nothing readable at all;
purity across repeated calls; and the absence of em and en dashes in every
render. The full table is in the candidates note.
