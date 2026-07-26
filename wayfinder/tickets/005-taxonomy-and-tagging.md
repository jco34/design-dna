---
id: 005
title: Taxonomy and tagging, closed vocabulary or agent-invented
label: wayfinder:grilling
status: open
assignee: unassigned
blocked-by: 004
parent: map
---

## Question

When the agent "automatically categorizes" something, what is it choosing
from?

The brief asks for automatic categorization and for filters that let you find
the design you have in mind. Those two pull against each other: filters need a
stable vocabulary, and an agent inventing tags per item will not produce one.
Left free, you get `brutalist`, `neo-brutalist`, `brutalism` and `raw-concrete`
as four separate facets across four items, and the filter becomes useless at
exactly the scale where you need it.

Resolve:

- **Closed, open, or hybrid?** A fixed taxonomy the agent must pick from, free
  tags it invents, or a fixed spine (style, mood, industry, surface type) plus
  free tags underneath.
- **If closed, what are the categories?** Draft the actual list. Style, mood,
  era, density, colour temperature, surface type (landing page, dashboard, app
  UI, editorial, portfolio, e-commerce), industry. Which axes do you genuinely
  filter by when hunting for a design, and which just feel tidy?
- **How does the vocabulary evolve?** A closed list you cannot extend will be
  wrong within a month. Who adds a category, and what happens to items
  categorized before it existed. Is there a backfill, or do old items stay
  stale?
- **Tag sprawl control** if free tags are allowed: normalization, an alias
  map, a synonym pass, a minimum-use threshold before a tag becomes a filter
  facet.
- **Multi-label or single?** One design is plausibly both editorial and
  brutalist. Are categories exclusive per axis, or can an item carry several
  values on one axis?
- **Correcting a bad category.** The narrow case of the broader correction
  question sitting in the map's "Not yet specified". Enough here to know
  whether a human-set category and an agent-set one are distinguishable in
  storage, which constrains ticket 006.

Deliverable: the taxonomy itself, and its terms added to `CONTEXT.md`.
