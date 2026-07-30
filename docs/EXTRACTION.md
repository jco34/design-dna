# How to extract a design philosophy

This is the doctrine. It is the single instruction for turning a resource into a
Design DNA, and it is authoritative for both producers named in
[ticket 008](../wayfinder/tickets/008-producer-cli-and-import-boundary.md):

- the `dna` CLI, whose extraction prompt is generated from this file's rules
- a Claude session reading a resource by hand, which is a first-class path

**Read this file first.** If you are an agent working in this repository and the
task is "look at this design and extract its DNA", everything you need is here.
Do not re-derive the procedure from `schema/`, and do not go spelunking through
`wayfinder/`. The record shape lives in [`schema/dna.ts`](../schema/dna.ts) and
the label vocabulary in [`schema/taxonomy.ts`](../schema/taxonomy.ts); this file
is how you decide what to put in them.

---

## 1. The two things you are producing, and they are not the same

| | The Capture | The DNA |
| --- | --- | --- |
| What it is | One static PNG, 2880x1800 | One JSON record of traits and labels |
| How many | Exactly one per Item, forever | Exactly one per Item |
| Records motion? | **No.** Animations are disabled at capture | **Yes**, as prose in the `motion` trait |
| Changes later? | Never | Only by `re-extract`, `relabel` or an Override |

This split is the whole reason deep interactive exploration is possible without
breaking anything. [Ticket 001](../wayfinder/tickets/001-what-a-captured-item-is.md)
locks one Capture per Item and
[ticket 003](../wayfinder/tickets/003-how-a-url-becomes-an-item.md) locks the
capture recipe at a fixed viewport with `animations: 'disabled'` and
`reducedMotion: 'reduce'`, because a Capture must be reproducible. None of that
forbids *looking* at a site properly. It only forbids the looking from changing
what the Capture is.

So: explore exhaustively, then photograph once, statically. What you learned
while exploring goes into words, not into pixels.

---

## 2. Protocol A: a URL

You are not taking a screenshot of a page. You are studying a design well enough
to describe how to build something with the same character, and the page is the
only evidence you get.

### A.1 Reach a photographable state

In order, with every wait bounded by a deadline and none of them a sleep:

1. `goto` at `load`.
2. `document.fonts.ready`, ceiling 5s. A webfont that never resolves must cost
   the ceiling, not the run.
3. Scroll to the bottom in 0.85-viewport steps, then return to the top. This
   gives lazy content a chance to start. **Do not trust it.** Ticket 003 measured
   a real page holding 42 first-viewport elements at `opacity < 0.05` both before
   and after this pass.
4. Wait for above-fold images to be `complete`, ceiling 5s. An image below the
   fold cannot appear in a viewport Capture, so blocking on it buys nothing.
5. Wait for `scrollHeight` stable across two consecutive animation frames,
   ceiling 3s. The last thing that moves on a settling page is usually its
   height.

`networkidle` and `waitForTimeout` are marked DISCOURAGED by Playwright's own
documentation. Neither appears anywhere in this pipeline.

### A.2 Refuse rather than photograph the wrong thing

Ticket 003 found `linear.app/no-such-page-xyz` returning **HTTP 200** with a
login screen, and dribbble returning **202**. A status check alone is not enough.
Refuse the Item, write nothing, and exit non-zero when any of these hold:

- `goto` throws, or the status is >= 400
- a visible `input[type=password]` is present, meaning you are looking at a login
- body text is under roughly 300 characters *and* `scrollHeight` is one viewport

Paywall *wording* is explicitly not a refusal trigger. A paywalled page often
renders a genuinely designed page, and that design is worth keeping.

Refuse before navigating at all when the design is not at the URL: Figma
`/file|/design|/proto|/board`, Dribbble `/shots/`, Behance `/gallery/`, Pinterest
`/pin/`, Google Docs and Drive, `*.notion.so` (but not `*.notion.site`),
`*.atlassian.net`. Say so, and name the file-handover path instead of capturing a
login screen.

A cross-host redirect is itself a signal. `www.spotify.com` redirecting to
`open.spotify.com` yielded an app shell with 13 undecoded above-fold images.

### A.3 The exploration pass

This is the part that produces the `motion` trait and sharpens every other one.
It runs **after** the wait recipe and **before** the Capture, and it must leave
the page in the state it found it: scrolled to the top, nothing toggled open,
nothing typed, nothing submitted.

