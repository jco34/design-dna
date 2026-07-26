---
id: 012
title: Assemble the v1 spec
label: wayfinder:task
status: open
assignee: unassigned
blocked-by: 001, 003, 004, 005, 006, 007, 008, 009, 010, 011
parent: map
---

## Question

Nothing to decide. This is the destination, assembled.

Gather every resolution on the map into a single `SPEC.md` at the repo root
that a build session can implement without making design decisions of its own.
It must carry:

- The domain model and glossary (`CONTEXT.md`, from 001, extended by later
  tickets).
- The storage and persistence contract with its concrete schema (006).
- The producer CLI: its command surface, the capture strategy, and the write
  protocol across the boundary into the store (003, 008).
- The extraction contract as JSON Schema plus the derived Zod definition, the
  agent invocation that fills it verbatim, and the palette-fidelity decision
  (002, 004).
- The hand-written path: how an entry authored in a Claude session is placed and
  validated, since it is a first-class second producer (008).
- The taxonomy (005).
- The search and filter model with the queries it implies (009).
- Prompt generation, single and mixed, with the chosen templates (007, 010).
- The UI surface inventory and the card design (011).
- The out-of-scope list from the map, restated, so the build session does not
  helpfully add an MCP server, or an upload form, or a progress spinner. State
  plainly that **the web app is read-only and contains no AI**, because that is
  the least obvious thing about this design and the easiest to "fix" by accident.

Two checks before closing:

- **Every ticket's resolution is represented.** A decision made and then left
  out of the spec is a decision that gets remade badly at build time.
- **No gaps left for the builder to improvise.** Read it as if you were the
  build session. Anywhere you would have to invent something is either a
  missing spec section or a ticket that was closed too loosely.

Any patch of the map's "Not yet specified" that never graduated gets a short
"deliberately deferred" section in the spec, so the builder knows it was seen
and left alone rather than forgotten.

Closing this ticket reaches the destination and ends the map.
