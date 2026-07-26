# Design DNA

A local-first, single-user library of the web design and UI work worth keeping,
where everything saved is analysed into its design DNA and can be turned into a
copyable prompt.

## Language

### The library

**Item**:
One saved thing: a single source, a single capture, a single DNA. What you
browse, search, and draw traits from, and what one grid card represents.
_Avoid_: Element, Entry, Asset, Inspiration

**Source**:
Where an item came from: a web address or an uploaded file. Provenance, not a
place you can browse to.
_Avoid_: Origin, Reference, Resource

**Capture**:
The single image an item holds, fixed at the moment of saving and never changed
afterwards.
_Avoid_: Screenshot, Image, Thumbnail

**Scope**:
How much of a design an item's capture holds, from a whole page down to a single
component. Governs which traits the item can have at all.
_Avoid_: Level, Granularity, Crop

### The analysis

**DNA**:
The design analysis of one item, made up of its traits and its labels. An item
has exactly one.
_Avoid_: Analysis, Profile, Extraction, Breakdown

**Trait**:
One facet of a DNA that is design content read off the capture and worth
transplanting on its own, such as a palette or a type system. The unit of
mixing, and taken whole or not at all.
_Avoid_: Element, Facet, Aspect, Attribute

**Label**:
A taxonomy value carried by an item so it can be found. Describes an item
rather than contributing to a prompt, and so is never mixed.

**Note**:
Your own words on why an item was worth saving. Never written by the agent.
_Avoid_: Comment, Caption, Description

### Absence and authorship

**Not applicable**:
A trait the item's scope structurally excludes. A capture cropped to a button
has no page layout, and nothing is missing.
_Avoid_: N/A, Empty, None

**Undetermined**:
A trait the agent looked for and could not read from the capture. Something is
missing, and a later re-run or override can fill it.
_Avoid_: Unknown, Missing, Null

**Override**:
A trait or label value written by you rather than by the agent.
_Avoid_: Correction, Edit, Manual value

### The payoff

**Mix**:
A selection of traits drawn from several items, rendered into a single prompt.
_Avoid_: Blend, Combination, Board, Cart

**Prompt**:
The text an item or a mix puts on the clipboard. A design brief, never code.
_Avoid_: Export, Output, Snippet
