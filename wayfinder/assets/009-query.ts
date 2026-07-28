/**
 * Design DNA - search, filter and sort.
 *
 * Ticket 009. Every function here is pure and synchronous: no I/O, no React, no
 * framework, no clock, no randomness, no network. The app hands in the array
 * 006's directory scan already produced and gets back the array the grid
 * renders. That is the whole architecture, and it is affordable because 006
 * measured a fully Zod-validated scan of 300 Items at 31ms, so there is no
 * index to build, no cache to invalidate and no query language to parse.
 *
 * Four things this module is designed to be:
 *
 *   Subtractive. There is one grid and every control removes items from it.
 *                Nothing here ranks, scores or returns a "result list", because
 *                009 decided browsing dominates searching at this scale.
 *
 *   Monotone.    Adding a value to a facet can only ever *widen* the grid
 *                (OR within an axis), so no sequence of facet clicks can walk
 *                you into an empty page. Only crossing axes narrows.
 *
 *   Total.       Every facet buckets every Item. `style` with no values lands
 *                in `none`; a colour that was never read lands in
 *                `undetermined`. No Item can hide from a facet.
 *
 *   Derived.     Light/dark and colour temperature are computed here from the
 *                palette on every read and stored nowhere, which is what 005
 *                rejected them as facets *for*: "the best facet on the list is
 *                the one you must not store".
 *
 * Dependencies: 004's schema module and 005's taxonomy module, and nothing
 * else. Colour maths is written out rather than pulled in, since it is 40 lines
 * of arithmetic and this module is on the app's read path.
 */
import type { Item, SwatchAuthorship, SwatchWeight } from '../../schema/index.js';
import {
  Borders,
  ContentWidth,
  Corners,
  Density,
  Elevation,
  GENRES,
  ImageryKind,
  MOODS,
  SCOPES,
  STYLES,
  TypeScale,
  WeightRange,
} from '../../schema/index.js';

/* ------------------------------------------------------------------ */
/* The record this module reads                                        */
/* ------------------------------------------------------------------ */

/**
 * What this module reads: the assembled `Item` from the shared `schema/`
 * module. That record already carries `taxonomyVersion` and the three-axis
 * `dna.labels` object 005 defined, so `LibraryItem` is a naming alias rather
 * than a widening. The alias exists so 011 and the app can name "an Item as the
 * grid holds it" without depending on where the type is declared.
 */
export type LibraryItem = Item;

export const PALETTE_ROLES = ['background', 'surface', 'ink', 'muted', 'accent'] as const;
export type PaletteRole = (typeof PALETTE_ROLES)[number];

/* ------------------------------------------------------------------ */
/* Colour: sRGB to OKLab, and the distance between two colours         */
/* ------------------------------------------------------------------ */

export interface Oklab {
  readonly L: number;
  readonly a: number;
  readonly b: number;
}

export interface Oklch {
  readonly L: number;
  readonly C: number;
  /** Degrees, 0 to 360. Meaningless when C is near zero. */
  readonly h: number;
}

const HEX6 = /^#?([0-9a-fA-F]{6})$/;
const HEX3 = /^#?([0-9a-fA-F]{3})$/;

/**
 * `#ABC`, `abc`, `#5E6AD2` and `5e6ad2` all become `#5e6ad2`. Anything else,
 * including 004's `""` for an Undetermined swatch, becomes null.
 *
 * The three-digit form is accepted because it is what a person types from
 * memory, and the empty string is rejected rather than defaulted because a
 * swatch the agent could not read must never silently answer a colour query.
 */
export function normaliseHex(raw: string): string | null {
  const text = raw.trim().toLowerCase();
  const six = HEX6.exec(text);
  if (six !== null && six[1] !== undefined) return `#${six[1]}`;
  const three = HEX3.exec(text);
  if (three !== null && three[1] !== undefined) {
    const [r, g, b] = three[1].split('');
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return null;
}

const linear = (v: number): number =>
  v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);

