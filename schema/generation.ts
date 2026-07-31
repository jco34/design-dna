/**
 * Design DNA - the generation schema.
 *
 * This is the JSON Schema handed to the Agent SDK as
 * `outputFormat: { type: 'json_schema', schema: GENERATION_SCHEMA }`. Ticket 002
 * measured that the SDK constrains generation natively from JSON Schema and
 * self-retries on violation, which is why this exists as JSON Schema rather than
 * as a prose instruction, and why `ExtractedDna` in `dna.ts` mirrors it rather
 * than the other way round.
 *
 * It is assembled from three sources so that no vocabulary is written twice:
 *
 *   the trait blocks below     ported from `wayfinder/assets/004-extraction-schema.json`,
 *                              which remains the historical record
 *   `MOTION_JSON_SCHEMA`       new at schemaVersion 2, defined here
 *   `LABELS_JSON_SCHEMA`       imported from `taxonomy.ts`, which builds its
 *                              descriptions from the same `*_GLOSS` records the
 *                              type system uses, so the words the agent is shown
 *                              and the words Zod accepts are the same words by
 *                              construction
 *
 * 004's provisional flat `labels` array is *not* ported. 005 replaced it with
 * three closed axes and `taxonomy.ts` owns that shape.
 *
 * Keyword budget: `type`, `description`, `properties`, `required`,
 * `additionalProperties`, `enum`, `items`, `minItems`, `maxItems` and
 * `maxLength`.
 *
 * `maxLength` is the one addition to 004's proven budget, and it was added in
 * response to a real failure rather than speculatively. 004 kept prose lengths out
 * of the JSON Schema and left them to Zod, on the reasoning that an unproven
 * generation constraint fails recoverably at the boundary. The first live run
 * showed what "recoverably" actually costs: `imagery.treatment` and
 * `motion.character` both came back over 240 characters, so a 95-second capture
 * and a paid extraction were thrown away over prose that was merely too long.
 * Rejecting after the money is spent is not recovery. The limits now sit in both
 * places - `maxLength` here to constrain generation, and Zod as the backstop -
 * because a constraint the generator can see is worth more than one that only
 * grades the result.
 *
 * Still deliberately Zod-only: lowercase hex (normalised in the producer before
 * validating) and array uniqueness (`uniqueItems` remains unproven, and
 * `taxonomy.ts` explains why its `distinct` helper exists).
 */
import { LABELS_JSON_SCHEMA } from './taxonomy';

/* ------------------------------------------------------------------ */
/* Palette                                                             */
/* ------------------------------------------------------------------ */

const HEX_DESCRIPTION =
  'Lowercase #rrggbb, exactly seven characters, for example "#10131a". Empty string if you cannot read it.';

const WEIGHT_DESCRIPTION = 'How much of the design this colour carries.';

const swatch = (role: string, weightDescription = WEIGHT_DESCRIPTION) => ({
  type: 'object',
  description: role,
  additionalProperties: false,
  required: ['hex', 'weight'],
  properties: {
    hex: { type: 'string', description: HEX_DESCRIPTION },
    weight: {
      type: 'string',
      description: weightDescription,
      enum: ['dominant', 'supporting', 'occasional', 'undetermined'],
    },
  },
});

const PALETTE_JSON_SCHEMA = {
  type: 'object',
  description:
    'The colour system, by role. Give the colour that actually performs each role in this design. Values are your visual read, not a pixel measurement, and are stored as approximate.',
  additionalProperties: false,
  required: ['background', 'surface', 'ink', 'muted', 'accent'],
  properties: {
    background: swatch(
      'The page or canvas colour that sits behind everything.',
      'How much of the design this colour carries. dominant: most of the visible area. supporting: a substantial but secondary share. occasional: small deliberate moments only.',
    ),
    surface: swatch(
      'The colour of panels, cards and raised areas sitting on the background. If the design has no layered surfaces, give the nearest colour doing that job.',
    ),
    ink: swatch('The primary text colour, the one headings and body copy are set in.'),
    muted: swatch(
      'The lower-emphasis colour: secondary copy, captions, hairlines, disabled states.',
    ),
    accent: swatch(
      'The one colour the design uses to make something matter: the primary call to action, the brand hit. If several compete, give the one used on the primary action.',
      'How much of the design this colour carries. An accent used on one button is "occasional"; an accent flooding half the page is "dominant". This distinction matters more than the hex.',
    ),
  },
};

