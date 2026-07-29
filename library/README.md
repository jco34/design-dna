# The library

This folder is the whole library. Copy it and you have moved it; nothing an
Item needs lives outside it.

Decided by [ticket 006](../wayfinder/tickets/006-storage-and-persistence.md) and
[ADR 0002](../docs/adr/0002-library-as-committed-files.md).

## Layout

```
library/
  items/<id>.json      one Item per file, flat, sortable by name
  captures/<id>.png    one Capture per Item, 2880x1800, same stem as its Item
```

There is no index, no manifest and no database. The app reads this folder by
scanning it, which a measurement in 006 put at 31ms for 300 fully validated
Items, so there is no query to accelerate.

## Who writes this

Two producers, both going through the same schema and the same validator:

- the producer CLI, which screenshots a URL and calls the Claude Agent SDK
- a Claude session writing an entry by hand, which is a first-class path and
  not a workaround

**The web app writes nothing here except deletions.** It is a reader, with one
deliberate exception recorded in
[ADR 0003](../docs/adr/0003-deletion-from-the-app.md): the item detail surface can
delete an Item and its Capture, behind a confirmation dialog. That is the only
write it performs, it lives in the single file `web/lib/mutate.ts`, and it is
gated to loopback requests.

Adding or editing an Item is still the producer's job. If you find the app
*creating* or *modifying* anything in this folder, that is a bug rather than a
feature.

## Checking it after a hand edit

```bash
npx tsx schema/check-library.ts
```

It validates every Item against the schema, checks each filename matches the
`id` inside it, checks every `capture.file` exists, reports orphaned captures,
and checks `notApplicable` agrees with what the Item's Scope actually excludes.
It exits non-zero on any problem.

## About the five items currently here

These are **seed items**, shipped so the app is not empty on first run. They are
not screenshots of real companies' websites. Each one is an original single-page
design written for this repo, living in [`../seed/philosophies/`](../seed/philosophies),
and captured with the real 1440x900 at `deviceScaleFactor: 2` recipe from
[ticket 003](../wayfinder/tickets/003-how-a-url-becomes-an-item.md). That is why
every `source.kind` is `file` rather than `url`.

They cover five deliberately distant philosophies: Swiss modernist, warm
editorial, neo-brutalist, aurora glass and technical terminal.

One honest caveat. A **Note** is defined as your own words on why an item was
worth saving, and the agent never writes one. The notes on these five were
written as demo content so the app's note surface is not blank, and each one
says so. Overwrite them or set them to `null`; they carry no weight.
