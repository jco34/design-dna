# 008 the producer CLI and the import boundary

Ticket: [`../tickets/008-producer-cli-and-import-boundary.md`](../tickets/008-producer-cli-and-import-boundary.md).
Literal help output: [`008-cli-usage.txt`](008-cli-usage.txt).
The record it writes is [`../../schema/dna.ts`](../../schema/dna.ts), which is
authoritative; this document specifies the program around it.

**Status: settled by derivation from locked decisions, from 006's write protocol
which already decided most of this, and from the assembled `schema/` module which
is now real code on disk rather than a proposal. Every genuine judgement call is
named in section 11, and every rejected option is recorded next to the decision
that beat it.** This resolution was written self-adversarially: there was no human
to grill, so for each decision the hardest objection is stated and answered rather
than assumed away.

The ticket is right that the risk here is not latency, it is drift. Two writers,
a schema that will change, and a reader that must never see a half-written or
invalid library. So the spine of this document is: one write protocol both writers
obey (section 3), one version story that says exactly what each of the two
counters governs (section 7), and a validator a hand author can run before
claiming an entry works (section 8). Everything else is the command surface that
falls out of those three.

---

## 0. What was already decided, and is not reopened here

008 inherits more settled protocol than any other open ticket. Listing it keeps
this document from relitigating it.

- **The store is `library/items/<id>.json` plus `library/captures/<id>.png`,
  committed to git, read by a full scan** (006). 008 writes into it and never
  changes its shape.
- **An overwrite is an authorship-respecting merge** (006 section 6.1): a re-run
  keeps every `override` verbatim, merges the palette per swatch, never touches
  `note`, `id`, `addedAt`, `source` or `capture`, and replaces `authoredBy`. 008
  builds this; it does not redesign it.
- **The producer refuses to overwrite an Item file with uncommitted changes**
  unless `--force`, and warns rather than refuses outside a work tree (006 section
  6.2). 008 applies this to every writing verb, not just re-extraction.
- **The atomic write is temp-then-rename** (006 section 9), verified to replace an
  existing file on Windows.
- **`library:check` is specified by 006 section 10 and already implemented** as
  [`../../schema/check-library.ts`](../../schema/check-library.ts). 008 owns
  extending it, not inventing it.
- **The capture recipe is 003 and already implemented** as
  [`../../seed/capture.mjs`](../../seed/capture.mjs). The producer's capture step
  is that code with the CLI's flags wired in, not a fresh implementation.
- **A migration is one numbered script and one revertable commit** (006 section
  8). 008 owns the runner and the first real bump.
- **Backfill is a narrow relabel pass, never a re-extraction** (005 section 9).
  008 builds it as its own verb.

Where 008 disagreed with any of this it would surface as a collision. It does not.
006 reached forward into this ticket deliberately and correctly, and the whole of
008's job is to build the program those decisions describe.

---

## 1. One binary, verbs not verb-per-input

**Decided: a single binary `dna` with a small set of verbs. The input kind (URL
or file) is sniffed from the argument, not selected by a flag or a separate verb.**

The ticket asks the question directly: one verb that sniffs (`dna add <url|file>`)
or separate verbs per input kind. Sniffing wins, and the argument is not
convenience, it is that **the input kind barely changes what happens**. A URL is
captured by a headless browser; a file is copied in. After that single step both
paths are identical: the same extraction, the same schema, the same merge, the
same write. Two verbs would duplicate every downstream flag to express one
branch that lives entirely in the first ten seconds of the run.

The sniff is unambiguous and needs no cleverness: a target matching `^https?://`
is a URL, anything else is a path. **A bare host with no scheme is refused, not
guessed.** `example.com` is a valid relative file path and a plausible URL, and
guessing wrong is either a capture of the wrong thing or a confusing file-not-found.
Refusing with "write `https://example.com` or `./example.com`" costs the user one
keystroke and removes a whole class of silent mistake.

**Rejected: `dna add-url` and `dna add-file`.** Doubles the flag surface to name a
branch that is one line of code. The ticket floats it; the downstream identity of
the two paths kills it.

**Rejected: `dna capture` and `dna import` as distinct verbs.** Same objection,
dressed as vocabulary. "Capture" and "import" are the same act (make an Item) with
a different first step.

