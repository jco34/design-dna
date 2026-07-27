---
id: 006
title: Storage and persistence contract
label: wayfinder:grilling
status: closed
assignee: jeb
blocked-by: 001, 004
parent: map
---

## Question

Where does everything live so that it survives stopping the app, and what is
the schema?

"Persist even if I stop running the app" is a stated requirement, so this is
load-bearing rather than an implementation detail. Two stores are involved:
metadata and analyses, and the image bytes themselves.

Since 2026-07-26 there is a second reason this matters: the store is written by
the producer CLI and by hand in a Claude session, and only *read* by the app. The
store is therefore an interface between programs rather than a private database,
which changes the format tradeoff considerably.

Resolve:

- **The metadata store.** Candidates: `node:sqlite` (built into Node 22+, no
  native build, no dependency), `better-sqlite3` (mature, but a native module
  that has to compile on Windows), Postgres in Docker (overkill at this scale,
  and a daemon to babysit), or plain JSON files (zero setup, no queries, and it
  degrades as the library grows). Weigh against the locked scale of low
  hundreds of items, and against `AGENTS.md`: robustness and maintainability
  over setup cost.
- **The image store.** A folder on disk with the database holding paths, or
  blobs in the database. Where does that folder sit relative to the repo, and
  what are the filenames: content-hashed, or human-readable?
- **Git.** Is the data folder committed or ignored? Committing gives you free
  history and a backup, bloats the repo with images, and puts sites you like in
  version control. Ignoring means one `rm -rf` and a hand-curated library is
  gone.
- **Backup and portability.** Is there an export? Can the library move to
  another machine by copying a folder? This is the entire value of the app
  sitting in one directory, so it is worth being deliberate about.
- **Schema and migrations.** The tables or files, and how a schema change is
  handled once the library holds real items. The extraction schema from 004
  will change after real use.
