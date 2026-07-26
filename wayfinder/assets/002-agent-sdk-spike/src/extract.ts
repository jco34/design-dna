/**
 * PROTOTYPE - throwaway shell, but THIS is the portable module. Ticket 002.
 *
 * The seam: everything terminal-facing lives in tui.ts. This file does I/O
 * (it spawns the Agent SDK subprocess) but never prints, never reads keys, and
 * never decides control flow from a console. If the spike answers "yes", this
 * is what gets lifted into the real ingest worker.
 *
 * Two invocation modes, because the ticket's central risk is schema validity
 * and the SDK turns out to offer a native answer:
 *   - 'schema'   -> options.outputFormat = { type: 'json_schema', schema }.
 *                   The CLI constrains and self-retries; the result carries
 *                   `structured_output`.
 *   - 'freeform' -> no outputFormat. We just ask for JSON in the prompt and
 *                   scrape it. This is the naive approach, and the control
 *                   group for the validity-rate number 004/006/008 depend on.
 */
import { query } from '@anthropic-ai/claude-agent-sdk';
import { PROVISIONAL_JSON_SCHEMA } from './schema.js';
import { parseAndClassify, type ParseOutcome } from './classify.js';

export type ExtractionInput =
  | { kind: 'image'; path: string; label: string }
  | { kind: 'url'; url: string; label: string };

export type Mode = 'schema' | 'freeform';

export type Attempt = {
  input: ExtractionInput;
  mode: Mode;
  startedAt: number;
  durationMs: number;
  /** Where the payload came from: the SDK's structured field, or scraped text. */
  payloadSource: 'structured_output' | 'result-text' | 'none';
  rawText: string;
  outcome: ParseOutcome;
  /** SDK telemetry we owe the map: cost, turns, and how it stopped. */
  turns: number | null;
  costUsd: number | null;
  sessionId: string | null;
  resultSubtype: string | null;
  stopReason: string | null;
  /** Set when the SDK itself errored (auth, spawn, network) rather than the model. */
  transportError: string | null;
  /** Anything the CLI wrote to stderr. The auth answer usually shows up here. */
  stderr: string;
};

const INSTRUCTIONS = `You are analysing a piece of web/UI design and extracting its "design DNA".

Report ONLY what you can actually read off the design. Do not invent values.
For the palette, give the dominant role colours as #rrggbb hex.
For typography, name the families you can identify (or your best specific read
of the style, e.g. "geometric sans" - never "sans-serif").
"scale" is how much size contrast there is between heading and body:
tight | moderate | dramatic.
"philosophy" is ONE paragraph on what makes this design work - the intent, not
an inventory. Be specific to this design; generic filler is a failure.
"tags" are 3-8 short lowercase descriptors someone would search by.`;

const FREEFORM_SUFFIX = `

Respond with a single JSON object and nothing else. No prose, no markdown
fences, no commentary. Exactly these keys:
{
  "palette":    { "background": "#rrggbb", "surface": "#rrggbb",
                  "text": "#rrggbb", "accent": "#rrggbb" },
  "typography": { "headingFamily": "...", "bodyFamily": "...",
                  "scale": "tight|moderate|dramatic" },
  "philosophy": "one paragraph, 80-1200 characters",
  "tags":       ["...", "...", "..."]
}
Add no other keys.`;

function promptFor(input: ExtractionInput, mode: Mode): string {
  const target =
    input.kind === 'image'
      ? `Read the image at ${input.path} and analyse the design it shows.`
      : `Fetch ${input.url} and analyse the design of that page.`;

  return `${target}\n\n${INSTRUCTIONS}${mode === 'freeform' ? FREEFORM_SUFFIX : ''}`;
}

export type RunOptions = {
  mode: Mode;
  model?: string;
  timeoutMs?: number;
};

