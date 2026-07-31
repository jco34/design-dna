/**
 * Design DNA - the copyable prompt.
 *
 * Ticket 007. `renderPrompt(item)` returns exactly the string the copy button
 * puts on the clipboard. `renderPrompt(item, { traits })` returns the
 * trait-subset prompt ticket 010 needs, in the same voice and from the same
 * code path.
 *
 * Three properties this file is designed to have, each of them load-bearing:
 *
 *   Pure.        No I/O, no clock, no `Date` construction, no `Intl`, no
 *                locale, no randomness. The same Item renders to the same
 *                bytes on every machine, forever. Dates are formatted by
 *                slicing the stored ISO-8601 string rather than parsing it,
 *                so no timezone can shift the rendered day.
 *
 *   On demand.   Nothing here is stored. The prompt is a projection of the
 *                Item and only of the Item, so editing this file improves
 *                every prompt in the library retroactively, and an Override
 *                on a trait shows up in the prompt the moment it is written.
 *                A prompt frozen at capture time could do neither.
 *
 *   One template. The full prompt is the subset render with every trait
 *                selected. There is no second template for a palette-only
 *                prompt, because a second template is a second thing to keep
 *                good and 010 would then need a third.
 *
 * Depends only on `004-extraction-schema.ts`, and only on its types plus
 * `traitState` and `isApproximate`.
 *
 * Deliberately absent: `labels`. CONTEXT.md defines a Label as something that
 * "describes an item rather than contributing to a prompt", so labels are how
 * you find an item and never part of what it says.
 */
import type { Item, TraitName } from './dna';
import { isApproximate, traitState } from './dna';

/* ------------------------------------------------------------------ */
/* Public surface                                                      */
/* ------------------------------------------------------------------ */

export interface PromptOptions {
  /**
   * Which traits to render. Omit for the full prompt. Supplying this - even
   * with all seven - makes it a *subset* render, which frames itself
   * differently and suppresses the Note by default.
   *
   * Order is ignored: output always follows the canonical order below, so two
   * selections of the same traits render identically.
   */
  traits?: readonly TraitName[];
  /**
   * Your Note. Defaults to on for a full render and off for a subset, because
   * a note about the pricing row is misdirection in a palette-only prompt.
   */
  includeNote?: boolean;
  /** The trailing provenance line. Defaults to on. */
  includeSource?: boolean;
}

/**
 * Canonical order. `philosophy` leads because 002 found it the most stable and
 * most substantive thing the agent produces, and because a brief that opens
 * with intent frames every fact after it. The remaining six follow 004's own
 * field order.
 */
export const PROMPT_TRAIT_ORDER: readonly TraitName[] = [
  'philosophy',
  'palette',
  'typography',
  'composition',
  'spacing',
  'surfaceTreatment',
  'imagery',
  // Motion last of the readings: everything above it is true of a single frame,
  // and this is the only section describing what happens over time. Reading it
  // after the static picture is established is the same order the CLI observes
  // it in.
  'motion',
];

export function renderPrompt(item: Item, options: PromptOptions = {}): string {
  const isSubset = options.traits !== undefined;
  const requested = new Set<TraitName>(options.traits ?? PROMPT_TRAIT_ORDER);
  const readable = PROMPT_TRAIT_ORDER.filter(
    (t) => requested.has(t) && traitState(item, t) === 'present',
  );

  // Undetermined and Not applicable are both rendered as silence. A line
  // saying "type scale: undetermined" spends tokens telling the reader
  // nothing and invites it to fill the gap on your authority; saying nothing
  // lets it choose freely, which is the honest instruction.
  if (readable.length === 0) return renderNothingReadable(item, isSubset, requested);

  const blocks: string[] = [frame(item, isSubset, readable)];

  for (const trait of readable) {
    const section = renderTrait(item, trait);
    if (section !== null) blocks.push(section);
  }

  const wantNote = options.includeNote ?? !isSubset;
  if (wantNote && item.note !== null && item.note.trim() !== '') {
    blocks.push(`What I wanted from this: ${asSentence(item.note)}`);
  }

  if (options.includeSource ?? true) blocks.push(provenance(item));

  return blocks.join('\n\n');
}

/* ------------------------------------------------------------------ */
/* The frame                                                           */
/* ------------------------------------------------------------------ */

