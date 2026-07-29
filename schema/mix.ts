/**
 * Design DNA - the mixed prompt.
 *
 * Ticket 010. `renderMix(parts)` returns exactly the string the copy button on
 * the mix surface puts on the clipboard, given a set of (Item, Trait)
 * selections drawn from several Items.
 *
 * The central move of this ticket is in the type, not in the function.
 *
 *   A Mix is a partial map from Trait to Item: at most one Item per trait.
 *
 * That is `MixRack` below, and it is what makes same-trait conflict
 * unrepresentable rather than resolved. Two selected palettes cannot exist, so
 * there is no rule for merging them, and 001 decision 7 is what forbids the
 * merge: a palette "is coherent through the relationships between its colours
 * and one value pulled out of it carries none of that". A primary/accent split
 * across two items is sub-trait selection wearing a disguise, and sub-trait
 * selection is already refused.
 *
 * Three properties inherited from 007 and not re-implemented here:
 *
 *   Pure.        No I/O, no clock, no locale, no randomness. Same parts, same
 *                bytes, on every machine, forever.
 *
 *   Mechanical.  Nothing is synthesised. The map locks that no AI runs inside
 *                the web app, so there is no reconciliation pass and no
 *                agent round trip; there could not be one. Every sentence in
 *                the output was written by the agent about one design, or by
 *                this file about the mix.
 *
 *   One template. Every trait section comes from 007's `renderPrompt`, called
 *                once per slot with a one-trait subset. This file adds a frame,
 *                a label on the intent paragraph, and a provenance block. It
 *                renders no trait content of its own, so 007's hedging,
 *                silence and enum-English rules cannot drift away from it.
 *
 * Deliberately absent: the Note. 001's hand-off to 007 says a mix never carries
 * notes, "since your reason for saving item A says nothing about the traits
 * taken from B and C". Also absent: labels, which are never mixed, and
 * Scope, which no longer has a single value once there is more than one donor.
 *
 * Depends on `004-extraction-schema.ts` and `007-prompt-template.ts`.
 */
import type { Item, TraitName } from './dna';
import { traitState } from './dna';
import { renderPrompt } from './prompt';

/* ------------------------------------------------------------------ */
/* Public surface                                                      */
/* ------------------------------------------------------------------ */

/** One selection: this trait, taken whole, from this Item. */
export interface MixPart {
  readonly trait: TraitName;
  readonly item: Item;
}

/**
 * The canonical form of a Mix. At most one Item per trait, so the same trait
 * can never appear twice. The UI's slot rack is this object; the URL is this
 * object serialised as `trait:itemId` pairs.
 */
export type MixRack = Partial<Record<TraitName, Item>>;

/**
 * Canonical section order, and it is 007's order with `philosophy` moved from
 * first to last.
 *
 * In a single-Item prompt the intent paragraph leads, because every fact under
 * it was read off the same design and it frames them correctly. In a Mix it
 * cannot lead, because the facts under it come from designs it has never seen,
 * and an unlabelled lead paragraph would silently claim authorship of six
 * sections it does not describe. 007 decision 9 already established the shape
 * of the fix for a block that speaks for something other than this brief: give
 * it a label and move it out of the lead. That is what the Note gets, and it is
 * what the intent paragraph gets here.
 */
export const MIX_TRAIT_ORDER: readonly TraitName[] = [
  'palette',
  'typography',
  'composition',
  'spacing',
  'surfaceTreatment',
  'imagery',
  'motion',
  'philosophy',
];

/**
 * The number of distinct donor Items at which the UI should say something.
 *
 * This is a judgement call and it is named as one in the model note. There is
 * no measurement behind it: the structural cap is seven, one per slot, and
 * nothing in the data can tell you whether four designs have stopped being one
 * design language. It is an advisory and never a refusal.
 */
export const MANY_SOURCES_ADVISORY_AT = 4;

