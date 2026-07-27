/**
 * Design DNA - the label taxonomy and the Scope vocabulary.
 *
 * Ticket 005. This module is the closed vocabulary the agent picks from, the
 * enum the producer stamps Scope with, and the table that turns a Scope into
 * 004's `notApplicable` list. The CLI, the app and the extraction prompt all
 * import it, so the words in the prompt and the words in the type system are
 * the same words by construction rather than by discipline.
 *
 * Three axes, and only three:
 *
 *   genre - what kind of designed thing this is. One value.
 *   style - which visual idiom it belongs to. Nought to two values.
 *   mood  - how it feels. Nought to two values.
 *
 * A fourth vocabulary lives here but is not a label: `SCOPES`, which is
 * producer-supplied fact rather than a reading, and which 004 carried
 * provisionally so `notApplicable` was derivable. 005 confirms it.
 *
 * Dependency direction: this module depends on nothing but `zod`. 004's module
 * is downstream of it and should import `SCOPES` from here, replacing its own
 * provisional `Scope`. That is why `LabelAuthorship` is redeclared below rather
 * than imported, and why `TraitName` is imported as a type only.
 *
 * Zod v3 syntax, as 004. Verified to typecheck and run under zod 4.4.3.
 */
import { z } from 'zod';
import type { TraitName } from './004-extraction-schema';

/* ------------------------------------------------------------------ */
/* Versioning                                                          */
/* ------------------------------------------------------------------ */

/**
 * Bumped whenever a value is added to any axis below.
 *
 * Stored on every Item. Note the asymmetry with 004's `schemaVersion`, which is
 * a `z.literal(1)`: a shape change is a migration and an Item carrying the old
 * shape is invalid, whereas an Item labelled under an older vocabulary is
 * perfectly valid and merely stale. So this is an integer, never a literal, and
 * nothing refuses to parse because it is behind.
 */
export const TAXONOMY_VERSION = 1;

/* ------------------------------------------------------------------ */
/* Axis 1 - genre. What kind of designed thing this is.                */
/* ------------------------------------------------------------------ */

export const GENRES = [
  'landing-page',
  'product-ui',
  'dashboard',
  'editorial',
  'portfolio',
  'commerce',
  'docs',
  'undetermined',
] as const;
export type Genre = (typeof GENRES)[number];

/**
 * The gloss is the definition. It is also the prompt: `LABELS_JSON_SCHEMA`
 * builds its `description` strings from these records, so a value cannot be
 * added to the enum without the agent being told what it means.
 */
export const GENRE_GLOSS: Record<Genre, string> = {
  'landing-page':
    'a marketing or product page whose job is to persuade: a hero, stacked sections, calls to action',
  'product-ui': 'the inside of an application - the working interface, not the page selling it',
  dashboard: 'a product surface whose subject is data: charts, tables, metrics, monitoring',
  editorial: 'writing as the subject: an article, essay, blog or magazine',
  portfolio: 'work shown as a body of work: a personal site, a studio site, a case study',
  commerce: 'buying: a shop, a product page, a basket, a checkout',
  docs: 'reference material: documentation, an API reference, a changelog, a design system site',
  undetermined: 'the capture does not show what kind of design this is',
};

/* ------------------------------------------------------------------ */
/* Axis 2 - style. Which visual idiom it belongs to.                   */
/* ------------------------------------------------------------------ */

export const STYLES = [
  'brutalist',
  'swiss',
  'technical',
  'organic',
  'maximalist',
  'retro',
  'glassmorphism',
  'experimental',
] as const;
export type Style = (typeof STYLES)[number];

export const STYLE_GLOSS: Record<Style, string> = {
  brutalist:
    'raw and hard-edged: exposed structure, blunt type, harsh contrast, deliberate anti-polish. Covers the whole family, from unstyled-HTML revival to the thick-border hard-shadow strain',
  swiss:
    'grid and typographic rationalism: a strict grid, neutral grotesk type, information ordered rather than expressed',
  technical:
    'engineered rather than decorated: monospace or tightly tracked type, dense data, precise surfaces, a developer-tool register',
  organic:
    'soft and hand-made: irregular shapes, hand-drawn or natural elements, warm texture, curves in place of a grid',
  maximalist:
    'deliberate excess: many typefaces, saturated colour, layered ornament, density used as expression',
  retro: 'a period look revived on purpose, whatever the period',
  glassmorphism: 'translucent frosted layers, blurred depth, light passing through surfaces',
  experimental:
    'convention deliberately broken: unusual navigation or scroll behaviour, canvas or 3D as the medium, layout that refuses the grid',
};

/* ------------------------------------------------------------------ */
/* Axis 3 - mood. How it feels.                                        */
/* ------------------------------------------------------------------ */