/*
 * The one imperative in the whole prompt, and it is about the block rather
 * than about what to build. The prompt does not know what you are making, so
 * it never says "build a landing page"; it hands over a design language and
 * lets your own sentence supply the task. Two instructions in one message
 * collide. A brief composes.
 */
function frame(item: Item, isSubset: boolean, readable: readonly TraitName[]): string {
  if (!isSubset) {
    return `Design brief. Work in the spirit of the design described below rather than reproducing it. It describes ${scopeEnglish(item.scope)}.`;
  }
  return (
    `Design brief, covering only ${list(readable.map(traitEnglish))}. ` +
    `Work in its spirit rather than reproducing it. It is drawn from ${scopeEnglish(item.scope)} ` +
    `and says nothing about the rest of that design; the rest is yours to choose.`
  );
}

function renderNothingReadable(
  item: Item,
  isSubset: boolean,
  requested: ReadonlySet<TraitName>,
): string {
  if (!isSubset) return 'This item has no readable design analysis to render.';
  const asked = PROMPT_TRAIT_ORDER.filter((t) => requested.has(t)).map(traitEnglish);
  const excluded = PROMPT_TRAIT_ORDER.filter(
    (t) => requested.has(t) && traitState(item, t) === 'not_applicable',
  );
  const why =
    excluded.length === asked.length
      ? `this item is ${scopeEnglish(item.scope)}, which has none`
      : 'the analysis could not read it';
  return `This item has nothing readable to say about ${list(asked)}: ${why}.`;
}

/* ------------------------------------------------------------------ */
/* One section per trait                                               */
/* ------------------------------------------------------------------ */

function renderTrait(item: Item, trait: TraitName): string | null {
  switch (trait) {
    case 'philosophy':
      // No label. The lead paragraph is the brief speaking in its own voice.
      return item.dna.philosophy.text.trim() === '' ? null : asSentence(item.dna.philosophy.text);
    case 'palette':
      return section('Palette', palette(item));
    case 'typography':
      return section('Type', typography(item));
    case 'composition':
      return section('Composition', composition(item));
    case 'spacing':
      return section('Space', spacing(item));
    case 'surfaceTreatment':
      return section('Surfaces', surfaces(item));
    case 'imagery':
      return section('Imagery', imagery(item));
    case 'motion':
      return section('Motion', motion(item));
  }
}

function section(label: string, body: string | null): string | null {
  return body === null || body.trim() === '' ? null : `${label}\n${body}`;
}

/* --- Palette ------------------------------------------------------- */

type Swatch = Item['dna']['palette']['background'];

const ROLE_LABEL: Record<keyof Item['dna']['palette'], string> = {
  background: 'Background',
  surface: 'Surface',
  ink: 'Ink',
  muted: 'Muted',
  accent: 'Accent',
};

/*
 * `weight` sits on the same line as the hex rather than in a paragraph,
 * because 004 section 3.2 asked for accent restraint next to the value. The
 * English below is the same English 004's JSON Schema used to *define* each
 * enum member, so the agent that wrote the value and the model that reads it
 * are working from one definition.
 */
const WEIGHT_PHRASE: Record<Swatch['weight'], string | null> = {
  dominant: 'carrying most of the visible area',
  supporting: 'a substantial secondary share',
  occasional: 'small deliberate moments only',
  undetermined: null,
};

/**
 * How approximation surfaces, and it surfaces per value rather than as a
 * footnote. 004 section 3.4 put `authorship` on each swatch precisely so that
 * correcting one hex cannot silently stop the other four being hedged; a
 * single "values are approximate" line at the bottom would do exactly that.
 * The marker is the word "around" rather than a tilde, because the prompt is
 * read by a person as well as by a model and `~#c8452d` is a glyph either of
 * them may skip. An unhedged hex therefore means someone measured or wrote it.
 */
function colourPhrase(swatch: Swatch): string | null {
  if (swatch.hex === '') return null;
  return isApproximate(swatch) ? `around ${swatch.hex}` : swatch.hex;
}