/* ------------------------------------------------------------------ */
/* The static traits                                                   */
/* ------------------------------------------------------------------ */

const TYPOGRAPHY_JSON_SCHEMA = {
  type: 'object',
  description:
    'The type system. Name a family only if you actually recognise the letterforms; describing the style is always required and is the more useful of the two.',
  additionalProperties: false,
  required: [
    'headingFamily',
    'headingCharacter',
    'bodyFamily',
    'bodyCharacter',
    'scale',
    'weightRange',
  ],
  properties: {
    headingFamily: {
      type: 'string',
      maxLength: 80,
      description:
        'The named typeface used for headings, for example "Inter" or "GT Sectra". Empty string if you do not recognise it or cannot see glyphs. Never guess a name to fill this in, and never put a generic CSS family here.',
    },
    headingCharacter: {
      type: 'string',
      maxLength: 200,
      description:
        'The heading type described specifically, for example "geometric sans, wide apertures, very tight tracking, all-caps at display size". Include tracking, leading and case here. Never "sans-serif". Empty string only if no glyphs are visible at all. Hard limit: 200 characters, and going over means the whole extraction is rejected. Be concise rather than exhaustive.',
    },
    bodyFamily: {
      type: 'string',
      maxLength: 80,
      description:
        'The named typeface used for body copy. Empty string if you do not recognise it or cannot see glyphs.',
    },
    bodyCharacter: {
      type: 'string',
      maxLength: 200,
      description:
        'The body type described specifically, including tracking, leading and measure. Empty string only if no glyphs are visible at all. Hard limit: 200 characters, and going over means the whole extraction is rejected. Be concise rather than exhaustive.',
    },
    scale: {
      type: 'string',
      description:
        'Size contrast between the largest heading and body copy. tight: they sit close together. moderate: a clear but conventional step. dramatic: display type many times body size.',
      enum: ['tight', 'moderate', 'dramatic', 'undetermined'],
    },
    weightRange: {
      type: 'string',
      description:
        'How many weights the design uses. uniform: essentially one. paired: two, typically a regular and a bold. wide: three or more, or a light-to-black spread used expressively.',
      enum: ['uniform', 'paired', 'wide', 'undetermined'],
    },
  },
};

const COMPOSITION_JSON_SCHEMA = {
  type: 'object',
  description:
    'How the design is arranged in space: the grid, the alignment, how attention is directed.',
  additionalProperties: false,
  required: ['structure', 'contentWidth'],
  properties: {
    structure: {
      type: 'string',
      maxLength: 300,
      description:
        'The layout approach in words, for example "centred single column with an asymmetric 60/40 hero split, everything left-aligned to one rail". Describe relationships, not pixel measurements. Empty string if you cannot read it. Hard limit: 300 characters, and going over means the whole extraction is rejected. Be concise rather than exhaustive.',
    },
    contentWidth: {
      type: 'string',
      description:
        'How much horizontal room content is given. full-bleed: content runs edge to edge. wide: a container near the full viewport. contained: a clear centred measure with visible margins. narrow: a deliberately tight column.',
      enum: ['full-bleed', 'wide', 'contained', 'narrow', 'undetermined'],
    },
  },
};

const SPACING_JSON_SCHEMA = {
  type: 'object',
  description: 'How generously the design breathes, and whether its spacing follows a system.',
  additionalProperties: false,
  required: ['density', 'rhythm'],
  properties: {
    density: {
      type: 'string',
      description:
        'dense: packed, information-first, little rest. balanced: conventional comfortable spacing. airy: large deliberate emptiness used as a design element.',
      enum: ['dense', 'balanced', 'airy', 'undetermined'],
    },
    rhythm: {
      type: 'string',
      maxLength: 240,
      description:
        'Whether spacing reads as systematic or ad hoc, and where the design puts its air, for example "consistent step scale, generous section breaks, tight within groups". Do not assert pixel values. Empty string if you cannot read it. Hard limit: 240 characters, and going over means the whole extraction is rejected. Be concise rather than exhaustive.',
    },
  },
};

