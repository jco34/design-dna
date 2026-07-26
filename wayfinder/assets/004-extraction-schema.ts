/**
 * Design DNA - the extraction schema and the Item record.
 *
 * Ticket 004. This module is the hand-off contract between the three parties
 * named in the map: the producer CLI that writes the library, a Claude session
 * hand-writing an entry, and the web app that reads it. Both writers validate
 * through here; the reader parses through here.
 *
 * Two schemas, and the split is the point:
 *
 *   Extracted*  - exactly what the agent returns. Mirrors
 *                 `004-extraction-schema.json`, which is what gets passed to
 *                 the SDK's `outputFormat: { type: 'json_schema', schema }`.
 *                 Nothing in here is the agent's opinion about provenance,
 *                 scope, authorship or your note.
 *
 *   Item        - the whole stored entry. The producer composes it from an
 *                 ExtractedDna plus everything the agent is not allowed to
 *                 write. Ticket 006 owns where the file lives and what it is
 *                 called; this module owns its shape.
 *
 * Why Zod is not the primary mechanism: 002 measured that the SDK constrains
 * generation natively from JSON Schema and self-retries on violation, which is
 * why the JSON file is authored first and this file is derived from it. Zod is
 * the read boundary, and it is also where the value-level constraints live
 * that were deliberately kept out of the JSON Schema (lowercase hex, prose
 * lengths). See `004-schema-commentary.md` for why.
 *
 * Zod v3 syntax. Verified to typecheck and run under zod 4.4.3 as well.
 */
import { z } from 'zod';

/* ------------------------------------------------------------------ */
/* Shared vocabularies                                                 */
/* ------------------------------------------------------------------ */

/**
 * How a stored value came to be there.
 *
 *   agent    - the agent read it off the Capture. 002 measured that this read
 *              is eyeballed rather than sampled: biased a few units and
 *              unstable between runs of the same image. An `agent` value is
 *              therefore approximate and must never be rendered as exact.
 *   sampled  - a deterministic reader measured it from the Capture's pixels.
 *              Unreachable in v1; no sampler exists. Present so that building
 *              one is not a breaking schema change.
 *   override - you wrote it. This is CONTEXT.md's **Override**, and it is
 *              authoritative regardless of how it was arrived at.
 */
export const SwatchAuthorship = z.enum(['agent', 'sampled', 'override']);
export type SwatchAuthorship = z.infer<typeof SwatchAuthorship>;

/** Everywhere except a palette swatch, only two authors are reachable. */
export const Authorship = z.enum(['agent', 'override']);
export type Authorship = z.infer<typeof Authorship>;

/**
 * Lowercase `#rrggbb`, or the empty string meaning Undetermined.
 *
 * The case rule is enforced here and not in the JSON Schema: `pattern` was
 * never exercised against the SDK's structured output (002 used `description`
 * alone and saw zero malformed hex across every run), so the producer
 * lowercases the agent's output before validating and this is the gate.
 */
export const Hex = z
  .string()
  .regex(/^(?:#[0-9a-f]{6})?$/, 'must be lowercase #rrggbb, or "" for undetermined');

/** A free-text leaf. Empty string means Undetermined. */
const text = (max: number) => z.string().max(max);

/** An ISO-8601 instant, e.g. `2026-07-26T14:03:11.000Z`. */
export const Instant = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/, 'must be ISO-8601');

/* ------------------------------------------------------------------ */
/* Traits, as the agent returns them                                   */
/* ------------------------------------------------------------------ */

export const SwatchWeight = z.enum(['dominant', 'supporting', 'occasional', 'undetermined']);
export type SwatchWeight = z.infer<typeof SwatchWeight>;

export const ExtractedSwatch = z.object({ hex: Hex, weight: SwatchWeight }).strict();

export const ExtractedPalette = z
  .object({
    background: ExtractedSwatch,
    surface: ExtractedSwatch,
    ink: ExtractedSwatch,
    muted: ExtractedSwatch,
    accent: ExtractedSwatch,
  })
  .strict();

export const TypeScale = z.enum(['tight', 'moderate', 'dramatic', 'undetermined']);
export const WeightRange = z.enum(['uniform', 'paired', 'wide', 'undetermined']);

export const ExtractedTypography = z
  .object({
    /** A named typeface, or "" when unrecognised. Never a generic CSS family. */
    headingFamily: text(80),
    /** The style described specifically. Carries tracking, leading and case. */
    headingCharacter: text(200),
    bodyFamily: text(80),
    bodyCharacter: text(200),
    scale: TypeScale,
    weightRange: WeightRange,
  })
  .strict();

export const ContentWidth = z.enum(['full-bleed', 'wide', 'contained', 'narrow', 'undetermined']);

export const ExtractedComposition = z
  .object({ structure: text(300), contentWidth: ContentWidth })
  .strict();

export const Density = z.enum(['dense', 'balanced', 'airy', 'undetermined']);

export const ExtractedSpacing = z.object({ density: Density, rhythm: text(240) }).strict();

export const Corners = z.enum(['sharp', 'slight', 'rounded', 'pill', 'mixed', 'undetermined']);
export const Borders = z.enum(['none', 'hairline', 'heavy', 'mixed', 'undetermined']);
export const Elevation = z.enum(['flat', 'subtle', 'pronounced', 'undetermined']);

export const ExtractedSurfaceTreatment = z
  .object({ corners: Corners, borders: Borders, elevation: Elevation, finish: text(240) })
  .strict();

export const ImageryKind = z.enum([
  'none',
  'photography',
  'illustration',
  '3d-render',
  'abstract-graphic',
  'ui-screenshot',
  'mixed',
  'undetermined',
]);

export const ExtractedImagery = z.object({ kind: ImageryKind, treatment: text(240) }).strict();

/** The one open field. Bounded, single, and with a stated job. */
export const ExtractedPhilosophy = z
  .object({ text: z.string().max(1200) })
  .strict()
  .refine((p) => p.text === '' || p.text.length >= 80, {
    message: 'philosophy must be one paragraph of at least 80 characters, or "" for undetermined',
    path: ['text'],
  });

/** Provisional. Ticket 005 owns the vocabulary and may replace this outright. */
export const LabelValue = z
  .string()
  .min(2)
  .max(40)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'lowercase, hyphenated, no spaces');