function palette(item: Item): string | null {
  const lines: string[] = [];
  for (const role of Object.keys(ROLE_LABEL) as (keyof Item['dna']['palette'])[]) {
    const swatch = item.dna.palette[role];
    const colour = colourPhrase(swatch);
    const weight = WEIGHT_PHRASE[swatch.weight];
    // A role whose colour was not read still tells you something if its share
    // was: "there is a dominant background, and it was not legible" is a real
    // instruction to pick one and let it dominate.
    if (colour === null && weight === null) continue;
    const parts = [ROLE_LABEL[role], colour ?? 'colour not read'];
    if (weight !== null) parts.push(weight);
    lines.push(`- ${parts.join(', ')}`);
  }
  return lines.length === 0 ? null : lines.join('\n');
}

/* --- Type ---------------------------------------------------------- */

const SCALE_PHRASE: Record<Item['dna']['typography']['scale'], string | null> = {
  tight: 'A tight size range between the largest and smallest text',
  moderate: 'A moderate size range between the largest and smallest text',
  dramatic: 'A dramatic size range between the largest and smallest text',
  undetermined: null,
};

const WEIGHT_RANGE_PHRASE: Record<Item['dna']['typography']['weightRange'], string | null> = {
  uniform: 'one weight throughout',
  paired: 'two weights working as a pair',
  wide: 'a wide spread of weights',
  undetermined: null,
};

function typography(item: Item): string | null {
  const t = item.dna.typography;
  const lines: string[] = [];

  const face = (label: string, family: string, character: string): string | null => {
    if (family === '' && character === '') return null;
    if (family === '') return `- ${label}: ${asSentence(character)}`;
    return `- ${label}: ${asSentence(family)}${character === '' ? '' : ` ${asSentence(character)}`}`;
  };

  const heading = face('Headings', t.headingFamily, t.headingCharacter);
  const body = face('Body', t.bodyFamily, t.bodyCharacter);
  if (heading !== null) lines.push(heading);
  if (body !== null) lines.push(body);

  const scale = SCALE_PHRASE[t.scale];
  const weight = WEIGHT_RANGE_PHRASE[t.weightRange];
  if (scale !== null && weight !== null) lines.push(`- ${scale}, carried by ${weight}.`);
  else if (scale !== null) lines.push(`- ${scale}.`);
  else if (weight !== null) lines.push(`- ${capitalise(weight)}.`);

  // 004 decision 8: an empty family with a non-empty character means the type
  // was read but not named. Say so once, rather than repeating a disclaimer on
  // each line, and say what to do about it.
  const unnamed =
    t.headingFamily === '' && t.headingCharacter !== ''
      ? t.bodyFamily === '' && t.bodyCharacter !== ''
        ? 'Neither face is named'
        : 'The heading face is not named'
      : t.bodyFamily === '' && t.bodyCharacter !== ''
        ? 'The body face is not named'
        : null;
  if (unnamed !== null && lines.length > 0) {
    lines.push(`${unnamed}; match the character rather than hunting for the name.`);
  }

  return lines.length === 0 ? null : lines.join('\n');
}

/* --- Composition --------------------------------------------------- */

const WIDTH_PHRASE: Record<Item['dna']['composition']['contentWidth'], string | null> = {
  'full-bleed': 'Content runs edge to edge.',
  wide: 'Content sits in a wide measure.',
  contained: 'Content sits in a contained measure rather than running the full width.',
  narrow: 'Content sits in a narrow measure.',
  undetermined: null,
};

function composition(item: Item): string | null {
  const c = item.dna.composition;
  const parts: string[] = [];
  if (c.structure.trim() !== '') parts.push(asSentence(c.structure));
  const width = WIDTH_PHRASE[c.contentWidth];
  if (width !== null) parts.push(width);
  return parts.length === 0 ? null : parts.join(' ');
}

/* --- Space --------------------------------------------------------- */

const DENSITY_PHRASE: Record<Item['dna']['spacing']['density'], string | null> = {
  dense: 'Dense overall.',
  balanced: 'Balanced overall.',
  airy: 'Airy overall.',
  undetermined: null,
};

function spacing(item: Item): string | null {
  const s = item.dna.spacing;
  const parts: string[] = [];
  const density = DENSITY_PHRASE[s.density];
  if (density !== null) parts.push(density);
  if (s.rhythm.trim() !== '') parts.push(asSentence(s.rhythm));
  return parts.length === 0 ? null : parts.join(' ');
}

