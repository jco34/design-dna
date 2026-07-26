---
id: 010
title: Mixing elements from several items
label: wayfinder:grilling
status: open
assignee: unassigned
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