/**
 * sRGB to OKLab (Ottosson 2020), via the linear-light LMS cube-root form.
 *
 * OKLab rather than CIELAB or CIEDE2000, and the argument is about the input
 * rather than about the metric. 002 measured that a stored hex is eyeballed:
 * biased a few units and unstable between runs of the same image. CIEDE2000 is
 * the more accurate measure for the problem it was built for, which is *small*
 * differences under controlled illumination; this query asks about *large*
 * differences between screen colours whose own error is larger than the gap
 * between the two metrics. OKLab is hue-linear, is a true Euclidean metric (so
 * "sort by distance" is well behaved, which CIEDE2000's rotation term does not
 * guarantee), has no discontinuities and no lookup tables, and was designed for
 * exactly this: manipulating colour on screens.
 */
export function hexToOklab(hex: string): Oklab | null {
  const h = normaliseHex(hex);
  if (h === null) return null;
  const r = linear(parseInt(h.slice(1, 3), 16) / 255);
  const g = linear(parseInt(h.slice(3, 5), 16) / 255);
  const b = linear(parseInt(h.slice(5, 7), 16) / 255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

export function hexToOklch(hex: string): Oklch | null {
  const lab = hexToOklab(hex);
  if (lab === null) return null;
  const C = Math.hypot(lab.a, lab.b);
  const h = ((Math.atan2(lab.b, lab.a) * 180) / Math.PI + 360) % 360;
  return { L: lab.L, C, h };
}

/** Euclidean distance in OKLab. Symmetric, and obeys the triangle inequality. */
export function deltaEOK(x: Oklab, y: Oklab): number {
  return Math.hypot(x.L - y.L, x.a - y.a, x.b - y.b);
}

/**
 * Below this OKLCH chroma a colour has no usable hue: `#08090a`, `#f7f8f8` and
 * `#8a8f98` all sit under it, `#5e6ad2` sits four times above it. Measured, not
 * guessed; see section 6 of `009-search-and-filter.md`.
 */
export const ACHROMATIC_CHROMA = 0.03;

/**
 * The three tolerances a colour query may use, in OKLab distance.
 *
 * `near` is the default and the floor is set by the data rather than by taste:
 * two honest readings of the same colour sit around 0.03 to 0.06 apart, so a
 * tolerance tighter than that would return different Items after a re-run,
 * which 002's non-idempotence makes a real event rather than a hypothetical.
 * A query cannot be more precise than the value it is querying.
 */
export const COLOUR_TOLERANCE = {
  exact: 0.05,
  near: 0.1,
  family: 0.2,
} as const;
export type ColourTolerance = keyof typeof COLOUR_TOLERANCE;

export interface ColourMatch {
  readonly role: PaletteRole;
  readonly hex: string;
  readonly distance: number;
  /** 004's per-swatch authorship, so 011 can hedge a match the way 007 does. */
  readonly authorship: SwatchAuthorship;
  readonly weight: SwatchWeight;
}

/**
 * The closest swatch in this Item's palette to `hex`, whatever the distance.
 *
 * **Minimum over all five roles, not the dominant swatch.** The dominant swatch
 * is almost always the background, and a background is almost always near-white
 * or near-black, so matching on it would fail for exactly the colours a person
 * remembers. A colour hunt is existential ("does this design have that orange
 * in it"), not an average, so `min` is the operator and `mean` would be
 * answering a question nobody asks.
 *
 * The role weight deliberately does not scale the distance. A small vivid
 * accent and a large dull field are equally findable, because memory is not
 * area-weighted. The matched role and weight come back in the result instead,
 * so the UI can say *where* it matched without the query pretending to rank.
 */
export function nearestSwatch(item: LibraryItem, hex: string): ColourMatch | null {
  const target = hexToOklab(hex);
  if (target === null) return null;
  let best: ColourMatch | null = null;
  for (const role of PALETTE_ROLES) {
    const swatch = item.dna.palette[role];
    const lab = hexToOklab(swatch.hex);
    if (lab === null) continue;
    const distance = deltaEOK(target, lab);
    if (best === null || distance < best.distance) {
      best = {
        role,
        hex: swatch.hex,
        distance,
        authorship: swatch.authorship,
        weight: swatch.weight,
      };
    }
  }
  return best;
}

/** The nearest swatch, but only if it is inside the tolerance. */
export function colourMatch(
  item: LibraryItem,
  hex: string,
  tolerance: number = COLOUR_TOLERANCE.near,
): ColourMatch | null {
  const best = nearestSwatch(item, hex);
  return best !== null && best.distance <= tolerance ? best : null;
}

/* ------------------------------------------------------------------ */
/* Derived facets: the two 005 refused to store                        */
/* ------------------------------------------------------------------ */

export type Lightness = 'dark' | 'light' | 'undetermined';

/**
 * "Show me the dark ones", which 005 called the best facet on its list and the
 * one it must not store.
 *
 * The test is relational before it is absolute: a design is dark when its
 * background is darker than its ink, which is what dark mode *means* and which
 * needs no threshold to argue about. The absolute fallback only runs when the
 * ink was not read, and it uses OKLab L rather than sRGB average or relative
 * luminance, both of which put mid-grey in the wrong half.
 *
 * `palette.background` alone, never the palette mean: a light page carrying
 * dark photography is a light page, and a mean would call it dark.
 */
export function lightnessOf(item: LibraryItem): Lightness {
  const background = hexToOklab(item.dna.palette.background.hex);
  if (background === null) return 'undetermined';
  const ink = hexToOklab(item.dna.palette.ink.hex);
  if (ink !== null && Math.abs(background.L - ink.L) > 0.05) {
    return background.L < ink.L ? 'dark' : 'light';
  }
  return background.L < 0.5 ? 'dark' : 'light';
}

export type Temperature = 'warm' | 'cool' | 'neutral' | 'undetermined';

/** The hue that reads warmest in OKLCH: orange, between red 29 and yellow 110. */
const WARM_POLE_DEG = 60;

const ROLE_SHARE: Record<SwatchWeight, number> = {
  dominant: 3,
  supporting: 2,
  occasional: 1,
  undetermined: 1,
};

/**
 * Where the palette sits on the warm/cool axis, from -1 (fully cool) to +1
 * (fully warm), or null when no swatch was read.
 *
 * Each swatch is projected onto the axis with `cos(h - 60deg)` rather than
 * averaged as an angle, which is what makes an orange-and-blue palette come out
 * *neutral* by cancellation instead of landing on some meaningless mean hue.
 * Contributions are weighted by chroma times 004's ordinal `weight`, so a grey
 * page with one indigo button is not called cool: a colour has to be both
 * saturated and present to move the number.
 */
export function warmth(item: LibraryItem): { score: number; chroma: number } | null {
  let weighted = 0;
  let total = 0;
  let chromaTotal = 0;
  let shareTotal = 0;
  for (const role of PALETTE_ROLES) {
    const swatch = item.dna.palette[role];
    const lch = hexToOklch(swatch.hex);
    if (lch === null) continue;
    const share = ROLE_SHARE[swatch.weight];
    const weight = lch.C * share;
    weighted += weight * Math.cos(((lch.h - WARM_POLE_DEG) * Math.PI) / 180);
    total += weight;
    chromaTotal += lch.C * share;
    shareTotal += share;
  }
  if (shareTotal === 0) return null;
  return {
    score: total === 0 ? 0 : weighted / total,
    chroma: chromaTotal / shareTotal,
  };
}

/** Above this the warm/cool reading is called; below it the palette is neutral. */
export const TEMPERATURE_BAND = 0.33;

export function temperatureOf(item: LibraryItem): Temperature {
  const w = warmth(item);
  if (w === null) return 'undetermined';
  if (w.chroma < ACHROMATIC_CHROMA) return 'neutral';
  if (w.score >= TEMPERATURE_BAND) return 'warm';
  if (w.score <= -TEMPERATURE_BAND) return 'cool';
  return 'neutral';
}

/**
 * The favourites facet, and it is derived rather than stored because the app
 * writes nothing (006 decision 13) and because an Item you would have starred
 * is an Item you wrote a Note on. See section 9 of the resolution.
 */
export function isNoted(item: LibraryItem): boolean {
  return item.note !== null && item.note.trim() !== '';
}

/* ------------------------------------------------------------------ */
/* Searchable text                                                     */
/* ------------------------------------------------------------------ */

/**
 * The deliberate subset, and the test that admitted each field is whether a
 * term found there *identifies* the Item rather than *describes* it.
 *
 * Everything else in the schema is excluded on purpose, and the four excluded
 * prose fragments (`headingCharacter`, `bodyCharacter`, `spacing.rhythm`,
 * `surfaceTreatment.finish`, `imagery.treatment`) are excluded for one reason:
 * each sits beside an enum facet that already answers the question it
 * elaborates, so searching them is a worse copy of a filter that is one click
 * away. Section 4 of the resolution has the argument and the miss it accepts.
 */
export const SEARCHABLE_FIELDS = [
  'note',
  'dna.philosophy.text',
  'dna.typography.headingFamily',
  'dna.typography.bodyFamily',
  'dna.composition.structure',
  'source.url',
  'source.originalPath',
] as const;

export function searchableText(item: LibraryItem): string {
  const parts: string[] = [
    item.note ?? '',
    item.dna.philosophy.text,
    item.dna.typography.headingFamily,
    item.dna.typography.bodyFamily,
    item.dna.composition.structure,
  ];
  if (item.source.kind === 'url') parts.push(item.source.url);
  else {
    parts.push(item.source.originalPath);
    if (item.source.url !== null) parts.push(item.source.url);
  }
  return parts.join(' ');
}

const COMBINING = /[̀-ͯ]/g;

/** Lowercase and strip diacritics, so `Söhne` is found by typing `sohne`. */
export function fold(text: string): string {
  return text.normalize('NFD').replace(COMBINING, '').toLowerCase();
}

/**
 * Split on everything that is not a letter or digit, which also splits
 * `neo-brutalist` into two tokens and `linear.app` into two, so both halves are
 * findable. Latin script only, which is what font names and English prose are.
 */
export function tokenize(text: string): string[] {
  return fold(text)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0);
}

/**
 * A term matches when it is a prefix of a whole token: `art` finds `artful` and
 * does not find `smart`. Plain substring matching was rejected for exactly that
 * second case, and stemming and fuzzy matching were rejected as tuning devices
 * for a corpus of a few hundred paragraphs.
 *
 * Terms are ANDed. Two words is the whole disambiguation mechanism, and it is
 * enough because the grid always shows how many Items are left.
 */
export function matchesTerms(item: LibraryItem, terms: readonly string[]): boolean {
  if (terms.length === 0) return true;
  const tokens = tokenize(searchableText(item));
  return terms.every((term) => tokens.some((token) => token.startsWith(term)));
}

/**
 * The one piece of syntax in the whole model, and it is a recognition rather
 * than a grammar: a hex in the search box is a colour query, not text.
 *
 * It earns its exception because a hex has no plausible reading as prose, is
 * unambiguous to detect, and because 002 makes the alternative useless anyway:
 * nobody recalls an eyeballed hex exactly, so a literal substring match on hex
 * strings would match nothing that a distance query would not match better.
 */
export function parseSearchText(raw: string): { terms: string[]; hex: string | null } {
  const terms: string[] = [];
  let hex: string | null = null;
  for (const word of raw.split(/\s+/)) {
    if (word === '') continue;
    const candidate = normaliseHex(word);
    if (candidate !== null && hex === null && /^#/.test(word.trim())) {
      hex = candidate;
      continue;
    }
    terms.push(...tokenize(word));
  }
  return { terms, hex };
}

/* ------------------------------------------------------------------ */
/* Facets                                                              */
/* ------------------------------------------------------------------ */

/** The bucket a multi-valued axis puts an Item in when it carries no values. */
export const NONE = 'none';
/** The bucket for a trait this Item's Scope structurally excludes. */
export const NOT_APPLICABLE = 'not-applicable';

export type FacetId =
  | 'genre'
  | 'style'
  | 'mood'
  | 'scope'
  | 'lightness'
  | 'temperature'
  | 'density'
  | 'noted'
  | 'contentWidth'
  | 'typeScale'
  | 'weightRange'
  | 'corners'
  | 'borders'
  | 'elevation'
  | 'imagery';

export interface FacetDef {
  readonly id: FacetId;
  /** What the UI calls it. */
  readonly label: string;
  /**
   * `primary` facets are the ones you hunt by when the design is
   * half-remembered; `secondary` ones are what you check after you have found
   * it. 011 shows the first tier and folds the second away.
   */
  readonly tier: 'primary' | 'secondary';
  /** Every bucket, in display order. The union of these is the whole library. */
  readonly values: readonly string[];
  /** Which buckets this Item falls in. Never empty: facets are total. */
  readonly valuesOf: (item: LibraryItem) => readonly string[];
}

const options = <T extends string>(schema: { options: readonly T[] }): readonly T[] =>
  schema.options;

export const FACETS: readonly FacetDef[] = [
  {
    id: 'genre',
    label: 'Kind',
    tier: 'primary',
    values: GENRES,
    valuesOf: (item) => [item.dna.labels.genre.value],
  },
  {
    id: 'style',
    label: 'Idiom',
    tier: 'primary',
    values: [...STYLES, NONE],
    valuesOf: (item) =>
      item.dna.labels.style.values.length === 0 ? [NONE] : item.dna.labels.style.values,
  },
  {
    id: 'mood',
    label: 'Feel',
    tier: 'primary',
    values: [...MOODS, NONE],
    valuesOf: (item) =>
      item.dna.labels.mood.values.length === 0 ? [NONE] : item.dna.labels.mood.values,
  },
  {
    id: 'scope',
    label: 'Scope',
    tier: 'primary',
    values: SCOPES,
    valuesOf: (item) => [item.scope],
  },
  {
    id: 'lightness',
    label: 'Light or dark',
    tier: 'primary',
    values: ['dark', 'light', 'undetermined'],
    valuesOf: (item) => [lightnessOf(item)],
  },
  {
    id: 'temperature',
    label: 'Temperature',
    tier: 'primary',
    values: ['warm', 'cool', 'neutral', 'undetermined'],
    valuesOf: (item) => [temperatureOf(item)],
  },
  {
    id: 'density',
    label: 'Density',
    tier: 'primary',
    values: options(Density),
    valuesOf: (item) => [item.dna.spacing.density],
  },
  {
    id: 'noted',
    label: 'Noted',
    tier: 'primary',
    values: ['noted', 'unnoted'],
    valuesOf: (item) => [isNoted(item) ? 'noted' : 'unnoted'],
  },
  {
    id: 'contentWidth',
    label: 'Content width',
    tier: 'secondary',
    values: [...options(ContentWidth), NOT_APPLICABLE],
    valuesOf: (item) =>
      item.notApplicable.includes('composition')
        ? [NOT_APPLICABLE]
        : [item.dna.composition.contentWidth],
  },
  {
    id: 'typeScale',
    label: 'Type scale',
    tier: 'secondary',
    values: options(TypeScale),
    valuesOf: (item) => [item.dna.typography.scale],
  },
  {
    id: 'weightRange',
    label: 'Weight range',
    tier: 'secondary',
    values: options(WeightRange),
    valuesOf: (item) => [item.dna.typography.weightRange],
  },
  {
    id: 'corners',
    label: 'Corners',
    tier: 'secondary',
    values: options(Corners),
    valuesOf: (item) => [item.dna.surfaceTreatment.corners],
  },
  {
    id: 'borders',
    label: 'Borders',
    tier: 'secondary',
    values: options(Borders),
    valuesOf: (item) => [item.dna.surfaceTreatment.borders],
  },
  {
    id: 'elevation',
    label: 'Elevation',
    tier: 'secondary',
    values: options(Elevation),
    valuesOf: (item) => [item.dna.surfaceTreatment.elevation],
  },
  {
    id: 'imagery',
    label: 'Imagery',
    tier: 'secondary',
    values: options(ImageryKind),
    valuesOf: (item) => [item.dna.imagery.kind],
  },
];

export const FACET_BY_ID: ReadonlyMap<FacetId, FacetDef> = new Map(
  FACETS.map((facet) => [facet.id, facet]),
);

export type FacetSelection = Partial<Record<FacetId, readonly string[]>>;

/**
 * **OR within an axis, AND across axes.** This is the load-bearing line in the
 * module and both halves are forced rather than chosen.
 *
 * OR within, because 005 capped `style` and `mood` at two values per Item, so
 * an AND-within-axis filter is *provably empty* on the third click and empty on
 * the second for single-valued `genre` and `scope`. Every axis in this taxonomy
 * would become unusable at a small fixed number of clicks. OR also buys the
 * property that makes `facetCounts` honest: adding a value can only widen.
 *
 * AND across, because each axis answers a different question and constraints
 * accumulate. The ticket's own example (`warm` AND `dense`) is an across-axis
 * query, not a within-axis one, which is what dissolves it.
 */
export function matchesFacets(item: LibraryItem, selection: FacetSelection): boolean {
  for (const facet of FACETS) {
    const selected = selection[facet.id];
    if (selected === undefined || selected.length === 0) continue;
    const held = facet.valuesOf(item);
    if (!selected.some((value) => held.includes(value))) return false;
  }
  return true;
}

/* ------------------------------------------------------------------ */
/* Sort                                                                */
/* ------------------------------------------------------------------ */

export type SortId = 'newest' | 'oldest' | 'hue';

export const SORTS: readonly { id: SortId; label: string }[] = [
  { id: 'newest', label: 'Newest first' },
  { id: 'oldest', label: 'Oldest first' },
  { id: 'hue', label: 'By colour' },
];

/**
 * The key that turns the grid into a spectrum: the hue of the most chromatic
 * swatch, with achromatic Items collected at the end and ordered dark to light.
 *
 * Most chromatic rather than dominant, for the same reason `nearestSwatch`
 * takes a minimum: the background carries the area but the accent carries the
 * memory. Sorting by it makes the grid itself a colour finder, which is a
 * browsing answer to a searching question and is why this sort exists at all.
 */
export function hueKey(item: LibraryItem): { achromatic: boolean; hue: number; light: number } {
  let best: Oklch | null = null;
  for (const role of PALETTE_ROLES) {
    const lch = hexToOklch(item.dna.palette[role].hex);
    if (lch === null) continue;
    if (best === null || lch.C > best.C) best = lch;
  }
  const background = hexToOklab(item.dna.palette.background.hex);
  const light = background?.L ?? 0;
  if (best === null || best.C < ACHROMATIC_CHROMA) return { achromatic: true, hue: 0, light };
  return { achromatic: false, hue: best.h, light };
}

/** Stable, total, and never dependent on the reader's clock or locale. */
export function sortItems(items: readonly LibraryItem[], sort: SortId): LibraryItem[] {
  const sorted = [...items];
  if (sort === 'hue') {
    const keys = new Map(sorted.map((item) => [item.id, hueKey(item)]));
    sorted.sort((a, b) => {
      const ka = keys.get(a.id)!;
      const kb = keys.get(b.id)!;
      if (ka.achromatic !== kb.achromatic) return ka.achromatic ? 1 : -1;
      if (ka.achromatic) return ka.light - kb.light || compareId(a, b);
      return ka.hue - kb.hue || compareId(a, b);
    });
    return sorted;
  }
  const direction = sort === 'oldest' ? 1 : -1;
  sorted.sort((a, b) => {
    if (a.addedAt !== b.addedAt) return a.addedAt < b.addedAt ? -direction : direction;
    return -direction * compareId(a, b);
  });
  return sorted;
}

const compareId = (a: LibraryItem, b: LibraryItem): number => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/* ------------------------------------------------------------------ */
/* The query                                                           */
/* ------------------------------------------------------------------ */

export interface ColourQuery {
  readonly hex: string;
  readonly tolerance: number;
}

export interface Query {
  readonly text: string;
  readonly facets: FacetSelection;
  readonly colour: ColourQuery | null;
  readonly sort: SortId;
}

export const EMPTY_QUERY: Query = { text: '', facets: {}, colour: null, sort: 'newest' };

export interface QueryResult {
  /** What the grid renders, in order. */
  readonly items: LibraryItem[];
  /** How many Items the library holds. The denominator in "47 of 312". */
  readonly total: number;
  /** Which swatch answered the colour query, per Item id, for the card to show. */
  readonly colourMatches: ReadonlyMap<string, ColourMatch>;
  /** The colour query actually applied, after a hex in the text box is routed. */
  readonly colour: ColourQuery | null;
  readonly terms: readonly string[];
}

/**
 * Text AND facets AND colour, then sorted. Order of application is irrelevant
 * because all three compose by conjunction, which is what makes "does a search
 * narrow within active filters" a non-question: there is one grid and every
 * control subtracts from it.
 */
export function runQuery(items: readonly LibraryItem[], query: Query): QueryResult {
  const { terms, hex } = parseSearchText(query.text);
  const colour: ColourQuery | null =
    query.colour ?? (hex === null ? null : { hex, tolerance: COLOUR_TOLERANCE.near });

  const matches: LibraryItem[] = [];
  const colourMatches = new Map<string, ColourMatch>();
  for (const item of items) {
    if (!matchesFacets(item, query.facets)) continue;
    if (!matchesTerms(item, terms)) continue;
    if (colour !== null) {
      const hit = colourMatch(item, colour.hex, colour.tolerance);
      if (hit === null) continue;
      colourMatches.set(item.id, hit);
    }
    matches.push(item);
  }
  return {
    items: sortItems(matches, query.sort),
    total: items.length,
    colourMatches,
    colour,
    terms,
  };
}

/* ------------------------------------------------------------------ */
/* Counts, which are what stop the grid ever going empty by accident   */
/* ------------------------------------------------------------------ */

export type FacetCounts = Record<FacetId, Record<string, number>>;

/**
 * For every facet value, how many Items would be showing if it were added to
 * the selection, holding every other constraint fixed.
 *
 * This is the whole answer to the ticket's "empty and near-empty results", and
 * it works only because of the OR-within-axis decision: adding a value to a
 * facet yields exactly the union, so **a value whose count is greater than zero
 * cannot produce an empty grid**, and a value whose count is zero is shown
 * disabled. You cannot click your way into a dead end. That claim is asserted
 * by the harness rather than believed.
 */
export function facetCounts(items: readonly LibraryItem[], query: Query): FacetCounts {
  const { terms, hex } = parseSearchText(query.text);
  const colour = query.colour ?? (hex === null ? null : { hex, tolerance: COLOUR_TOLERANCE.near });

  const candidates: { item: LibraryItem; values: Map<FacetId, readonly string[]> }[] = [];
  for (const item of items) {
    if (!matchesTerms(item, terms)) continue;
    if (colour !== null && colourMatch(item, colour.hex, colour.tolerance) === null) continue;
    const values = new Map<FacetId, readonly string[]>();
    for (const facet of FACETS) values.set(facet.id, facet.valuesOf(item));
    candidates.push({ item, values });
  }

  const counts = {} as FacetCounts;
  for (const facet of FACETS) {
    const row: Record<string, number> = {};
    for (const value of facet.values) row[value] = 0;
    for (const candidate of candidates) {
      let passesOthers = true;
      for (const other of FACETS) {
        if (other.id === facet.id) continue;
        const selected = query.facets[other.id];
        if (selected === undefined || selected.length === 0) continue;
        const held = candidate.values.get(other.id) ?? [];
        if (!selected.some((value) => held.includes(value))) {
          passesOthers = false;
          break;
        }
      }
      if (!passesOthers) continue;
      for (const value of candidate.values.get(facet.id) ?? []) {
        if (value in row) row[value] = (row[value] ?? 0) + 1;
      }
    }
    counts[facet.id] = row;
  }
  return counts;
}

export interface Relaxation {
  /** A facet id, `text`, or `colour`. */
  readonly constraint: FacetId | 'text' | 'colour';
  readonly label: string;
  /** How many Items would show if this one constraint were dropped. */
  readonly wouldShow: number;
}

/**
 * Leave-one-out over the active constraints, sorted by what it recovers.
 *
 * Text and colour are the only constraints that can empty the grid on their own
 * (you can type anything, and the library may hold nothing near a colour), so
 * an empty state has to name the culprit rather than apologise. "No matches;
 * 3 Items match *phosphor* if you clear the two active filters" is a diagnosis;
 * "no results" is a dead end.
 */
export function explainEmpty(items: readonly LibraryItem[], query: Query): Relaxation[] {
  const out: Relaxation[] = [];
  const count = (q: Query): number => runQuery(items, q).items.length;

  for (const facet of FACETS) {
    const selected = query.facets[facet.id];
    if (selected === undefined || selected.length === 0) continue;
    const facets = { ...query.facets };
    delete facets[facet.id];
    out.push({
      constraint: facet.id,
      label: facet.label,
      wouldShow: count({ ...query, facets }),
    });
  }
  if (query.text.trim() !== '') {
    out.push({ constraint: 'text', label: 'Search', wouldShow: count({ ...query, text: '' }) });
  }
  if (runQuery(items, query).colour !== null) {
    out.push({
      constraint: 'colour',
      label: 'Colour',
      wouldShow: count({ ...query, colour: null, text: parseSearchText(query.text).terms.join(' ') }),
    });
  }
  return out.sort((a, b) => b.wouldShow - a.wouldShow);
}

/* ------------------------------------------------------------------ */
/* URL state                                                           */
/* ------------------------------------------------------------------ */

/**
 * 006 decision 13 put filters and search text in the URL, so the encoding is
 * part of this contract rather than something 011 invents. Keys are emitted in
 * a fixed order so the same query always produces the same string, which is
 * what makes the back button and a bookmark behave.
 */
export function encodeQuery(query: Query): string {
  const params = new URLSearchParams();
  if (query.text.trim() !== '') params.set('q', query.text.trim());
  for (const facet of FACETS) {
    const selected = query.facets[facet.id];
    if (selected === undefined || selected.length === 0) continue;
    params.set(`f.${facet.id}`, [...selected].sort().join(','));
  }
  if (query.colour !== null) {
    params.set('c', query.colour.hex.replace('#', ''));
    if (query.colour.tolerance !== COLOUR_TOLERANCE.near) {
      params.set('ct', String(query.colour.tolerance));
    }
  }
  if (query.sort !== EMPTY_QUERY.sort) params.set('sort', query.sort);
  return params.toString();
}

export function decodeQuery(search: string): Query {
  const params = new URLSearchParams(search);
  const facets: Record<string, readonly string[]> = {};
  for (const facet of FACETS) {
    const raw = params.get(`f.${facet.id}`);
    if (raw === null) continue;
    const values = raw.split(',').filter((value) => facet.values.includes(value));
    if (values.length > 0) facets[facet.id] = values;
  }
  const rawColour = params.get('c');
  const hex = rawColour === null ? null : normaliseHex(rawColour);
  const rawTolerance = Number(params.get('ct'));
  const sort = params.get('sort');
  return {
    text: params.get('q') ?? '',
    facets: facets as FacetSelection,
    colour:
      hex === null
        ? null
        : {
            hex,
            tolerance:
              Number.isFinite(rawTolerance) && rawTolerance > 0
                ? rawTolerance
                : COLOUR_TOLERANCE.near,
          },
    sort: sort === 'oldest' || sort === 'hue' ? sort : 'newest',
  };
}