/* --- Surfaces ------------------------------------------------------ */

const CORNER_PHRASE: Record<Item['dna']['surfaceTreatment']['corners'], string | null> = {
  sharp: 'square corners',
  slight: 'slightly softened corners',
  rounded: 'clearly rounded corners',
  pill: 'fully pill-shaped corners',
  mixed: 'mixed corner treatments',
  undetermined: null,
};

const BORDER_PHRASE: Record<Item['dna']['surfaceTreatment']['borders'], string | null> = {
  none: 'no borders',
  hairline: 'hairline borders',
  heavy: 'heavy borders',
  mixed: 'mixed border weights',
  undetermined: null,
};

const ELEVATION_PHRASE: Record<Item['dna']['surfaceTreatment']['elevation'], string | null> = {
  flat: 'no elevation',
  subtle: 'subtle elevation',
  pronounced: 'pronounced elevation',
  undetermined: null,
};

function surfaces(item: Item): string | null {
  const s = item.dna.surfaceTreatment;
  const material = [
    CORNER_PHRASE[s.corners],
    BORDER_PHRASE[s.borders],
    ELEVATION_PHRASE[s.elevation],
  ].filter((p): p is string => p !== null);

  const parts: string[] = [];
  if (material.length > 0) parts.push(`${capitalise(material.join(', '))}.`);
  if (s.finish.trim() !== '') parts.push(asSentence(s.finish));
  return parts.length === 0 ? null : parts.join(' ');
}

/* --- Imagery ------------------------------------------------------- */

const IMAGERY_PHRASE: Record<Item['dna']['imagery']['kind'], string | null> = {
  none: 'No imagery.',
  photography: 'Photography.',
  illustration: 'Illustration.',
  '3d-render': '3D renders.',
  'abstract-graphic': 'Abstract graphics.',
  'ui-screenshot': 'UI screenshots.',
  mixed: 'Mixed imagery.',
  undetermined: null,
};

function imagery(item: Item): string | null {
  const i = item.dna.imagery;
  const parts: string[] = [];
  const kind = IMAGERY_PHRASE[i.kind];
  if (kind !== null) parts.push(kind);
  if (i.treatment.trim() !== '') parts.push(asSentence(i.treatment));
  return parts.length === 0 ? null : parts.join(' ');
}

/* --- Motion -------------------------------------------------------- */

/*
 * `presence: 'none'` is the one member here that renders as a full sentence on
 * its own, because "nothing moves" is a real and actionable instruction: it
 * tells the receiving model to resist adding motion it would otherwise supply
 * by default. `undetermined` stays silent, per the rule at the top of this file,
 * and the difference between the two is exactly the difference between a fact
 * about the design and a gap in the reading.
 */
const PRESENCE_PHRASE: Record<Item['dna']['motion']['presence'], string | null> = {
  none: 'Nothing moves. Treat stillness as deliberate rather than unfinished.',
  restrained: 'Motion is restrained, used only where it clarifies.',
  prominent: 'Motion is prominent and part of the design language.',
  pervasive: 'Motion is pervasive; almost everything responds.',
  undetermined: null,
};

const EASING_PHRASE: Record<Item['dna']['motion']['easing'], string | null> = {
  linear: 'linear timing',
  eased: 'eased timing',
  spring: 'spring physics rather than fixed curves',
  abrupt: 'abrupt state changes rather than transitions',
  mixed: 'mixed timing functions',
  undetermined: null,
};

const PACE_PHRASE: Record<Item['dna']['motion']['pace'], string | null> = {
  instant: 'an instant pace',
  brisk: 'a brisk pace',
  measured: 'a measured pace',
  slow: 'a slow pace',
  undetermined: null,
};

const TRIGGER_PHRASE: Record<Item['dna']['motion']['triggers'][number], string> = {
  hover: 'hover',
  scroll: 'scroll',
  click: 'click',
  'page-load': 'page load',
  focus: 'keyboard focus',
  ambient: 'nothing at all, running ambiently',
  drag: 'drag',
};