export const ExtractedDna = z
  .object({
    palette: ExtractedPalette,
    typography: ExtractedTypography,
    composition: ExtractedComposition,
    spacing: ExtractedSpacing,
    surfaceTreatment: ExtractedSurfaceTreatment,
    imagery: ExtractedImagery,
    philosophy: ExtractedPhilosophy,
    labels: z.array(LabelValue).min(3).max(8),
  })
  .strict();

/** Exactly the object the SDK returns in `structured_output`. */
export type ExtractedDna = z.infer<typeof ExtractedDna>;

/* ------------------------------------------------------------------ */
/* Traits, as they are stored                                          */
/* ------------------------------------------------------------------ */

/*
 * The stored shape is the extracted shape plus authorship, and nothing else.
 * Authorship sits on the trait, because 001 decision 7 makes a trait atomic
 * when mixed and a thing that is atomic when mixed is atomic when attributed.
 * The palette is the single exception: its swatches carry authorship
 * individually, because that is the one place a value's fidelity differs from
 * its siblings' and the one place a future sampler would rewrite values one at
 * a time.
 */

export const Swatch = ExtractedSwatch.extend({ authorship: SwatchAuthorship }).strict();

export const Palette = z
  .object({
    background: Swatch,
    surface: Swatch,
    ink: Swatch,
    muted: Swatch,
    accent: Swatch,
  })
  .strict();

export const Typography = ExtractedTypography.extend({ authorship: Authorship }).strict();
export const Composition = ExtractedComposition.extend({ authorship: Authorship }).strict();
export const Spacing = ExtractedSpacing.extend({ authorship: Authorship }).strict();
export const SurfaceTreatment = ExtractedSurfaceTreatment.extend({
  authorship: Authorship,
}).strict();
export const Imagery = ExtractedImagery.extend({ authorship: Authorship }).strict();
export const Philosophy = z
  .object({ text: z.string().max(1200), authorship: Authorship })
  .strict()
  .refine((p) => p.text === '' || p.text.length >= 80, {
    message: 'philosophy must be one paragraph of at least 80 characters, or "" for undetermined',
    path: ['text'],
  });

export const Label = z.object({ value: LabelValue, authorship: Authorship }).strict();

export const Dna = z
  .object({
    palette: Palette,
    typography: Typography,
    composition: Composition,
    spacing: Spacing,
    surfaceTreatment: SurfaceTreatment,
    imagery: Imagery,
    philosophy: Philosophy,
    labels: z.array(Label).min(3).max(8),
  })
  .strict();

export type Dna = z.infer<typeof Dna>;

/* ------------------------------------------------------------------ */
/* Everything that is not the agent's to write                         */
/* ------------------------------------------------------------------ */

/** The traits a Scope can structurally exclude. `labels` is never excluded. */
export const TraitName = z.enum([
  'palette',
  'typography',
  'composition',
  'spacing',
  'surfaceTreatment',
  'imagery',
  'philosophy',
]);
export type TraitName = z.infer<typeof TraitName>;

/**
 * Provisional. 001 decision 5 gave the Scope vocabulary to ticket 005; this is
 * a placeholder so `notApplicable` is derivable in the meantime, and 005 is
 * free to replace it.
 */
export const Scope = z.enum(['page', 'section', 'component']);
export type Scope = z.infer<typeof Scope>;

/** Where the Item came from. Provenance, never a place the app browses to. */
export const Source = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('url'), url: z.string().min(1) }).strict(),
  z
    .object({
      kind: z.literal('file'),
      /** The path handed to the producer, kept as a citation, not as a link. */
      originalPath: z.string().min(1),
      /** An address supplied with `--source`, if the file came from somewhere. */
      url: z.string().min(1).nullable(),
    })
    .strict(),
]);