/**
 * What the mix surface shows beside the rack. Never rendered into the prompt:
 * the clipboard artifact must not contain a sentence about the state of the
 * library. 011 may reword `message`; the shape is what it can rely on.
 */
export type MixAdvisory =
  | { kind: 'empty'; message: string }
  | {
      kind: 'duplicate-trait';
      trait: TraitName;
      keptItemId: string;
      droppedItemIds: readonly string[];
      message: string;
    }
  | {
      kind: 'unreadable-trait';
      trait: TraitName;
      itemId: string;
      state: 'undetermined' | 'not_applicable';
      message: string;
    }
  | { kind: 'intent-crosses-sources'; itemId: string; message: string }
  | { kind: 'many-sources'; count: number; message: string };

/* ------------------------------------------------------------------ */
/* Normalisation: the slot rule, applied                               */
/* ------------------------------------------------------------------ */

/**
 * Collapse a selection list into the rack. Last wins, because the gesture is a
 * replacement: choosing a palette while a palette is already in the rack puts
 * the new one in the slot and turns the old one out. The UI shows that at the
 * moment it happens; this function exists for the other entry point, which is
 * a hand-edited or stale URL.
 *
 * `replaced` is every part that lost its slot, in input order.
 */
export function mixRack(parts: readonly MixPart[]): {
  rack: MixRack;
  replaced: readonly MixPart[];
} {
  const rack: MixRack = {};
  const replaced: MixPart[] = [];
  for (const part of parts) {
    const sitting = rack[part.trait];
    if (sitting !== undefined) replaced.push({ trait: part.trait, item: sitting });
    rack[part.trait] = part.item;
  }
  return { rack, replaced };
}

/** The filled slots, in canonical order. */
function filledSlots(rack: MixRack): { trait: TraitName; item: Item }[] {
  const out: { trait: TraitName; item: Item }[] = [];
  for (const trait of MIX_TRAIT_ORDER) {
    const item = rack[trait];
    if (item !== undefined) out.push({ trait, item });
  }
  return out;
}

