/**
 * PROTOTYPE - throwaway. Ticket 002.
 *
 * A deliberately rough PROVISIONAL schema. This is NOT the extraction schema.
 * Designing that is ticket 004. This exists only to give the spike something
 * strict to validate against so we can measure a first-try validity rate.
 *
 * Two choices here are load-bearing for the measurement:
 *   - `.strict()` so INVENTED fields are a hard failure we can count.
 *   - a real hex regex so MALFORMED hex is a hard failure we can count.
 * Neither can catch a plausible-but-wrong hex (#1a1a1a when the real bg is
 * #181818). That needs an eyeball, which is why the TUI renders swatches.
 */
import { z } from 'zod';

const Hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'must be #rrggbb');

export const ProvisionalDna = z
  .object({
    palette: z
      .object({
        background: Hex,
        surface: Hex,
        text: Hex,
        accent: Hex,
      })
      .strict(),
    typography: z
      .object({
        headingFamily: z.string().min(1),
        bodyFamily: z.string().min(1),
        scale: z.enum(['tight', 'moderate', 'dramatic']),
      })
      .strict(),
    philosophy: z.string().min(80).max(1200),
    tags: z.array(z.string().min(1)).min(3).max(8),
  })
  .strict();

export type ProvisionalDna = z.infer<typeof ProvisionalDna>;

/** The same shape as JSON Schema, for the SDK's native `outputFormat`. */
export const PROVISIONAL_JSON_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['palette', 'typography', 'philosophy', 'tags'],
  properties: {
    palette: {
      type: 'object',
      additionalProperties: false,
      required: ['background', 'surface', 'text', 'accent'],
      properties: {
        background: { type: 'string', description: 'hex, #rrggbb' },
        surface: { type: 'string', description: 'hex, #rrggbb' },
        text: { type: 'string', description: 'hex, #rrggbb' },
        accent: { type: 'string', description: 'hex, #rrggbb' },
      },
    },
    typography: {
      type: 'object',
      additionalProperties: false,
      required: ['headingFamily', 'bodyFamily', 'scale'],
      properties: {
        headingFamily: { type: 'string' },
        bodyFamily: { type: 'string' },
        scale: { type: 'string', enum: ['tight', 'moderate', 'dramatic'] },
      },
    },
    philosophy: {
      type: 'string',
      description: 'One paragraph, 80-1200 chars, on what makes this design work.',
    },
    tags: { type: 'array', minItems: 3, maxItems: 8, items: { type: 'string' } },
  },
};
