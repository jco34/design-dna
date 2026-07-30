/**
 * The Agent SDK call. Ticket 002 proved this shape; this is that shape applied.
 *
 * Four options are load-bearing and each was chosen for a measured reason:
 *
 *   permissionMode: 'dontAsk'   The correct headless mode: never prompt, deny
 *                               anything not pre-approved. It does *not* need
 *                               `allowDangerouslySkipPermissions`, which
 *                               'bypassPermissions' does.
 *
 *   settingSources: []          Without this the subprocess inherits the
 *                               developer's global `~/.claude/settings.json`,
 *                               `CLAUDE.md` and installed skills. For a
 *                               measurement that poisons the result; for this
 *                               producer it would mean extraction output varying
 *                               per machine. It is also why the prompt below
 *                               carries its own rules rather than relying on this
 *                               repo's `AGENTS.md`: the subprocess cannot see it.
 *
 *   allowedTools: ['Read']      One tool, because there is one job: read the PNG
 *                               at a path. No web access is granted, so the model
 *                               cannot answer from the live site instead of from
 *                               the Capture.
 *
 *   outputFormat json_schema    The SDK constrains generation natively and
 *                               self-retries on violation. 002 measured 3/3 valid
 *                               first-try in schema mode against 1/1 in freeform
 *                               that arrived wrapped in ``` fences. Zod stays as
 *                               the second, redundant check at the boundary.
 */
import { query } from '@anthropic-ai/claude-agent-sdk';
import { ExtractedBuild, ExtractedDna, GENERATION_SCHEMA, PROMPT_VERSION } from '../../../schema/index.js';
import type { MotionObservations } from './capture.js';

export interface ExtractionResult {
  readonly dna: ExtractedDna;
  readonly build: ExtractedBuild;
  readonly model: string | null;
  readonly costUsd: number | null;
  readonly durationMs: number;
  readonly promptVersion: string;
}

/** The agent produced something the schema refuses, after its own retries. */
export class ExtractionFailed extends Error {
  constructor(
    message: string,
    readonly issues: readonly string[] = [],
  ) {
    super(message);
  }
}

/* ------------------------------------------------------------------ */
/* The prompt                                                          */
/* ------------------------------------------------------------------ */

/**
 * What the JSON Schema descriptions cannot carry.
 *
 * Per-field rules live in `GENERATION_SCHEMA` so they sit next to the field they
 * govern. What is left for the prompt is the posture: what to look at, what
 * counts as failure, and the one instruction that costs the most to get wrong,
 * which is that Undetermined beats a plausible guess.
 */
const POSTURE = `You are extracting the design DNA of one captured design.

Read only what is actually there. This matters more than completeness:

- Undetermined is a correct answer. Empty string for text, "undetermined" for
  choices. It means you looked and the evidence could not tell you, and it can be
  filled in later by a re-run or by hand.
- A confident wrong value is the expensive failure, because nothing marks it as
  needing a second look. Never guess a typeface name to fill a field. Never
  invent a label value.
- Distinguish "the design lacks this" from "I could not read this". Every choice
  field has a member for genuine absence - none, flat, uniform - and separately
  has "undetermined". Reaching for the wrong one turns a gap in your reading into
  a claim about the design.

Describe the design, never the subject matter. Not what the company does, not
what the copy says, not whether the product is any good.

Colour: give the colour that performs each role. Your hex values are a visual
read rather than a pixel measurement, they are stored as approximate, and they
are expected to be a few units off. Getting the *weight* right - how much of the
design each colour carries - matters more than the hex.

Typography: name a family only if you genuinely recognise the letterforms. If you
do not, leave the family empty and describe the character precisely instead.
"Geometric sans with a single-storey a and very short descenders" is useful.
"Sans-serif" is not, and a guessed name is worse than either.

The philosophy paragraph is the argument the design is making, not an inventory
of its parts. Say what it is for and what it trades away to get there. Test it
before you finish: if the paragraph would still be true pasted onto a different
design, it is not specific enough yet. Do not restate the fields above and do not
praise.`;

/**
 * The one instruction that asks the agent to infer rather than read. Kept
 * separate from `POSTURE` because it governs a field with a fundamentally
 * different honesty rule: everywhere else "I cannot tell" is the failure
 * mode to avoid guessing around; here a *plausible, well-reasoned* guess is
 * the actual job, and the honesty rule is narrower - never invent internals
 * that are not visible in the design itself.
 */