const SURFACE_TREATMENT_JSON_SCHEMA = {
  type: 'object',
  description:
    'What the surfaces are made of: how edges are cut, how things are separated, whether anything lifts off the page, and the finish.',
  additionalProperties: false,
  required: ['corners', 'borders', 'elevation', 'finish'],
  properties: {
    corners: {
      type: 'string',
      description:
        'Corner treatment on cards, buttons and inputs. sharp: square. slight: a small radius. rounded: obviously soft. pill: fully rounded ends. mixed: deliberately inconsistent.',
      enum: ['sharp', 'slight', 'rounded', 'pill', 'mixed', 'undetermined'],
    },
    borders: {
      type: 'string',
      description:
        'How elements are separated. none: separation is by space or colour alone. hairline: fine low-contrast lines. heavy: thick or high-contrast rules as a design feature. mixed.',
      enum: ['none', 'hairline', 'heavy', 'mixed', 'undetermined'],
    },
    elevation: {
      type: 'string',
      description:
        'Depth. flat: no shadows at all. subtle: soft shadows you have to look for. pronounced: shadows or offsets that are part of the look.',
      enum: ['flat', 'subtle', 'pronounced', 'undetermined'],
    },
    finish: {
      type: 'string',
      maxLength: 240,
      description:
        'The material quality of the surfaces, for example "matte flat fills", "a faint film grain over a mesh gradient", "frosted translucent nav over content". Write "plain flat fills" if there is genuinely no texture; that is an answer, not a gap. Empty string only if you cannot read it. Hard limit: 240 characters, and going over means the whole extraction is rejected. Be concise rather than exhaustive.',
    },
  },
};

const IMAGERY_JSON_SCHEMA = {
  type: 'object',
  description:
    'The pictures, illustration or graphics the design uses. A design that uses none is a real and common answer.',
  additionalProperties: false,
  required: ['kind', 'treatment'],
  properties: {
    kind: {
      type: 'string',
      description:
        'The dominant kind of imagery. none: the design is typographic and geometric only. ui-screenshot: pictures of the product itself. mixed: two or more with no clear lead.',
      enum: [
        'none',
        'photography',
        'illustration',
        '3d-render',
        'abstract-graphic',
        'ui-screenshot',
        'mixed',
        'undetermined',
      ],
    },
    treatment: {
      type: 'string',
      maxLength: 240,
      description:
        'How that imagery is styled and used, for example "duotone photography bled off the right edge, no borders". Empty string when kind is "none" or when you cannot read it. Hard limit: 240 characters, and going over means the whole extraction is rejected. Be concise rather than exhaustive.',
    },
  },
};

/* ------------------------------------------------------------------ */
/* Motion                                                              */
/* ------------------------------------------------------------------ */

/**
 * New at schemaVersion 2, and the only block whose evidence is not the Capture.
 *
 * The description carries the Undetermined rule explicitly rather than leaving it
 * implied, because this is the one trait where a plausible guess is both easy and
 * actively harmful: a still frame cannot distinguish a deliberately static design
 * from an animated one caught at rest, so `none` read off an image is a claim the
 * evidence cannot support. `docs/EXTRACTION.md` section B.3 is the long form.
 */
