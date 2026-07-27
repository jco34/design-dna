# 006 storage contract - where the library lives and what protects it

Ticket: [`../tickets/006-storage-and-persistence.md`](../tickets/006-storage-and-persistence.md).
Stores the `Item` defined by [`004-extraction-schema.ts`](004-extraction-schema.ts).

**Status: settled by derivation from locked decisions where one reached, and by
measurement where 003 left a gap.** The gap 003 named explicitly ("`deviceScaleFactor: 2`
file size is reasoning, not measurement. Bears on 006") is closed in section 1,
and it turns out to be the number that decides the git question.

Sections 1, 4 and 6 are the ones with teeth. Section 1 is the measurement.
Section 4 is git, which is the ticket's hardest question and which turns out to
be the *same* decision as where the folder lives and as whether an analysis is
versioned. Section 6 is that coupling stated plainly.

---

## 1. The measurement 003 deferred, and what it decides

003 locked the Capture as a 1440x900 viewport shot at `deviceScaleFactor: 2` and
then said outright that it never measured what that costs, guessing "roughly
0.5-2MB per Capture". Everything in this document that concerns disk, git and
backup rests on that number, so it was measured rather than inherited.

**Method.** Playwright (chromium build 1228, headless), Windows 11, Node
v22.14.0, 2026-07-27. Context exactly as 003 section 3 specifies:
`viewport: {width: 1440, height: 900}`, `deviceScaleFactor` 1 and 2,
`reducedMotion: 'reduce'`, `colorScheme: 'light'`, `locale: 'en-GB'`; 003's wait
recipe (`load`, `document.fonts.ready`, a 0.85-viewport scroll pass and return);
`page.screenshot({ scale: 'device', animations: 'disabled' })`. Six real sites,
chosen to span the range 003 itself sampled (a near-monochrome dark UI, a
gradient-heavy marketing page, a minimal typographic page, two photography-led
pages). Every `deviceScaleFactor: 2` output was confirmed **2880x1800** by
reading the PNG IHDR, so `scale: 'device'` behaved as 003 predicted.

| site | PNG @1x | **PNG @2x** | multiplier | JPEG q90 @2x |
| --- | ---: | ---: | ---: | ---: |
| vercel.com | 46.5 KB | **107.7 KB** | 2.32x | 138.1 KB |
| linear.app | 134.0 KB | **313.3 KB** | 2.34x | 250.9 KB |
| www.anthropic.com | 172.6 KB | **467.4 KB** | 2.71x | 362.9 KB |
| figma.com | 289.1 KB | **752.0 KB** | 2.60x | 315.9 KB |
| stripe.com | 605.5 KB | **2,048.1 KB** | 3.38x | 464.2 KB |
| monzo.com | 922.5 KB | **2,996.9 KB** | 3.25x | 578.2 KB |
| **mean** | 362 KB | **1,114 KB** | **2.77x** | 352 KB |
| **median** | 231 KB | **610 KB** | | |

Three results, and each one settles something further down.

1. **003's reasoning was sound but its budget was low.** It predicted "somewhere
   under 4x" and got 2.32x to 3.38x, which is right. It predicted 0.5-2MB and the
   worst case is **3.0MB**, half again over the top of the range. The honest
   figure to plan against is **a mean of 1.1MB and a tail to 3MB**, and the tail
   matters because photography-led and gradient-heavy pages are exactly what a
   design library fills up with.
2. **At the locked scale of low hundreds of Items the Captures are 0.2-0.4 GB.**
   300 Items is **183 MB** on the median and **334 MB** on the mean. That is a
   real number but it is not a frightening one, and section 4 spends it.
3. **The metadata is not where the bytes are.** A rendered Item file is
   **3.83 KB** (section 7), so 300 Items is **1.1 MB** of JSON against 334 MB of
   PNG. **The metadata store is 0.3% of the library.** Every argument in section 2
   that trades format elegance against size is therefore arguing about rounding
   error, and the only axis that matters is which format a human and a Claude
   session can edit safely.

---

## 2. The metadata store: JSON files, one per Item

**Decided: one JSON file per Item, under `library/items/<id>.json`, read by a
full directory scan. No database of any kind.**

### 2.1 The hard requirement kills SQLite before the scale argument is reached

The ticket promotes hand-editability from a nicety to a hard requirement, and it
is worth being precise about what the requirement actually is, because "editable"
alone would not settle this. It is four properties, and SQLite fails all four:

| requirement | JSON files | `node:sqlite` / `better-sqlite3` |
| --- | --- | --- |
| **diffable** | `git diff` shows the changed hex | binary; git shows "Binary files differ" |
| **greppable** | `rg '#5e6ad2' library/` | needs a query, needs a client |
| **safe to edit without a client** | any text editor, then validate | a client *is* required, by definition |
| **a bad edit fails loudly** | `JSON.parse` or Zod throws, naming the file | a bad write is silent corruption |

**Rejected: `node:sqlite`.** This is the strongest of the database candidates and
the one the ticket names first, so it deserves the real objection rather than a
dismissal. Its case is good: zero dependencies, built into Node 22, no native
build on Windows, real indexes. And it still loses, for three reasons in
ascending order. First, at 300 Items there is no query to accelerate; section 2.3
measures the alternative at 31ms for the *entire library, fully validated*, which
is faster than the frame budget of the grid it feeds. Second, a Claude session
editing a `.db` file is not editing, it is writing a program that mutates a file
it cannot read back, which is a materially different and worse act than changing
a line. Third, and decisively, **it deletes the git decision**. A binary blob has
no useful history, so committing it buys none of section 6's payoffs: no readable
diff of a re-extraction, no revertable migration, no per-Item log. SQLite would
force a versioning mechanism to be *built* that section 5 gets for free.

**Rejected: `better-sqlite3`.** Everything above, plus a native module that has to
compile on Windows. `AGENTS.md` prefers robustness over setup cost, which is an
argument *against* it here rather than for it: a toolchain-dependent build step
in the read path of a library meant to last is a fragility, not an investment.

**Rejected: Postgres in Docker.** A daemon to babysit, a second process the app
cannot start, and a library that no longer moves by copying a folder. The ticket
calls it overkill and the ticket is right.

### 2.2 One file per Item, not one file for the library

**Rejected: a single `library.json` holding an array.** Fewer files and one read.
Rejected on three counts. Two writers append to it (the producer CLI and a Claude
session), so every concurrent edit is a conflict in the same region of the same
file. A `git diff` of one changed hex inside a 1.1 MB array is unreadable, which
throws away the main reason for choosing text. And a single malformed edit takes
the **whole library** offline rather than one Item, which is the difference
between an annoyance and a catastrophe on a hand-edited store.

**Rejected: one file per Item plus a generated index file.** The classic
compromise, and it is premature: an index is a cache, a cache goes stale, and
something has to notice and rebuild it. At 300 Items **the scan is the index**
(section 2.3). Reintroduce it if the library ever reaches a scale that the map
has ruled out.

**Rejected: sharding `items/` into subdirectories** (`items/2026/07/...`). 300
files in one directory is nothing on any filesystem, and sharding would make the
one hand-navigation move that matters (`ls library/items/`) require knowing the
date first.

### 2.3 The scan cost, measured, so nobody has to guess

300 rendered Item files written to disk and read back, Node v22.14.0, Windows 11:

| operation over the whole library | time |
| --- | ---: |
| `readdir` + `readFile` + `JSON.parse` + **`Item.parse` (full Zod)**, cold | 417 ms |
| `readdir` + `readFile` + `JSON.parse` + **`Item.parse` (full Zod)**, warm | **31.0 ms** |
| `readdir` + `readFile` + `JSON.parse`, no validation | 18.1 ms |
| a two-predicate filter across all 300 parsed Items | 0.14 ms |

**The app validates every Item on every read and it costs 31 milliseconds.** No
index, no cache, no invalidation logic, and 009 gets to design search against an
in-memory array rather than against a query language. If a cache is ever wanted,
its key is the `items/` directory mtime, but nothing here justifies writing one.

### 2.4 JSON, not YAML, and the reason is the hex

Hand-editability argues for YAML: comments, block scalars for the prose fields,
no quote noise. It loses anyway, and on a specific rather than a general ground.

**`#` starts a comment in YAML, and this schema stores five hex values per Item.**
An unquoted `accent: #5e6ad2` parses as an empty value followed by a comment. So
every hex in the library would have to be quoted, on the single most-edited field
in the schema, with the failure mode being *silent data loss on a valid-looking
line*. That is the exact opposite of "safe to edit without a client". Add the
Norway problem (`no` -> `false`), sexagesimal integers, and a parser dependency
where JSON needs none, and the format that reads better costs more than it
returns.

**Rejected: TOML.** No comment hazard, but deeply nested tables (this schema is
three levels deep at `dna.palette.accent.hex`) render as `[[dna.palette]]` header
soup that is harder to scan than the JSON it replaces.

**Rejected: JSON5 / JSONC.** Comments and trailing commas, at the cost of a
parser dependency and of breaking the property that makes this store trustworthy:
**the file on disk is exactly what `JSON.parse` yields and exactly what Zod
validates**, with no third dialect in between.

**Rejected: Markdown with YAML frontmatter.** Attractive because `note` and
`philosophy` are prose. Rejected because it splits one validated record across two
syntaxes, keeps the YAML hex hazard for everything above the fold, and 004 defined
and verified a single closed object. Two formats for one record is worse than one
imperfect format.

The cost of JSON is honestly stated: no comments, and `philosophy` is one long
line. Neither bites. Comments are unnecessary because the schema module is the
documentation and `note` is the field for your words. A 600-character paragraph on
one line diffs as one changed line, which is *accurate*: the paragraph changed.
`git diff --word-diff` renders it properly when the detail matters.

### 2.5 Canonical form is part of the contract

Two writers plus a validator means formatting has to be pinned, or every producer
write reformats the last hand edit into a spurious whole-file diff.

> **Canonical form: `JSON.stringify(item, null, 2) + '\n'`. Two-space indent, LF
> line endings, one trailing newline, keys in the declaration order of
> `Item` in `004-extraction-schema.ts`.**

`library:check` (section 9) verifies it, so a hand edit that drifts is caught
before it becomes noise in the next diff. LF is already enforced by the repo's
`.gitattributes` (`* text=auto eol=lf`).

The Zod module is consumed under **zod 4.x**, which closes the item 004 handed to
this ticket. 004 wrote the module in v3 syntax and verified it typechecks and runs
identically under 4.4.3, and 4.4.3 is what the repo actually has installed. 006 is
what makes that module a runtime dependency of two programs, so it is pinned here:
`zod@^4.4.3`, one version, both programs.

---

## 3. The image store

**Decided: PNG files in `library/captures/`, one per Item, named `<id>.png`. Not
blobs, not base64, not JPEG.**

### 3.1 PNG, and this is a derived decision rather than an inherited one

003 locked the viewport and the scale factor but never locked the encoding, and
section 1 shows the choice is worth 3.2x: at `deviceScaleFactor: 2` the mean PNG
is 1,114 KB against 352 KB for JPEG q90. 334 MB becomes 106 MB. That is the whole
case for JPEG and it is not enough, for two reasons that both come from locked
decisions rather than from preference.

1. **004 section 3.3 deliberately deferred a pixel sampler and designed the schema
   so it can be built later**, with `authorship: 'sampled'` sitting unreachable in
   the enum for exactly that purpose. A sampler reads flat colour fields off the
   Capture. JPEG chroma subsampling and ringing artifacts corrupt flat fields and
   hard edges specifically, which is to say **JPEG would damage the one signal the
   deferred feature exists to read**. Lossily compressing the input to a planned
   accuracy fix is self-defeating.
2. **A Capture is irreplaceable.** 001 fixes it at the moment of saving, 003
   confirms nothing ever re-fetches, and the site redesigns. There is no second
   chance at these bytes. Spending 230 MB of a personal disk to keep the only copy
   of something unrepeatable lossless is not a close call.

A screenshot is also close to the worst case for JPEG and the best case for PNG:
synthetic imagery, hard type edges, large flat fills. Note that the one site where
JPEG q90 came out *larger* than PNG (vercel.com, 138 KB against 108 KB) is the most
minimal page in the sample, which is the same phenomenon.

**Rejected: lossless WebP.** Roughly 30% smaller than PNG at identical fidelity,
so the fidelity argument does not touch it. Rejected on the delivery path:
Playwright's `page.screenshot` emits png or jpeg only, so WebP means a re-encode
step and an image library (`sharp`, a native module) between the browser and the
store. That is the same Windows native-build fragility this document rejects
`better-sqlite3` for, added to the one path where the artifact is irreplaceable.
Saving 100 MB is not worth putting a compiled dependency in the way of the only
copy.

### 3.2 Files, not blobs and not base64

There is no database, so "blobs in the database" would mean base64 inside the Item
JSON. **Rejected with the measured number:** a 1.1 MB mean PNG is 1.5 MB of base64
on a single line, inflating a 3.83 KB Item file by roughly 400x and destroying
diffability, greppability and readability in one move. It would trade the hard
requirement for nothing at all.

### 3.3 Filenames: named after the Item, not after the content and not after the source

**Decided: `library/captures/<id>.png`, the same `<id>` as `library/items/<id>.json`.**

This is neither of the two options the ticket names, and it is better than both.
001's invariant is one Item, one Capture. Naming the Capture after the Item makes
that invariant **visible on disk and checkable by set difference**: an orphan
Capture or a dangling reference is `ls items | sed s/.json// ` against
`ls captures | sed s/.png//`, which is what `library:check` does. There is no
lookup, no join, no ambiguity, and deleting an Item is deleting two files that
share a stem.

**Rejected: content-hashed names (`sha256-<hex>.png`).** Free deduplication and
guaranteed immutability, and the map's parked "duplicates" item explicitly
imagines a capture-bytes hash. Rejected as a *filename* because it detaches the
Capture from the Item that owns it, so the one-to-one invariant becomes something
you have to reconstruct by reading every JSON file. The hash is still worth having
and section 11 surfaces it as a field rather than as a name.

**Rejected: human-readable names (`linear-app-2026-07-26.png`).** Browsable, and
that is the whole of its case. It collides (ADR 0001: "several items may share one
source"), so it needs a disambiguating counter, and a counter is reused after a
deletion, which is identity reuse. It also encodes the source into the name, which
runs against the spirit of 001 decision 4.

### 3.4 The Item id

004 types `id` as opaque and producer-assigned and leaves the format to 006.

> **`<compact-instant>-<six base36 characters>`, for example
> `20260726T210311Z-k3m9qa`.**

Four properties, each of which was required by something:

- **Sortable.** `ls library/items/` comes out in save order, so the directory is
  navigable by hand. This is what rules out UUIDv4.
- **Opaque about the source.** Nothing about where the Item came from contributes,
  which is 001 decision 4. This is what rules out a slug.
- **Typeable.** A Claude session hand-writing an entry (an equally valid writer,
  per the map) can produce one from the current time plus six characters. Nobody
  can invent a plausible UUIDv4 by hand; they have to run a command first.
- **Filesystem-safe everywhere.** `[0-9A-Za-z-]` only, 23 characters, so no
  Windows-illegal characters, no case-collision risk on case-insensitive volumes,
  no path-length pressure.

**Rejected: `crypto.randomUUID()`.** Zero dependency and standard, and it loses on
the first and third properties above.

**Rejected: a hash of the Capture bytes as the id.** Natural deduplication, and it
contradicts a locked decision: 001 makes identity **the act of saving**, and ADR
0001 states that several Items may legitimately share a source. Saving the same
crop deliberately twice would silently become one Item.

**The risk, named so nobody trips on it:** the prefix duplicates `addedAt`, so a
hand edit can make them disagree. **The id is opaque and authoritative; the
timestamp prefix is a sorting convenience and nothing may parse it.**
`library:check` does not compare them, on purpose.

---

## 4. Git: committed, and this is the same decision as sections 5 and 6

**Decided: `library/` is committed in full, JSON and PNGs together. The repo's
`.gitignore` gains nothing.**

### 4.1 The size objection, answered with the measurement

The ticket's objection is that committing "bloats the repo with images", and
section 1 lets that be priced instead of feared.

Measured: a working tree of 6,700 KB of `deviceScaleFactor: 2` PNGs plus 1,360 KB
of Item JSON packs to **6,451 KB**. PNGs are already deflate-compressed so git
stores them at roughly 1:1; the near-identical JSON files delta-compress to
essentially nothing. **The pack is the size of the capture folder, and the
metadata is free.**

Projected to the locked scale of 300 Items: **0.18-0.33 GB of working tree, and
roughly 1.8x that on disk once committed**, so 0.33-0.61 GB total. For a personal
library on a personal machine that is a rounding error against any modern disk.

The decisive structural point is one the raw size hides: **git bloat comes from
repeatedly changing binaries, not from accumulating immutable ones.** 001 fixes
the Capture at the moment of saving and 003 confirms nothing re-fetches, so each
Capture is written **exactly once and never modified**. One blob per Capture,
forever, with no churn. The pathological case that makes people afraid of binaries
in git structurally cannot occur here.

### 4.2 "Commit the JSON, ignore the PNGs" is the tempting answer and it is backwards

This is the compromise everyone reaches for, and it inverts the value of the two
stores. A clone or a restore would yield 300 Items whose `capture.file` points at
nothing, which is 300 broken Items, because **the Capture is not derivable**. It
cannot be regenerated: 001 locks it as never refreshed, 003 confirms nothing
re-fetches, and the site it came from will have redesigned. The PNGs are the
**most** irreplaceable bytes in the library, not the least. They are also the only
bytes with no other copy anywhere, where a lost DNA can be re-extracted for
$0.05-0.13 (002).

Note the inversion in full: the cheap-to-replace half (metadata, 1.1 MB,
regenerable for pennies) is what people want to commit, and the impossible-to-
replace half (Captures, 334 MB, gone forever) is what they want to ignore.

### 4.3 Rejected: git-lfs

The standard answer for binaries in git, and it is disqualified by the ticket's
own portability requirement. **An LFS checkout without the LFS tool installed
gives you 130-byte text pointers where your Captures should be**, which turns the
library's most precious files into stubs on any machine that is not fully set up.
There is also no remote today (`git remote -v` is empty), so LFS's actual benefit
(bandwidth) is zero. It adds a tool dependency and a failure mode, and buys
nothing here.

### 4.4 What committing actually buys, and what it does not

Buys, and each is used elsewhere in this document:

- **The history of every re-extraction and every hand edit**, which is section 5's
  entire answer to the versioning question.
- **A revertable migration**, which is section 8.
- **Portability**: `git clone` moves the library complete.
- **Recovery from a working-tree `rm -rf`**, which is the loss the ticket names.

Does **not** buy, and this must be said plainly:

- **Backup.** `.git` lives inside the folder, so `rm -rf design-dna` destroys the
  history along with the library. **Git is versioning, not backup.** Backup
  requires a second copy elsewhere, and section 5.3 prescribes one.

### 4.5 The two real costs, accepted with eyes open

- **Deleted Items persist in history and the repo never shrinks.** Bounded at this
  scale, deletion is parked in the map's "Not yet specified" anyway, and
  `git filter-repo` exists if it ever matters.
- **Committing your taste.** There is no remote today. If one is ever added it
  must be **private**, and adding it is the decision to put your browsing taste
  somewhere other than your own disk. Named in ADR 0002 as a consequence rather
  than buried here.

### 4.6 The escape hatch, which costs nothing now

The strongest objection to committing is not size, it is **lifecycle coupling**:
the spec repo will one day hold the app source, and code has a reason to be shared
that a personal library does not. The answer is not to hedge the decision but to
make it cheap to reverse in the one direction it might need to go. `library/` is a
single self-contained top-level directory with **no path pointing outward and no
absolute path anywhere inside it** (section 5.2), so extracting it into its own
repo later is `git filter-repo --path library/`, or in the trivial case `mv`. The
app resolves the library at `LIBRARY_DIR` if set and `./library` otherwise, which
is five lines and makes "keep the library outside the repo" a configuration rather
than a rewrite.

---

## 5. Backup and portability

### 5.1 The folder is the export

The ticket asks whether there is an export. **There is, and it is `library/`.**
Building a second serialization of a store that is already plain JSON and plain
PNGs would be a worse copy of the best thing about it, and the map rules
"anything reading the library back out except the copy button" out of scope.
Copying the folder *is* the export, and that is the strongest available answer to
the ticket's own framing that "the entire value of the app sitting in one
directory".

### 5.2 The invariant that makes it true

> **No absolute path exists anywhere in the library.**

`capture.file` is a bare filename resolved against `library/captures/`, never a
path. `source.url` is provenance the app never follows (003 decision 7).
`source.originalPath` is explicitly a citation and not a link (004). Filenames are
`[0-9A-Za-z-]` only. So `library/` is position-independent, machine-independent
and platform-independent: copy it to a Mac, to a stick, to a NAS, and it works.
`library:check` enforces this, because it is the property that everything in this
section rests on.

### 5.3 What actually protects the library from loss

Three tiers, honestly separated, because conflating them is how libraries die.

1. **Bad edits and bad re-runs** are protected by git history. `git diff` before
   committing, `git checkout <sha> -- library/items/<id>.json` after.
2. **Deleting the working tree** is protected by `.git`, which sits beside it.
3. **Losing the disk is protected by nothing in this repo.** This is the honest
   gap. It requires a second copy elsewhere, and either of these closes it:
   a **private** git remote pushed after each producer run, or a periodic
   `git clone` (or plain folder copy) onto a second physical device. The
   recommendation is the private remote, because a clone is verifiably complete in
   a way a folder copy is not, and because push is a habit where a manual copy is
   a resolution.

---

## 6. Versioning versus overwrite: the file is overwritten, and git is the version store

**Decided: an Item file holds exactly one current `Item`. Re-extraction overwrites
it. The version history is git.**

The ticket is right that "keeping history is cheap now and impossible to retrofit
later", and 002 raised the stakes correctly: re-extraction is not idempotent, so
an overwrite silently replaces a value you may have preferred. But "impossible to
retrofit" is only true if **nothing** records history, and section 4 already
decided that something does. `git log -p library/items/<id>.json` is literally
every version of that DNA, timestamped, diffed, with the hexes that moved
highlighted. This is the second place the commit decision pays for itself, and it
is why sections 4, 5 and 6 are one decision rather than three.

**Rejected: an array of DNA versions inside the Item file.** Self-describing and
needs no external tool. Rejected on three counts, the first of which is decisive:
it multiplies the size of the file a human has to hand-edit by the number of
re-runs, against the ticket's own hard requirement. It also breaks the property
that a file is exactly one validated `Item`, and it would require 004 to grow a
versions array to serve a feature no ticket has asked for a surface for.

**Rejected: superseded DNAs as sibling files** (`library/history/<id>/2.json`).
Keeps the current file clean, and is a hand-rolled reimplementation of a
content-addressed versioned store that is already sitting in `.git`, with none of
its tooling and a directory of junk that nothing reads.

### 6.1 Overwrite is an authorship-respecting merge, not a file replacement

This is what "overwrite" has to mean if 002's finding is taken seriously, and it
is the rule the map's parked "correcting the agent" item will build on.

> **A re-run replaces agent-authored values and preserves everything else.**
>
> - Any trait whose `authorship` is `override` is **kept verbatim**. The agent's
>   new reading of it is discarded.
> - The palette merges **per swatch**, since 004 put `authorship` on each swatch
>   precisely so a corrected accent survives while the other four are refreshed.
> - `note` is never touched by any automated writer.
> - `id`, `addedAt`, `source` and `capture` are never touched. The Capture is
>   fixed (001) and is not re-taken by a re-extraction.
> - `authoredBy` is replaced with the run that produced the new values.

Without this rule a re-run destroys your corrections, which is exactly the
destructive act 002 warned about. With it, an Override is permanent until you
change it, which is what the map means by "Override as the primary correction
mechanism".

### 6.2 The producer refuses to overwrite uncommitted work

Git is only a version store for edits that were committed. A hand edit made and
not committed, followed by a re-run, is lost with nothing to recover from.

> **If the library is inside a git work tree and the target Item file is dirty,
> the producer refuses to write it and exits non-zero, naming the file, unless
> `--force` is passed. If the library is not inside a work tree, it warns.**

Five lines against `git status --porcelain`, and it converts "git is your history"
from an aspiration into an enforced invariant. Being a warning rather than a
refusal outside a work tree keeps the library usable for anyone who takes section
4.6's escape hatch.

---

## 7. The concrete layout, and a rendered Item

```
design-dna/
  .gitattributes              * text=auto eol=lf ; *.png binary   (already present)
  .gitignore                  node_modules/ and OS cruft only. library/ is NOT here.
  library/                    the whole library. Copy this folder and you have moved it.
    README.md                 what this folder is, for whoever finds it in five years
    items/
      20260726T210311Z-k3m9qa.json
      20260726T214402Z-p7w1de.json
      ...                     one file per Item, flat, sortable by name
    captures/
      20260726T210311Z-k3m9qa.png
      20260726T214402Z-p7w1de.png
      ...                     one PNG per Item, 2880x1800, same stem as its Item
  migrations/
    001-<slug>.ts             one script per schemaVersion bump. None yet. Never in library/.
  docs/adr/
  wayfinder/
```

Exactly two kinds of file live under `library/`, plus one README. There is no
manifest, no index, no lockfile and no sidecar. **Rejected: a `library/library.json`
manifest** carrying a library-level format version, because at v1 it would hold
nothing that is not already a per-Item fact, and a second place to record the
schema version is a second place for it to be wrong.

### 7.1 `library/items/20260726T210311Z-k3m9qa.json`, in full

Canonical form, exactly as the producer writes it and exactly as `Item.parse`
accepts it. 3,923 bytes, 111 lines.

```json
{
  "schemaVersion": 1,
  "id": "20260726T210311Z-k3m9qa",
  "addedAt": "2026-07-26T21:03:11.482Z",
  "source": {
    "kind": "url",
    "url": "https://linear.app"
  },
  "capture": {
    "file": "20260726T210311Z-k3m9qa.png",
    "takenAt": "2026-07-26T21:03:09.117Z",
    "pixelWidth": 2880,
    "pixelHeight": 1800,
    "mode": "viewport"
  },
  "scope": "page",
  "notApplicable": [],
  "note": "The one that made me want to build this. Almost nothing on the page, and the restraint is the design.",
  "authoredBy": {
    "kind": "cli",
    "model": "claude-opus-4-6-20260401",
    "runAt": "2026-07-26T21:03:29.004Z",
    "promptVersion": "extract-v1"
  },
  "dna": {
    "palette": {
      "background": {
        "hex": "#08090a",
        "weight": "dominant",
        "authorship": "agent"
      },
      "surface": {
        "hex": "#141516",
        "weight": "supporting",
        "authorship": "agent"
      },
      "ink": {
        "hex": "#f7f8f8",
        "weight": "supporting",
        "authorship": "agent"
      },
      "muted": {
        "hex": "#8a8f98",
        "weight": "supporting",
        "authorship": "agent"
      },
      "accent": {
        "hex": "#5e6ad2",
        "weight": "occasional",
        "authorship": "override"
      }
    },
    "typography": {
      "headingFamily": "Inter Display",
      "headingCharacter": "Neo-grotesque, tight negative tracking at display size, high optical weight, sentence case, no italics anywhere.",
      "bodyFamily": "Inter",
      "bodyCharacter": "Same family one optical size down, generous leading, regular weight, muted grey rather than full-contrast white.",
      "scale": "dramatic",
      "weightRange": "paired",
      "authorship": "agent"
    },
    "composition": {
      "structure": "Centred single column on a dark field. A thin fixed nav, one oversized headline, one line of subcopy, two buttons, then a large product screenshot bleeding toward the fold.",
      "contentWidth": "contained",
      "authorship": "agent"
    },
    "spacing": {
      "density": "airy",
      "rhythm": "Very large vertical gaps between the four hero elements, tight coupling inside each one, so the page reads as a few confident blocks rather than a list.",
      "authorship": "agent"
    },
    "surfaceTreatment": {
      "corners": "slight",
      "borders": "hairline",
      "elevation": "subtle",
      "finish": "Near-black surfaces separated by one-pixel low-contrast borders and a faint top-edge highlight, with a soft radial glow behind the product shot.",
      "authorship": "agent"
    },
    "imagery": {
      "kind": "ui-screenshot",
      "treatment": "A single high-fidelity screenshot of the product itself, angled slightly, cropped by the fold, treated as the hero rather than as a supporting figure.",
      "authorship": "agent"
    },
    "philosophy": {
      "text": "The design's whole argument is that the product is the only thing worth looking at. Everything around it is subtracted until what remains is a dark field, one sentence, and the interface itself. Contrast does all the work that colour usually does: near-black against off-white, with a single indigo reserved for the one action worth taking. The restraint reads as confidence rather than emptiness because the type is set with real conviction at display size, and because the surfaces are separated by hairlines instead of shadows, which keeps the page feeling engineered rather than decorated.",
      "authorship": "agent"
    },
    "labels": [
      {
        "value": "dark",
        "authorship": "agent"
      },
      {
        "value": "minimal",
        "authorship": "agent"
      },
      {
        "value": "developer-tool",
        "authorship": "agent"
      },
      {
        "value": "high-contrast",
        "authorship": "agent"
      },
      {
        "value": "product-led",
        "authorship": "override"
      }
    ]
  }
}
```

This file was **run through 004's actual Zod module**, not written to look right:
`Item.parse` accepts it, an invented extra field is rejected, the seven traits all
report `present` via `traitState()`, and re-serializing reproduces the bytes
exactly. The `accent` swatch and the `product-led` label are deliberately
`override` to show the shape a correction takes and what section 6.1 preserves
across a re-run.

---

## 8. Schema and migrations

004 puts `schemaVersion: z.literal(1)` on every Item and gives 008 the job of
bumping it. What 006 owns is the mechanism, and there are four rules.

1. **Every Item file carries its own `schemaVersion`.** There is no second place
   where a version is recorded, so there is nothing to drift out of sync.
2. **The reader refuses what it does not recognise, loudly and by name.** An Item
   at an unknown version raises, naming the file and both versions. It is never
   coerced, never skipped, never guessed at. A store two programs write is a store
   that will one day contain a file from the future, and silently ignoring it is
   how a library quietly loses Items.
3. **A schema change is a numbered script, `migrations/00N-<slug>.ts`**, which
   reads every Item, transforms it, writes it back canonically and bumps
   `schemaVersion`. It runs to completion over the whole library or not at all, and
   lands as **one commit** containing both the script and its effect. Mixed
   versions are not a supported state: the alternative is every consumer carrying a
   version switch forever, and 004's Zod schema is written against exactly one
   shape.
4. **The app never migrates.** It is a pure reader (section 9), so
   migration-on-write does not exist as a concept. This is the ticket's "several
   problems dissolve", cashed.

**Why this is better than it sounds, and it is the third payoff of section 4:** a
migration over flat JSON in git is **reviewable before it is committed** (`git
diff` over 300 files shows precisely what changed, on every Item) and
**revertable after** (`git revert` restores every byte). A SQLite migration is
neither, in practice. A dry-run flag that writes to a scratch directory is worth
having, but git already provides the real safety net.

Migrations live with the schema module and **never inside `library/`**, which
holds data only. The exact path follows wherever 008 or 012 places the shared
module; `migrations/` at the repo root is the placement until then.

---

## 9. The app writes nothing

**Confirmed: the web app is a pure reader. It writes zero bytes to `library/`.**

This restates the map's lock ("the app is a pure reader of a library that was
written out-of-band") rather than adding to it, and the ticket asks for it to be
confirmed explicitly, so: no Notes, no Overrides, no re-runs, no deletions, no
saved Mixes, no touch of an mtime. `library/` is opened read-only.

What follows, and it is most of what a storage ticket usually has to design:

- **No locking, no lockfile, no WAL, no concurrent-writer protocol.** There is one
  writer at a time and it is a human-initiated CLI run.
- **No migration on write** (section 8).
- **No transactions.** The only durability primitive needed is that a crash
  mid-write must not leave a truncated Item: the producer writes
  `<id>.json.tmp` and then renames over the target. Verified on Windows 11 with
  Node v22.14.0, where `fs.renameSync` does replace an existing file.

**What the app does write, precisely, and it is not in the library:** transient UI
state, meaning the in-progress trait selection for a Mix, active filters and
search text. That lives in the URL and in `localStorage`, owned by the browser and
discardable. The boundary is that **`library/` is the durable library and the
browser holds only what can be thrown away without losing anything.**

---

## 10. `library:check`, which is what makes hand-editability real

Hand-editability without a validator is hand-corruptibility. The requirement is
not met by choosing a text format; it is met by choosing a text format **and**
giving the editor a way to know they got it right.

`npm run library:check` exits non-zero on any of:

1. an Item file that is not valid JSON, or that fails `Item.parse`, naming the
   file and the Zod path;
2. an Item whose `schemaVersion` the module does not know (section 8 rule 2);
3. an Item whose filename stem does not equal its `id`;
4. a duplicate `id`;
5. an Item whose `capture.file` is missing from `captures/`, or a Capture with no
   Item (the set difference of section 3.3);
6. a `capture.file` that is not a bare filename, or any absolute path anywhere in
   the record (section 5.2's invariant);
7. a `capture.pixelWidth` or `pixelHeight` disagreeing with the PNG's actual IHDR;
8. a file that is not in canonical form (section 2.5).

`npm run library:format` fixes 8 alone. Nothing else is auto-fixed, because every
other failure is a decision.

---

## 11. Surfaced deliberately: a collision with 004

**`capture` wants a `sha256` of the Capture bytes, and that is 004's field to
add.** 006 is not adding it unilaterally.

The case for it is that it serves three separate things at the cost of one
nullable string. It is the exact signal the map's parked "duplicates and
near-duplicates" item asks for ("whether a hash of the capture bytes drives an
advisory *you may already have this* signal"). It makes `library:check` able to
detect a Capture that was truncated by a bad copy or replaced by accident, which
matters more than usual on a store that is hand-edited and folder-copied. And it
gives 001's immutability claim ("fixed at the moment of saving and never changed")
something that can actually verify it, rather than leaving it a convention.

Today `pixelWidth`/`pixelHeight` are a weak proxy for that check and
`library:check` rule 7 uses them. The recommendation is that **008 adds
`capture.sha256` when it first bumps `schemaVersion`**, which costs one migration
that computes it from files already on disk. Until then the store is exactly
004's `Item` with nothing added, which is why the example in section 7.1 does not
carry one.

---

## 12. What was verified, and what was not

Verified by running it, Windows 11, Node v22.14.0, 2026-07-27:

1. `deviceScaleFactor: 2` Capture bytes across six real sites under 003's exact
   context and wait recipe, with every output confirmed 2880x1800 from the PNG
   header (section 1). This closes the gap 003 flagged for 006.
2. The Item file in section 7.1 parses under 004's real `Item` Zod schema
   (zod 4.4.3), rejects an invented field, reports `present` for all seven traits
   via `traitState()`, and round-trips byte-identically.
3. Its canonical size: 3,923 bytes.
4. Full-library scan at 300 Items: 417 ms cold and **31.0 ms warm** including full
   Zod validation of every Item; 18.1 ms without validation; 0.14 ms to filter.
5. Git pack cost: 8,060 KB of working tree (PNGs plus JSON) packs to 6,451 KB,
   confirming PNGs store at roughly 1:1 and Item JSON delta-compresses to
   effectively nothing.
6. `fs.renameSync` replaces an existing file on Windows, so the atomic-write
   pattern in section 9 works on the target platform.

Not verified, and each is a real gap:

- **The five seed Captures did not exist when this was written.** `seed/captures/`
  was empty at the time of measurement, so section 1 rests on six sites captured
  for this ticket rather than on the real seed set. The seed Captures should be
  measured against the table in section 1 as soon as they land; if their mean is
  far above 1.1 MB the 0.2-0.4 GB projection moves, though nothing in section 4's
  reasoning depends on the exact figure.
- **The six-site sample is small and self-selected.** It spans the range
  deliberately, but a mean over six is not a distribution. The tail is what matters
  and the tail is what is least well measured.
- **The 300-Item scan used 300 near-identical files.** Real Items differ more, so
  the git delta-compression figure for JSON is optimistic. It is also irrelevant:
  metadata is 0.3% of the library either way.
- **Nothing has been written by a producer**, because no producer exists. Section
  6.1's merge rule, section 6.2's dirty-file refusal and section 10's
  `library:check` are specified here and built by 008.
- **No migration has been run**, so section 8's rules are reasoned rather than
  exercised. The first real bump is the test, and 004 already expects one.
- **Cross-platform portability is argued, not tested.** The invariants that make
  it true (no absolute paths, restricted filename alphabet, LF) are enforceable and
  checked, but no copy of a library to macOS or Linux has been performed.
- **`node:sqlite` was not benchmarked.** It would certainly beat 31 ms. The
  argument against it does not turn on speed, so measuring it would not change the
  decision, but the rejection is on grounds other than performance and should be
  read that way.

---

## 13. The judgement calls, named

Everything above is derived from a locked decision, forced by a measurement, or
one of these six. A reviewer who wants to disagree efficiently should start here.

1. **The id format.** Sortable-and-typeable over UUID is a real preference. The
   consequence of being wrong is small and the migration is mechanical.
2. **Naming the Capture after the Item** rather than content-hashing it. The
   invariant-visible-on-disk argument is the one doing the work; a hash would also
   have been defensible, and section 11 recovers most of what it offered.
3. **PNG over JPEG**, which spends 230 MB at 300 Items on a sampler that does not
   exist yet and a fidelity nobody may ever look at. This is the most expensive
   call in the document.
4. **The `LIBRARY_DIR` override.** Five lines of insurance against a coupling the
   map says will not arise. Arguably it should not exist at all.
5. **Refusing to overwrite a dirty Item file** (6.2), which makes the producer
   git-aware. A cleaner design would keep the CLI ignorant of version control.
6. **Specifying `library:check` here** rather than leaving it to 008. Justified
   because the integrity rules *are* the storage contract, but it does reach into
   another ticket's territory on implementation.