function motion(item: Item): string | null {
  const m = item.dna.motion;
  const parts: string[] = [];

  const presence = PRESENCE_PHRASE[m.presence];
  if (presence !== null) parts.push(presence);

  // Suppressed when nothing moves: naming what would trigger motion in a design
  // that has none is a contradiction, and the agent can emit both.
  if (m.presence !== 'none' && m.triggers.length > 0) {
    parts.push(`Triggered by ${list(m.triggers.map((t) => TRIGGER_PHRASE[t]))}.`);
  }

  const timing = [EASING_PHRASE[m.easing], PACE_PHRASE[m.pace]].filter(
    (p): p is string => p !== null,
  );
  if (timing.length > 0) parts.push(`${capitalise(timing.join(' at '))}.`);

  if (m.character.trim() !== '') parts.push(asSentence(m.character));
  if (m.choreography.trim() !== '') parts.push(asSentence(m.choreography));

  return parts.length === 0 ? null : parts.join(' ');
}

/* ------------------------------------------------------------------ */
/* Provenance                                                          */
/* ------------------------------------------------------------------ */

/*
 * The Source is named, last, and defused in the same breath. Naming it is
 * real grounding and is what keeps a prompt traceable back into the library
 * once it has been pasted somewhere and outlived the tab it came from.
 * Leading with it would invite the receiving model to answer from its memory
 * of the site rather than from the seven traits above, which would make the
 * whole extraction apparatus decorative.
 *
 * A local path is never rendered. 004 keeps `originalPath` as a citation for
 * the library; on a clipboard it is noise at best and a leak of your directory
 * structure at worst.
 */
function provenance(item: Item): string {
  const url: string | null = item.source.kind === 'url' ? item.source.url : item.source.url;
  const day = item.capture.takenAt === null ? null : formatDay(item.capture.takenAt);
  const when = day === null ? '' : ` on ${day}`;
  if (url === null) return `Captured from an image supplied by hand${when}.`;
  return (
    `Captured from ${url}${when}. ` +
    `Provenance only: work from the description above rather than from memory of the site.`
  );
}

/* ------------------------------------------------------------------ */
/* Plain-text helpers                                                  */
/* ------------------------------------------------------------------ */

const SCOPE_ENGLISH: Record<Item['scope'], string> = {
  page: 'a whole page',
  section: 'one section of a page',
  component: 'a single component',
};
const scopeEnglish = (scope: Item['scope']): string => SCOPE_ENGLISH[scope];

const TRAIT_ENGLISH: Record<TraitName, string> = {
  palette: 'the colour system',
  typography: 'the type system',
  composition: 'the composition',
  spacing: 'the spacing',
  surfaceTreatment: 'the surface treatment',
  imagery: 'the imagery',
  motion: 'the motion',
  philosophy: 'the design intent',
};
const traitEnglish = (trait: TraitName): string => TRAIT_ENGLISH[trait];

function list(items: readonly string[]): string {
  if (items.length === 0) return 'nothing';
  if (items.length === 1) return items[0]!;
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]!}`;
}

/**
 * Trim, sentence-case, and end with a full stop unless it is already
 * punctuated. The agent's prose leaves are written as descriptive fragments
 * ("hairline borders, no elevation"), so the renderer is what turns a fragment
 * into a sentence. Without this the brief reads as a database dump with
 * lowercase section bodies.
 */
function asSentence(text: string): string {
  const trimmed = text.trim();
  if (trimmed === '') return '';
  const punctuated = /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
  return capitalise(punctuated);
}

/**
 * Uppercase the first letter, unless doing so would damage a name that is
 * lowercase on purpose. `iOS`, `eBay` and `xAI` all begin lowercase-then-
 * uppercase, and are left alone.
 */
function capitalise(text: string): string {
  const first = text.charAt(0);
  if (first !== first.toLowerCase()) return text;
  if (/^[a-z][A-Z]/.test(text)) return text;
  return first.toUpperCase() + text.slice(1);
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/**
 * `2026-07-19T21:14:02.000Z` -> `19 July 2026`, by slicing rather than by
 * constructing a `Date`. Parsing would make the rendered day depend on the
 * reader's timezone, which would break the purity this file claims.
 */
function formatDay(instant: string): string {
  const [year, month, day] = instant.slice(0, 10).split('-');
  const name = MONTHS[Number(month) - 1];
  if (year === undefined || name === undefined || day === undefined) return instant.slice(0, 10);
  return `${Number(day)} ${name} ${year}`;
}
