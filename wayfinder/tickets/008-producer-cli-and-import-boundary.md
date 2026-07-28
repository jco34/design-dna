---
id: 008
title: The producer CLI and the import boundary
label: wayfinder:grilling
status: closed
assignee: jeb
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

## Resolution

**One binary `dna` writes `library/` directly; the boundary between the two
programs is the shared `schema/` module, not a wire format; and drift is settled
by two independent version counters that must never be merged.** Full command
surface and rejected alternatives in
[`../assets/008-cli-and-boundary.md`](../assets/008-cli-and-boundary.md); the
literal `--help` output is [`../assets/008-cli-usage.txt`](../assets/008-cli-usage.txt).
No ADR 0003: every hard-to-reverse choice here is ADR 0002 applied, not a new
commitment (contract section 12).

### What was decided

1. **A single binary with sniffed input, not a verb per input kind.** `dna add
   <url|file>` decides URL from `^https?://` and refuses a bare scheme-less host
   rather than guessing. The two input kinds differ only in the first step
   (headless capture versus copy-in); everything after (extract, stamp, merge,
   write) is identical, so a second verb would duplicate every flag to name a
   one-line branch. Verbs: `add`, `re-extract`, `relabel`, `note`, `validate`,
   `check`, `migrate`, `id`.

2. **The write protocol is direct, and the ticket's "emit a file the app imports"
   is answering a question 006 closed.** The app writes zero bytes, so there is no
   importer; an emitted file would only have to be moved into `library/` by the
   producer writing `library/` directly. What the two programs share is the
   validated record shape in `schema/`, a typed versioned module, not an ad-hoc
   JSON contract. Partial writes are prevented by temp-then-rename (006 section 9);
   no lock is needed because there is one human-initiated writer at a time.

3. **The app validates on read, because 006 already measured it free.** A full
   scan with `Item.parse` on every Item is 31ms at 300 Items, so a hand-written
   typo surfaces as one named broken card rather than a silently wrong one. The
   reader parses through the same module both writers validate through.

4. **Validation residue after the SDK's self-retry refuses the Item.** The SDK
   already self-retries against the schema (002), so the residue is unfixable by
   re-rolling. Writing a degraded-and-flagged Item would reintroduce the per-item
   `failed` state this ticket rules out, because a degraded Item is first-class in
   the grid, in search and in a Mix. So: write nothing, remove the Capture,
   name the Zod path (by re-parsing the SDK's last payload through
   `ExtractedDna`), exit non-zero, and keep going in a batch. This matches 003's
   capture-failure behaviour exactly.

5. **Resume is observed from the library, not journalled.** Because each Item is
   written atomically and independently, a re-run of the same `add` skips any
   target already present (URL by exact match, file by basename) and does the
   rest. On by default for a batch, off for a single explicit target, and
   `--no-resume` deliberately saves a second Item for a source you already have
   (001 permits it). **Resume skips; it never re-runs**, so it carries none of
   002's non-idempotence: that lives only in `re-extract`. Serial by default,
   `--concurrency` capped at 4 as the honest response to an unmeasured axis.

6. **The Note is never prompted for mid-batch.** A good Note needs the Capture and
   the DNA, which exist only after the run, and an `$EDITOR` prompt would block an
   unattended batch on a human. So `dna note <id>` is the after-the-fact verb
   (editing the Note text alone, never the JSON, so a slip cannot break the
   record), `add --note`/`--note-file` covers the single deliberate save, and
   hand-editing the field stays supported.

7. **Two version counters, and the line between them is the line between an invalid
   Item and a stale one.** `schemaVersion` (`z.literal`) governs record shape: an
   old one is invalid and the reader refuses it by name; it moves by a `migrate`
   run. `taxonomyVersion` (integer) governs which label vocabulary was used: an old
   one is valid and merely stale, findable and relabelable, and moves by an
   optional `relabel`. Merging them is impossible because their failure modes are
   opposite: a vocabulary addition must not invalidate old Items, and a shape
   change must not be tolerated as stale. **The rule: if `Item.parse` would reject
   the old file it is `schemaVersion`, else `taxonomyVersion`.** The assembled
   `schema/dna.ts` already types both exactly this way.

8. **The CLI mutates in exactly two verbs, kept deliberately apart.** `re-extract`
   reads the stored Capture (never the network) and applies 006's
   authorship-respecting merge, refusing a dirty file unless `--force`. It has **no
   `--all`**: a bulk re-extraction discards every agent value and is 002's
   destructive act, so expanding ids in the shell is the guardrail. `relabel`
   writes labels and `taxonomyVersion` only, leaves every trait byte-identical,
   rewrites only agent-authored axes (`isRelabelable`), and **does** get
   `--stale`/`--all` because it is non-destructive. They must never be one command,
   and they are not.

9. **What a hand-written entry costs is now small and concrete.** `dna id` prints a
   conforming id, `dna add --no-extract` produces a valid Item with the real
   Capture and an all-Undetermined DNA (the mechanical half done for you), and
   `dna validate <path>` is the promised gate that names the exact Zod path before
   the file goes near `library/`. `dna validate` and `dna check` are one validator
   at two scopes, aligned with and extending the existing
   `schema/check-library.ts` rather than a new shape.

### Collisions and integrations surfaced

- **006's `capture.sha256` recommendation is adopted as the first migration.** 006
  section 11 handed 008 the job of adding it at the first `schemaVersion` bump.
  `migrations/002-add-capture-sha256.ts` is that bump, computing the hash from
  files already on disk, and it doubles as the worked example that exercises the
  migration mechanism against a real library. It is deferred rather than shipped at
  v1 because the shared module is `literal(1)` and assembled centrally, and because
  git plus the v1 PNG-dimension check already cover most of what the hash adds.

- **The stored Capture is always `<id>.png`.** A supplied `.jpg`/`.webp` is
  re-encoded to PNG at ingest, keeping 006's PNG invariant and the png-only orphan
  scan in `schema/check-library.ts` true for every Item however it was made.

- **No collision with 006.** 006 reached forward into this ticket (merge rule,
  dirty-file refusal, `library:check`, migration mechanism) and 008 builds exactly
  the program those decisions describe. Where the resolution differs from the
  ticket's framing (the "emit a file" option, the "trust the store" option) it is
  because 006 already closed those, not because 008 overrode anything.

### What was not verified

- **No producer has been run**, because 008 specifies it and does not build it. The
  merge, the resume skip logic, the refusal path and the extended `check` are
  designed here and implemented by the build session.
- **The SDK has not been run against the assembled generation schema.** 004 and 005
  both flag that the seven-trait, `enum`-inside-`items` schema is inherited from
  002's smaller object; the first real `add` is that test.
- **Concurrency is unmeasured** (002 never measured it), so the cap of 4 is a
  conservative guess, not a tuned number.
- **No migration has been run**, so the all-or-nothing runner and the sha256 bump
  are reasoned rather than exercised. The first bump is the test.
- **Resume identity by URL exact-match and file basename is unexercised**, so its
  false-negative (two same-named files in different folders read as one target) is
  named rather than observed.
