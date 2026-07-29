# Agent instructions: Design DNA

Global instructions in `~/AGENTS.md` still apply. This file is the project layer,
and its main job is to route you to the right document in one hop instead of
letting you re-derive it from source.

## If the task is "extract a design from this thing"

Read **[`docs/EXTRACTION.md`](docs/EXTRACTION.md)** and follow it. That file is
the doctrine: the URL exploration protocol, the image reading protocol, the
per-trait rules, the closed label vocabularies, and the honesty rules. It is
authoritative for both producers, whether the extraction is running through the
`dna` CLI or you are reading a resource directly in a session.

Do not reconstruct the procedure from `schema/` or `wayfinder/`. The doctrine is
the procedure; `schema/dna.ts` is only the shape the result has to fit.

Applies whether the user hands you a URL, an image file, a pasted screenshot, or
points at something already in the library.

## What this project is

A local-first, single-user library of web design worth keeping. Everything saved
is analysed into its **design DNA** and can be rendered as a copyable prompt.

The vocabulary is not casual. [`CONTEXT.md`](CONTEXT.md) defines every domain
term (Item, Capture, Scope, DNA, Trait, Swatch, Label, Axis, Mix, Prompt,
Undetermined, Override, Authorship) along with the words to avoid for each.
Use those words exactly; they are load-bearing in the type system as well as the
prose.

## The one architectural rule

**Two producers write the library. The app reads it, and may only delete.**

- the `dna` CLI, which captures and extracts
- a Claude session hand-writing an entry, which is a first-class path and not a
  workaround

Both go through `schema/` and the same validator. This is
[ADR 0002](docs/adr/0002-library-as-committed-files.md) and
[ticket 008](wayfinder/tickets/008-producer-cli-and-import-boundary.md), and it
was deliberately re-affirmed after a re-charter rather than inherited by accident.

One revision, in [ADR 0003](docs/adr/0003-deletion-from-the-app.md): the app can
delete an Item behind a confirmation dialog, because deletion has none of the
properties that made in-app ingest untenable - it is two `unlink` calls with no
agent, no async job and no waiting state. That write lives in exactly one file,
`web/lib/mutate.ts`, and nothing else in the app writes.

**If you find the app creating or modifying an Item, that is still a bug.** Adding
is `dna add`; correcting a value is an Override through the producer.

## Layout

| Path | What it is |
| --- | --- |
| `docs/EXTRACTION.md` | **The extraction doctrine. Start here for any analysis task.** |
| `CONTEXT.md` | The domain vocabulary. Authoritative for naming. |
| `SPEC.md` | The assembled specification. |
| `schema/` | The shared module both producers and the reader validate through. |
| `library/items/`, `library/captures/` | The library. One JSON and one PNG per Item. |
| `producer/` | The `dna` CLI. The only program that writes the library. |
| `web/` | The Next.js reader. Has its own `AGENTS.md`; read it before touching it. |
| `wayfinder/tickets/`, `wayfinder/assets/` | How each decision was reached. History, not instructions. |

Where `schema/` and a `wayfinder/` asset disagree, `schema/` wins. The assets
record the reasoning; the module is the running code.

## Before claiming an Item is written

```bash
npx tsx schema/check-library.ts
```

Exits non-zero on any problem. Run it after any hand-written entry or migration.
