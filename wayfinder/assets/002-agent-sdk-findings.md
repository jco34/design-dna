# 002 findings - can the Agent SDK drive schema-valid design extraction on Windows?

Spike: [`002-agent-sdk-spike/`](002-agent-sdk-spike/). Ticket:
[`../tickets/002-prove-agent-sdk-extraction.md`](../tickets/002-prove-agent-sdk-extraction.md).

**Status: the engine risk is retired, and the ticket was then superseded.** The
SDK works. Later the same day the destination was re-chartered so that no AI runs
inside the web app: extraction moved to a **producer CLI** outside it. That kills
the in-app questions here (concurrency for a queue, the waiting state) but leaves
the SDK findings fully intact, because the CLI runs the same SDK the same way.

Section 3 is the part to read. It is a real design constraint that survives the
re-charter untouched, and 004, 006 and 007 all have to absorb it.

Environment: Windows 11, `node v22.14.0`, `@anthropic-ai/claude-agent-sdk`
`0.3.207`, Claude Code CLI `2.1.218`.

> Numbers below are from my verification runs, 4 runs total. Enough to retire the
> go/no-go risk, not enough to be a validity rate to plan against. Nothing now
> blocks on that number, so it was left as measured rather than firmed up.

## 1. Does it run headlessly at all? Yes, and auth survives.

`ANTHROPIC_API_KEY` was **unset**. The SDK spawned its bundled CLI as a
subprocess from a plain Node process and completed normally, so existing Claude
Code credentials do carry into a spawned process. No interactive prompt, no
device-code flow, no login step.

The working invocation, verbatim:

```ts
import { query } from '@anthropic-ai/claude-agent-sdk';

const q = query({
  prompt,
  options: {
    permissionMode: 'dontAsk',                          // never prompt; deny anything not pre-approved
    allowedTools: ['Read'],                             // or ['WebFetch'] for the URL path
    settingSources: [],                                 // isolation - see below
    outputFormat: { type: 'json_schema', schema },      // schema mode only
    abortController,
    stderr: (d) => chunks.push(d),
  },
});
for await (const msg of q) { /* 'assistant' | 'result' */ }
```

This was verified in **both** host shapes the ticket asks about: a plain Node
process (the worker) and from inside an HTTP request handler (`npm run server`),
which is structurally what a Next.js route handler is. Both succeeded. I did not
install Next.js - the auth and spawn behaviour is a property of the Node process,
not the framework, and a real Next app would have buried the finding under
framework noise.

Three options are load-bearing and each was chosen for a reason:

- **`permissionMode: 'dontAsk'`** - "don't prompt, deny if not pre-approved".
  This is the correct headless mode. It does *not* need
  `allowDangerouslySkipPermissions`, which `'bypassPermissions'` does. Pair it
  with an explicit `allowedTools` allowlist.
- **`settingSources: []`** - without this the subprocess inherits the developer's
  global `~/.claude/settings.json`, `CLAUDE.md`, and installed skills. For a
  measurement that poisons the result; for the real app it means extraction
  output would silently vary per machine. **Set it explicitly.**
- **`allowedTools`** - `['Read']` for an image by path, `['WebFetch']` for a URL.

## 2. Is structured output trustworthy? Better than the ticket assumed.

The ticket assumed we would be scraping JSON out of prose. We do not have to.
The SDK exposes **native schema-constrained output**:

```ts
outputFormat: { type: 'json_schema', schema: /* JSON Schema */ }
```

The payload then arrives on the result message as `structured_output` (already an
object), not as text to be parsed. The SDK also **self-retries** on schema
violation - there is a distinct failure subtype `error_max_structured_output_retries`
and a terminal reason `structured_output_retry_exhausted`, which only make sense
if it validates and retries internally before giving up.

| | schema mode | freeform mode |
| --- | --- | --- |
| valid first try | 3/3 | 1/1 |
| payload arrived as | `structured_output` (object) | text, **wrapped in ` ```json ` fences** |
| needs a tolerant parser | no | **yes** |

Across every run in both modes I saw **zero** of the failure kinds the ticket
anticipated - no invented fields, no missing fields, no malformed hex, no
unparseable output. The one envelope problem (fences) only appeared in freeform.

Both modes produced schema-valid output against a strict Zod schema
(`.strict()`, real `#rrggbb` regex, enum on `scale`, length bounds on
`philosophy`). The difference is the envelope: freeform came back fenced, so the
naive path needs brace-matching and fence-stripping. Schema mode does not.

**Recommendation for 004: use `outputFormat`, and design the schema as JSON
Schema first.** The Zod schema becomes a second, redundant validation at the app
boundary rather than the primary mechanism. Note the constraint this puts on 004:
whatever schema it locks has to be expressible as JSON Schema.

The spike keeps freeform as a switchable mode (`[m]`) so this comparison stays
re-runnable rather than being a claim in a doc.

## 3. The real caveat: hexes are eyeballed, not sampled.

This is the finding that matters, and it is the one the ticket predicted as
"plausible-but-wrong hex values".

Run against `inputs/_synthetic-known-hex.png`, a generated mock with exactly
four known colours - **twice**, same image, same schema mode:

