---
id: 009
title: Search and filter model
label: wayfinder:grilling
status: closed
assignee: jeb
blocked-by: 004, 005
parent: map
---

## Question

How do you find the design you have in mind?

The brief asks for a filter and a search bar so you can see the design you have
in mind. That phrasing matters: you are not searching for a known item by name,
you are hunting by half-remembered feel. That is a different problem from
text search, and semantic search infrastructure is out of scope at this scale,
so the taxonomy and the schema have to carry the weight.

Resolve:

- **What is searchable text?** The philosophy prose, your own notes, tags, the
  source URL, the font names, the literal hex strings. Everything, or a
  deliberate subset? Indiscriminate full-text search over prose makes every
  query match everything.
- **Search versus filter.** Is the search bar a text query and the filters a
  set of facets, or is there one unified query surface? Do they compose, and
  does a search narrow within active filters?
- **Facet composition.** AND or OR across values of one axis, and across axes.
  `warm` AND `dense` is a different tool from `warm` OR `dense`, and getting
  this wrong is the most common way a filter UI becomes useless.
- **Colour search.** The interesting one: finding designs by palette rather
  than by word. Picking a colour and getting near matches, or filtering by
  colour family and temperature. Needs a distance measure and a decision about
  whether it operates on the dominant colour or the whole palette.
- **Empty and near-empty results.** What happens when a filter combination
  matches nothing. At a few hundred items over-filtering is easy and dead ends
  are the main failure mode.
- **Sort order.** Recency, or something more useful. Is there a notion of
  favourites or of items you actually reached for?
- **Does browsing matter more than searching?** At this scale, scrolling a
  well-ordered grid may beat any query. Worth deciding honestly before building
  a query engine that gets used twice.

Deliverable: the search and filter model, and the queries it implies against
006's schema.

## Resolution

**The library is browsed, not searched, so there is one grid in a stable order
and every control subtracts from it.** The model,
[`../assets/009-search-and-filter.md`](../assets/009-search-and-filter.md), and
the pure module the app imports,
[`../assets/009-query.ts`](../assets/009-query.ts), are a `filter` and a `sort`
over an in-memory `Item[]`, with no index, no query engine and nothing that
ranks. The ticket's last question is answered first and it collapses the rest.

### What was decided

1. **Browsing dominates, and that is the design, not a concession.** 006
   measured a fully validated 300-Item scan at 31 ms and a two-predicate filter
   at 0.14 ms, so there is nothing to accelerate. Measured against this module:
   a facet pass over 300 synthetic Items is **0.035 ms**, a text pass 0.74 ms, a
   colour pass 0.88 ms, all fifteen facet counts 2.1 ms, and the worst case
   (text + facets + colour + hue sort) **0.38 ms** - every pass under one frame.
   The "no index needed" claim is measured rather than assumed. **Rejected:** a
   ranked result list, and semantic/embedding search (out of scope, and unearned
   at this scale).

2. **Search and filter are one subtractive surface.** Text AND facets AND colour,
   then sorted. Whether a search "narrows within active filters" is a non-question
   once conjunction is the only combinator: there is one grid and every input
   removes cards from it. The `Query` lives in the URL (006 decision 13), and the
   module owns its codec.

3. **Searchable text is a deliberate subset, admitted by identify-not-describe.**
   Searched: `note`, `philosophy`, both font families, `composition.structure`,
   and the source URL/path. **Not searched:** the five enum-elaborating prose
   fields (`headingCharacter`, `bodyCharacter`, `spacing.rhythm`,
   `surfaceTreatment.finish`, `imagery.treatment`), because each restates an enum
   facet one click away, and searching them is how prose search starts matching
   everything - the exact failure the ticket names, tested against 004's 80-1200
   char philosophy bound. Labels are facets not text; a hex is a colour query not
   text. Matching is fold + tokenize + **prefix-on-token** (so `art` finds
   `artful`, not `smart`) + AND across terms. **Rejected:** stemming, fuzzy match,
   BM25 - tuning devices for a large ranked corpus this is not.

4. **Facet composition: OR within an axis, AND across axes, and both are forced.**
   005 caps `style` and `mood` at two values and makes `genre`/`scope` single, so
   AND-within-axis is *provably empty* at a small fixed click count on every axis;
   OR-within is the only semantics the taxonomy supports and also what a person
   means. AND-across because each axis answers a different question. The ticket's
   `warm` AND `dense` is an across-axis query, which is what dissolves it.
   OR-within also gives the widen-only property section 7's dead-end guarantee
   rests on. **Rejected:** a global any/all toggle, and negation (breaks
   widen-only; a clean future add).

