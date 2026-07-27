# Design DNA

A local-first, single-user library of the web design and UI work worth keeping,
where everything saved is analysed into its design DNA and can be turned into a
copyable prompt.

## Language

### The library

**Library**:
Everything saved, taken together. One folder you can copy whole; nothing an item
needs lives outside it.
_Avoid_: Database, Store, Collection

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

**Swatch**:
One colour of a palette: the role it performs in the design and how much of the
design it carries. Never meaningful on its own, since a palette is taken whole.
_Avoid_: Colour, Hex, Token

**Label**:
A taxonomy value carried by an item so it can be found. Describes an item
rather than contributing to a prompt, and so is never mixed.
_Avoid_: Tag, Category, Keyword, Facet

**Axis**:
One of the three fixed questions a label answers: what kind of designed thing
this is, which visual idiom it belongs to, how it feels. Its values are a closed
list, and an item's answer on one axis is a single judgement whether it holds
one value or two.
_Avoid_: Facet, Category, Dimension, Tag

**Genre**:
The axis naming what kind of designed thing an item shows: its job rather than
its look. Exactly one value.
_Avoid_: Type, Kind, Surface type

**Style**:
The axis naming the visual idiom an item belongs to: its look rather than its
job. Nought to two values, since a design can sit in two schools at once and an
item with no named idiom is ordinary.
_Avoid_: Aesthetic, Genre, Look

**Mood**:
The axis naming how a design feels to someone seeing it for the first time.
Nought to two values.
_Avoid_: Tone, Feel, Vibe

**Note**:
Your own words on why an item was worth saving. Never written by the agent.
_Avoid_: Comment, Caption, Description

### Absence and authorship

**Not applicable**:
A trait the item's scope structurally excludes. A capture cropped to a button
has no page layout, and nothing is missing.
_Avoid_: N/A, Empty, None

**Undetermined**:
A trait, or one part of a trait, that the agent looked for and could not read
from the capture. Something is missing, and a later re-run or override can fill
it.
_Avoid_: Unknown, Missing, Null

**Authorship**:
How a stored value came to be there: read off the capture by the agent,
measured from the capture by a tool, or written by you. Carried by every trait
and every label. A value the agent read is approximate and is never presented
as exact.
_Avoid_: Confidence, Precision, Provenance

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