- **Whether an analysis is a version or an overwrite,** given that re-running
  the agent is expected (see the map's "Not yet specified"). Keeping history is
  cheap now and impossible to retrofit later. **002 raised the stakes here:**
  re-extraction is not idempotent, so an overwrite silently replaces a value you
  may have preferred with a different one. That is an argument for versioning
  that did not exist when this ticket was written.
- **Hand-editability is now a hard requirement, not a nicety.** Two things write
  this store: the producer CLI, and me editing it directly in a Claude session.
  The second only works if the format is diffable, greppable and safe to edit
  without a client - which is a serious mark against SQLite and in favour of
  JSON or YAML on disk, one file per item or one index plus files. Weigh that
  against the query cost at the locked scale of low hundreds of items, where a
  full in-memory scan per request is entirely affordable.
- **Whether the app can write at all.** If it is a pure reader, several problems
  above dissolve: no locking, no migration-on-write, no concurrent-writer story.
  Confirm that read-only is the intent, and if the app *does* need to write
  anything (a Note, an Override, a saved Mix), say precisely what and treat that
  as the only write path in the app.

Deliverable: the storage decision with rationale, the concrete schema, and an
ADR if it proves hard to reverse (it likely will, once real items exist).

## Resolution

**The library is `library/`, a committed folder holding one JSON file per Item
and one PNG per Capture, read by a full directory scan, with git as the version
store and the app writing nothing at all.** The four questions this ticket asks
separately (which store, where the images sit, committed or ignored, versioned
or overwritten) turn out to be one decision, and section 6 of the contract is
that coupling stated. Contract:
[`../assets/006-storage-contract.md`](../assets/006-storage-contract.md), root
decision in
[ADR 0002](../../docs/adr/0002-library-as-committed-files.md).

### What was decided

1. **The number 003 deferred is measured, and it is the number that decides this
   ticket.** 003 locked `deviceScaleFactor: 2` and said plainly that it never
   measured the cost, guessing 0.5-2MB. Measured under 003's exact context and
   wait recipe across six real sites, every output confirmed 2880x1800 from the
   PNG header: **mean 1,114 KB, median 610 KB, range 108 KB (vercel.com) to
   2,997 KB (monzo.com)**, a 2.32x-3.38x multiplier over `deviceScaleFactor: 1`.
   003's reasoning was sound and its ceiling was 50% low. **At 300 Items the
   Captures are 0.18-0.33 GB.** The third result matters most: a rendered Item
   file is **3.83 KB**, so metadata is **0.3% of the library**, and every
   argument that trades format elegance against size is arguing about rounding
   error.

2. **One JSON file per Item, and the hard requirement decides it before scale is
   reached.** "Hand-editable" is four properties (diffable, greppable, safe to
   edit without a client, fails loudly on a bad edit) and SQLite fails all four.
   `node:sqlite` is the strongest candidate and still loses on three grounds, the
   last decisive: there is no query to accelerate at this scale, a Claude session
   editing a `.db` is writing a program rather than changing a line, and **a
   binary store deletes the git decision**, so versioning would have to be built
   rather than inherited. A single `library.json` array was rejected because two
   writers conflict in one region, a one-hex diff inside 1.1 MB is unreadable, and
   one malformed edit takes the whole library down instead of one Item. A
   generated index was rejected as a cache that can go stale when **the scan is
   the index**.

3. **A full scan of the library, fully validated, costs 31 milliseconds.**
   Measured at 300 Items: 417 ms cold, **31.0 ms warm** including `Item.parse` on
   every Item, 18.1 ms without validation, 0.14 ms to filter. The app validates
   everything on every read and needs no index, no cache and no invalidation, and
   009 gets to design search against an in-memory array.

4. **JSON rather than YAML, and the reason is specific rather than general: `#`
   starts a comment in YAML and this schema stores five hex values per Item.**
   Unquoted `accent: #5e6ad2` is an empty value plus a comment, so the failure
   mode is silent data loss on a valid-looking line, on the most-edited field in
   the schema. That is the opposite of safe to edit without a client. TOML was
   rejected on nesting three levels deep, JSON5 on breaking the property that the
   file is exactly what `JSON.parse` yields and Zod validates, Markdown with
   frontmatter on splitting one validated record across two syntaxes. **Canonical
   form is part of the contract** (`JSON.stringify(item, null, 2)` plus a newline,
   keys in schema order), or every producer write reformats the last hand edit
   into a spurious whole-file diff.

5. **PNG, and this was 006's to decide because 003 locked the viewport but not
   the encoding.** JPEG q90 would save 3.2x (334 MB becomes 106 MB) and loses
   anyway on two locked decisions. 004 section 3.3 deliberately deferred a pixel
   sampler and designed `authorship: 'sampled'` for it, and JPEG artifacts corrupt
   flat colour fields and hard edges specifically, which is **the exact signal the
   deferred feature exists to read**. And a Capture is irreplaceable: 001 fixes
   it, 003 confirms nothing re-fetches, the site redesigns. Lossless WebP was
   rejected because Playwright emits png or jpeg only, so it needs `sharp`, a
   native module, in the one path where the artifact cannot be re-obtained.

6. **The Capture is named after its Item, which is neither option this ticket
   offered and is better than both.** `library/captures/<id>.png` beside
   `library/items/<id>.json` makes 001's one-Item-one-Capture invariant **visible
   on disk and checkable by set difference**. Content-hashed names were rejected
   as a *filename* because they detach the Capture from its owner; human-readable
   names were rejected because they collide (ADR 0001 permits several Items per
   source), the disambiguating counter is reused after a deletion, and they encode
   the source into the name. The id is `<compact-instant>-<six base36 chars>`,
   e.g. `20260726T210311Z-k3m9qa`: sortable so `ls` is navigable, opaque per 001
   decision 4, and **typeable**, which UUIDv4 is not and which the hand-writing
   path needs.

7. **Committed, in full, PNGs included.** Measured: 8,060 KB of working tree
   packs to 6,451 KB, so PNGs store at roughly 1:1 and Item JSON delta-compresses
   to nothing. 300 Items is 0.33-0.61 GB on disk once committed. The structural
   point the raw size hides is that **git bloat comes from repeatedly changing
   binaries, not from accumulating immutable ones**, and 001 plus 003 make each
   Capture write-once, so one blob per Capture with no churn. The pathological
   case cannot occur here.

8. **"Commit the JSON, ignore the PNGs" is the tempting answer and it is
   backwards.** It would ignore the only irreplaceable bytes in the library and
   leave a restore holding 300 Items whose `capture.file` points at nothing. The
   inversion in full: the cheap half (metadata, 1.1 MB, re-extractable for
   $0.05-0.13 per 002) is what people want to commit, and the impossible half
   (Captures, 334 MB, gone forever) is what they want to ignore. **git-lfs was
   rejected** because an LFS checkout without the tool yields 130-byte text
   pointers where your Captures should be, defeating the portability the decision
   exists to serve.

9. **The folder is the export, and one invariant makes that true: no absolute
   path exists anywhere in the library.** `capture.file` is a bare filename,
   `source.url` is provenance the app never follows, `source.originalPath` is a
   citation not a link, filenames are `[0-9A-Za-z-]`. So `library/` is
   position-, machine- and platform-independent. Building a second export format
   would be a worse copy of the best thing about the store. **What protects the
   library, honestly separated:** git history protects against bad edits and bad
   re-runs, `.git` protects against deleting the working tree, and **nothing here
   protects against losing the disk**. That needs a second copy elsewhere, and
   the recommendation is a private remote pushed after each producer run.

10. **The file is overwritten and git is the version store.** The ticket is right
    that history is impossible to retrofit, but only if nothing records it, and
    decision 7 already made something record it: `git log -p
    library/items/<id>.json` is every version of that DNA with the hexes that
    moved highlighted, which is the direct answer to 002's non-idempotence. A
    versions array inside the Item file was rejected because it multiplies the
    size of the file a human must hand-edit by the number of re-runs, against this
    ticket's own hard requirement; a `history/` sibling directory was rejected as
    a hand-rolled reimplementation of `.git` with none of its tooling.

11. **An overwrite is an authorship-respecting merge, not a file replacement.**
    A re-run keeps any trait whose `authorship` is `override` verbatim, merges the
    palette **per swatch** (which is what 004's per-swatch authorship was for),
    never touches `note`, `id`, `addedAt`, `source` or `capture`, and replaces
    `authoredBy`. Without this rule a re-run destroys your corrections, which is
    exactly the destructive act 002 warned about. Additionally, **the producer
    refuses to overwrite an Item file with uncommitted changes unless forced**,
    since an uncommitted edit is an edit git cannot restore. Five lines against
    `git status --porcelain`, and it turns "git is your history" from an
    aspiration into an enforced invariant.

12. **Migrations: one numbered script, one commit, all or nothing, and the app
    never migrates.** Every Item carries its own `schemaVersion` and there is no
    second place recording it. **A reader refuses an unknown version loudly and by
    name** rather than coercing, skipping or guessing, because a store two
    programs write will one day hold a file from the future and silently ignoring
    it is how a library quietly loses Items. Mixed versions are not a supported
    state. The payoff of decision 7 lands a third time here: a migration over flat
    JSON in git is **reviewable as a diff before it commits and revertable after**,
    which a SQLite migration is not in practice.

13. **The app is a pure reader, confirmed explicitly, and it writes zero bytes to
    `library/`.** No Notes, no Overrides, no re-runs, no deletions, no saved
    Mixes. Everything a storage ticket usually has to design therefore does not
    exist: no locking, no lockfile, no WAL, no transactions, no concurrent-writer
    protocol, no migration on write. The only durability primitive needed is
    write-to-temp-then-rename, verified to replace an existing file on Windows
    with Node v22.14.0. **What the app does write, precisely:** transient UI state
    (in-progress Mix selection, filters, search text) in the URL and
    `localStorage`, owned by the browser and discardable without loss.

14. **`library:check` is what makes hand-editability real**, because a text format
    without a validator is hand-corruptibility. Eight checks: Zod validity, known
    `schemaVersion`, filename stem equals `id`, no duplicate ids, no orphan
    Capture and no dangling reference, no absolute path anywhere, PNG dimensions
    agreeing with the record's IHDR, and canonical formatting. Only the last is
    auto-fixable; everything else is a decision.

### Collisions surfaced deliberately

- **`capture` wants a `sha256` and that is 004's field to add, not 006's to take.**
  One nullable string would serve three things at once: it is exactly the signal
  the map's parked "duplicates and near-duplicates" item asks for, it lets
  `library:check` detect a Capture truncated by a bad copy or replaced by
  accident, and it gives 001's immutability claim something that can verify it
  rather than leaving it a convention. **Recommendation: 008 adds it at the first
  `schemaVersion` bump**, computed from files already on disk. Until then the
  store is exactly 004's `Item` with nothing added, which is why the rendered
  example carries none. `pixelWidth`/`pixelHeight` are the weak proxy in the
  meantime.

- **010 inherits a constraint it has not been told about yet.** Decision 13 means
  that if a Mix must persist, the app still cannot be what writes it. A saved Mix
  would be a separate unit under `library/mixes/<id>.json`, written by the
  producer or by hand through the same validator, and it would need its own
  schema. If 010 wants saved mixes it is opening a writer question, not a UI one.
  The cheapest outcome by a distance is that a Mix is ephemeral, which the map's
  "the copy button is the only export surface" already suggests.

- **003's dangling file-size item is closed and its budget was low.** 003 said
  "budget for roughly 0.5-2MB per Capture and check it against the first real
  batch". The measured worst case is 3.0MB. Nothing in 003 changes, but anyone
  sizing from that sentence should size from the table in section 1 instead.

- **004's zod version question is settled in one line.** 004 left "the v3 request
  may be worth revisiting in 006 or 008". The module is consumed under
  **`zod@^4.4.3`**, the version the repo already has installed and the version 004
  actually typechecked against, pinned to one version across both programs
  because 006 is what makes the module a runtime dependency of two of them.

### What was not verified

- **The five seed Captures did not exist when this was measured.**
  `seed/captures/` was empty, so the byte figures come from six sites captured for
  this ticket rather than from the real seed set. Measure the seed Captures
  against section 1's table when they land. Nothing in the git reasoning depends
  on the exact figure, only on the order of magnitude.
- **Six sites is a range, not a distribution.** The sample was chosen to span the
  extremes 003 sampled, but the tail is what drives the projection and the tail is
  what is least well measured.
- **The 300-Item scan used near-identical files**, so the git delta-compression
  figure for JSON is optimistic. It is also irrelevant, since metadata is 0.3% of
  the library either way.
- **Nothing has been written by a producer, because no producer exists.** The
  merge rule, the dirty-file refusal and `library:check` are specified here and
  built by 008.
- **No migration has been run**, so the migration rules are reasoned rather than
  exercised. The first real bump is the test, and 004 already expects one.
- **Cross-platform portability is argued, not tested.** The invariants that make
  it true are enforceable and checked, but no library has actually been copied to
  macOS or Linux.
- **`node:sqlite` was not benchmarked.** It would certainly beat 31 ms. The
  rejection does not turn on speed and should not be read as though it does.