export const MOODS = ['calm', 'bold', 'playful', 'serious', 'refined'] as const;
export type Mood = (typeof MOODS)[number];

export const MOOD_GLOSS: Record<Mood, string> = {
  calm: 'quiet and unhurried; nothing competes for attention',
  bold: 'loud and confident; scale, colour or contrast used to hit hard',
  playful: 'humour and warmth; irregularity and delight over correctness',
  serious: 'sober and institutional; weight and authority over charm',
  refined: 'precise and considered; craft and restraint read as quality',
};

/* ------------------------------------------------------------------ */
/* Scope - not a label, and here because 004 handed it over            */
/* ------------------------------------------------------------------ */

/**
 * How much of a design the Capture holds. Producer-supplied (004 section 7),
 * never the agent's to write, and structural: it decides which traits an Item
 * has at all.
 *
 * This confirms rather than replaces 004's provisional enum. CONTEXT.md's own
 * definition of Scope, written by 001, already names both endpoints - "from a
 * whole page down to a single component" - and the middle value is the one 003
 * created when `--selector` made section framing free.
 */
export const SCOPES = ['page', 'section', 'component'] as const;
export type Scope = (typeof SCOPES)[number];

export const SCOPE_GLOSS: Record<Scope, string> = {
  page: 'a whole viewport of a design as it was published',
  section: 'one band of a page framed on its own: a hero, a pricing block, a footer',
  component: 'one interface part in isolation: a button, a card, a nav, an input',
};

/**
 * The table 004 section 5.2 specified and could not write without this
 * vocabulary. Frozen into the Item at write time by the producer.
 *
 * It has exactly one non-empty cell, and that is a finding rather than an
 * oversight: 004's rule that "a state describes the reading and a value
 * describes the design" gave every enum a member for the case where the design
 * genuinely lacks the thing, so almost nothing is left for a Scope to exclude.
 * A component crop has no imagery, but that is `imagery.kind: 'none'`; it has
 * few colours, but those are Undetermined swatches. Only `composition` is
 * structurally impossible: `contentWidth` has no meaning for a picture of a
 * button, and 004 names composition as this mechanism's primary customer.
 */
export const NOT_APPLICABLE_BY_SCOPE: Record<Scope, readonly TraitName[]> = {
  page: [],
  section: [],
  component: ['composition'],
};

export const notApplicableFor = (scope: Scope): TraitName[] => [...NOT_APPLICABLE_BY_SCOPE[scope]];

/* ------------------------------------------------------------------ */
/* Zod                                                                 */
/* ------------------------------------------------------------------ */

export const GenreValue = z.enum(GENRES);
export const StyleValue = z.enum(STYLES);
export const MoodValue = z.enum(MOODS);
export const ScopeValue = z.enum(SCOPES);

/** How many values one multi-valued axis may carry. */
export const MAX_STYLES = 2;
export const MAX_MOODS = 2;

/**
 * Structurally identical to 004's `Authorship`, redeclared so that this module
 * has no runtime dependency on 004 - the dependency runs the other way. When
 * the two modules are assembled into the real repo under 006/008, this is the
 * declaration to delete.
 */
export const LabelAuthorship = z.enum(['agent', 'override']);
export type LabelAuthorship = z.infer<typeof LabelAuthorship>;

/**
 * `uniqueItems` is outside 004's proven JSON Schema keyword budget, so a
 * repeated value cannot be prevented at generation. It is caught here instead,
 * which is exactly the asymmetry 004 section 2 relies on: a missing generation
 * constraint fails recoverably at the Zod boundary.
 */
const distinct = <T extends z.ZodTypeAny>(item: T, max: number) =>
  z
    .array(item)
    .max(max)
    .refine((values) => new Set(values).size === values.length, {
      message: 'an axis must not carry the same value twice',
    });

/**
 * Exactly what the agent returns under `labels`. This replaces 004's
 * provisional `labels: Label[]` with `minItems: 3, maxItems: 8`.
 *
 * An empty `style` or `mood` array is a legitimate and expected answer, not a
 * failure: it means nothing in the closed list is close. This is 004's
 * `headingFamily` rule applied to labels - an unnamed thing is normal, and the
 * design is still fully described by its traits and its philosophy.
 */
export const ExtractedLabels = z
  .object({
    genre: GenreValue,
    style: distinct(StyleValue, MAX_STYLES),
    mood: distinct(MoodValue, MAX_MOODS),
  })
  .strict();
export type ExtractedLabels = z.infer<typeof ExtractedLabels>;

