---
id: 012
title: Assemble the v1 spec
label: wayfinder:task
status: closed
assignee: jeb
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

## Resolution

**[`SPEC.md`](../../SPEC.md) is written at the repo root, gathering all eleven
prior resolutions into one buildable document, and this closes the map.**

### The two checks the ticket required

- **Every ticket's resolution is represented.** SPEC.md has a numbered section
  per decision area: the two-program architecture (008), the domain model (001,
  extended), the extraction contract and palette fidelity (002, 004), the
  taxonomy (005), storage (006), the producer CLI and capture (003, 008), prompt
  generation single and mixed (007, 010), search and filter (009), the UI
  surfaces and card (011), the restated out-of-scope list, the deliberately
  deferred patches, and a build order. Every closed ticket 001-011 is cited in
  at least one section.
- **No gaps left for the builder to improvise.** The spec points at `schema/` as
  the authoritative running code rather than paraphrasing it, states plainly and
  first that the app is read-only and contains no AI, and carries a "deliberately
  deferred" section so the five ungraduated "Not yet specified" patches read as
  seen-and-left rather than forgotten.

### What changed during assembly, beyond gathering

Assembling the spec required one real integration that no single ticket owned:
reconciling 004's provisional flat `labels` array with 005's three-axis object in
the actual shared module. That was done in `schema/` (not left as prose): `Dna`
and `ExtractedDna` now carry 005's `Labels`, the Item carries `taxonomyVersion`,
and `Scope` is re-exported from the taxonomy. The module typechecks under zod
4.4.3, and `schema/check-library.ts` validates the five seed Items. The spec
records `schema/` as authoritative over the `wayfinder/assets/00N-*` files, which
remain the record of how each decision was reached.

### What was not verified

- The spec is complete against the tickets, but it has not been read back by an
  independent build session, which is the only real test that "no gaps remain".
  The build order in section 12 is the suggested path, not a validated one.
- The producer `dna` binary is specified but not implemented; only the capture
  step exists (`seed/capture.mjs`) and the validator (`schema/check-library.ts`).
  The app and the schema module are built and running; the CLI is the one program
  the map specified and left for the build session.