/** Distinct donors, in the order their first readable slot appears. */
function donors(slots: readonly { trait: TraitName; item: Item }[]): Item[] {
  const seen = new Set<string>();
  const out: Item[] = [];
  for (const slot of slots) {
    if (seen.has(slot.item.id)) continue;
    seen.add(slot.item.id);
    out.push(slot.item);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Advisories                                                          */
/* ------------------------------------------------------------------ */

/**
 * What the app can honestly say about a Mix without a model.
 *
 * The ticket asks whether the app points out a conflict, picks, or hands the
 * mess to the model and hopes. The answer splits in two, and only the first
 * half is a conflict the app can see:
 *
 *   Same-trait conflict is structurally impossible. There is one slot per
 *   trait, so there is nothing to point out and nothing to merge.
 *
 *   Cross-trait contradiction is real and the app cannot detect it. Deciding
 *   that a paragraph about a warm paper field disagrees with a near-black
 *   palette is a reading task, and the map locks that no AI runs inside the
 *   web app. So the app does the two things it can: it flags the one
 *   over-reach that is structural rather than semantic, and the frame tells
 *   the receiving model the truth, which is that these parts were never seen
 *   together. That is not hoping. It is handing over a mess labelled as one.
 */
export function mixAdvisories(parts: readonly MixPart[]): MixAdvisory[] {
  const { rack, replaced } = mixRack(parts);
  const slots = filledSlots(rack);
  const out: MixAdvisory[] = [];

  if (slots.length === 0) {
    return [{ kind: 'empty', message: 'Nothing is in the mix yet.' }];
  }

  for (const trait of MIX_TRAIT_ORDER) {
    const dropped = replaced.filter((p) => p.trait === trait).map((p) => p.item.id);
    const kept = rack[trait];
    if (dropped.length === 0 || kept === undefined) continue;
    out.push({
      kind: 'duplicate-trait',
      trait,
      keptItemId: kept.id,
      droppedItemIds: dropped,
      message: `Only one item can fill the ${TRAIT_ENGLISH[trait]} slot. The most recent choice is the one in the mix.`,
    });
  }

  for (const slot of slots) {
    const state = traitState(slot.item, slot.trait);
    if (state === 'present') continue;
    out.push({
      kind: 'unreadable-trait',
      trait: slot.trait,
      itemId: slot.item.id,
      state,
      message:
        state === 'not_applicable'
          ? `This item's scope has no ${TRAIT_ENGLISH[slot.trait]}, so the slot adds nothing to the prompt.`
          : `The analysis could not read ${TRAIT_ENGLISH[slot.trait]} on this item, so the slot adds nothing to the prompt.`,
    });
  }

  const readable = slots.filter((s) => traitState(s.item, s.trait) === 'present');
  const sources = donors(readable);

  const intent = readable.find((s) => s.trait === 'philosophy');
  if (intent !== undefined && readable.some((s) => s.item.id !== intent.item.id)) {
    out.push({
      kind: 'intent-crosses-sources',
      itemId: intent.item.id,
      message:
        'This paragraph describes that whole design, including the parts you took from somewhere else. It is the one place a mix can contradict itself.',
    });
  }

  if (sources.length >= MANY_SOURCES_ADVISORY_AT) {
    out.push({
      kind: 'many-sources',
      count: sources.length,
      message: `This mix draws on ${sources.length} designs. Nothing stops you, but past three the brief starts describing a committee rather than a design.`,
    });
  }

  return out;
}

/* ------------------------------------------------------------------ */
/* The render                                                          */
/* ------------------------------------------------------------------ */

export function renderMix(parts: readonly MixPart[]): string {
  const { rack } = mixRack(parts);
  const slots = filledSlots(rack);

  if (slots.length === 0) return 'Nothing is selected for this mix.';

  const readable = slots.filter((s) => traitState(s.item, s.trait) === 'present');
  if (readable.length === 0) {
    return `This mix has nothing readable to say about ${list(slots.map((s) => TRAIT_ENGLISH[s.trait]))}.`;
  }

  const sources = donors(readable);

  // A Mix of one is exactly 007's subset prompt, and it must be, because the
  // mixed frame below would otherwise assert that this brief was assembled
  // from several designs when it was read off one. Delegating rather than
  // branching also keeps the Scope clause, which 007's frame carries correctly
  // when there is exactly one design and cannot carry at all when there are
  // several. The Note stays suppressed: a mix never carries one, whatever its
  // size.
  if (sources.length === 1) {
    return renderPrompt(sources[0]!, {
      traits: readable.map((s) => s.trait),
      includeNote: false,
      includeSource: true,
    });
  }

  const blocks: string[] = [mixFrame(readable.map((s) => s.trait))];

  for (const slot of readable) {
    const body = traitSection(slot.item, slot.trait);
    if (body === null) continue;
    blocks.push(slot.trait === 'philosophy' ? `${INTENT_LABEL}\n${body}` : body);
  }

  blocks.push(mixProvenance(sources));
  return blocks.join('\n\n');
}

/* ------------------------------------------------------------------ */
/* The frame                                                           */
/* ------------------------------------------------------------------ */

/**
 * One imperative, as in 007, and it is about the block rather than about what
 * to build. The clause that matters is "were never seen together": it is the
 * only defence this artifact has against the failure mode 010 exists to
 * prevent, which is the receiving model quietly reconciling the parts into a
 * pastiche of whichever source spoke loudest.
 *
 * Scope is deliberately not carried. 007's frame names it because a
 * single-Item prompt has exactly one, and it explains what the brief leaves
 * out. A Mix has one Scope per donor, and the trait list does that job better.
 */
function mixFrame(traits: readonly TraitName[]): string {
  const rest = traits.length < MIX_TRAIT_ORDER.length ? ' The rest is yours to choose.' : '';
  return (
    `Design brief, assembled from several designs rather than read off one. ` +
    `It covers ${list(traits.map((t) => TRAIT_ENGLISH[t]))}. ` +
    `These parts were chosen separately and were never seen together, so work them into ` +
    `one coherent design rather than reproducing any of the sources.${rest}`
  );
}

/**
 * The intent paragraph is the one block in a mixed brief that speaks for a
 * design rather than for this brief, so it says so on the line above itself.
 */
const INTENT_LABEL = 'Intent, taken from one of the sources and describing that whole design';

/* ------------------------------------------------------------------ */
/* Trait sections, borrowed whole from 007                             */
/* ------------------------------------------------------------------ */

/**
 * One trait section, rendered by 007 and lifted out of its frame.
 *
 * This is the mechanism that makes "the same code path" true rather than
 * aspirational: the palette hedges per swatch, an Undetermined leaf is silent,
 * and every enum member renders as the English 004 defined it with, because
 * none of that logic exists in this file to be got wrong.
 *
 * The seam is a string operation, and it is the ugliest thing in this ticket.
 * It relies on one property of 007's output: blocks are joined with a blank
 * line and no single block contains one. A one-trait render with no Note and
 * no Source is therefore exactly two blocks, frame then section, or one block
 * when the trait is not readable.
 *
 * **The better shape, deliberately not taken:** 007 exports
 * `renderTraitSection(item, trait)` and this function is one call. That is a
 * change to a closed ticket's artifact, so it is recommended in the model note
 * rather than made here. Duplicating 007's seven section renderers was the
 * third option and is the one thing this ticket must not do, since a mixed
 * palette that hedges differently from a single palette is exactly the drift
 * 007 decision 8 refused to allow.
 */
function traitSection(item: Item, trait: TraitName): string | null {
  const rendered = renderPrompt(item, {
    traits: [trait],
    includeNote: false,
    includeSource: false,
  });
  const blocks = rendered.split('\n\n');
  if (blocks.length < 2) return null;
  return blocks.slice(1).join('\n\n');
}

/* ------------------------------------------------------------------ */
/* Provenance                                                          */
/* ------------------------------------------------------------------ */

/**
 * Every contributing Source, once each, last, and defused in one clause.
 *
 * 007 put the URL last so that a model which recognises the site would not
 * answer from memory of it and make the whole extraction apparatus decorative.
 * A mix multiplies that risk rather than dividing it, since a reader who
 * recognises one of three sites will happily rebuild that one. So the clause
 * is kept and widened to all of them.
 *
 * Capture dates are dropped. In a single prompt one date is grounding; in a
 * mix, three dates are a changelog, and the thing worth tracing a mix back to
 * is the mix URL, which the app holds anyway.
 *
 * A local path is never rendered, for 007's reasons: it is noise to the reader
 * and a leak of your directory structure to whoever you paste in front of.
 */
function mixProvenance(sources: readonly Item[]): string {
  const named: string[] = [];
  for (const item of sources) {
    const url = item.source.url;
    const phrase = url === null ? 'an image supplied by hand' : url;
    if (!named.includes(phrase)) named.push(phrase);
  }
  return (
    `Assembled from ${list(named)}. ` +
    `Provenance only: work from the description above rather than from memory of any of these designs.`
  );
}

/* ------------------------------------------------------------------ */
/* Plain-text helpers                                                  */
/* ------------------------------------------------------------------ */

/**
 * Duplicated from 007, which does not export it. Seven entries and one
 * three-line joiner, kept verbatim so the two files cannot describe the same
 * trait in two ways. The fix is the same one named on `traitSection`: 007
 * exports these and this block disappears.
 */
const TRAIT_ENGLISH: Record<TraitName, string> = {
  palette: 'the colour system',
  typography: 'the type system',
  composition: 'the composition',
  spacing: 'the spacing',
  surfaceTreatment: 'the surface treatment',
  imagery: 'the imagery',
  motion: 'the motion',
  philosophy: 'the design intent',
};

function list(items: readonly string[]): string {
  if (items.length === 0) return 'nothing';
  if (items.length === 1) return items[0]!;
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]!}`;
}