const BUILD_POSTURE = `THE BUILD: alongside the nine design traits above, suggest how you would actually
replicate this design - the toolset and the few techniques that matter for it
specifically, not a generic build plan.

This is the one field where you are allowed to infer rather than read. Key off
what you are seeing: a 3D or heavily animated design calls for a real 3D/motion
stack (for example Three.js, React Three Fiber, GSAP); a plain static page calls
for almost nothing distinctive, and an empty stack with empty techniques is the
honest answer for it. Never invent internals you cannot see from the design
alone - no state management, no backend, no data layer claims. Name candidate
tools, most load-bearing first, then the 2-4 techniques specific to this design.`;

/**
 * Motion is the only trait whose evidence is handed over rather than looked at,
 * so the prompt has to be explicit about which situation the agent is in. There
 * are exactly two, and conflating them is what produces a fabricated `none`.
 */
export function motionBriefing(observations: MotionObservations | null): string {
  if (observations === null) {
    return `MOTION: you have a single still image and no observations of the live design.

Every motion field is therefore Undetermined: presence "undetermined", triggers
[], easing "undetermined", pace "undetermined", character "", choreography "".

Do NOT report presence "none". That would assert the design does not move, and a
still frame cannot tell you that - a heavily animated page caught at rest looks
identical to a deliberately static one. Undetermined is the honest answer and is
recoverable; "none" is a fabrication that will never be revisited.

The single exception: if the image itself documents motion design, such as a
storyboard, a timing diagram or an annotated spec sheet with easing curves, then
you are reading motion content directly and should record what it states.`;
  }

  const lines: string[] = [
    `MOTION: the page was explored interactively before it was captured, with`,
    `animations enabled. These are the observations. Base the motion fields on`,
    `them, not on what the static image suggests.`,
    ``,
  ];

  if (observations.transitions.length > 0) {
    lines.push('CSS transitions found in computed styles:');
    for (const t of observations.transitions) lines.push(`  - ${t}`);
  } else {
    lines.push('No CSS transitions were found in computed styles.');
  }

  if (observations.keyframeAnimations.length > 0) {
    lines.push('Keyframe animations found:');
    for (const a of observations.keyframeAnimations) lines.push(`  - ${a}`);
  }
  if (observations.ambientAnimationCount > 0) {
    lines.push(
      `${observations.ambientAnimationCount} element(s) run an infinitely repeating ` +
        `animation, so something moves with no input at all.`,
    );
  }

  lines.push('');
  if (observations.hover.length > 0) {
    lines.push('Hover was tested on one representative of each interactive kind:');
    for (const h of observations.hover) {
      lines.push(`  - ${h.label}: changed ${h.properties.join(', ')}`);
    }
  } else {
    lines.push('Hover produced no computed-style change on any element tested.');
  }
  if (observations.hoverInertCount > 0) {
    lines.push(
      `  ${observations.hoverInertCount} interactive kind(s) did not respond to hover at all.`,
    );
  }

  lines.push('');
  if (observations.scripted.libraries.length > 0) {
    lines.push(
      `Animation libraries detected: ${observations.scripted.libraries.join(', ')}. Motion built ` +
        `this way is written as inline styles frame by frame, so it does NOT appear in the CSS ` +
        `lists above. Weigh the measured figures below far more heavily than that list.`,
    );
  }
  if (observations.scripted.inlineAnimatedElements > 0) {
    lines.push(
      `${observations.scripted.inlineAnimatedElements} element(s) carry an inline transform or ` +
        `opacity, which is the fingerprint of script-driven animation.`,
    );
  }
  if (observations.scripted.webAnimations > 0) {
    lines.push(
      `${observations.scripted.webAnimations} Web Animations API animation(s) were running.`,
    );
  }

  lines.push('');
  lines.push(`Keyboard focus ring visible: ${observations.focusRingVisible ? 'yes' : 'no'}.`);

  const s = observations.scroll;
  lines.push(
    `Scroll was measured directly, by tracking ${s.sampled} elements across ${s.steps} scroll ` +
      `depths down a page ${s.depthViewports} viewports tall, and comparing each element's ` +
      `document-space position, opacity and scale between depths:`,
  );
  lines.push(`  - ${s.revealed} element(s) went from invisible to visible as they were reached`);
  lines.push(
    `  - ${s.parallax} element(s) moved by more or less than the scroll itself, which is ` +
      `parallax, pinning or a scroll-linked transform`,
  );
  lines.push(`  - ${s.scaled} element(s) changed scale`);
  lines.push(
    `  - reveals ${s.staggered ? 'landed at several different scroll depths, so they are sequenced rather than arriving as one group' : 'all landed at the same depth, so there is no evidence of staggering'}`,
  );
  lines.push(`  - sticky or resizing header: ${observations.stickyHeader ? 'yes' : 'no'}`);
  lines.push(
    `These counts are measured effects rather than declared intentions, so they hold whatever ` +
      `the design was built with. A high reveal or parallax count means the page genuinely ` +
      `animates on scroll even when the CSS lists above are nearly empty.`,
  );
  if (observations.disclosuresOpened.length > 0) {
    lines.push(`Disclosure controls opened and closed: ${observations.disclosuresOpened.join(', ')}.`);
  }
  if (observations.honoursReducedMotion === true) {
    lines.push(
      `The site declares materially less motion under prefers-reduced-motion, so it ` +
        `honours the preference. Worth noting in the philosophy paragraph as a craft signal.`,
    );
  } else if (observations.honoursReducedMotion === false) {
    lines.push(
      `The site declares the same motion under prefers-reduced-motion, so it does not ` +
        `honour the preference.`,
    );
  }
  for (const note of observations.notes) lines.push(`Note: ${note}.`);

  lines.push('');
  lines.push(
    `Where these observations are thin, prefer Undetermined over inference. An absence ` +
      `of observed transitions is evidence for presence "none" only if hover, scroll and ` +
      `load all came back inert; otherwise it means the pass could not see the motion.`,
  );

  return lines.join('\n');
}