export const MOTION_JSON_SCHEMA = {
  type: 'object',
  description:
    'How the design behaves over time. This is the one trait a still image cannot answer. If your evidence is a single static image, every field here is "undetermined" or empty - do NOT report "none", because that claims the design does not move, which a still frame cannot tell you. Only report motion you actually observed by interacting with a live page, or that the image itself documents.',
  additionalProperties: false,
  required: ['presence', 'triggers', 'easing', 'pace', 'character', 'choreography'],
  properties: {
    presence: {
      type: 'string',
      description:
        'How much motion the design uses. none: it is genuinely static, and you observed it live long enough to say so. restrained: motion exists but only where it clarifies, such as hover feedback. prominent: motion is part of the design language and you would notice its absence. pervasive: almost everything responds or moves. undetermined: you could not observe it.',
      enum: ['none', 'restrained', 'prominent', 'pervasive', 'undetermined'],
    },
    triggers: {
      type: 'array',
      description:
        'What sets the motion off. Nought to four. Empty array when nothing moves, or when you could not observe it. Report only what you actually saw respond.',
      minItems: 0,
      maxItems: 4,
      items: {
        type: 'string',
        description:
          'hover: pointer over an element. scroll: position in the page. click: a press or tap. page-load: an entrance on first paint. focus: keyboard focus. ambient: runs continuously with no input at all. drag: pointer-drag, swipe or orbit, the dominant interaction on a canvas or 3D experience.',
        enum: ['hover', 'scroll', 'click', 'page-load', 'focus', 'ambient', 'drag'],
      },
    },
    easing: {
      type: 'string',
      description:
        'The timing character. linear: constant speed, mechanical. eased: conventional acceleration and deceleration. spring: physical, overshooting or settling rather than following a fixed curve. abrupt: states change with no transition at all. mixed: several distinct approaches in one design.',
      enum: ['linear', 'eased', 'spring', 'abrupt', 'mixed', 'undetermined'],
    },
    pace: {
      type: 'string',
      description:
        'How quick the motion feels. instant: under roughly 100ms, felt rather than seen. brisk: roughly 100-250ms. measured: roughly 250-500ms. slow: over roughly 500ms, deliberately unhurried.',
      enum: ['instant', 'brisk', 'measured', 'slow', 'undetermined'],
    },
    character: {
      type: 'string',
      maxLength: 240,
      description:
        'What actually moves and how it feels, specifically enough to rebuild. Give real durations and curves where you read them, for example "cards lift 4px and gain a soft shadow over 200ms on an ease-out". Describe the mechanism, not the impression: "delightful micro-interactions" is a failure. Empty string if you could not observe it. Hard limit: 240 characters, and going over means the whole extraction is rejected. Be concise rather than exhaustive.',
    },
    choreography: {
      type: 'string',
      maxLength: 300,
      description:
        'How movements relate to each other in time: what leads, what follows, whether elements arrive together or stagger, and whether anything is sequenced deliberately. For example "sections stagger in from below about 60ms apart as they enter the viewport". Empty string if there is no sequencing to report or you could not observe it. Hard limit: 300 characters, and going over means the whole extraction is rejected. Be concise rather than exhaustive.',
    },
  },
};

/* ------------------------------------------------------------------ */
/* The Build                                                           */
/* ------------------------------------------------------------------ */

/**
 * New at schemaVersion 3, and the one block that is a suggestion rather than
 * a reading. Exported for the same reason `MOTION_JSON_SCHEMA` is: both the
 * full schema and a slim schema for a dedicated re-run (`dna re-build`) need
 * to describe it identically.
 */
export const BUILD_JSON_SCHEMA = {
  type: 'object',
  description:
    'Your suggested toolset for REPLICATING this design, not a fact about it. Candidate libraries and the few techniques that matter for this specific design. Key off imagery, motion and composition: a still, static, typographic page needs almost nothing distinctive here, and an empty stack with empty techniques is the honest answer for it. A 3D or heavily animated design is where this earns its keep. Never invent internals you cannot see from the design alone - no state-management or backend claims.',
  additionalProperties: false,
  required: ['stack', 'techniques'],
  properties: {
    stack: {
      type: 'array',
      description:
        'Candidate tools and libraries, most load-bearing first, for example ["Three.js", "React Three Fiber", "GSAP"]. Empty array if nothing distinctive is called for.',
      minItems: 0,
      maxItems: 12,
      items: {
        type: 'string',
        maxLength: 40,
        description: 'One tool or library name.',
      },
    },
    techniques: {
      type: 'string',
      maxLength: 600,
      description:
        'The 2-4 techniques that matter for replicating THIS design specifically, for example "scroll-linked camera dolly, instanced meshes for the particle field, a pinned hero section". Not a generic build plan. Empty string only if nothing here is worth saying - a non-empty stack does not require this to be non-empty, and vice versa. Hard limit: 600 characters, and going over means the whole extraction is rejected. Be concise rather than exhaustive.',
    },
  },
};

/* ------------------------------------------------------------------ */
/* Philosophy                                                          */
/* ------------------------------------------------------------------ */

const PHILOSOPHY_JSON_SCHEMA = {
  type: 'object',
  description:
    'The one free-text field. Everything worth saying that the fields above cannot hold belongs here and nowhere else.',
  additionalProperties: false,
  required: ['text'],
  properties: {
    text: {
      type: 'string',
      maxLength: 1200,
      description:
        'One paragraph, roughly 80-1200 characters, on the intent behind this design and the mechanism that makes it work. Be specific to this design. A paragraph that would be equally true of any other page of its kind is a failure. Do not inventory the fields above. Do not praise. Empty string only if the image is unreadable.',
    },
  },
};