Read-only means read-only. **Never** click anything that submits, authenticates,
purchases, posts, or navigates off-origin. Interaction here is for reading the
design, not for driving the product.

Work through these, and record what you observe rather than what you expect:

**Hover.** Every distinct interactive kind, once each: the primary button, a
secondary button, a nav link, a card, a table row, an input, a footer link. Note
what changes and how fast: colour, elevation, scale, border, underline, an icon
sliding, a cursor swap. Note when nothing changes at all, because restraint is a
design decision and is worth recording.

**Focus.** Keyboard-tab through the first several stops. A visible, well-designed
focus ring is a strong signal about how much craft went in, and its absence is
equally informative.

**Click, but only what is safe.** Menus, accordions, tabs, disclosure triangles,
carousel arrows, theme toggles, filter chips. Watch the transition, not just the
end state: does the panel slide, fade, spring, or snap? Close each thing you
open.

**Scroll.** Move down in stages and watch for reveal-on-scroll, parallax depth,
sticky headers changing height or gaining a shadow, progress indicators, counters
counting up, elements staggering in sequence rather than together.

**Load.** Reload once and watch the first 1500ms. Is there a considered entrance,
a skeleton, a fade, a stagger, or does everything simply appear?

**Ambient.** Anything that moves with no input at all: a marquee, a gradient
drift, a looping video, a cursor-following blob, a pulsing dot.

**Responsive, if it costs nothing.** A quick look at a narrow viewport tells you
whether the grid is genuinely fluid or merely stacks. Return to 1440x900 before
capturing.

Where the page makes it cheap, prefer measured values over impressions.
Computed styles carry real numbers: `transition-duration`, `transition-timing-function`,
`animation-name`, `transform`. A read of `240ms cubic-bezier(0.4, 0, 0.2, 1)` is
worth more than "a smooth transition", and unlike a colour read off pixels it is
exact rather than eyeballed.

### A.4 Capture

Fixed viewport `1440x900` at `deviceScaleFactor: 2`, `scale: 'device'`, never
`fullPage`, `animations: 'disabled'`, `caret: 'hide'`, context-level
`reducedMotion: 'reduce'`. Every Capture is therefore exactly 2880x1800 and
1.6:1, and the grid can treat that as a constant.

Full-page is rejected on measured evidence, not taste: across ten real sites a
full-page Capture would have ranged from 0.63:1 to 10.25:1 with a median of
7.57:1. No card grid survives that.

Consent banners are captured as noise rather than dismissed. Only 3 of 10 pages
showed one, each in the bottom eighth rather than over the hero, and a
13-vendor signature sweep still missed two first-party dialogs. Masking would
paint a rectangle that poisons palette extraction. The escape hatch is
`--headed --wait-before-capture <ms>`, not a rule engine.

---

## 3. Protocol B: an image

A supplied image is the whole world. There is no DOM to interrogate, no computed
style to read, and no second look available later. Read it accordingly.

### B.1 Look at the whole thing before looking at any part

Establish, in this order: what kind of thing this is, what the reading order is,
where the eye lands first and second, and what the single loudest element is.
Every later judgement depends on these, and a detail-first read produces an
inventory rather than an analysis.

### B.2 Then read it closely

Go region by region at full resolution rather than glancing at a downscaled
whole. For each region, name what is actually there:

**Colour.** Sample the large flat areas first, since those are the background and
surface. Then the type colour, then the one or two accents. Distinguish a true
surface from a background with a slight tint, and note where a colour is a
gradient rather than a flat fill.

**Type.** Measure relationships, not absolutes: the ratio between heading and
body size, the leading relative to the cap height, the tracking, the case, the
weight pairing. Name a typeface only when you actually recognise its letterforms.
If you cannot, leave the family empty and describe the character precisely
instead. "Geometric sans with a single-storey a and very short descenders" is
useful; "sans-serif" is not, and inventing "Inter" because it looks plausible is
worse than either.

**Edges and surfaces.** Corner radii, border weights and whether borders exist at
all, shadow spread and direction, whether surfaces are opaque or translucent,
whether there is visible texture, noise or blur.

**Spacing.** Where the rhythm is consistent and where it deliberately is not.
What proportion of the frame is empty. Whether the empty space is doing work.

