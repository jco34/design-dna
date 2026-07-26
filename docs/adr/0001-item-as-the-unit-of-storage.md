---
status: accepted
---

# Item as the unit of storage

The brief for Design DNA asks to "mix and match several design elements from
different resources", which reads as though the library should store design
elements: a palette here, a type system there, each browsable in its own right.
We decided the stored unit is instead the **Item**, one source with one capture
and one DNA, and that mixing draws on the **traits** of an item's DNA rather
than on separately stored elements. Element-level storage would require the
agent to decide where one design element ends and the next begins from a
picture, which is a harder problem than the design analysis itself and the one
risk the project is already spending a ticket to retire, and it would fill the
library with items nobody chose to save.

## Considered options

- **Item as the unit (chosen).** One saved thing, one capture, one analysis.
  Element-level mixing comes from the traits of that analysis, which are fields
  rather than entities. Scope becomes a human decision: to keep a page's
  pricing table on its own, you crop it and save it as its own item.
- **Element as the unit.** The agent decomposes each capture into several
  stored elements and the source becomes provenance hanging off each one.
  Rejected: segmentation from an image is unreliable in a way the analysis is
  not, and it multiplies a curated library by four or five with cards that were
  never chosen.
- **Both, as source parent and element children.** Rejected: every downstream
  concern acquires a cardinality question it would not otherwise have (does
  search return sources or elements, does a mix hold sources or elements, does
  storage version at which level, what does a card show) plus a two-level
  browse hierarchy, all for a library of a few hundred items.

## Consequences

- The app never proposes a decomposition. One thing saved is one card.
- Because the app captures web addresses itself, scope is only fully chosen for
  uploads. A URL item carries whatever scope its capture yields. Cropping an
  existing capture into a new item is a deliberate v1 omission rather than an
  oversight, and it is the natural direction for this decision to grow.
- Traits are atomic when mixed. A palette is taken whole; one hex value or one
  font pulled out of it is not selectable.
- A narrowly scoped item is the best mix ingredient, because it carries no
  competing traits. Partial captures are therefore first-class rather than
  degraded.
- Several items may share one source with no relation recorded between them
  beyond that shared source.
