---
id: 002
title: Prove the Agent SDK can drive schema-valid design extraction on Windows
label: wayfinder:prototype
status: closed
assignee: jeb
blocked-by: none
parent: map
---

## Question

Can the Claude Agent SDK, spawned as a local subprocess from a Node server
process on Windows, reliably return schema-valid design analysis?

The AI engine choice was locked while charting, and this is the risk that came
with it. If the answer is no, the engine decision flips and much of the map
changes, so this ticket exists to retire that risk before anything is built on
top of it.

Answer with a throwaway spike, not a design discussion. Use a deliberately
rough provisional schema (a handful of fields: palette as named hex roles,
typography, a philosophy paragraph, a few tags) and validate against it with
Zod. Do not try to design the real schema here, that is ticket 004.

Find out:

- **Does it run headlessly at all?** Invoked from a Next.js route handler or a
  worker on Windows, non-interactive, using existing Claude Code auth rather
  than an API key. What is the exact invocation? Does auth survive being run
  from a spawned process?
- **Is structured output trustworthy?** Run the same screenshot through it
  several times. How often does it come back schema-valid on the first try?
  What does failure look like: prose wrapped around the JSON, invented fields,
  missing fields, plausible-but-wrong hex values?
- **Both input kinds.** An image file handed over by path (the SDK can read
  images off disk), and a URL it fetches itself. Does URL analysis without a
  rendered screenshot produce anything worth keeping? That finding feeds 003.
- **Latency and concurrency.** Seconds per item? What happens if three ingests
  fire at once? Is there a queue or a hard limit?
- **Is the analysis any good?** The part only you can judge. Show the raw
  output for two or three real inputs and get a verdict on whether it captures
  what you actually like about a design or produces generic filler.

Deliverable: a spike under `wayfinder/assets/002-*` plus a findings note,
linked from the resolution. Record the working invocation verbatim, the
observed validity rate, and the latency, because 004, 006 and 008 all depend on
those numbers.

## Resolution

**The engine risk is retired, and the ticket was then partly overtaken.** The
answer to the question as asked is yes. In the same session the destination was
re-chartered so that no AI runs inside the web app at all, which makes the
in-app half of this ticket moot. Closing rather than leaving open: what remains
open is not this question.

Spike: [`../assets/002-agent-sdk-spike/`](../assets/002-agent-sdk-spike/).
Findings: [`../assets/002-agent-sdk-findings.md`](../assets/002-agent-sdk-findings.md).

**What was proven and still matters, because the CLI runs the same SDK:**

- **Headless works and auth survives.** `ANTHROPIC_API_KEY` unset; the SDK
  spawned its bundled CLI as a subprocess from Node on Windows and completed,
  on existing Claude Code credentials. Verified from a plain worker *and* from
  inside an HTTP request handler. Working invocation recorded verbatim in the
  findings note, including the three load-bearing options
  (`permissionMode: 'dontAsk'`, an explicit `allowedTools` allowlist, and
  `settingSources: []` for isolation - without the last, output varies per
  machine).
- **Structured output is better than assumed.** The SDK has native
  `outputFormat: { type: 'json_schema', schema }`, delivers the payload as an
  object on `structured_output`, and self-retries on violation. 4/4 valid, zero
  invented fields, zero missing fields, zero malformed hex. The naive
  prompt-and-scrape path also validated but returned fenced JSON, so it needs a
  tolerant parser and schema mode does not. **004 should therefore design the
  schema as JSON Schema first**, with Zod as a redundant check at the boundary.
- **Palette values are eyeballed, not sampled.** Against a generated mock with
  known colours, every hex was biased (`#ff6b35` read as `#fb6b3e`) *and*
  unstable across runs of the same image. `typography.scale` flipped
  `moderate` → `dramatic` on identical input. This survives the re-charter
  untouched: a human doing the analysis in a chat session eyeballs colour too.
  Consequences pushed to 004 (is palette agent-read or ground truth?), 007
  (a prompt asserting exact hex asserts something false), and the map's
  "correcting the agent" (re-extraction is destructive, so Override should be
  the primary correction).
- **Cost and latency:** ~$0.05-0.13 and 18-48s per item, varying 2x on identical
  input. Bounded and affordable at the locked scale, but too variable to promise
  an ETA anywhere.

**What was never measured, and no longer blocks anything:** the concurrency
number and a validity rate at n≥5. Both were needed for 008's in-app queue and
waiting state, which no longer exist. If the producer CLI grows batch mode,
`[3]` in the spike still measures concurrency.

**Not answered, and deliberately not carried forward as a blocker:** whether the
analysis is any *good* on real inputs. That is a judgement on real screenshots,
and it now belongs to the prompt-tuning loop in the map's *Not yet specified*
rather than to a go/no-go ticket.