| role | ground truth | run A | run B |
| --- | --- | --- | --- |
| background | `#10131a` | `#10131c` | `#10131e` |
| surface | `#1b2030` | `#1b2233` | `#1b2236` |
| text | `#eef2ff` | `#edf1fc` | `#edf0fc` |
| accent | `#ff6b35` | `#fb6b3e` | `#fc6a3d` |

Two separate problems, and the second is the worse one:

1. **Every value is biased** - close enough to look right, wrong enough to be
   wrong. The model reads colour visually; it does not sample pixels. On a real
   screenshot this is undetectable by eye, which is why the calibration image
   exists.
2. **Values are not stable across runs.** Same input, same mode, different
   numbers. So a palette is not reproducible, and re-running extraction on an
   item would silently change its stored DNA.

`typography.scale` was also unstable on the same image - `moderate` in run A,
`dramatic` in run B. So the instability is not confined to numeric fields; it
affects any trait where the design sits near a judgement boundary. Free-text
fields (`philosophy`, `tags`) varied in wording but were consistent in substance
across both runs.

Consequences the map should absorb:

- **007 (what the copied prompt is)** - a prompt that asserts exact hex values is
  asserting something subtly false. Either present palette values as approximate,
  or fix them at the source.
- **004 (extraction schema)** - worth deciding whether palette is "what the agent
  read" or "ground truth". If ground truth, the fix is not a better prompt: it is
  to sample the actual pixels for the regions the agent names, post-extraction.
  That is a real component, not a prompt tweak, and it needs ticketing.
- **006 (storage) and the map's "correcting the agent" item** - because a re-run
  produces different values, re-extraction is not idempotent. That makes a
  re-run a *destructive* operation on a trait the user may have been happy with,
  which strengthens the case for **Override** being the primary correction
  mechanism rather than re-running.
- Free-text traits are unaffected in substance. There is no exact answer for
  `philosophy` to be subtly wrong about.

## 4. Both input kinds work. URL analysis is worth keeping - feeds 003.

**Image by path** (`Read`): works. 18.5s, 3 turns, $0.059.

**URL** (`WebFetch`, no rendered screenshot): works, and the output is not
degraded the way I expected. Against `linear.app` it returned `#08090a`
background, `#f7f8f8` text, `#5e6ad2` accent - and `#5e6ad2` is Linear's actual
brand purple. It is reading real values out of the fetched CSS, not confabulating
from the brand's reputation. The two modes independently agreed on three of four
hexes, which is a decent consistency signal.

**For 003:** URL-without-screenshot is viable for palette and typography, because
those are literally in the stylesheet. What it cannot give you is *composition* -
spacing rhythm, hierarchy, how the page actually looks - since there are no
rendered pixels. Expect URL-only DNA to be strong on the token-level traits and
weak on the layout-level ones. That is a scope question (001's **Scope**), not a
capability gap.

## 5. Latency and concurrency

| | observed |
| --- | --- |
| image by path, from a Node worker | 18.5s, 3 turns, $0.059 |
| image by path, from an HTTP handler | 34.0s, 3 turns, $0.046 |
| URL, freeform | 48.4s, 5 turns, $0.126 |
| trivial no-tool call | 6.7s, 1 turn |

Note the spread on the *same* image in the *same* mode: 18.5s vs 34.0s. Latency
is highly variable, so nothing anywhere should promise an ETA.

**Tens of seconds per item, not seconds.** This was originally the evidence that
in-app ingest had to be asynchronous. After the re-charter it is a milder fact: it
means the producer CLI is a thing you run and walk away from, and that a backlog
import is a batch worth being able to resume.

Cost lands around **$0.05-0.13 per item**. At the locked scale (low hundreds of
items) that is roughly $12-26 to analyse the whole library once. Re-running
extraction across the library is therefore affordable but not free - worth knowing
for the "correcting the agent" item in the map's *Not yet specified*.

**Concurrency was never measured**, and after the re-charter nothing blocks on it:
there is no in-app queue to size. `[3]` in the spike still measures it if the CLI
grows a batch mode. Each `query()` is its own subprocess, so the constraint is
likely local resources and API rate limits rather than anything in the SDK.

## 6. Is the analysis any good?

**Yours to judge - this is the part I cannot answer for you**, and it needs your
own screenshots rather than my synthetic mock.

What I can report is that it did not produce filler on the one hard case. Handed
the synthetic wireframe, it correctly identified it *as* a wireframe, refused to
invent font families ("no glyphs visible"), and described the actual mechanism -
low-contrast navy surfaces so structure reads without borders, a single warm CTA
as the only high-contrast element. That is a real read, not generic praise.

Whether it captures what *you* like about designs you chose is still open, but it
is no longer a go/no-go question - it is the prompt-tuning loop in the map's *Not
yet specified*. Drop 2-3 screenshots in `inputs/`, press `[5]`, and read the
philosophy paragraphs. The failure mode to watch for is a paragraph that would be
equally true of any dark SaaS landing page.

## Open items this hands off

- **Hex fidelity decision** - approximate values, or pixel-sample post-extraction?
  Belongs to 004, which is now the load-bearing ticket.
- **Re-extraction is not idempotent** - same input gives different palette and
  different `scale`. Bears on 006 and on the map's "correcting the agent" item;
  may deserve its own ticket.
- **Quality verdict on real inputs** - yours.