/**
 * Labels as stored. Authorship sits once per axis, not once per value: an
 * axis's value set is a single judgement, so it is attributed as one. Editing
 * `style` from ['swiss'] to ['brutalist', 'swiss'] makes the whole pair yours,
 * and per-value authorship would claim the agent endorsed a pair it never saw.
 *
 * The two reasons 004 gave the palette per-value authorship both fail here:
 * there is no sampler that would upgrade one label at a time, and 007 never
 * hedges a label, because a label is a pick from a list rather than an
 * approximate reading.
 */
export const Labels = z
  .object({
    genre: z.object({ value: GenreValue, authorship: LabelAuthorship }).strict(),
    style: z
      .object({ values: distinct(StyleValue, MAX_STYLES), authorship: LabelAuthorship })
      .strict(),
    mood: z.object({ values: distinct(MoodValue, MAX_MOODS), authorship: LabelAuthorship }).strict(),
  })
  .strict();
export type Labels = z.infer<typeof Labels>;

/** The axis names, for a filter UI that wants to iterate them. */
export const AXES = ['genre', 'style', 'mood'] as const;
export type Axis = (typeof AXES)[number];

/**
 * What 005 adds to 004's `Item`, beyond replacing the `labels` shape. Declared
 * here as documentation of the delta; 006 owns the assembled record.
 *
 * `taxonomyVersion` is what makes staleness findable, which is the whole reason
 * the evolution rule can be "old items stay as they are".
 */
export const ItemTaxonomyFields = z
  .object({
    scope: ScopeValue,
    taxonomyVersion: z.number().int().positive(),
  })
  .strict();

/** An Item labelled before the current vocabulary existed. Not an error. */
export const isStale = (item: { taxonomyVersion: number }): boolean =>
  item.taxonomyVersion < TAXONOMY_VERSION;

/**
 * The labels half of 004's `stampAuthorship`. Mechanical, like its sibling:
 * nothing the agent wrote is rewritten, reinterpreted or repaired.
 */
export function stampLabelAuthorship(extracted: ExtractedLabels): Labels {
  return {
    genre: { value: extracted.genre, authorship: 'agent' },
    style: { values: extracted.style, authorship: 'agent' },
    mood: { values: extracted.mood, authorship: 'agent' },
  };
}

/**
 * A relabel pass may only rewrite an axis the agent still owns. This is the
 * single rule that makes vocabulary evolution non-destructive, and it needs no
 * mechanism 004 did not already provide.
 */
export const isRelabelable = (axis: { authorship: LabelAuthorship }): boolean =>
  axis.authorship === 'agent';

/* ------------------------------------------------------------------ */
/* The generation schema fragment                                      */
/* ------------------------------------------------------------------ */

/** "a: gloss. b: gloss." - the form 004's enum descriptions already use. */
const glossList = (gloss: Record<string, string>): string =>
  Object.entries(gloss)
    .map(([value, text]) => `${value}: ${text}`)
    .join('. ');

/**
 * Splice this in at `properties.labels` of `004-extraction-schema.json`,
 * replacing the provisional free-string array there.
 *
 * Every keyword used is inside 004 section 2's proven budget: `type`,
 * `properties`, `required`, `additionalProperties`, `enum`, `items`,
 * `minItems`, `maxItems`, `description`. Nothing else appears, and in
 * particular `uniqueItems` does not, which is why `distinct` above exists.
 *
 * The one combination 002 did not exercise is `enum` nested inside `items`.
 * That is named in the resolution's "what was not verified"; the fallback, if
 * it degrades, is to keep the array of plain strings and carry the vocabulary
 * in the description alone, which 002 showed is enough for a hex format.
 */
export const LABELS_JSON_SCHEMA = {
  type: 'object',
  description:
    'How this design is filed so it can be found again. These are not design content to be transplanted; they are the shelf it sits on. Choose only from the listed values. Never invent one.',
  additionalProperties: false,
  required: ['genre', 'style', 'mood'],
  properties: {
    genre: {
      type: 'string',
      description: `What kind of designed thing this is - its job, not its look. Exactly one. ${glossList(
        GENRE_GLOSS,
      )}`,
      enum: [...GENRES],
    },
    style: {
      type: 'array',
      description:
        'The named visual idiom or idioms this design belongs to - its look, not its job. Nought to two. Pick the closest member; leave the array empty when nothing in the list is close, which is a normal answer and not a failure. Never stretch a member to fit.',
      minItems: 0,
      maxItems: MAX_STYLES,
      items: {
        type: 'string',
        description: glossList(STYLE_GLOSS),
        enum: [...STYLES],
      },
    },
    mood: {
      type: 'array',
      description:
        'How the design feels to a first-time viewer. Nought to two. Leave empty rather than reaching for a member that is only half true.',
      minItems: 0,
      maxItems: MAX_MOODS,
      items: {
        type: 'string',
        description: glossList(MOOD_GLOSS),
        enum: [...MOODS],
      },
    },
  },
};
