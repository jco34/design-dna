---
id: 009
title: Search and filter model
label: wayfinder:grilling
status: open
assignee: unassigned
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
