---
id: 004
title: The extraction schema, or what the agent must return
label: wayfinder:grilling
status: open
assignee: unassigned
blocked-by: 001
parent: map
---

> **Promoted 2026-07-26.** With extraction moved out of the app, this schema is
> no longer an internal detail of one program - it is the **hand-off contract**
> between the producer CLI, a Claude session writing an entry by hand, and the
> web app reading it. It is now the load-bearing ticket on the map, and 002
> unblocked it. Two findings from 002 constrain it directly; see the bottom.

## Question

Exactly which fields does a design analysis contain, and how strictly are they
typed?

This is the contract at the centre of the app. Storage stores it, search
searches it, filters filter on it, the prompt is rendered from it, and mixing
merges it. Everything downstream is shaped here, so it is worth being pedantic.

The brief names palette, typography and design philosophy explicitly, and
"etc." implicitly. Resolve what "etc." covers and what it does not.

Per candidate field, settle the type, not just the name:

- **Palette.** A flat list of hex values, or roles (background, surface, ink,
  accent, muted)? Roles make mixing and prompt rendering far better and are
  much harder for the agent to get right. Are proportions captured, given that
  a design using an accent at 2% reads nothing like one using it at 40%?
- **Typography.** Named families, or a description when the family is
  unidentifiable from a screenshot? A pairing (display plus body), the scale,
  the weight range, the tracking and leading character? What is stored when the
  agent guesses a font wrong, which it will.
- **Design philosophy.** Free prose, or prose plus structured axes (dense
  versus airy, warm versus cool, playful versus severe, flat versus
  dimensional)? Axes are filterable, prose is not. Prose carries the nuance
  that makes a prompt good.
- **What else earns a field.** Spacing and density, corner and border
  treatment, shadow and depth, motion, imagery and illustration style, layout
  and grid, iconography, texture.
- **Fields that are not the agent's to fill.** Your own note on why you saved
  it. Provenance: source URL, capture date. Confidence, where the agent is
  guessing.

Cross-cutting:

- **Strict or open?** A closed schema is filterable and predictable. An open
  bag of observations captures the thing that made this design worth saving and
  fits no column. Can both coexist without the open half becoming a dumping
  ground?
- **Nullability.** A cropped button screenshot has no typography and no
  philosophy. Are fields optional, or is there a "not applicable" that reads
  differently from "the agent missed it"?
- Whether the schema attaches to a source or an element, which is 001's answer.

## What 002 already constrains

- **Author it as JSON Schema first, Zod second.** The SDK constrains generation
  natively via `outputFormat: { type: 'json_schema', schema }` and self-retries
  on violation, which is why 002 saw zero invented and zero missing fields. That
  only works for a schema expressible as JSON Schema, so that is the real
  constraint on this design. Zod becomes a redundant check at the read boundary,
  not the primary mechanism.
- **Palette is the hard case, and not for the reason expected.** Roles are fine -
  the agent fills them. The problem is fidelity: hex values are *eyeballed, not
  sampled*, so they are consistently a few units off and **change between runs of
  the same image**. `typography.scale` was likewise unstable on identical input.
  So decide explicitly:
  - Is a palette value **"what the agent read"** (honest, approximate, and must
    never be presented as exact) or **ground truth** (which means sampling the
    actual pixels for the regions the agent names - a real CLI component, not a
    prompt tweak)?
  - Is there a **precision** or **approximate** marker on numeric traits, so 007
    can render "around #ff6b35" rather than asserting a false exact value?
  - Does instability change the **Undetermined** vs **Not applicable** design? A
    third state - read, but not reliably - may be needed, or may be one state too
    many.
- **Do not add a confidence field on the agent's word alone.** 002 showed the
  agent is well-calibrated in prose (it volunteered "no glyphs visible" rather
  than inventing a font family) but that is not the same as a trustworthy numeric
  self-score.

Deliverable: the schema as JSON Schema **and** the derived Zod definition, plus
commentary on each field's rationale and the palette-fidelity decision, and the
vocabulary added to `CONTEXT.md`.