/**
 * How the Capture was taken. `mode` is the evidence behind `scope`: 003 found
 * the CLI knows this exactly, where the agent could only infer it from pixels.
 */
export const CaptureMode = z.enum(['viewport', 'selector', 'clip', 'supplied']);

export const Capture = z
  .object({
    file: z.string().min(1),
    /** Null for a handed-over file, whose true capture moment is unknown. */
    takenAt: Instant.nullable(),
    pixelWidth: z.number().int().positive(),
    pixelHeight: z.number().int().positive(),
    mode: CaptureMode,
  })
  .strict();

/** Which writer produced this entry. 008 owns both paths. */
export const AuthoredBy = z
  .object({
    kind: z.enum(['cli', 'hand']),
    model: z.string().min(1).nullable(),
    runAt: Instant,
    /** Which extraction prompt produced this DNA. Makes prompt tuning legible. */
    promptVersion: z.string().min(1).nullable(),
  })
  .strict();

export const Item = z
  .object({
    /** Bumped by 008 when this shape changes. */
    schemaVersion: z.literal(1),
    /** Opaque, assigned at save time. Nothing about the source contributes. */
    id: z.string().min(1),
    addedAt: Instant,
    source: Source,
    capture: Capture,
    /** Producer-supplied. The agent never writes this. */
    scope: Scope,
    /** Traits this Item's Scope structurally excludes. Frozen at write time. */
    notApplicable: z.array(TraitName).max(7),
    /** Your words on why this was worth saving. Never written by the agent. */
    note: z.string().max(4000).nullable(),
    authoredBy: AuthoredBy,
    dna: Dna,
  })
  .strict()
  .superRefine((item, ctx) => {
    if (new Set(item.notApplicable).size !== item.notApplicable.length) {
      ctx.addIssue({
        code: 'custom',
        message: 'notApplicable must not repeat a trait',
        path: ['notApplicable'],
      });
    }
    if (item.source.kind === 'url' && item.capture.mode === 'supplied') {
      ctx.addIssue({
        code: 'custom',
        message: 'a url Source cannot have a supplied Capture; that is a file Source',
        path: ['capture', 'mode'],
      });
    }
  });

export type Item = z.infer<typeof Item>;

/* ------------------------------------------------------------------ */
/* The derivation everyone would otherwise reinvent                    */
/* ------------------------------------------------------------------ */

/**
 * The three cases 001 decision 6 requires, derived rather than stored.
 *
 *   not_applicable - the Scope excludes it. Recorded once per Item, next to
 *                    Scope, because it is a fact about the Scope.
 *   undetermined   - every leaf came back empty. The agent looked and could
 *                    not tell; a re-run or an Override can fill it.
 *   present        - anything else, including a partial read.
 *
 * There is deliberately no fourth state for "read, but unstable". See the
 * commentary: instability is a property of the field, not of the value, and
 * 002 forbids asking the agent to self-score.
 */
export type TraitState = 'present' | 'not_applicable' | 'undetermined';

const isEmptyLeaf = (v: unknown): boolean => v === '' || v === 'undetermined';

export function traitState(item: Item, trait: TraitName): TraitState {
  if (item.notApplicable.includes(trait)) return 'not_applicable';
  const value = item.dna[trait] as Record<string, unknown>;
  const leaves =
    trait === 'palette'
      ? Object.values(value).flatMap((swatch) => {
          const s = swatch as Record<string, unknown>;
          return [s.hex, s.weight];
        })
      : Object.entries(value)
          .filter(([k]) => k !== 'authorship')
          .map(([, v]) => v);
  return leaves.every(isEmptyLeaf) ? 'undetermined' : 'present';
}

/**
 * True when 007 must hedge a value rather than assert it: the agent eyeballed
 * it, so "around #ff6b35" is honest and "#ff6b35" is not.
 */
export const isApproximate = (swatch: z.infer<typeof Swatch>): boolean =>
  swatch.authorship === 'agent';

/**
 * Lift an agent payload into a stored DNA by stamping authorship. This is the
 * whole of the producer's transformation, and it is mechanical by design.
 */
export function stampAuthorship(extracted: ExtractedDna): Dna {
  const swatch = (s: z.infer<typeof ExtractedSwatch>) => ({ ...s, authorship: 'agent' as const });
  return {
    palette: {
      background: swatch(extracted.palette.background),
      surface: swatch(extracted.palette.surface),
      ink: swatch(extracted.palette.ink),
      muted: swatch(extracted.palette.muted),
      accent: swatch(extracted.palette.accent),
    },
    typography: { ...extracted.typography, authorship: 'agent' },
    composition: { ...extracted.composition, authorship: 'agent' },
    spacing: { ...extracted.spacing, authorship: 'agent' },
    surfaceTreatment: { ...extracted.surfaceTreatment, authorship: 'agent' },
    imagery: { ...extracted.imagery, authorship: 'agent' },
    philosophy: { ...extracted.philosophy, authorship: 'agent' },
    labels: extracted.labels.map((value) => ({ value, authorship: 'agent' as const })),
  };
}
