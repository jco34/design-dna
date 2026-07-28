---
id: 011
title: UI surfaces and what a card shows
label: wayfinder:prototype
status: closed
assignee: jeb
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

## Resolution

**The app is three routes with a neutral, zero-hue chrome, and the one card
device is a palette weight bar that sits under the Capture like a strip of
genetic code; it is prototyped as the real v1 app under `web/`, not as a
throwaway, because a working reader over the five seed Items is stronger
evidence than a static mock.** This ticket was `wayfinder:prototype`, and the
prototype is the shipped app that 009 and 010 already handed a designed surface
to fill.

### What was decided

1. **Surface inventory: two routes plus one overlay, not several.** The library
   grid at `/` is the home and the only place a query lives; the item detail at
   `/item/<id>` is where traits are legible enough to select from (010 required
   this: a card cannot show seven traits, so the grid cannot be the only entry
   point to a Mix); the **Mix rack is a right-hand overlay drawer** reachable
   from either route, not a third page, because 010 made it transient URL state
   rather than a saved entity and a saved-thing page would overclaim its
   permanence. There is deliberately **no add surface**: the empty state names
   the `dna add` CLI instead, since the app writes nothing (006).

2. **Visual identity: no hue at all.** The ticket asked whether the app should
   have a visual identity of its own or stay neutral so the saved designs are
   the only colour on screen, and called neutral "probably right and a real
   decision". This takes the strict reading: the chrome carries **zero
   saturated colour**, in light and dark. Every selected state is an inversion
   of ink (a filled black chip in light, a filled white chip in dark), never a
   brand accent. The Captures and their palette bars are the whole of the colour
   in the interface. The type does the identity work instead: a grotesque for
   the interface, a monospace for every read value, hex, count and label, which
   suits an app whose subject is design analysis.

3. **The card: Capture-dominant, with the palette as a weight bar, not
   swatches.** 011's hardest question was how a card conveys the palette without
   the swatches fighting the Capture's own colour. The answer is a single thin
   horizontal bar directly beneath the Capture, where each of the five roles
   takes width **in proportion to its ordinal weight** (004's `dominant`,
   `supporting`, `occasional`), so an accent used at two percent reads as the
   sliver it is. It is a legend for the Capture rather than a competitor to it.
   An Undetermined swatch is drawn as a hatched blank, never a colour, so a gap
   never masquerades as a value. The card otherwise shows only what you scan by:
   source title, genre, idiom.

4. **Approximate values read as approximate everywhere.** Every eyeballed hex is
   prefixed `~` on the card's colour-match chip, in the detail swatch list and
   in the copied prompt, and the detail view states plainly that agent-read
   hexes are approximate rather than sampled. This is 004's fidelity decision
   and 007's hedge carried into pixels: a swatch reads as precise unless the
   number beside it says otherwise.

5. **Copy lives in both places, for the two different jobs.** The whole-design
   prompt is copied from the detail view where you can see what you are copying;
   the mixed prompt is copied from the rack, which shows the rendered brief
   before you copy it (010 required the preview, since a mix is the one artifact
   whose text you cannot predict from what you clicked). The button reports what
   it did in its own label rather than through a separate toast.

6. **Uniform grid, not masonry.** 003 fixed the Capture at 1440x900 at
   `deviceScaleFactor: 2`, so every Capture is 1.6:1 and a uniform grid is
   correct; masonry would be solving an aspect-ratio problem that 003 already
   removed.

7. **The whole surface is subtractive and URL-addressable.** The filter rail
   shows 009's eight primary facets and folds the seven secondary ones, disables
   any value whose count is zero so a dead end is unreachable, and writes every
   choice to the URL through 009's `encodeQuery`. The Mix writes to the same URL
   under a `mix` key. One URL therefore captures the entire visible state, which
   is what 006 decision 13 asked the UI to honour.

### Collisions surfaced

- **009 and 010 both write the URL, and they share one query string.** Resolved
  by giving each its own keys and patching them independently, so changing a
  filter never disturbs the rack and adding a trait never disturbs the filters.
  This is a UI-layer concern the two modules could not have settled alone, and
  it is recorded in `web/lib/url-state.ts`.
- **The card wants a title, but an Item has no name (001).** Resolved by
  deriving a display title from the Source: the hostname for a URL Item, the
  filename stem for a file Item. This is presentation only and stored nowhere.

### What was not verified

- **Taste at native resolution.** The app was driven through its accessibility
  tree and DOM in an automation context whose pane does not composite, so every
  interaction, filter, colour match, mix render, and the absence of console
  errors, is confirmed, but the exact rendered pixels, hover transitions and
  font rendering were not eyeballed at full size. The five Captures were checked
  visually and decode at 2880x1800.
- **Clipboard write under automation** returned `NotAllowedError` because the
  headless context has no user activation; the button carries a textarea
  fallback and works from a real click on a focused page. Not confirmed against
  a real click.
- **The grid at real volume.** Everything was exercised over the five seed
  Items. 009 measured its query cost to 300 Items, but the visual density of a
  few hundred cards, and whether browsing genuinely beats searching at that
  scale as 009 bet, is not something five Items can show.
