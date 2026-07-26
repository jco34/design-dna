---
id: 007
title: What copying the prompt actually produces
label: wayfinder:prototype
status: open
assignee: unassigned
blocked-by: 004
parent: map
---

## Question

What exact text lands on the clipboard, and does it work?

This is the payoff of the whole app: everything else exists to make this
string good. It is also the one thing that cannot be settled by discussion,
because the only real test is pasting it into Claude in a fresh project and
seeing whether what comes back looks like the design you saved.

Prototype the artifact, do not just specify it. Write three or four candidate
prompts by hand from one real captured design, paste each into a fresh session,
and compare what gets built.

Settle:

- **Form.** A prose paragraph, structured markdown with headings, a token
  block (hex values, font stacks, a spacing scale), or prose plus tokens.
  Prose carries intent, tokens carry precision, and the wrong ratio produces
  either a vague pastiche or a rigid colour-by-numbers.
- **Voice.** Is the prompt written as instructions to an AI ("build a landing
  page using..."), or as a design brief that happens to be pasteable? Does it
  assume a stack, or stay stack-agnostic as the prompt-only decision implies?
- **How much is too much.** Does naming twelve attributes produce a better
  result than naming five, or does the model drown? Test this rather than
  assuming.
- **Provenance.** Does the prompt name the source site? Useful grounding if
  the model knows the site, and a bias toward copying it if it does.
- **Generated when?** Rendered on demand from the stored analysis, or
  generated once by the agent at capture time and stored? On-demand means
  improving the template retroactively improves every item, which is a strong
  argument. Agent-written at capture time may read better. This one interacts
  with 006.
- **Is it one prompt or several?** A full-page prompt, a palette-only prompt,
  a typography-only prompt. Element-level extraction (001) makes partial
  prompts natural.

Deliverable: the candidate prompts and the pasted results under
`wayfinder/assets/007-*`, and the chosen template linked from the resolution.