function buildPrompt(imagePath: string, observations: MotionObservations | null): string {
  return [
    `Read the image at ${imagePath} and extract the design DNA of the design it shows.`,
    '',
    POSTURE,
    '',
    motionBriefing(observations),
    '',
    BUILD_POSTURE,
  ].join('\n');
}

/* ------------------------------------------------------------------ */
/* The call                                                            */
/* ------------------------------------------------------------------ */

export interface ExtractOptions {
  readonly model?: string;
  readonly timeoutMs?: number;
  readonly observations?: MotionObservations | null;
}

/* ------------------------------------------------------------------ */
/* The one place that talks to the SDK                                 */
/* ------------------------------------------------------------------ */

export interface AgentRequest {
  readonly prompt: string;
  /**
   * A JSON Schema object. Typed structurally rather than as `unknown` because the
   * SDK's `outputFormat` requires an indexable object, and the two schemas in
   * `schema/generation.ts` are `as const`, which is assignable to this and not to
   * `unknown` without a cast at every call site.
   */
  readonly schema: Readonly<Record<string, unknown>>;
  readonly model?: string;
  readonly timeoutMs?: number;
  readonly allowedTools?: readonly string[];
}

export interface AgentResponse {
  readonly structured: unknown;
  readonly model: string | null;
  readonly costUsd: number | null;
  readonly durationMs: number;
}

/**
 * Every SDK call goes through here, so the four load-bearing options documented at
 * the top of this file are set once rather than per caller. `re-explore` asks for a
 * motion-only schema and `add` asks for the full one; neither gets to decide
 * whether the subprocess inherits the developer's global settings.
 */
export async function runAgent(request: AgentRequest): Promise<AgentResponse> {
  const started = Date.now();
  const stderrChunks: string[] = [];
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), request.timeoutMs ?? 240_000);

  let structured: unknown;
  let model: string | null = null;
  let costUsd: number | null = null;
  let failure: string | null = null;

  try {
    const stream = query({
      prompt: request.prompt,
      options: {
        model: request.model,
        permissionMode: 'dontAsk',
        allowedTools: [...(request.allowedTools ?? ['Read'])],
        settingSources: [],
        outputFormat: { type: 'json_schema' as const, schema: request.schema },
        abortController: abort,
        stderr: (chunk: string) => stderrChunks.push(chunk),
      },
    });

    for await (const message of stream as AsyncIterable<Record<string, unknown>>) {
      if (message.type !== 'result') continue;
      if (typeof message.total_cost_usd === 'number') costUsd = message.total_cost_usd;

      // There is no `model` field on the result message. `modelUsage` is keyed by
      // model id, so the keys are where the answer lives. A run that escalated
      // through more than one model reports all of them rather than picking, since
      // `authoredBy.model` exists to say what produced this DNA and a single name
      // would be a guess about which one mattered.
      const usage = message.modelUsage;
      if (typeof usage === 'object' && usage !== null) {
        const names = Object.keys(usage as Record<string, unknown>);
        if (names.length > 0) model = names.join('+');
      }

      if (message.subtype === 'success') {
        structured = message.structured_output;
      } else {
        const errors = Array.isArray(message.errors) ? message.errors.join('; ') : 'no detail';
        failure = `${String(message.subtype)}: ${errors}`;
      }
    }
  } catch (error) {
    clearTimeout(timer);
    const stderr = stderrChunks.join('').trim();
    throw new ExtractionFailed(
      `the agent could not be run: ${(error as Error).message}${stderr === '' ? '' : `\n${stderr}`}`,
    );
  }
  clearTimeout(timer);

  if (failure !== null) {
    // 008 decision 4: the SDK already self-retries against the schema, so this is
    // the unfixable residue. Refuse rather than writing a degraded Item, because a
    // degraded Item is first-class in the grid, in search and in a Mix.
    throw new ExtractionFailed(`the agent gave up: ${failure}`);
  }
  if (structured === undefined) {
    throw new ExtractionFailed('the agent returned no structured output');
  }

  return { structured, model, costUsd, durationMs: Date.now() - started };
}

