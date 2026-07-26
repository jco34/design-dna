---
id: 011
title: UI surfaces and what a card shows
label: wayfinder:prototype
status: open
assignee: unassigned
blocked-by: 009, 010
parent: map
---

> **Narrowed 2026-07-26.** The app is a pure reader, so there is no ingest
> surface, no placeholder or half-analysed card, no progress indication and no
> failed card. This ticket is now only about browsing, and it no longer waits on
> 008.

## Question

What screens exist, and what does a single card have to convey at a glance?

An app about good design that looks mediocre undercuts itself, and this is the
one place in the map where taste is the deliverable rather than a constraint.
Consult `frontend-design` or `ui-ux-pro-max` here.

Settle the surface inventory: the library grid, an item detail view, the mix
board (from 010), and whether filters live in a sidebar, a top bar, or a command
palette. Is this one page with panels or several routes?

There is no "add" surface at all, which is worth sitting with rather than
skipping past: the app you open has no button that puts anything into it. The
empty state has to explain that items arrive from the CLI without reading as
broken, and the whole app has to feel deliberate rather than half-built.

Then the card, which is the hardest single design problem in the app:

- Screenshot-dominant, or does the palette show as swatches? A wall of
  thumbnails is beautiful and tells you nothing about typography or philosophy.
  A wall of metadata is searchable and joyless.
- How does a card convey the palette without the swatches fighting the
  screenshot's own colours?
- What appears on hover versus at rest?
- Where does the copy-prompt action live: on the card for one-click use, or in
  the detail view where you can see what you are copying?
- Uniform grid or masonry, given that captures will be wildly different aspect
  ratios (a full-page screenshot next to a cropped button). 003's viewport
  decision bounds how wild this gets.
- How a card shows a palette value that is **approximate** rather than exact
  (002, and 004's fidelity decision). A swatch reads as precise whether or not
  the number behind it is.
- The empty state, which is the first thing you will ever see, and which cannot
  offer an add button because there isn't one.

Also: does this app have a visual identity of its own, or is it deliberately
neutral so the saved designs are the only colour on screen? Neutral is probably
right and is a real decision, not a default.

Deliverable: a prototype of the grid and card under `wayfinder/assets/011-*`
with several real captures in it, plus the surface inventory for the spec.