**Imagery.** What kind, how treated, and whether it is content or decoration.

### B.3 Motion, on a still image

`motion` is **Undetermined** for a supplied still image. All of it. Not "none",
not a plausible guess from the visual style.

This matters enough to be a rule rather than a note. `none` is a statement about
the design: this design does not move. `undetermined` is a statement about the
reading: the evidence could not tell you. A still frame cannot distinguish a
deliberately static page from a heavily animated one caught mid-rest, so
claiming `none` asserts something you did not observe. Leave it Undetermined and
let a later `re-extract` or an Override fill it.

The one exception: if the image itself depicts motion design, such as a
storyboard, a timing diagram, or an annotated spec sheet with easing curves on
it, then you are reading motion content directly and should record what it says.

---

## 4. Reading the traits

Nine traits. Each is read off the evidence and is worth transplanting on its own.
Enum values below are the ones `schema/dna.ts` will accept; anything else fails
validation.

### palette

Five roles, each with a hex and a weight: `background`, `surface`, `ink`,
`muted`, `accent`.

Weights are `dominant`, `supporting`, `occasional`, `undetermined`, and they
describe how much of the design the colour carries, not how important it looks.

**Every hex you produce is approximate and must never be presented as exact.**
This is measured, not cautious: run against a synthetic image with four known
colours, ground truth `#10131a` came back as `#10131c` and `#10131e` on two runs
of the same input. Every value was biased, and no value was stable between runs.
Colour is read visually here, not sampled from pixels. The schema records this as
`authorship: "agent"`, and the prompt renderer hedges accordingly.

### typography

`headingFamily`, `headingCharacter`, `bodyFamily`, `bodyCharacter`, plus
`scale` (`tight` | `moderate` | `dramatic` | `undetermined`) and `weightRange`
(`uniform` | `paired` | `wide` | `undetermined`).

A family is a real typeface name or an empty string. Never a generic CSS family.
The character fields are where tracking, leading and case go, and they should be
specific enough to act on.

Note that `scale` was measured as unstable across runs on the same image, so it
is a judgement near a boundary rather than a fact. Do not agonise over it.

### composition

`structure` as prose, plus `contentWidth` (`full-bleed` | `wide` | `contained` |
`narrow` | `undetermined`).

`structure` describes the actual arrangement: what is pinned, what is centred,
what the column count is, what floats. Structurally excluded at `component`
scope, because `contentWidth` is meaningless for a picture of a button.

### spacing

`density` (`dense` | `balanced` | `airy` | `undetermined`) and `rhythm` as prose.
`rhythm` is where you say what the spacing actually does, including where it
breaks its own pattern.

### surfaceTreatment

`corners` (`sharp` | `slight` | `rounded` | `pill` | `mixed` | `undetermined`),
`borders` (`none` | `hairline` | `heavy` | `mixed` | `undetermined`),
`elevation` (`flat` | `subtle` | `pronounced` | `undetermined`), and `finish` as
prose for gloss, blur, translucency, texture and noise.

### imagery

`kind` (`none` | `photography` | `illustration` | `3d-render` |
`abstract-graphic` | `ui-screenshot` | `mixed` | `undetermined`) and `treatment`
as prose.

`none` is a real and common answer. Use it when the design genuinely has no
imagery, and reserve `undetermined` for when you cannot tell.

### motion

New at schemaVersion 2. Fully Undetermined for a still image, per B.3.

- `presence`: `none` | `restrained` | `prominent` | `pervasive` | `undetermined`
- `triggers`: nought to four of `hover`, `scroll`, `click`, `page-load`, `focus`,
  `ambient`
- `easing`: `linear` | `eased` | `spring` | `abrupt` | `mixed` | `undetermined`
- `pace`: `instant` | `brisk` | `measured` | `slow` | `undetermined`
- `character` as prose: what actually moves and how it feels, with real durations
  and curves where you read them
- `choreography` as prose: sequencing and staggering, what leads and what
  follows, and whether elements move together or in turn

Describe motion so it could be rebuilt, not so it sounds impressive. "Cards rise
4px and gain a soft shadow over about 200ms on an ease-out, one after another
with roughly 60ms between them" is transplantable. "Delightful micro-interactions"
is not.

### philosophy

One paragraph, 80 to 1200 characters, or an empty string for Undetermined.

