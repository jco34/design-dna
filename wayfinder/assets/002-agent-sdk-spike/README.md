# 002 spike - Agent SDK design extraction

**Throwaway prototype.** Nothing here is production code. It exists to answer one
question and then be captured as a primary source on a throwaway branch.

## The question

Can the Claude Agent SDK, spawned as a local subprocess from a Node process on
Windows, reliably return schema-valid design analysis - headlessly, using
existing Claude Code auth rather than an API key? And is the analysis any good,
or generic filler?

Findings live in [`../002-agent-sdk-findings.md`](../002-agent-sdk-findings.md).

## Run it

```bash
cd wayfinder/assets/002-agent-sdk-spike && npm install && npm run spike
```

Then, to exercise the request-handler shape (what a Next.js route handler is):

```bash
npm run server
```

## Inputs

Drop screenshots into `inputs/`. Every image there is picked up automatically.
Two URLs are seeded for the URL path.

`inputs/_synthetic-known-hex.png` is a generated mock whose colours are known
exactly - background `#10131a`, surface `#1b2030`, text `#eef2ff`, accent
`#ff6b35`. It is the calibration input: it is the only way to tell a
plausible-but-wrong hex from a right one, because on a real screenshot you
cannot eyeball the difference between `#10131a` and `#10131c`.

## Keys

| key | does |
| --- | --- |
| `1` | run once on the selected input |
| `5` | run 5x - this is how you get the validity rate |
| `3` | fire 3 concurrent - this is how you answer the queue question |
| `m` | toggle `schema` / `freeform` mode |
| `i` | next input |
| `r` | show the raw payload |
| `w` | write `findings.json` |
| `x` | reset the tally |
| `q` | quit |

## The two modes

The SDK turns out to offer a native answer to the ticket's central risk, so the
spike measures both and the comparison is the finding:

- **`schema`** - `options.outputFormat = { type: 'json_schema', schema }`. The
  CLI constrains generation and self-retries; the payload arrives on the result
  message's `structured_output` field.
- **`freeform`** - no `outputFormat`. Ask for JSON in the prompt and scrape it
  out of the text. The naive approach, and the control group.

## What is worth keeping

`src/extract.ts` and `src/classify.ts` are the portable seam - no console, no
terminal codes, no control flow from a TTY. `src/tui.ts` and `src/server.ts` are
the throwaway shells. If the answer is "yes", the two former files are what gets
lifted into the real ingest worker; the shells ride along to the throwaway
branch and stay out of main.

`src/schema.ts` is a deliberately rough provisional schema, **not** the
extraction schema - that is ticket 004. It exists only so there is something
strict to fail against.
