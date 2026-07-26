/**
 * PROTOTYPE - throwaway. Ticket 002.
 *
 * Pure functions. No I/O, no console. This is the bit worth lifting if the
 * finding is "we need to classify extraction failures", because 008 (the
 * waiting state) needs to know which failures are worth a silent retry and
 * which are worth showing the user.
 */
import { z } from 'zod';
import { ProvisionalDna } from './schema.js';

export type FailureKind =
  | 'no-json' //            nothing JSON-shaped came back at all
  | 'prose-wrapped' //      valid JSON, but buried in prose or fences
  | 'invented-fields' //    keys we never asked for
  | 'missing-fields' //     required keys absent
  | 'malformed-hex' //      a palette value that is not #rrggbb
  | 'bad-enum' //           typography.scale outside the enum
  | 'length-bounds' //      philosophy / tags outside min-max
  | 'schema-other';

export type ParseOutcome =
  | { ok: true; value: ProvisionalDna; wasProseWrapped: boolean }
  | { ok: false; failures: FailureKind[]; detail: string[]; wasProseWrapped: boolean };

/**
 * Pull the first balanced top-level JSON object out of arbitrary text.
 * Returns the substring plus whether anything else surrounded it.
 */
export function extractJsonObject(
  text: string
): { json: string; wasProseWrapped: boolean } | null {
  const start = text.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        const json = text.slice(start, i + 1);
        const before = text.slice(0, start).trim();
        const after = text.slice(i + 1).trim();
        return { json, wasProseWrapped: before.length > 0 || after.length > 0 };
      }
    }
  }
  return null;
}

/**
 * Map a ZodError onto the ticket's failure taxonomy.
 *
 * Issue codes verified empirically against the installed zod (v4), which
 * renamed several of v3's: `invalid_string` -> `invalid_format`,
 * `invalid_enum_value` -> `invalid_value`, and a missing required key is
 * `invalid_type` with `input === undefined` (v3's `received` field is gone).
 */
function classifyZodError(err: z.ZodError): { failures: FailureKind[]; detail: string[] } {
  const failures = new Set<FailureKind>();
  const detail: string[] = [];

  for (const issue of err.issues) {
    const path = issue.path.join('.') || '(root)';
    const inPalette = issue.path[0] === 'palette';
    detail.push(`${path}: ${issue.message}`);

    switch (issue.code) {
      case 'unrecognized_keys':
        failures.add('invented-fields');
        break;
      case 'invalid_type':
        // Absent required key vs. present-but-wrong-type.
        if ((issue as { input?: unknown }).input === undefined) {
          failures.add('missing-fields');
        } else {
          failures.add('schema-other');
        }
        break;
      case 'invalid_format':
        failures.add(inPalette ? 'malformed-hex' : 'schema-other');
        break;
      case 'invalid_value':
        failures.add('bad-enum');
        break;
      case 'too_small':
      case 'too_big':
        failures.add('length-bounds');
        break;
      default:
        failures.add('schema-other');
    }
  }

  return { failures: [...failures], detail };
}

/** The whole raw-text -> validated-or-classified pipeline. Pure. */
export function parseAndClassify(rawText: string): ParseOutcome {
  const found = extractJsonObject(rawText);
  if (!found) {
    return {
      ok: false,
      failures: ['no-json'],
      detail: ['no balanced JSON object found in the response text'],
      wasProseWrapped: false,
    };
  }

  let candidate: unknown;
  try {
    candidate = JSON.parse(found.json);
  } catch (e) {
    return {
      ok: false,
      failures: ['no-json'],
      detail: [`found braces but JSON.parse failed: ${(e as Error).message}`],
      wasProseWrapped: found.wasProseWrapped,
    };
  }

  const result = ProvisionalDna.safeParse(candidate);
  if (result.success) {
    return { ok: true, value: result.data, wasProseWrapped: found.wasProseWrapped };
  }

  const { failures, detail } = classifyZodError(result.error);
  if (found.wasProseWrapped) failures.unshift('prose-wrapped');
  return { ok: false, failures, detail, wasProseWrapped: found.wasProseWrapped };
}
