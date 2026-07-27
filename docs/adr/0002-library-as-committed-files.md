---
status: accepted
---

# The library is a folder of files, committed to the repo

Ticket 006 asks four questions that look separate: which metadata store, where
the images sit, whether the data folder is committed or ignored, and whether an
analysis is versioned or overwritten. They are one question. Since the
2026-07-26 re-charter the store is an interface between two writing programs
(the producer CLI and a Claude session hand-writing an entry) and one reading
one, and hand-editability is a hard requirement rather than a nicety, so the
format must be diffable, greppable and safe to edit without a client. We decided
the library is **`library/`, a committed folder holding one JSON file per Item
and one PNG per Capture, with git as the version store**. Choosing text files is
what makes git history meaningful; committing is what makes an overwrite safe,
because `git log -p` on an Item file is every version of that DNA with the hexes
that moved highlighted, which is the answer to 002's finding that re-extraction
is not idempotent. A database would have taken all of that back at once: a
binary store has no useful diff, so committing it buys nothing and versioning
would have to be built by hand. The size objection was measured rather than
feared. A 1440x900 Capture at `deviceScaleFactor: 2` is a mean of 1.1MB across
six real sites, so 300 Items is 0.2-0.4GB, and because 001 fixes a Capture at
the moment of saving and nothing ever re-fetches it, each PNG is written once
and never modified: one blob per Capture, no churn, and the pack is the size of
the folder.

## Considered options

- **Files in git (chosen).** `library/items/<id>.json` and
  `library/captures/<id>.png`, read by a full directory scan, which measures at
  31ms for 300 Items including full Zod validation of every one. Every editing
  requirement is met by the format itself, history and revertable migrations come
  free, and the library moves to another machine by copying one folder or cloning
  the repo.
- **SQLite (`node:sqlite` or `better-sqlite3`), committed or ignored.** Rejected:
  a binary blob is not diffable, not greppable and not editable without a client,
  which fails the hard requirement on all three counts; a bad hand-write is silent
  corruption rather than a loud validation error; and there is no query at this
  scale for an index to accelerate. `better-sqlite3` additionally needs a native
  build on Windows.
- **Files, but with the images gitignored.** The tempting middle, and it inverts
  the value of the two halves. A Capture cannot be regenerated (001 fixes it, 003
  confirms nothing re-fetches, the site redesigns), while a DNA can be
  re-extracted for $0.05-0.13. Ignoring the PNGs would ignore the only
  irreplaceable bytes in the library and leave a restore holding Items whose
  capture points at nothing.
- **Files, with git-lfs for the images.** Rejected: an LFS checkout without the
  tool installed yields 130-byte text pointers where the Captures should be, which
  defeats the portability the decision exists to serve, and there is no remote for
  its bandwidth benefit to apply to.

## Consequences

- **Git is versioning, not backup.** `.git` sits inside the folder, so losing the
  disk loses both. A second copy elsewhere, preferably a private remote, is
  required and is not optional.
- **An overwrite is an authorship-respecting merge.** A re-run replaces
  agent-authored traits and keeps every `override` verbatim, per swatch for the
  palette, and never touches `note`, `id`, `source` or `capture`. The producer
  refuses to overwrite an Item file with uncommitted changes unless forced, since
  an uncommitted edit is an edit git cannot restore.
- **A migration is one numbered script and one commit**, reviewable as a diff
  before it lands and revertable after. Mixed schema versions are not a supported
  state, and a reader refuses an Item at a version it does not know rather than
  skipping it.
- **The app writes nothing.** No locking, no transactions, no migration on write
  and no concurrent-writer story exists, because none can. Transient UI state
  lives in the browser. If 010 wants a saved Mix it is a separate unit written by
  the same CLI or by hand, never by the app.
- **Deleted Items persist in history and the repo never shrinks**, and adding a
  remote is the decision to put your browsing taste somewhere other than your own
  disk. Both are accepted; a remote must be private.
- **The decision is reversible in the one direction it might need to go.**
  `library/` is self-contained with no absolute path anywhere inside it, so
  splitting it into its own repo later is one `git filter-repo --path`, and the
  app resolves `LIBRARY_DIR` before falling back to `./library`.