/* ------------------------------------------------------------------ */
/* The assembled schema                                                */
/* ------------------------------------------------------------------ */

/*
 * No `$schema` key, and this is a hard requirement rather than a tidiness choice.
 *
 * The SDK validates the schema you hand it before using it, and it cannot resolve
 * a `$schema` reference to a remote meta-schema: passing
 * `https://json-schema.org/draft/2020-12/schema` fails the whole run with
 * `no schema with key or ref`. The historical record in
 * `wayfinder/assets/004-extraction-schema.json` carries the key because it is a
 * standalone document meant to be read; this is a parameter, and the key is both
 * useless and fatal here.
 */
export const GENERATION_SCHEMA = {
  title: 'Design DNA extraction',
  description:
    'The design analysis of one Capture. Report only what you can actually read off the evidence. Never invent a value. Any leaf you cannot read is the empty string for text fields and "undetermined" for choice fields. Undetermined is a correct answer and is always better than a plausible guess: a gap can be filled later, whereas a confident wrong value is never revisited. Do not describe the subject matter, the copy, or the company; describe the design.',
  type: 'object',
  additionalProperties: false,
  required: [
    'palette',
    'typography',
    'composition',
    'spacing',
    'surfaceTreatment',
    'imagery',
    'motion',
    'philosophy',
    'labels',
    'build',
  ],
  properties: {
    palette: PALETTE_JSON_SCHEMA,
    typography: TYPOGRAPHY_JSON_SCHEMA,
    composition: COMPOSITION_JSON_SCHEMA,
    spacing: SPACING_JSON_SCHEMA,
    surfaceTreatment: SURFACE_TREATMENT_JSON_SCHEMA,
    imagery: IMAGERY_JSON_SCHEMA,
    motion: MOTION_JSON_SCHEMA,
    philosophy: PHILOSOPHY_JSON_SCHEMA,
    labels: LABELS_JSON_SCHEMA,
    build: BUILD_JSON_SCHEMA,
  },
} as const;

/**
 * Just the motion trait, for `dna re-explore`.
 *
 * Motion is the one trait whose evidence is the live page rather than the stored
 * Capture, so it is also the only one that can go stale while everything around it
 * stays accurate. Refreshing it through the full schema would pay for eight traits
 * to be re-read off an image that has not changed, and would hand the merge a pile
 * of new values it is contractually obliged to discard.
 *
 * This is deliberately built from the same `MOTION_JSON_SCHEMA` the full schema
 * uses, so the two can never describe motion differently.
 */
export const MOTION_ONLY_SCHEMA = {
  title: 'Design DNA motion',
  description:
    'How one design behaves over time. Report only motion you actually observed in the supplied observations. Undetermined is a correct answer and is always better than a plausible guess.',
  type: 'object',
  additionalProperties: false,
  required: ['motion'],
  properties: { motion: MOTION_JSON_SCHEMA },
} as const;

/**
 * Just the Build, for `dna re-build`.
 *
 * Built from the same `BUILD_JSON_SCHEMA` the full schema uses, so the two
 * can never describe the Build differently. Mirrors `MOTION_ONLY_SCHEMA`.
 */
export const BUILD_ONLY_SCHEMA = {
  title: 'Design DNA build suggestion',
  description:
    'A suggested toolset for replicating one design, given its stored analysis. Report only what is distinctive about this design. Undetermined (empty stack, empty techniques) is correct when nothing about the design calls for particular tools.',
  type: 'object',
  additionalProperties: false,
  required: ['build'],
  properties: { build: BUILD_JSON_SCHEMA },
} as const;

/**
 * The prompt version stamped onto every Item this build writes.
 *
 * `authoredBy.promptVersion` exists so prompt tuning is legible after the fact:
 * when a philosophy paragraph reads badly six months from now, this is what tells
 * you which instructions produced it. Bump it whenever the extraction
 * instructions or this schema change in a way that would alter output.
 */
export const PROMPT_VERSION = '3.1.0-drag-trigger';
