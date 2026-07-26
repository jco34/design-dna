---
id: 008
title: The producer CLI and the import boundary
label: wayfinder:grilling
status: open
assignee: unassigned
blocked-by: 001, 003, 004, 006
parent: map
---

> **Re-chartered 2026-07-26.** This ticket was "Ingest and the waiting state".
> No AI runs in the web app any more, so there is no asynchronous ingest, no job
> queue, no progress UI and no waiting state to design. The prototype-typed
> question about how the wait *feels* is gone entirely. What replaced it is the
> program that actually writes the library, which nothing else on the map covers.

## Question

What is the producer CLI, and what exactly crosses the boundary between it and
the web app?

There are two writers into one library: the CLI, and a Claude session
hand-writing an entry. Both go through the same schema (004) and the same
validator. The app reads and never writes. The risk here is not latency any
more, it is **drift** - two producers, a schema that will change, and a reader
that must never see a half-written or invalid library.

Settle the CLI surface:

- **The commands.** Is it one verb that sniffs its argument
  (`dna add <url|file>`), or separate verbs per input kind? What does adding
  several at once look like, and does it run them in parallel? Ticket 002
  measured 18-48s per item, so a directory of 50 screenshots is a real batch
  that wants resuming after a crash rather than a fresh start.
- **Where the note goes.** A **Note** is your words on why an item was worth
  saving, and the agent never writes it. Is it a flag on the add command, an
  `$EDITOR` prompt, or something you add later by editing the store by hand?
- **What the CLI does when the agent output fails validation.** Retry, write it
  degraded and flag it, or refuse and exit non-zero? 002 found the SDK already
  self-retries on schema violation, so this is about the residue after that.
- **Whether the CLI ever mutates an existing item,** or only appends. This is
  where the map's "correcting the agent" lands: given that re-extraction is not
  idempotent (002), a `re-run` verb overwrites a value you may have preferred.

Settle the boundary:

- **The write protocol.** Does the CLI write the store directly, or emit a file
  the app imports? Direct is simpler and couples the two programs to one format.
  How is a partial write prevented from being read - write-to-temp-and-rename,
  a lock, or does it not matter for a single-user local app?
- **Does the app validate on read,** or trust the store because only the CLI and
  you ever wrote it? Trusting is cheaper and means a hand-written entry with a
  typo surfaces as a broken card rather than an error.
- **Schema drift.** 004's schema *will* change after real use. When it does, the
  store holds entries in the old shape. Does the CLI migrate them, does the app
  tolerate both, or is there a version field per entry? This is the single most
  likely source of pain in this design and is cheap to settle now.
- **What a hand-written entry costs.** If I am writing an entry in a session, I
  need to know the target path, the exact shape, and how to validate it before
  claiming it worked. That implies a documented `dna validate` command.

Explicitly out of scope now that the app is read-only: entry-point UI, paste and
drag-drop affordances, placeholder cards, progress indication, and per-item
`pending`/`failed` states. 001 deferred item-level pending and failed to this
ticket; the answer is that they do not exist, because an item only appears in the
store once it is complete.

Deliverable: the CLI command surface and the import/write protocol for the spec,
plus the schema-drift decision. An ADR if the write protocol proves hard to
reverse.
