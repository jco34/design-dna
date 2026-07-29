/**
 * Presentation helpers. Pure, isomorphic (safe on client and server).
 *
 * The prompt module turns DNA into a design brief; this turns DNA into the
 * small labels the interface shows. It never invents information the schema
 * does not hold, and it renders an approximate hex honestly (007's rule: a
 * value the agent read is shown hedged, never as exact).
 */
import type {
  Item,
  PaletteRole,
  SwatchWeight,
  TraitName,
} from "@schema";
import {
  GENRE_GLOSS,
  MOOD_GLOSS,
  STYLE_GLOSS,
  isApproximate,
  traitState,
} from "@schema";

export const PALETTE_ROLES: readonly PaletteRole[] = [
  "background",
  "surface",
  "ink",
  "muted",
  "accent",
];

/** How much horizontal room a role takes in the DNA bar, by its weight. */
const WEIGHT_FLEX: Record<SwatchWeight, number> = {
  dominant: 8,
  supporting: 3,
  occasional: 1.4,
  undetermined: 1,
};

export type Swatch = {
  role: PaletteRole;
  hex: string;
  weight: SwatchWeight;
  flex: number;
  approximate: boolean;
  determined: boolean;
};

export function swatches(item: Item): Swatch[] {
  return PALETTE_ROLES.map((role) => {
    const s = item.dna.palette[role];
    return {
      role,
      hex: s.hex,
      weight: s.weight,
      flex: WEIGHT_FLEX[s.weight],
      approximate: isApproximate(s),
      determined: s.hex !== "",
    };
  });
}

/** The hex as it should read: hedged when the agent eyeballed it. */
export function hexLabel(s: Swatch): string {
  if (!s.determined) return "unread";
  return s.approximate ? `~${s.hex}` : s.hex;
}

export const TRAIT_LABEL: Record<TraitName, string> = {
  palette: "Palette",
  typography: "Type",
  composition: "Composition",
  spacing: "Space",
  surfaceTreatment: "Surfaces",
  imagery: "Imagery",
  motion: "Motion",
  philosophy: "Philosophy",
};

/** The genre, style and mood values an Item carries, as display strings. */
export function genreLabel(item: Item): string {
  return item.dna.labels.genre.value;
}

export function styleValues(item: Item): string[] {
  return [...item.dna.labels.style.values];
}

export function moodValues(item: Item): string[] {
  return [...item.dna.labels.mood.values];
}

export function glossFor(axis: "genre" | "style" | "mood", value: string): string {
  if (axis === "genre") return GENRE_GLOSS[value as keyof typeof GENRE_GLOSS] ?? "";
  if (axis === "style") return STYLE_GLOSS[value as keyof typeof STYLE_GLOSS] ?? "";
  return MOOD_GLOSS[value as keyof typeof MOOD_GLOSS] ?? "";
}

/** A short human title for an Item, since Items have no name of their own. */
export function itemTitle(item: Item): string {
  if (item.source.kind === "url") {
    try {
      return new URL(item.source.url).hostname.replace(/^www\./, "");
    } catch {
      return item.source.url;
    }
  }
  const base = item.source.originalPath.split(/[\\/]/).pop() ?? item.source.originalPath;
  return base.replace(/\.[a-z0-9]+$/i, "");
}

export function sourceLabel(item: Item): string {
  if (item.source.kind === "url") return item.source.url;
  return item.source.originalPath;
}

export const TRAIT_ORDER: readonly TraitName[] = [
  "palette",
  "typography",
  "composition",
  "spacing",
  "surfaceTreatment",
  "imagery",
  "motion",
  "philosophy",
];

export function readTraitState(item: Item, trait: TraitName) {
  return traitState(item, trait);
}