**Rejected: a subcommand-free `dna <url>` where add is implied.** Tempting for the
common case, but it collides with `dna check`, `dna validate` and every other verb
the moment the argument looks like a path. An explicit verb keeps the grammar
regular, and regular is what a tool you run and walk away from needs.

The full verb list, and why each exists rather than being a flag on another:

| verb | why it is its own verb |
| --- | --- |
| `add` | the only verb that creates an Item |
| `re-extract` | mutates an existing Item's DNA; 006's merge rule; must be hard to invoke by accident (section 5) |
| `relabel` | 005's narrow label-only pass; must never be the same command as re-extract |
| `note` | writes the one field the agent never writes; different safety story (section 6) |
| `validate` | reads and judges one or more records; writes nothing (section 8) |
| `check` | the whole-library integrity pass; `library:check` (section 8) |
| `migrate` | the schema-drift mechanism; all-or-nothing over the library (section 7) |
| `id` | prints a fresh id, so the hand-written path can get one without a UUID (section 9) |

---

## 2. `add`: the capture-to-write pipeline

`add` is five steps, and only the first differs by input kind.

1. **Acquire the Capture.** For a URL: 003's recipe, which is `seed/capture.mjs`
   plus the refusal rules of 003 section 9, the reject-before-navigate host list
   of 003 section 10, and the `--selector` / `--clip` / `--headed` /
   `--wait-before-capture` flags 003 named. For a file: copy the bytes in,
   re-encoding to PNG if the input is `.jpg`/`.jpeg`/`.webp` so the stored Capture
   is always `<id>.png` (section 2.2). Capture failure refuses the Item and writes
   nothing, per 003 section 9.
2. **Assign the id and write the Capture.** The id is section 9's format. The PNG
   is written to `library/captures/<id>.png` first, so a crash after this point
   leaves an orphan Capture that `dna check` names and a human deletes, never a
   dangling Item reference.
3. **Extract.** Call the Agent SDK exactly as 002 verified: `permissionMode:
   'dontAsk'`, `settingSources: []`, `allowedTools: ['Read']`, `outputFormat:
   { type: 'json_schema', schema }` against the assembled generation schema
   (004's JSON schema with 005's `LABELS_JSON_SCHEMA` spliced at `properties.labels`).
   The Scope is passed into the prompt so the agent does not hunt for page layout
   in a picture of a button, but the agent never writes Scope. Section 4 covers
   what happens when the returned object fails Zod after the SDK's own self-retry.
4. **Compose the Item.** `dna = stampAuthorship(extracted)` and `labels =
   stampLabelAuthorship(extracted.labels)`, both mechanical and both already in the
   module. Add the producer-only fields: `schemaVersion`, `id`, `addedAt`,
   `source`, `capture`, `scope`, `taxonomyVersion` (the current
   `TAXONOMY_VERSION`), `notApplicable = notApplicableFor(scope)`, `note`,
   `authoredBy`.
