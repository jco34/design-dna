# 009 search and filter - one grid, and every control subtracts from it

Ticket: [`../tickets/009-search-and-filter-model.md`](../tickets/009-search-and-filter-model.md).
Module: [`009-query.ts`](009-query.ts), pure functions over `Item[]` from the
shared `schema/` module. Reads the store [006](006-storage-contract.md)
describes and the labels [005](005-taxonomy.md) defines.

**Status: settled by measurement where one reached and by derivation from locked
decisions everywhere else.** The ticket's last question is answered first because
it collapses the rest, and the answer shrinks this ticket from a query engine to
a filter pass. Section 3 is the composition semantics, section 6 is colour, and
those are the two with teeth.

---

## 0. The last question first: browsing beats searching, and that is the design

The ticket asks, honestly, whether browsing matters more than searching, and
warns against "a query engine that gets used twice". Answered plainly: **at this
scale browsing dominates, and everything below is built as a subtractive filter
over one grid rather than as a search that returns a result list.**

The evidence is 006's measurement, not taste. A full, Zod-validated scan of 300
Items is **31 ms**, and a two-predicate filter across all 300 parsed Items is
**0.14 ms**. There is no index to build and nothing to accelerate, so the honest
architecture is: hold the whole library in memory, render it as a grid in a
stable order, and let every control **remove** Items from that grid. There is no
"results view" distinct from the "browse view". They are the same grid with a
different number of cards in it.

This is measured against my own module rather than inherited: a facet-only pass
over 300 synthetic Items is **0.035 ms**, a text pass **0.74 ms**, a colour pass
**0.88 ms**, the full `facetCounts` over all fifteen facets **2.1 ms**, and the
worst case (text and facets and a colour query and a hue sort together) **0.38
ms**. Every one of these is under a single 60fps frame, most of them by two
orders of magnitude. **There is no query to optimise, so there is no query
engine.** The whole model is a `filter` and a `sort`.

Three consequences shape the rest of this document.

1. **Nothing ranks.** A search does not score relevance and return the best
   matches; it removes the Items that do not match. Browsing a well-ordered grid
   is the primary act, and the controls exist to make the grid shorter.
2. **The default state is the whole library, newest first.** You open the app
   and see everything. That is the most common "query" and it costs nothing.
3. **The controls are calm.** Because subtracting is cheap and reversible and the
   grid never lies about how much is left, a filter UI can afford to show counts
   on every value and never surprise you into an empty page (section 7).

**Rejected: a ranked search returning a scored result list.** It is the shape
every search box reaches for and it is wrong here. Ranking implies you cannot see
everything, which at a few hundred Items you can; it implies a relevance model to
tune, which is the "used twice" engine the ticket warns against; and it fights
the one thing this app is actually for, which is looking at design. A grid you
scroll is a better colour-and-typography browser than any ranked list.

**Rejected: semantic or embedding search.** Ruled out of scope by the map, and
correctly: at low hundreds of Items the taxonomy and the derived facets carry the
"half-remembered feel" hunt without a vector index to build, store and stale.

---

## 1. Search and filter are one surface, composed by conjunction

The ticket asks whether the search bar and the filters are one query surface or
two, and whether a search narrows within active filters.

**Decided: they are distinct inputs that compose into one `Query`, and every part
is ANDed.** Text AND facets AND colour, then sorted. A search always narrows
within active filters, because there is only one grid and every input subtracts
from it. "Does the search narrow within the filters" is a non-question once the
model is subtractive: order of application is irrelevant, since conjunction
commutes.

```
runQuery(items, { text, facets, colour, sort })
  = sort( items where matchesFacets AND matchesTerms AND colourMatch )
```

The search bar and the facet panel are different inputs because they answer
different questions (free recall versus a closed pick), but they are not
different engines. There is one `Query` object, it lives in the URL (006 decision
13), and `runQuery` is the only thing that reads it.

---

## 2. Searchable text is a deliberate subset, and the test is identify-not-describe

