---
id: 006
title: Storage and persistence contract
label: wayfinder:grilling
status: open
assignee: unassigned
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
