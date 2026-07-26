# Wayfinder tracker (local markdown)

No issue tracker is configured for this repo, so this folder *is* the tracker.

## Layout

- `map.md` is the map (label `wayfinder:map`). It is an index, loaded once per session.
- `tickets/NNN-slug.md` are the child tickets of the map.

## Wayfinding operations

**The frontier** (what is takeable right now): every ticket where
`status: open`, `assignee: unassigned`, and every id in `blocked-by` has
`status: closed`.

```bash
grep -l "status: open" wayfinder/tickets/*.md
```

**Claim a ticket:** set `assignee:` to the dev driving the map *before* doing
any work, so a concurrent session skips it.

**Blocking:** the `blocked-by:` frontmatter field, holding a comma-separated
list of ticket ids, or `none`. Markdown has no native dependency relation, so
this body convention stands in for one.

**Resolve a ticket:** append a `## Resolution` section to the ticket file, flip
`status:` to `closed`, then append one line to the map's "Decisions so far"
pointing at the ticket. Assets created while resolving (prototypes, research
notes) are linked from the ticket, never pasted into it.

**Never resolve more than one ticket per session.**