The ticket's own warning is the whole design constraint: "indiscriminate
full-text search over prose makes every query match everything". That warning has
to be tested against the prose lengths 004 actually permits rather than asserted.

**004 permits `philosophy` from 80 to 1200 characters and `note` up to 4000.** A
300-Item library therefore holds on the order of a hundred thousand words of
searchable prose. Full-text over all of it, matched by substring, would make
common design words (`grid`, `dark`, `type`, `space`) match most of the library,
which is the failure the ticket names. The subset is not a performance decision
(section 0 shows there is no cost); it is a **precision** decision.

**The admission test: a field is searchable when a term found there *identifies*
the Item rather than *describes* it.** A font name identifies (you remember the
face). A philosophy paragraph identifies (it is your own or the agent's specific
account of this one design). A structural sentence identifies (you remember "a
centred column on a dark field"). But the enum-elaborating prose fields describe:
they restate a value an enum facet already carries, so searching them is a worse,
fuzzier copy of a filter that is one click away.

**Searched** (`SEARCHABLE_FIELDS`):

| field | why it identifies |
| --- | --- |
| `note` | your own words; the highest-signal text in the store |
| `dna.philosophy.text` | the specific account of this design; 005 made it the home of everything the closed vocabulary cannot carry (era, "a footer", the unlisted idiom) |
| `dna.typography.headingFamily`, `bodyFamily` | a named typeface is the most identifying single token a design has |
| `dna.composition.structure` | the sentence you actually remember: "a centred column", "a split hero" |
| `source.url`, `source.originalPath` | provenance; `linear.app` finds the Linear one |

**Not searched, and each is a deliberate cut:**

- `headingCharacter`, `bodyCharacter`, `spacing.rhythm`, `surfaceTreatment.finish`,
  `imagery.treatment`. These are the enum-elaborating prose fields. Each sits
  beside an enum facet (`typography.scale`/`weightRange`, `spacing.density`,
  `surfaceTreatment.*`, `imagery.kind`) that answers the same question exactly and
  filters cleanly. Searching "rounded" should hit the `corners` facet, not a
  sentence that happens to contain the word.
- The **labels** (`genre`, `style`, `mood`). They are facets, not text. Typing
  `brutalist` filters the `style` facet; it does not do a string match. This keeps
  005's closed vocabulary closed on the read side too: you cannot search for a
  style that is not a real value.
- The **hex strings**. A hex in the search box is a colour query, not text
  (section 6.4). Substring-matching hex strings is useless anyway: 002 makes every
  stored hex eyeballed, so nobody recalls one exactly.

**The miss this accepts, named honestly:** searching the character fields would
occasionally help ("monospace", "italic", "uppercase" live in `headingCharacter`).
The cut stands because those three are better served as future facets than as
prose search, and because admitting the character fields reopens the door to the
every-query-matches-everything failure the ticket exists to prevent. If it bites,
the fix is a new enum facet, not widening the text search.

### Matching: fold, tokenize, prefix, AND

- **Fold**: lowercase and strip diacritics via NFD, so `Söhne` is found by typing
  `sohne`. Latin script only, which is what font names and English prose are.
- **Tokenize**: split on every non-alphanumeric, so `neo-brutalist` becomes two
  tokens and `linear.app` becomes two. Both halves are findable.
- **Prefix, not substring**: a term matches when it is a prefix of a whole token.
  `art` finds `artful`, and does **not** find `smart`. This is the single most
  important matching decision, because substring matching is exactly how prose
  search starts matching everything.
- **AND across terms**: two words both have to match. This is the whole
  disambiguation mechanism, and it is enough because the grid always shows how
  many Items are left, so you narrow by adding a word and watching the count fall.

**Rejected: stemming, fuzzy/edit-distance, and BM25 ranking.** Each is a tuning
device for a large corpus and a ranked result set. This corpus is a few hundred
paragraphs and the result is a filtered grid, not a ranked list, so a stemmer
buys recall nobody needs and fuzzy matching buys false positives nobody wants.
Prefix-on-token is the honest floor and it is stable run to run.

---

## 3. Facet composition: OR within an axis, AND across axes

The ticket calls getting this wrong "the most common way a filter UI becomes
useless", and singles out that `style` and `mood` can hold two values, which
makes within-axis semantics a real question. Both halves of the answer are forced
rather than chosen.

> **Within one facet, selected values are ORed. Across facets, the constraints
> are ANDed.**

### Why OR within an axis is forced, not preferred

005 caps `style` and `mood` at **two values per Item** and makes `genre` and
`scope` single-valued. Consider AND-within-axis under those caps:

- `genre` is single-valued, so selecting two genres with AND matches **nothing**,
  always. Empty on the second click.
- `style` holds at most two values, so selecting three styles with AND matches
  **nothing**, always. Empty on the third click.

An AND-within-axis filter over this taxonomy is provably empty at a small fixed
number of clicks on every axis. It is not merely a worse tool; it is a broken one.
**OR within an axis is the only within-axis semantics this taxonomy can support**,
and it also happens to be what a person means: clicking `brutalist` and then
`swiss` means "show me either", the same way ticking two boxes in any faceted shop
does.

OR-within buys one more property that section 7 depends on: **adding a value to a
facet can only ever widen the grid.** The result is a strict union, so no sequence
of facet clicks can walk you into an empty page.

### Why AND across axes is forced

Each axis answers a different question, so constraints on different axes
accumulate. `genre: dashboard` AND `lightness: dark` is "dark dashboards", which
is what you mean. The ticket's own example, `warm` AND `dense`, is an
**across-axis** query (temperature AND density), and stating the semantics
dissolves it: it is AND because they are different axes, and it is not the
within-axis case at all. The ticket's warning was really a warning about
conflating the two, and naming them separately is the fix.

This is stated once in the module, in `matchesFacets`, and the harness asserts
both halves: `genre: [product-ui, editorial]` unions to 4 Items; adding
`style: [technical]` across the axis narrows to 2.

**Rejected: a global AND/OR toggle.** Some faceted UIs offer "match any / match
all". Rejected because it exposes an implementation choice as a user decision, and
because the correct answer differs by scope (within versus across) in a way a
single toggle cannot express. The semantics are fixed and invisible, which is what
makes them trustworthy.

**Rejected: negation ("not brutalist").** A real want, and cut for v1 because it
breaks the widen-only property that makes counts honest and dead ends impossible,
and because at this scale you can read past the styles you do not want. It is a
clean future addition if the library grows.

---

## 4. Derived facets: light/dark and temperature are computed, never stored

005 rejected density, flat/dimensional, colour temperature and light/dark as axes
because they are **derivable from traits 004 already stores**, and handed the
derivation to 009 by name: "Hand it to 009 and it is always right, for free, with
no field, no prompt tokens and no staleness." This is that decision, honored.

- **Density, content width, type scale, weight range, corners, borders, elevation,
  imagery** are already enum leaves on the trait. They are facets by reading the
  field directly. No computation, no decision; `spacing.density` *is* the density
  facet.

- **Light or dark** (`lightnessOf`) is computed from `palette.background`. The
  test is **relational first**: a design is dark when its background is darker than
  its ink, which is what dark mode *means* and needs no threshold to argue about.
  The absolute OKLab-lightness fallback (`L < 0.5`) runs only when ink was not
  read. It uses `palette.background` alone, never the palette mean, because a light
  page carrying dark photography is a light page and a mean would miscall it.
  005 called this "the best facet on the list is the one you must not store", and
  the reason it must not be stored is exactly 005's: an accent later overridden to
  blue must not leave a stale `dark` label behind. Derived, it cannot go stale.

- **Temperature** (`temperatureOf`) is the interesting derivation and section 6.3
  covers its formula. `warm | cool | neutral | undetermined`.

- **Noted** (`isNoted`) is the favourites facet, and section 9 argues why it is
  the honest form of "favourites" in a read-only app.

Every derived facet is **total**: it buckets every Item, including into
`undetermined` when no colour was read. No Item can hide from a facet, which is
what makes the counts add up.

---

## 5. Colour is a query, and it operates on the whole palette by minimum

The ticket calls colour "the interesting one" and demands a concrete distance
measure named, a formula, and a decision about dominant-swatch versus
whole-palette. All three, in order.

### 5.1 Whole palette, by minimum, not the dominant swatch

**Decided: a colour query matches an Item when *any* swatch in its five-role
palette is within tolerance of the query colour. The score is the minimum
distance over the five roles.**

The dominant swatch is almost always the background, and a background is almost
always near-white or near-black. Matching on the dominant swatch would fail for
exactly the colours a person remembers, which are the accents. A colour hunt is
**existential** ("does this design have that orange *in* it"), not an average, so
`min` over the palette is the operator. `mean` would answer a question nobody
asks, and would call an orange-accented near-white page "white".

The matched role and its 004 weight come back in the `ColourMatch` result, so the
card can say *where* it matched ("that orange is the accent") without the query
pretending to rank. The role weight deliberately **does not** scale the distance:
a small vivid accent and a large dull field are equally findable, because memory
is not area-weighted.

### 5.2 The distance: OKLab Euclidean (deltaEOK), and why not CIEDE2000

**Decided: distance is the Euclidean distance in OKLab, `deltaEOK`.** The formula
is sRGB to linear light, the Ottosson LMS cube-root transform to OKLab, then
`sqrt(dL^2 + da^2 + db^2)`. It is 40 lines of arithmetic, written out in the
module rather than pulled in as a dependency, because it sits on the app's read
path and has no configuration.

The choice is about the **input**, not about metric sophistication. 002 measured
that a stored hex is eyeballed: biased a few units and **unstable between runs of
the same image**. The harness measures two honest readings of one colour sitting
about **0.004 to 0.06** apart in OKLab. CIEDE2000 is the more accurate measure for
the problem it was built for, which is *small* colour differences under controlled
illumination in a lab. This query asks about *large* differences between screen
colours whose own error is larger than the gap between the two metrics. Spending
CIEDE2000's complexity here is measuring an eyeballed number with a micrometer.

OKLab wins on four grounds that all matter here:

1. **It is hue-linear**, so equal steps look equal, which is what the temperature
   projection in 6.3 and the hue sort in section 8 both rely on.
2. **It is a true Euclidean metric** (symmetric, obeys the triangle inequality),
   so "sort by distance" is well behaved. CIEDE2000's hue-rotation term is not a
   metric and can misbehave under sorting.
3. **No discontinuities, no lookup tables, no configuration.** It is a pure
   function, which is what this module has to be.
4. **It was designed for manipulating colour on screens**, which is precisely and
   only what this is.

**Rejected: naive RGB Euclidean.** The tempting zero-maths option, and wrong: RGB
distance is perceptually lopsided (green swamps blue), so a "near" tolerance would
be generous in one direction and stingy in another, and the near-match set would
depend on which corner of the cube you queried. The cube-root OKLab transform is
the specific fix for that lopsidedness and it is cheap.

**Rejected: CIEDE2000 against the dominant swatch.** Both halves wrong at once, as
above: the wrong swatch measured with the wrong-for-the-job metric.

**Rejected: HSL/HSV hue bucketing ("colour family").** Coarser and it looks
simpler, but hue is undefined for greys and unstable for near-greys, so it needs
the same chroma gate OKLCH needs (section 6.1) without OKLab's perceptual
uniformity. Once you have OKLab for the gate you have it for the distance.

### 5.3 Tolerance is bounded below by the data, not by taste

Three tolerances, in OKLab distance: `exact 0.05`, `near 0.10` (default),
`family 0.20`. The floor is set by 002, not by preference: two honest readings of
the same colour sit around 0.03 to 0.06 apart, so a tolerance tighter than that
would return **different Items after a re-run**, which 002's non-idempotence makes
a real event. **A colour query cannot honestly be more precise than the value it
queries**, and 007 already established the vocabulary for this: an agent hex is
rendered "around #c8452d", and a query against an "around" value is an "around"
query. `exact` at 0.05 is as tight as the data permits.

### 5.4 A hex typed in the search box is a colour query

The one piece of syntax in the whole model, and it is a recognition rather than a
grammar: `parseSearchText` pulls a leading-`#` hex out of the search string and
routes it to the colour query, leaving the other words as terms. It earns the
exception because a hex has no plausible reading as prose, is unambiguous to
detect, and because substring-matching hex strings is useless (5.2). So typing
`#5e6ad2 dark` is "dark Items with that indigo somewhere in the palette", which is
exactly what you meant and needs no separate colour control to have been opened
first. A dedicated colour picker in the UI sets the same `colour` field.

---

## 6. The colour constants, measured

Three numbers in the module are empirical, so they are recorded here rather than
left as magic.

### 6.1 `ACHROMATIC_CHROMA = 0.03`

Below this OKLCH chroma a colour has no usable hue and is treated as grey. Checked
against the seed palette 006 renders: `#08090a`, `#f7f8f8` and `#8a8f98` all sit
**below** it (chroma ~0.002 to 0.01), and `#5e6ad2` sits about **four times
above** it. It is the gate that stops a near-black being assigned a spurious hue
in the temperature reading and the hue sort.

### 6.2 The warm pole at 60 degrees

Warmth projects each hue onto an axis whose warm pole is OKLCH hue **60 degrees**
(orange, between red at ~29 and yellow at ~110), via `cos(h - 60)`. Projection,
not angular averaging, is the point: an orange-and-blue palette **cancels to
neutral** instead of landing on a meaningless mean hue. Contributions are weighted
by chroma times 004's ordinal `weight`, so a grey page with one indigo button is
*not* called cool: a colour has to be both saturated and present to move the
number. The harness confirms the warm-editorial seed reads warm (score +0.88) and
a near-monochrome dark UI with one small indigo accent reads **neutral** (its
overall chroma is below the gate), which is the deliberate "one accent does not
recolour the palette" behaviour.

### 6.3 `TEMPERATURE_BAND = 0.33`

The warm/cool score runs -1 to +1; beyond +/-0.33 the palette is called warm or
cool, inside it is neutral. A third of the way to a pole is a defensible line and
it is named as a judgement call (section 11), not a measurement.

---

## 7. Empty results are a diagnosis, never a dead end

The ticket names over-filtering and dead ends as "the main failure mode". Two
mechanisms make dead ends structurally rare and, when they happen, self-explaining.

**`facetCounts` makes most dead ends impossible to reach.** For every value of
every facet it reports how many Items would show if that value were added, holding
all other constraints fixed. Because of OR-within-axis (section 3), **a value
whose count is greater than zero cannot produce an empty grid**, and a value whose
count is zero is shown disabled. You cannot click a facet into a dead end; the
zero-count values are visibly unavailable before you click. The harness asserts
this over every facet value against the actual `runQuery` result: no positive
count ever yields an empty grid, and every count is exact.

**`explainEmpty` diagnoses the two constraints that *can* empty the grid.** Only
text and colour can empty it on their own: you can type anything, and the library
may genuinely hold nothing near a colour. When the grid is empty, `explainEmpty`
does leave-one-out over the active constraints and returns them sorted by what
each recovers, so the empty state says "No matches. 3 Items match if you clear the
search" rather than "no results". A diagnosis, not an apology. The harness
confirms an over-filtered query (`text: phosphor` AND `genre: editorial`) reports
that clearing the text recovers 2 and clearing the genre recovers 1.

**The empty state never blames the user and never offers an add button**, because
011's empty state cannot (there is no add surface). It offers relaxations.

---

## 8. Sort: newest, oldest, and by colour

**Three sorts, and the default is newest first.**

- **newest / oldest** key on `addedAt`, ties broken by the opaque `id` so the
  order is total and stable and never depends on the reader's clock or locale
  (the module constructs no `Date`). Newest-first is the default because the
  thing you just saved is the thing you most likely want.
- **by colour** (`hueKey`) turns the grid into a spectrum: it keys on the hue of
  the **most chromatic** swatch (accent-memory again, not the dominant
  background), with achromatic Items collected at the end and ordered dark to
  light. This is the browsing answer to the searching question: sorting the grid
  by colour makes the grid *itself* a colour finder, which at this scale often
  beats forming a colour query at all. It is the clearest expression of the
  section 0 decision that browsing dominates.

**Rejected: relevance sort.** There is no relevance score, because nothing ranks
(section 0). A filtered grid in a stable order is more useful than a grid that
reshuffles on every keystroke.

**Rejected: sort by "most reached for" / usage.** It needs a write the app is
forbidden (006 decision 13). Section 9.

---

## 9. Favourites, and why they are `note`, not a star

The ticket asks whether there is a notion of favourites or of items you actually
reached for. Both are natural, and both are **writes**, and 006 decision 13 makes
the app a pure reader that writes zero bytes to `library/`. A star or a
reach-count would be app-authored state with nowhere legitimate to live.

**Decided: the favourites facet is `noted` - whether the Item carries a `note` -
and it is derived, not stored anew.** The reasoning is not a workaround; it is
that the two are the same thing. CONTEXT defines a **Note** as "your own words on
why an item was worth saving". **An Item you would have starred is an Item you
wrote a note on.** The note is a stronger favourite than a star because it records
*why*, and it already exists, is already hand-editable, and is already the
highest-signal searchable text (section 2). "Show me the ones I cared enough to
write about" is the favourites hunt, served by a field that is already there.

**Rejected: a stored favourite flag.** It is a write the app cannot make. It could
only be set by the producer or by hand-editing JSON, which is a strange gesture
for "star this", and it would duplicate the signal `note` already carries.

**Rejected: a reach-for / usage count.** The truest "favourite" and the most
forbidden: it is a write on every copy-prompt action, which is precisely the
per-interaction write 006 forbids. Transient session state (recently viewed) can
live in the browser per 006, but it is not durable and does not belong in the
query model.

---

## 10. The full filter surface, and what 011 renders

Fifteen facets, plus text, plus colour, plus sort. `FACETS` carries a `tier` so
011 can show the primary hunt controls and fold the rest away.

**Primary** (the half-remembered-feel hunt): genre, style, mood, scope, light/dark,
temperature, density, noted.

**Secondary** (checked after you have found it): content width, type scale, weight
range, corners, borders, elevation, imagery.

This is 005's own count cashed out: the taxonomy contributes three facets
(genre/style/mood), 004's enum leaves contribute eight, the palette contributes
two derived (light/dark, temperature), Scope one, and `note` one. Labels only
carry what nothing else can.

---

## 11. The judgement calls, named

Everything above is derived from a locked decision or forced by a measurement,
except these, which are mine. A reviewer who wants to disagree efficiently starts
here.

1. **Browsing over searching as the organising principle** (section 0). The
   measurement forces "no engine", but the decision to make the grid primary and
   every control subtractive is a stance. It shrinks the ticket, which is the
   point, but a reviewer who expects a search product will find this minimal.
2. **The searchable subset** (section 2), specifically cutting the five
   enum-elaborating character/prose fields. The identify-not-describe test is
   mine; a reviewer may want `headingCharacter` searchable for "monospace".
3. **OKLab over CIEDE2000** (5.2). Defensible either way on paper; the
   eyeballed-input argument is what tips it, and that argument is a reading of
   002.
4. **min-over-palette for colour** (5.1) rather than the dominant swatch. The
   existential-hunt framing is the load-bearing claim.
5. **The three colour numbers** (section 6): the 0.03 chroma gate is measured, but
   the 60-degree warm pole and the 0.33 temperature band are calibrations that
   real Items will move. These are the first things to retune once the library is
   real, and mood/temperature are the softest readings in the app.
6. **Favourites as `note`** (section 9). The strongest objection is that a person
   may want to star something without writing about it. The answer is that the app
   cannot store a star at all, so the choice is `note` or nothing, and `note` is
   the better signal.
7. **The three sort orders and newest-as-default** (section 8). Uncontroversial,
   but the hue sort is a real bet that a colour-ordered grid earns its place over
   a colour query.

---

## 12. What was verified, and what was not

Verified by running `009-query.ts` through a throwaway harness (tsx, Node
v22.14.0, Windows 11), 45 assertions, every constructed Item parsed through the
real `Item.parse` from `schema/` so nothing is tested against a shape the store
cannot hold:

1. OKLab maths: self-distance is 0, distance is symmetric, indigo is closer to
   blue than to red, the near-black/near-white/mid-grey seed colours all fall
   under the chroma gate and indigo sits well above it, and two honest readings of
   one colour sit ~0.004 apart.
2. `nearestSwatch` matches the accent role, not the dominant background; a colour
   query against a pure black-and-white palette correctly misses.
3. Derived facets: the dark UI reads dark, the white Swiss page reads light, the
   warm editorial page reads warm, a chromatic glass page reads cool, a pure-grey
   palette reads neutral, and the one-small-accent case reads neutral by design.
4. Text: prefix-on-token matches whole tokens and not substrings (`art` not
   `smart`), diacritics fold (`sohne` finds `Söhne`), terms AND, and a hex splits
   out of the text into a colour query.
5. Composition: OR within an axis unions (4 Items), AND across axes narrows (2),
   the `none` bucket catches empty style/mood arrays, the `not-applicable` bucket
   catches a component's excluded `composition`, and derived facets compose with
   the rest.
6. Facets are total: every facet buckets every Item into a declared value.
7. `facetCounts` is exact against `runQuery` for every value, and no positive-count
   value ever yields an empty grid (the no-dead-end invariant).
8. `explainEmpty` ranks the recovering constraints for an over-filtered query.
9. Sort: newest is the reverse of oldest, both are total, and the hue sort keeps
   every Item and collects achromatic ones after chromatic ones.
10. `runQuery` composes colour with a facet, attaches a per-Item `ColourMatch`,
    and the whole `Query` survives a URL encode/decode round-trip.
11. **Performance over 300 synthetic Items**: facet-only pass **0.035 ms**, text
    pass **0.74 ms**, colour pass **0.88 ms**, full `facetCounts` over all fifteen
    facets **2.1 ms**, worst case (text + facet + colour + hue sort) **0.38 ms**.
    This is the measured basis for section 0's "no index needed": every pass is
    under one frame, most by two orders of magnitude, consistent with 006's 0.14
    ms two-predicate filter.

Also typechecked: `009-query.ts` compiles clean under `strict` with
`moduleResolution: bundler` (the Next app's config) against the real `schema/`
barrel.

Not verified, and each is a real gap:

- **No real Items exist.** The colour constants (6.2, 6.3) are calibrated against
  the seed palette and general colour sense, not against what you actually save.
  Temperature and mood are the softest readings and will move first.
- **The searchable-subset precision claim is reasoned, not measured on a real
  corpus.** The "every query matches everything" failure is argued from 004's
  length bounds; it wants a real library to confirm the subset is neither too thin
  nor too broad.
- **`facetCounts` was tested at 300 near-identical synthetic Items**, so the count
  distribution is not representative even though the invariant (no positive value
  is a dead end) holds structurally.
- **The URL codec is tested for round-trip, not against a hostile query string.**
  `decodeQuery` filters unknown facet values and clamps tolerance, but 011 owns
  the actual URL wiring and should fuzz it.
- **No UI exists.** This is the model and the module; 011 builds the surface that
  drives it, and the tier split and `explainEmpty` output are designed for it but
  unexercised by a real control.