5. **Write the Item.** `JSON.stringify(item, null, 2) + '\n'`, keys in `Item`
   declaration order (006's canonical form), to `<id>.json.tmp`, then rename over
   `<id>.json`. Then `Item.parse` it back and fail loudly if it does not round-trip,
   so a producer bug can never leave an invalid file behind.

### 2.1 `--no-extract`: the first half of the hand-written path

`add --no-extract` runs steps 1, 2, 4 and 5 but skips 3, writing a DNA that is
entirely Undetermined (`""` prose, `"undetermined"` enums, empty `style`/`mood`)
and `authoredBy.kind: 'hand'`. It costs nothing and produces a valid Item with a
real Capture and a blank analysis, which is exactly the scaffold a Claude session
then fills in by hand or a later `re-extract` completes. This is the cheapest way
to get the Capture and the boilerplate right without spending an extraction, and
it is why the hand-written path is not "write 111 lines of JSON from nothing"
(section 9).

### 2.2 The stored Capture is always PNG

**Decided: `capture.file` is always `<id>.png`. A supplied `.jpg`/`.jpeg`/`.webp`
is re-encoded to PNG once at ingest.**

006 section 3 chose PNG for the URL path because Playwright emits it, and
`schema/check-library.ts` globs `captures/*.png` for its orphan scan. A supplied
JPEG that kept its extension would be a Capture that check never sees and an
exception to the store's one uniform image format. Re-encoding once at ingest
keeps `<id>.png` universal and both those invariants true.

**Rejected: keep the supplied file's extension and teach `check` every format.**
It spreads a format decision across the whole toolchain (011's card, a future
sampler, the orphan scan) to save one re-encode of an image the user is saving
forever anyway. The uniform-PNG store is worth a lossless transcode.

**The honest cost:** re-encoding a JPEG to PNG does not recover the quality the
JPEG already lost, and it inflates the file. Accepted: the store format is PNG,
the input was already degraded by whoever made the JPEG, and uniformity is worth
more than the bytes at this scale.

---

## 3. The write protocol: direct, and the boundary is the schema module

**Decided: the CLI writes `library/` directly. There is no intermediate file the
app imports. The boundary between the two programs is the shared `schema/` module,
not a wire format.**

The ticket frames it as a choice: does the CLI write the store directly, or emit
a file the app imports. The second option is answering a question 006 already
closed. **The app is a pure reader that writes zero bytes** (006 section 9), so
there is no "import" for it to do: an emitted file would have to be moved into
`library/` by something, and that something is the producer writing `library/`
directly. The indirection buys nothing because there is no second party on the
write side to decouple from.

What the two programs actually share is the **validated record shape**, and that
is a code module (`schema/`), imported by both, not a serialization format
negotiated between them. This is the strongest form of the "direct is simpler and
couples the two programs to one format" tradeoff the ticket names: they are coupled
to one format, and that format is a typed, versioned, Zod-validated module rather
than an ad-hoc JSON contract that drifts.

**How a partial write is prevented from being read:** temp-then-rename (006
section 9), which is atomic on the target platform. The reader either sees the old
file or the new one, never a truncation. No lock, no WAL, no lockfile: there is
one writer at a time and it is a human-initiated CLI run (006 section 9), so the
concurrent-writer problem that would justify locking does not exist.

**Does the app validate on read?** Yes, and 006 section 2.3 already priced it: a
full scan with `Item.parse` on every Item is 31ms at 300 Items, faster than the
frame budget of the grid it feeds. So the ticket's "trust the store because only
the CLI and you wrote it" is declined, but for a reason that costs nothing: **a
hand-written entry with a typo should surface as one broken card, named, not as a
silently wrong one.** The reader parses through the same module the writers
validate through, so the round trip is closed. This is 006's decision restated
because 008 is where the "does the app validate on read" question was pointed, and
the answer is the one 006 measured: it validates, and it is free.

**Rejected: the CLI emits `entry.json` into an inbox the app imports on next
launch.** This is in-app ingest wearing a hat. It reintroduces exactly the
asynchronous-write, half-written-state and pending-item machinery the 2026-07-26
re-charter deleted, and it makes the app a writer, which 006 forbids. The map lock
that "the app is a pure reader" is the whole reason this option is dead.

**Rejected: the CLI writes a staging directory and an atomic `mv` promotes the
whole batch.** A real idea for making a 50-item batch appear all-or-nothing. Rejected
because it fights 006's grain: each Item is independent, a partial batch is a
normal and recoverable state (section 5's resume), and there is no reader
transaction that needs the batch to appear atomically. It would add a promotion
step and a second place for a crash to leave junk, to buy an atomicity nothing
consumes.

---

## 4. Validation residue after the SDK's self-retry

**Decided: refuse the Item and exit non-zero. Write nothing, keep the Capture off
disk too, name the Zod path that failed, and tell the user to re-run that one
target. The CLI does not write a degraded Item and does not retry beyond the SDK.**

002 established the shape of this: the SDK constrains generation from JSON Schema
and **self-retries** on schema violation, with a terminal failure subtype
(`structured_output_retry_exhausted`). So by the time the CLI sees a failure, the
SDK has already tried and given up. The question is only what to do with that
residue, and the three options the ticket lists resolve cleanly.

- **Retry again in the CLL?** No. The SDK already retried against the same schema
  with the same image. A CLI-level retry is the same call hoping for a different
  boundary judgement, which 002 showed is exactly the unstable thing. It would
  spend money to re-roll dice, not to fix a fixable error.
- **Write it degraded and flag it?** No, and this is the load-bearing refusal. A
  "degraded" Item is a first-class Item in every surface that reads the library:
  it appears in the grid, in search, in a Mix. There is no per-item `failed` state
  (the ticket rules it out) precisely because **an Item only exists once it is
  complete**. Writing a flagged-broken Item would reintroduce the failed state
  through the back door.
- **Refuse and exit non-zero?** Yes. It matches 003's capture-failure decision
  exactly (refuse, write nothing, name the cause, give the next command), so the
  two failure modes of `add` behave identically and a batch's refusals are a
  uniform list. The Capture written in step 2 is removed on refusal, so no orphan
  is left.

**What "name the Zod path" means concretely:** the SDK's terminal error does not
carry a Zod path, so the CLI takes the last structured payload the SDK produced,
runs it through `ExtractedDna.safeParse`, and prints the issues. If the SDK
exhausted retries without ever producing a parseable object, the message says so
instead. Either way the user learns which field the model could not satisfy, which
is what turns "extraction failed" into an actionable line.

**The batch does not stop.** One target's refusal is logged to stderr and the run
continues to the next, so a directory of 50 does not abort on item 4. The exit
code is non-zero if any target was refused, and the summary line counts them. This
is the only sane behaviour for an unattended batch, and it is why refusal is
per-target rather than per-run.

**Self-adversarial objection:** if refusal silently drops an item from a
50-directory batch, the user might not notice one missing Item among fifty. Answer:
the refusal is on stderr with the filename and the reason, the summary line counts
refusals explicitly ("48 written, 1 skipped, 1 refused"), and the exit code is
non-zero. A dropped item is loud in three independent places. And the recovery is
the cheapest possible: re-run `dna add` on that one file, because resume (section
5) skips the 48 already written.

---

## 5. Batch and resume

002 measured 18 to 48 seconds per Item, so a directory of 50 is 15 to 40 minutes.
A crash at minute 30 must not mean starting over. The ticket says this outright:
the batch "wants resuming after a crash rather than a fresh start."

### 5.1 Resume is derived from the library, not from a journal

**Decided: resume is on by default for a batch, and it works by skipping any target
already present in the library. There is no separate progress file, journal or
lockfile. The library is its own progress record.**

This is the design the store hands you for free. Each Item is written atomically
and independently (section 3), so after a crash the library contains exactly the
Items that finished, and nothing half-written. Re-running the same `add` command
therefore needs only to answer, per target: is this already here? If yes, skip it;
if no, do it. The set of finished work is not tracked, it is **observed**, which is
the same move 006 made when it ruled that "the scan is the index."

**What "already present" means, and it is the subtle part:**

- **A URL target** is present if an Item exists whose `source.kind === 'url'` and
  whose `source.url` equals the target. Equality is exact string match after a
  trailing-slash and scheme-case normalisation, and no more: two URLs that differ
  are two deliberate saves.
- **A file target** is present if an Item exists whose `source.kind === 'file'`
  and whose `source.originalPath` basename equals the target's basename. Basename,
  not full path, because a resumed batch may be invoked from a different working
  directory, and because the interesting identity of `./shots/03-hero.png` is
  `03-hero.png`.

Both matches are computed from one upfront library scan (31ms), so resume costs
nothing measurable even on a large batch.

### 5.2 Why resume is not idempotency, and why that is correct

**The objection to answer:** "the CLI mutates by re-running" is exactly what 002's
non-idempotence warns against, so isn't a resume that skips existing Items hiding a
footgun?

No, and the distinction is the whole point. **Resume skips; it does not re-run.**
A target already in the library is left byte-for-byte untouched. Resume never
re-extracts, never overwrites, never merges. It is the opposite of the destructive
re-run: it is how you avoid touching work that finished. The non-idempotence 002
found lives entirely in `re-extract` (section 5.3 of the merge rule), which is a
different, deliberately harder-to-invoke verb.

**`--no-resume`** exists for the one case where you do want a second Item from a
source you already have: 001's rule that "several items may share one source" is
legitimate, so saving `linear.app` twice on purpose is supported. It never
overwrites either; it adds a second Item with its own id. So even the un-resumed
path only ever appends.

**A single explicit target has no resume.** `dna add https://linear.app` always
attempts the save, because one explicit argument is one deliberate act. Resume is a
batch affordance, where the target list was not hand-picked item by item.

### 5.3 Concurrency

`--concurrency <n>`, 1 to 4, default 1. Each extraction is its own SDK subprocess
(002), so the ceiling is local resources and API rate limits, not the SDK. The
default is 1 because a personal machine running a headless Chromium plus an SDK
subprocess per lane gets loud fast, and the batch is unattended anyway so wall-clock
is not precious. The cap is 4 because 002 never measured concurrency and a low cap
is the honest response to an unmeasured axis; it can rise when someone measures it.
`--headed` forces concurrency 1, because you cannot dismiss banners in four visible
browsers at once.

**Rejected: parallel by default.** Faster on paper, but it multiplies the failure
surface of an unmeasured concurrency story against a metered API, on a tool you run
once in a while. Serial-by-default with an opt-in ceiling is the conservative call
and costs only wall-clock the user is not watching.

---

## 6. Where the Note goes

**Decided: the Note is not asked for during `add`. It has its own verb, `dna note
<id>`, and it is also always editable by hand. `add` takes an optional `--note` /
`--note-file` for the single-target case only, and refuses it for a batch.**

CONTEXT defines a Note as your words on why an item was worth saving, never written
by the agent. The ticket asks: a flag on add, an `$EDITOR` prompt, or hand-editing
later. The answer is "mostly later, with a flag for when you already know," and the
reason is about **when the Note can honestly be written.**

You usually cannot write a good Note until you have seen the Capture and read the
DNA, and both of those exist only after the run. An `$EDITOR` prompt mid-`add`
would block an unattended batch on a human, which is precisely the thing a
run-and-walk-away tool must not do. So the batch never stops to ask.

But for a single deliberate save you often already know why ("the one that made me
want to build this"), so `--note "..."` and `--note-file path` are there for the
single-target case and refused for a batch, where one note cannot describe fifty
Items.

`dna note <id>` is the after-the-fact path, and it opens your editor on the **Note
text alone**, never the JSON, so an editing slip cannot break the record. It writes
back canonically and validates before replacing the file. Hand-editing the `note`
field in the JSON stays fully supported (006 makes the store hand-editable on
purpose); the verb exists only because it cannot leave the file malformed.

**Rejected: a mandatory Note.** A Note you must write to save is a Note you write
badly to get past the prompt. Optional keeps it honest, and an Item with `note:
null` is valid and common.

**Rejected: `add --note` for batches, applied to every Item.** One sentence cannot
be true of fifty designs, and a Note that is the same on fifty Items is noise. Refused.

---

## 7. Schema drift: two counters, and exactly what each governs

This is the ticket's "single most likely source of pain," and the assembled module
has already made the key structural choice, so 008's job is to state the rule
crisply and name the mechanism.

**Decided: there are two independent version counters, they are not merged, and
the line between them is the line between an invalid Item and a merely stale one.**

| counter | type | governs | an old value is | how it moves |
| --- | --- | --- | --- | --- |
| `schemaVersion` | `z.literal(1)` | the **shape** of the record | **invalid**: the reader refuses it by name | a `migrate` run: one numbered script, one commit |
| `taxonomyVersion` | `z.number().int().positive()` | which **label vocabulary** was used | **valid but stale**: findable, relabelable | a `relabel` run, or nothing (stale is fine) |

The two counters answer two different questions and must not be collapsed, which is
the decision.

**`schemaVersion` governs shape.** If a field is added, removed, renamed or
retyped, every existing Item is now the wrong shape, `Item.parse` rejects it, and
the only correct response is to migrate every Item at once. It is a `z.literal`
because a mixed-version library is not a supported state: the alternative is every
consumer carrying a version switch forever (006 section 8). The reader refuses an
unknown `schemaVersion` loudly and by name rather than coercing or skipping,
because a store two programs write will one day hold a file from the future and
silently ignoring it is how a library quietly loses Items.

**`taxonomyVersion` governs vocabulary.** Adding `style: 'grunge'` to the taxonomy
does not change the shape of any Item. Every existing Item still parses; it was
simply labelled before `grunge` existed and may deserve it now. So this counter is
an integer, nothing refuses to parse because it is behind, and the response is not
a migration but an **optional** `relabel` pass. This is 005's decision, and the
assembled module already types it exactly this way.

**Why two and not one.** Merging them would force one of two errors: either a new
taxonomy value would invalidate every old Item (treating a vocabulary addition as a
shape change, which strands Items for no reason and spends money to relabel them
against their will), or a shape change would be tolerated as "merely stale" (which
lets an invalid record into the reader). The two failure modes are opposite, so
one counter cannot serve both. **The clean rule: if `Item.parse` would reject the
old file, it is `schemaVersion`; if it would accept it, it is `taxonomyVersion`.**

### 7.1 The migration mechanism, and its first real use

A schema change is one script `migrations/00N-<slug>.ts` exporting
`{ from, to, up(record: unknown): unknown }`. `dna migrate` owns everything else:
find the pending scripts, order them, read every Item, apply `up`, validate the
result against the current schema **in memory before writing a byte**, and only
then write them all. All-or-nothing: a script that throws on Item 200 leaves the
library untouched. It refuses a dirty work tree (which is also what stops two
migrations racing), never commits, and prints "review with `git diff` and commit
the script with its effect," so the change lands as one revertable unit (006
section 8). An Item at a version higher than the build knows is refused by name,
not downgraded.

**The first migration is already specified by a collision 006 handed up.** 006
section 11 recommended that **008 add `capture.sha256` at the first `schemaVersion`
bump**, computed from files already on disk, because one nullable hash serves three
things at once: the duplicates signal the map parks, a `check` that can detect a
Capture truncated by a bad copy, and something that can actually verify 001's
immutability claim. 008 adopts that recommendation and makes it the worked example:

> **`migrations/002-add-capture-sha256.ts`** reads each Capture, computes its
> SHA-256, and writes `capture.sha256` while bumping `schemaVersion` to 2.

This is deferred to a migration rather than done at v1 for a concrete reason: the
shared `schema/` module is `schemaVersion: z.literal(1)` today and is assembled
centrally, so v1 ships without the field and `dna check` uses `pixelWidth`/
`pixelHeight` as the weak proxy 006 named. The first person who wants the stronger
check runs the migration, and in doing so exercises the whole mechanism against a
real library, which is the test 006 said the first bump would be.

**Self-adversarial objection:** deferring sha256 to a migration means v1 has no
tamper check, so a Capture silently replaced or truncated by a bad folder copy goes
unnoticed until v2. Answer: v1 is not defenceless. `dna check` verifies the PNG
header dimensions against `pixelWidth`/`pixelHeight`, which catches a truncated or
replaced-with-different-size file, and the store is committed to git, so
`git status` catches any change to a Capture that should be immutable. sha256 is a
strengthening of an existing check, not the only check, and it costs nothing to add
later because the bytes are already on disk. Adding a field to the centrally
assembled module now, to pre-empt a check that git and dimensions already largely
provide, is the wrong order.

---

## 8. What a hand-written entry costs, and `dna validate`

The map makes a hand-written entry an equally valid second path through the same
schema and validator. For that to be real, a Claude session needs three things:
the target path, the exact shape, and a way to prove the entry is valid before
claiming it worked. All three now exist as fact rather than promise.

- **The target path** is `library/items/<id>.json` and `library/captures/<id>.png`,
  and `dna id` prints a conforming id so the session does not have to hand-forge one.
- **The exact shape** is the `Item` type in `schema/dna.ts`, which is authoritative
  code, plus the rendered 111-line example in 006 section 7.1 that parses under it.
- **The proof** is `dna validate <path>`, which the ticket explicitly asked for.

**The cheapest honest hand-written path is not "write 111 lines from nothing."** It
is `dna add <target> --no-extract`, which produces a valid Item with the real
Capture, the correct id, the correct `source`/`capture`/`scope`/`notApplicable`
already filled, and an all-Undetermined DNA. The session then edits the `dna` block
and the `note`, and runs `dna validate` until it passes. So the hand author writes
the interesting half (the analysis) and the tool writes the mechanical half (the
provenance and the Capture). This is why `--no-extract` is a first-class flag and
not an afterthought.

**`dna validate` versus `dna check`.** They are one validator at two scopes, and
this is the alignment with `schema/check-library.ts` the assembly requires rather
than a new shape:

- **`dna validate [path...]`** judges one record, or a candidate file anywhere on
  disk, against every rule that needs only that record: JSON validity, `Item.parse`
  (which in the assembled module also enforces `notApplicable` agreeing with Scope),
  known `schemaVersion`, canonical form, no absolute path, `capture.file` a bare
  `.png` name, the Capture present with matching header dimensions, and stem equals
  id when the file is inside the library. It writes nothing and fixes nothing. This
  is the gate a hand author runs before moving a file into `library/`.
- **`dna check`** is `library:check`: every `validate` rule over every Item, plus
  the rules that need the whole library (no duplicate ids, no orphan Captures, no
  unexpected files, the id alphabet, and a note counting stale-taxonomy Items).
  `schema/check-library.ts` already implements the core of this (JSON, `Item.parse`,
  stem equals id, Capture exists, no orphans, `notApplicable` agrees with Scope);
  008 extends that file with the remaining rules rather than replacing it.
  `npm run library:check` is `dna check`; `npm run library:format` is
  `dna check --fix`, which rewrites canonical form and nothing else.

Everything except canonical form is a decision a program cannot make for you, so
`--fix` touches only formatting. A Capture whose header no longer matches its
record has either been replaced or corrupted, and no tool can tell you which, so no
Capture is ever auto-deleted: it is the only irreplaceable thing in the library.

---

## 9. The id, and why the hand path needs it typeable

The id format is 006's: `<compact-instant>-<six base36 chars>`, e.g.
`20260727T142233Z-k3m9qa`. 008 owns one small addition: **`dna id` prints one.**
The reason is the hand-written path. Nobody can invent a plausible UUIDv4 by hand,
so a store that used UUIDs would force the hand author to run a command before they
could even name their file, and 006 chose a typeable format precisely so they can
produce one from the current time plus six characters. `dna id` makes that a
one-word command rather than a mental exercise, and it is the same generator the
producer uses, so a hand-made id is indistinguishable from a produced one. The id
is authoritative and opaque; the timestamp prefix is a sorting convenience and
nothing parses it (006 section 3.4).

---

## 10. `re-extract` and `relabel`: the two mutation verbs, kept apart on purpose

The ticket asks whether the CLI ever mutates an existing Item or only appends. It
mutates, in exactly two verbs, and both are deliberately harder to invoke than `add`.

**`re-extract <id>...`** is the map's "correcting the agent" landing on the CLI. It
reads the stored Capture (never the network, so it works offline and after the site
is gone), re-runs extraction, and applies 006's authorship-respecting merge: every
`override` kept verbatim, the palette merged per swatch, `note`/`id`/`addedAt`/
`source`/`capture` untouched, `authoredBy` and `taxonomyVersion` replaced. It
refuses a dirty Item file unless `--force`, because the merge is the destructive
act 002 warned about and git history is the only thing that can undo it.

**There is no `re-extract --all`.** This is a deliberate friction. A library-wide
re-extraction discards every agent-authored value in one command, costs $0.05 to
$0.13 per Item, and is non-idempotent, so it is the single most dangerous thing the
CLI could do. Making the user expand the ids in their shell is the cheapest possible
guardrail against typing four characters that rewrite the whole library. `--force`
exists per-invocation; a blanket `--all` does not.

**`relabel <id>... | --stale | --all`** is 005's narrow backfill. It re-asks the
label question only, writes `dna.labels` and `taxonomyVersion`, and leaves every
trait byte-identical. It rewrites only axes whose authorship is `agent`
(`isRelabelable` in the module), so an overridden axis is kept and an Item with all
three axes overridden skips the agent entirely and only has its `taxonomyVersion`
bumped, which is free. `--stale` is the intended path after a taxonomy grows a
value: it targets exactly the Items behind the current `TAXONOMY_VERSION`.

**Why `relabel` gets `--stale`/`--all` and `re-extract` does not.** The asymmetry
is the whole safety argument. Relabel is non-destructive (it touches one field and
respects overrides), so a bulk relabel is recoverable and cheap-ish. Re-extract is
destructive (it re-rolls every agent value), so a bulk re-extract is the thing 002
tells us to fear. The verbs are kept apart, and given different bulk affordances,
precisely so that the safe one is convenient and the dangerous one is not. **They
must never be the same command** (005 section 9), and they are not.

**Self-adversarial objection:** `relabel --all` still spends money against the API
without naming individual Items, so isn't it the same footgun as `re-extract --all`
in miniature? Answer: no, because the failure modes differ in kind. A bad
`relabel --all` produces different labels, which are a filter facet you can override
or relabel again, and it never touches the traits that carry the design. A bad
`re-extract --all` produces different hexes and type scales, silently replacing
readings you were happy with, with only git to recover them. The cost axis (money)
is shared; the destructive axis (does it overwrite work you valued) is not, and the
destructive axis is what gates the bulk flag.

---

## 11. The judgement calls, named

Everything above is derived from a locked decision, from 006's forward-reaching
write protocol, or from the assembled module, except these. A reviewer who wants to
disagree efficiently should start here.

1. **A single `dna` binary with sniffed input rather than verb-per-input.** The
   downstream-identity argument is doing the work; two verbs were defensible.
2. **Refuse-and-exit on post-retry validation failure, rather than write-degraded.**
   Forced by the no-failed-state rule, but "write degraded and flag" was a real
   option and is rejected on the first-class-Item argument, not a locked decision.
3. **Resume by observing the library rather than by a journal**, and the specific
   identity rules (exact URL match, file basename match). The basename choice in
   particular is a call: it makes a resumed batch portable across working
   directories at the cost of treating two same-named files in different folders as
   the same target.
4. **Serial by default, concurrency capped at 4.** A conservative response to an
   unmeasured axis; a higher default would be defensible once measured.
5. **The Note has its own verb and is never prompted for mid-batch.** The
   "you cannot write it until you have seen the Capture" argument is mine.
6. **Deferring `capture.sha256` to the first migration rather than shipping it at
   v1.** Driven partly by the centrally-assembled module being `literal(1)` today,
   but the "git plus dimensions already cover most of it" argument is a judgement
   and a reviewer may want the hash from day one.
7. **Re-encoding supplied JPEG/WebP to PNG at ingest** to keep the store uniform
   and `check-library.ts`'s png-only scan honest, at the cost of a lossless
   transcode of an already-degraded input.
8. **No `re-extract --all`, but `relabel --stale`/`--all`.** The asymmetry is
   justified by the destructive-axis argument, but it is an asymmetry a reviewer
   could find surprising, so it is named.

---

## 12. Why there is no ADR 0003

An ADR is for a decision that is genuinely hard to reverse. The write protocol here
is not a new hard-to-reverse decision: **it is ADR 0002's decision, applied.** ADR
0002 already recorded that the library is committed files, that an overwrite is an
authorship-respecting merge, that the producer refuses to overwrite uncommitted
work, that a migration is one numbered script and one commit, and that the app
writes nothing. Every load-bearing, hard-to-reverse choice in this document is one
of those, and re-recording them under a new number would be duplication that can
drift out of sync with the original.

What 008 adds on top is command surface, resume behaviour, the note verb, the
two-counter version rule, and the sha256 migration. These are either directly
reversible (a verb or a flag is a code change, not a data-shape commitment) or they
are the *implementation* of an ADR 0002 consequence rather than a new architectural
commitment. The one thing that touches data shape, `capture.sha256`, is delivered
as a migration, which is itself the reversible mechanism ADR 0002 prescribes.

**So no ADR 0003 is written, deliberately.** If a future change reverses the "CLI
writes `library/` directly, no import file" boundary, or reverses the two-counter
version model, that is the moment for a new ADR. Neither is reversed here; both are
derived from what 0002 and the assembled module already locked.