export async function runExtraction(
  input: ExtractionInput,
  opts: RunOptions
): Promise<Attempt> {
  const startedAt = Date.now();
  const stderrChunks: string[] = [];

  let rawText = '';
  let payloadSource: Attempt['payloadSource'] = 'none';
  let turns: number | null = null;
  let costUsd: number | null = null;
  let sessionId: string | null = null;
  let resultSubtype: string | null = null;
  let stopReason: string | null = null;
  let transportError: string | null = null;

  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), opts.timeoutMs ?? 180_000);

  try {
    const q = query({
      prompt: promptFor(input, opts.mode),
      options: {
        model: opts.model,
        // Non-interactive: never prompt, deny anything not pre-approved.
        permissionMode: 'dontAsk',
        allowedTools: input.kind === 'image' ? ['Read'] : ['WebFetch'],
        // Isolation. Without this the spike inherits the user's global
        // CLAUDE.md, skills and settings, which would poison the finding.
        settingSources: [],
        ...(opts.mode === 'schema'
          ? { outputFormat: { type: 'json_schema' as const, schema: PROVISIONAL_JSON_SCHEMA } }
          : {}),
        abortController: abort,
        stderr: (d) => stderrChunks.push(d),
      },
    });

    for await (const msg of q) {
      if (msg.type === 'assistant') {
        for (const block of msg.message.content) {
          if (block.type === 'text') rawText += block.text;
        }
        if (msg.error) transportError = `assistant error: ${msg.error}`;
      } else if (msg.type === 'result') {
        resultSubtype = msg.subtype;
        turns = msg.num_turns;
        costUsd = msg.total_cost_usd;
        sessionId = msg.session_id;
        stopReason = msg.stop_reason;

        if (msg.subtype === 'success') {
          if (msg.structured_output !== undefined) {
            payloadSource = 'structured_output';
            rawText = JSON.stringify(msg.structured_output);
          } else if (msg.result) {
            payloadSource = 'result-text';
            rawText = msg.result;
          }
        } else {
          transportError = `result ${msg.subtype}: ${msg.errors?.join('; ') ?? 'no detail'}`;
        }
      }
    }
  } catch (e) {
    transportError = `${(e as Error).name}: ${(e as Error).message}`;
  } finally {
    clearTimeout(timer);
  }

  if (payloadSource === 'none' && rawText.length > 0) payloadSource = 'result-text';

  return {
    input,
    mode: opts.mode,
    startedAt,
    durationMs: Date.now() - startedAt,
    payloadSource,
    rawText,
    outcome: parseAndClassify(rawText),
    turns,
    costUsd,
    sessionId,
    resultSubtype,
    stopReason,
    transportError,
    stderr: stderrChunks.join(''),
  };
}

/* ------------------------------------------------------------------ */
/* Aggregation over attempts. Pure.                                    */
/* ------------------------------------------------------------------ */

export type Tally = {
  runs: number;
  firstTryValid: number;
  validityRate: number;
  transportErrors: number;
  /**
   * Valid, but the JSON arrived wrapped in prose or ``` fences and had to be
   * scraped. Not a validity failure - we can recover it - but it is the thing
   * that decides whether the real pipeline needs a tolerant parser or can
   * trust the payload verbatim. Tracked separately for exactly that reason.
   */
  proseWrapped: number;
  latency: { min: number; p50: number; max: number };
  failureCounts: Record<string, number>;
  totalCostUsd: number;
};

export function tally(attempts: Attempt[]): Tally {
  const runs = attempts.length;
  if (runs === 0) {
    return {
      runs: 0,
      firstTryValid: 0,
      validityRate: 0,
      transportErrors: 0,
      proseWrapped: 0,
      latency: { min: 0, p50: 0, max: 0 },
      failureCounts: {},
      totalCostUsd: 0,
    };
  }

  const firstTryValid = attempts.filter((a) => a.outcome.ok).length;
  const durations = attempts.map((a) => a.durationMs).sort((x, y) => x - y);
  const failureCounts: Record<string, number> = {};

  for (const a of attempts) {
    if (!a.outcome.ok) {
      for (const f of a.outcome.failures) failureCounts[f] = (failureCounts[f] ?? 0) + 1;
    }
  }

  return {
    runs,
    firstTryValid,
    validityRate: firstTryValid / runs,
    transportErrors: attempts.filter((a) => a.transportError).length,
    proseWrapped: attempts.filter((a) => a.outcome.wasProseWrapped).length,
    latency: {
      min: durations[0],
      p50: durations[Math.floor(durations.length / 2)],
      max: durations[durations.length - 1],
    },
    failureCounts,
    totalCostUsd: attempts.reduce((s, a) => s + (a.costUsd ?? 0), 0),
  };
}
