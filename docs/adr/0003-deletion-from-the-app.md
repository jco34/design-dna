---
status: accepted
supersedes-in-part: 0002
---

# The app may delete an Item, and that is the only thing it may write

[ADR 0002](0002-library-as-committed-files.md) established the library as a
committed folder written by two producers, and
[ticket 008](../../wayfinder/tickets/008-producer-cli-and-import-boundary.md)
stated the boundary absolutely: the app reads and never writes. We decided to
**revise that to allow exactly one write, deletion, performed from the item
detail surface behind a confirmation dialog.** Everything else stays as it was.

The reasoning that removed writing from the app was about ingest specifically,
not about writing in general. 008's re-charter killed in-app ingest because
capturing and extracting needs a headless browser, an agent subprocess, and the
18 to 48 seconds ticket 002 measured, which together force an asynchronous job
model: a queue, per-item `pending` and `failed` states, progress indication, and
a waiting state to design. 008 rejected all of that and was right to. **Deletion
shares none of those properties.** It is two `unlink` calls. It is synchronous,
it needs no agent, it has no intermediate state to render, and it cannot leave a
half-written record behind, because it writes nothing: the only failure mode is
that one of the two files is already gone, which is indistinguishable from
success. Applying a rule derived from ingest's cost model to an operation with
none of ingest's cost is cargo-culting the conclusion past its premise.

The alternative was `dna delete <id>` in the CLI, which we rejected because it
puts the confirmation in the wrong place. Deleting the wrong design is a
recognition failure, not a typing failure: you decide from the capture, the
philosophy paragraph and the note, which is to say from the item detail surface.
A terminal prompt showing an opaque id such as `20260729T104855Z-h4uzyt` cannot
show you what you are about to destroy, so it asks you to confirm a decision it
has given you no means to check. Confirming next to the capture is a materially
safer act than confirming next to an id.

## What contains the revision

The blast radius is deliberately narrow, and each of these is a constraint rather
than a description:

- **One file writes.** `web/lib/mutate.ts` holds the only write in the app.
  `web/lib/library.ts` stays a pure reader and its docstring stays true, so "does
  the app write?" has a one-file answer rather than requiring a grep.
- **Deletion is the only mutation that file will hold.** Adding an Item still
  belongs to `dna add`, for exactly the reasons 008 gave. Editing a trait is an
  Override and belongs to the producer.
- **Loopback only.** The endpoint has no authentication because this is a
  single-user local tool, so it refuses any request whose `Host` is not loopback.
  Without that, `next start` on a machine with an open port would expose an
  unauthenticated endpoint that destroys design work.
- **Two independent path-traversal defences.** The id must match `dna check` rule
  12's `[0-9A-Za-z-]` alphabet, which cannot express `..` at all, and every
  resolved path is separately checked to be inside the directory it belongs to.
  The id arrives from a URL segment and is interpolated into a filesystem path,
  which is the classic shape of this bug; one defence being subtly wrong is
  survivable, both being wrong is not.
- **The Capture filename comes from the record**, not from `<id>.png`. Assuming
  would be correct for every Item the CLI has written and wrong for a hand-written
  one that named its Capture differently, and the cost of guessing is an orphaned
  PNG that nothing references.
- **The Capture is unlinked first.** A crash between the two unlinks then leaves
  an Item pointing at a missing Capture, which `dna check` reports loudly. The
  other order leaves an orphaned PNG, which is quieter and so easier to never
  notice.

## What the dialog owes the reader

The confirmation is not a speed bump, and "are you sure?" would have been one. It
does three jobs:

It **names what is going**, by source and by both filenames, so a misclick on the
wrong card is visible before it is permanent.

It **tells a conditional truth about recovery.** A committed Item is restorable
with `git checkout library/`; an Item that has never been committed is not
restorable at all. A flat "this cannot be undone" would be wrong for the first
case, and false reassurance in either direction is worse than none. ADR 0002
makes git the version store, so the honest sentence has to mention it.

It **makes the safe path the fast one.** Cancel takes initial focus, Escape
cancels, focus is trapped in the dialog, and Delete is never what Enter presses
by default.

The dialog also says out loud why the capture is the part worth pausing over:
`dna check` already refuses to delete an orphaned Capture on the grounds that it
is the only irreplaceable thing in the library, because the design it photographed
may have been redesigned or taken offline since. That reasoning does not stop
applying because a human clicked the button; it is the reason there is a dialog.

## Consequences

- `library/README.md` and the root `AGENTS.md` said the app writes nothing and
  that finding it modifying `library/` is a bug. Both are corrected rather than
  left to contradict the code.
- 008's list of things ruled out for the read-only app stands unchanged. This adds
  no queue, no `pending` state, no progress UI and no waiting state, because
  deletion needs none of them.
- A deletion leaves no trace in the library itself. The record of what was removed
  is the git history, which is what ADR 0002 already made the version store.