/* ------------------------------------------------------------------ */
/* The full nine-trait extraction                                      */
/* ------------------------------------------------------------------ */

export async function extractDna(
  imagePath: string,
  options: ExtractOptions = {},
): Promise<ExtractionResult> {
  const result = await runAgent({
    prompt: buildPrompt(imagePath, options.observations ?? null),
    schema: GENERATION_SCHEMA,
    model: options.model,
    timeoutMs: options.timeoutMs,
  });

  // `build` sits beside the nine trait keys in the one flat object the SDK
  // returns, so it has to come off before the rest validates as
  // `ExtractedDna`, which is `.strict()` with exactly nine keys.
  const payload = result.structured as Record<string, unknown>;
  const { build, ...dnaPayload } = payload;

  const parsedDna = ExtractedDna.safeParse(lowercaseHexes(dnaPayload));
  if (!parsedDna.success) {
    throw new ExtractionFailed(
      'the agent output does not satisfy the schema',
      parsedDna.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
    );
  }

  const parsedBuild = ExtractedBuild.safeParse(build);
  if (!parsedBuild.success) {
    throw new ExtractionFailed(
      'the agent output does not satisfy the build schema',
      parsedBuild.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
    );
  }

  return {
    dna: parsedDna.data,
    build: parsedBuild.data,
    model: result.model,
    costUsd: result.costUsd,
    durationMs: result.durationMs,
    promptVersion: PROMPT_VERSION,
  };
}

/**
 * `Hex` requires lowercase, and that rule is enforced in Zod rather than in the
 * JSON Schema because `pattern` was never exercised against the SDK's structured
 * output. So the producer lowercases before validating, and this is that step. It
 * is a normalisation, not a repair: `#AABBCC` and `#aabbcc` are the same colour,
 * whereas a malformed hex still fails, as it should.
 */
function lowercaseHexes(payload: unknown): unknown {
  if (typeof payload !== 'object' || payload === null) return payload;
  const root = payload as Record<string, unknown>;
  const palette = root.palette;
  if (typeof palette !== 'object' || palette === null) return payload;

  const fixed: Record<string, unknown> = {};
  for (const [role, swatch] of Object.entries(palette as Record<string, unknown>)) {
    if (typeof swatch === 'object' && swatch !== null) {
      const s = swatch as Record<string, unknown>;
      fixed[role] = typeof s.hex === 'string' ? { ...s, hex: s.hex.toLowerCase() } : s;
    } else {
      fixed[role] = swatch;
    }
  }
  return { ...root, palette: fixed };
}

/** The all-Undetermined DNA `--no-extract` writes. The mechanical half, done. */
export function undeterminedDna(): ExtractedDna {
  const swatch = { hex: '', weight: 'undetermined' as const };
  return ExtractedDna.parse({
    palette: {
      background: swatch,
      surface: swatch,
      ink: swatch,
      muted: swatch,
      accent: swatch,
    },
    typography: {
      headingFamily: '',
      headingCharacter: '',
      bodyFamily: '',
      bodyCharacter: '',
      scale: 'undetermined',
      weightRange: 'undetermined',
    },
    composition: { structure: '', contentWidth: 'undetermined' },
    spacing: { density: 'undetermined', rhythm: '' },
    surfaceTreatment: {
      corners: 'undetermined',
      borders: 'undetermined',
      elevation: 'undetermined',
      finish: '',
    },
    imagery: { kind: 'undetermined', treatment: '' },
    motion: {
      presence: 'undetermined',
      triggers: [],
      easing: 'undetermined',
      pace: 'undetermined',
      character: '',
      choreography: '',
    },
    philosophy: { text: '' },
    labels: { genre: 'undetermined', style: [], mood: [] },
  });
}

/** The all-Undetermined Build `--no-extract` writes. */
export function undeterminedBuild(): ExtractedBuild {
  return ExtractedBuild.parse({ stack: [], techniques: '' });
}