5. **Colour is a query over the whole palette by minimum distance in OKLab.** The
   measure is `deltaEOK`, Euclidean distance in OKLab (sRGB to linear to the
   Ottosson cube-root transform, written out in the module). Whole palette by
   **min**, not the dominant swatch, because the dominant swatch is the near-white
   or near-black background and the colour you remember is the accent; a colour
   hunt is existential ("is that orange in there"), so `min` is the operator and
   role weight does not scale distance. **OKLab over CIEDE2000** because the input
   is eyeballed (002): two honest readings of one colour sit ~0.004-0.06 apart, so
   CIEDE2000's lab-grade precision measures an eyeballed number with a micrometer,
   while OKLab is hue-linear, a true metric (safe to sort by), and configuration-
   free. Tolerances `exact 0.05 / near 0.10 / family 0.20` are floored by that
   re-run noise: a query cannot be more precise than the value it queries. A
   leading-`#` hex typed in the search box routes to a colour query. **Rejected:**
   naive RGB Euclidean (perceptually lopsided), CIEDE2000-on-dominant (wrong swatch
   and wrong-for-the-job metric), HSL hue bucketing.

6. **Light/dark and temperature are derived at read time, honoring 005's "the best
   facet is the one you must not store".** Light/dark is relational first
   (background darker than ink), with an OKLab-lightness fallback, on
   `palette.background` alone. Temperature projects each swatch's OKLCH hue onto a
   warm pole at 60 degrees weighted by chroma times 004's ordinal weight, so an
   orange-and-blue palette cancels to neutral and one small accent does not
   recolour a grey palette. Both cannot go stale because they are computed, which
   is 005's whole reason for rejecting them as stored labels. The eight trait-enum
   facets are read directly. Every facet is total: it buckets every Item,
   including into `undetermined`/`none`/`not-applicable`.

7. **Empty results are a diagnosis, never a dead end.** `facetCounts` shows a
   live count on every facet value and disables the zero-count ones, and because
   adding a value only ever widens (decision 4), no positive-count value can
   produce an empty grid - you cannot click your way into a dead end, and the
   harness asserts it. Only text and colour can empty the grid alone, and
   `explainEmpty` does leave-one-out over the active constraints and names what
   clearing each recovers, so the empty state is "3 match if you clear the search",
   not "no results".

8. **Sort: newest (default), oldest, by colour.** Recency keys on `addedAt` with
   an `id` tiebreak, total and clock-independent. The colour sort orders the grid
   by the hue of the most chromatic swatch with achromatic Items collected at the
   end, turning the grid itself into a colour finder - the browsing answer to the
   colour-search question.

9. **Favourites are `note`, because the app cannot write.** 006 decision 13
   forbids app writes, so a star or a reach-count has nowhere to live. It is not a
   workaround: CONTEXT defines a Note as "your own words on why an item was worth
   saving", so an Item you would star is an Item you noted, and the note is the
   stronger favourite because it records why. The `noted` facet is derived from it.
   **Rejected:** a stored flag (a forbidden write) and a usage count (a forbidden
   per-interaction write).

### Collisions surfaced deliberately

- **The assembled `Item` type is now real, and 009 reads it.** While 009 was in
  flight the shared module moved to `schema/` and reconciled 004's provisional
  flat `labels` array into 005's three-axis object plus `taxonomyVersion`.
  `009-query.ts` imports `Item` from `schema/` and reads
  `labels.genre.value` / `labels.style.values` / `labels.mood.values`. It
  typechecks clean under the app's own tsconfig.

- **011 inherits a designed surface, not a blank one.** `FACETS` carries a
  primary/secondary `tier`, `ColourMatch` says which swatch answered a colour
  query so a card can point at it (and hedge it by 004 authorship the way 007
  does), and `explainEmpty` is shaped for the empty state that cannot offer an add
  button. The `Query` codec (`encode/decodeQuery`) is the URL contract 006
  decision 13 requires.

### What was not verified

- **No real Items exist**, so the colour constants (warm pole, temperature band)
  are calibrated against the seed palette and general colour sense; temperature and
  mood are the softest readings and will retune first.
- **The searchable-subset precision claim is reasoned from 004's length bounds,
  not measured on a real corpus.**
- **`facetCounts` was exercised at 300 near-identical synthetic Items**, so the
  no-dead-end invariant holds structurally but the count distribution is not
  representative.
- **The URL codec is round-trip tested, not fuzzed**; 011 owns the wiring.
- **No UI exists.** This is the model and the module; 011 builds the surface.