This is the argument the design is making, not an inventory of its parts. The
failure mode to watch for is a paragraph that would be equally true of any dark
SaaS landing page. If what you wrote could be pasted onto a different design
without becoming false, it is not specific enough yet.

Say what the design is *for* and what it trades away to get there. A design that
withholds colour to make blur and reflection carry the interest is an argument. A
design that "uses a modern aesthetic with clean lines" is filler.

---

## 5. The Build

New alongside the nine traits, and different in kind from all of them: every
trait above is read off the evidence; the Build is your suggestion, and it is
labelled as one everywhere it appears - never as a trait, never in the Prompt.

`stack`: candidate tools and libraries, most load-bearing first, for example
`["Three.js", "React Three Fiber", "GSAP"]`. Freeform, not a closed
vocabulary: the tooling universe changes constantly and a fixed list would go
stale.

`techniques`: prose, the 2-4 methods that actually matter for replicating
this design specifically - "scroll-linked camera dolly, instanced meshes for
the particle field, a pinned hero section" - not a generic build plan.

Key off `imagery`, `motion` and `composition`. A still, typographic, static
page calls for almost nothing distinctive, and an empty stack with empty
`techniques` is the honest answer for it: **Undetermined is a correct answer
here too.** A 3D or heavily animated design is where the Build earns its
keep.

**Never invent internals you cannot see.** No state-management, backend or
data layer claims - a screenshot cannot show you Redux. Suggest from the
visible design language only.

---

## 6. Labels

Three axes, all closed vocabularies. A label describes an Item so it can be
found; it is never mixed into a prompt and never contributes design content.

- **genre**, exactly one: `landing-page`, `product-ui`, `dashboard`, `editorial`,
  `portfolio`, `commerce`, `docs`, `undetermined`
- **style**, nought to two: `brutalist`, `swiss`, `technical`, `organic`,
  `maximalist`, `retro`, `glassmorphism`, `experimental`
- **mood**, nought to two: `calm`, `bold`, `playful`, `serious`, `refined`

The definitions live in the `*_GLOSS` records in
[`schema/taxonomy.ts`](../schema/taxonomy.ts) and are the same words the
generation schema shows the agent, by construction.

An empty `style` or `mood` array is a correct and expected answer. It means
nothing in the closed list is close, and an item with no named idiom is simply
ordinary. Never stretch a member to fit, and never invent a value.

---

## 7. Honesty rules

These are the ones that make the library worth having, and every one of them is
easier to break than to follow.

**Undetermined is not failure.** It means you looked and the evidence could not
tell you. It is recoverable: a re-run or an Override can fill it. A confident
wrong value is not recoverable, because nothing marks it as needing a second
look.

**Distinguish "the design lacks this" from "I could not read this".** Every enum
has a member for genuine absence (`none`, `flat`, `uniform`) *and*
`undetermined`. Reaching for the wrong one silently converts a gap in your
reading into a claim about the design.

**Never write the Note.** The Note is the owner's words on why an Item was worth
saving. Leave it `null`. The five seed Items carry demo notes and each one says
so; they carry no weight.

**Never write the Scope.** Scope is producer-supplied fact. The CLI knows whether
it took a whole viewport, a `--selector` or a `--clip`, which is strictly more
reliable than inferring it from pixels.

**Re-extraction is not idempotent.** The same image yields different hexes and
sometimes a different `typography.scale`. This is why an Override, not a re-run,
is the primary way to correct a value, and why `re-extract` refuses to overwrite
an Item file with uncommitted changes.

**Specificity beats coverage.** A trait left Undetermined costs one field. A
plausible-sounding fabrication costs the credibility of every field beside it.

**The Build is a suggestion, not a reading.** Everywhere else Undetermined
means "I looked and could not tell"; for the Build it can also mean "nothing
about this design calls for anything distinctive", and that is still the
honest answer. What it must never mean is a guess at internals the design
cannot show you.

---

## 8. What this doctrine is worth checking against

After any hand-written or migrated Item:

```bash
npx tsx schema/check-library.ts
```

It validates every Item against the schema, checks each filename matches the `id`
inside it, checks every `capture.file` exists, reports orphaned Captures, and
checks `notApplicable` agrees with what the Item's Scope actually excludes. It
exits non-zero on any problem.
