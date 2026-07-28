/**
 * The URL is the state. Pure helpers, no React.
 *
 * Two independent concerns share one query string:
 *   - the library Query (009): `q`, `sort`, `c`, `ct`, `f.<facet>`
 *   - the Mix rack (010): `mix`, a list of `trait:itemId` pairs
 *
 * They are patched independently so changing a filter never disturbs the rack
 * and adding a trait never disturbs the filters. 009 owns `encodeQuery` and
 * `decodeQuery`; this module only has to keep the two families of keys from
 * treading on each other.
 */
import {
  EMPTY_QUERY,
  FACETS,
  decodeQuery,
  encodeQuery,
  type Item,
  type MixPart,
  type Query,
  type TraitName,
} from "@schema";

const QUERY_KEYS = new Set<string>([
  "q",
  "sort",
  "c",
  "ct",
  ...FACETS.map((f) => `f.${f.id}`),
]);

export function readQuery(search: string): Query {
  return decodeQuery(search);
}

/** Replace the Query-owned keys in `current`, leaving everything else intact. */
export function withQuery(current: URLSearchParams, query: Query): URLSearchParams {
  const next = new URLSearchParams(current.toString());
  for (const key of [...next.keys()]) {
    if (QUERY_KEYS.has(key)) next.delete(key);
  }
  const encoded = new URLSearchParams(encodeQuery(query));
  for (const [key, value] of encoded) next.set(key, value);
  return next;
}

export const MIX_TRAITS: readonly TraitName[] = [
  "palette",
  "typography",
  "composition",
  "spacing",
  "surfaceTreatment",
  "imagery",
  "philosophy",
];

const isTrait = (value: string): value is TraitName =>
  (MIX_TRAITS as readonly string[]).includes(value);

/** Parse the `mix` param into parts, dropping any Item no longer in the library. */
export function readMix(
  search: string,
  itemsById: ReadonlyMap<string, Item>,
): { parts: MixPart[]; dropped: number } {
  const raw = new URLSearchParams(search).get("mix");
  if (!raw) return { parts: [], dropped: 0 };
  const parts: MixPart[] = [];
  let dropped = 0;
  for (const token of raw.split(",")) {
    const [trait, id] = token.split(":");
    if (!trait || !id || !isTrait(trait)) continue;
    const item = itemsById.get(id);
    if (!item) {
      dropped += 1;
      continue;
    }
    parts.push({ trait, item });
  }
  return { parts, dropped };
}

export function withMix(current: URLSearchParams, parts: readonly MixPart[]): URLSearchParams {
  const next = new URLSearchParams(current.toString());
  if (parts.length === 0) {
    next.delete("mix");
  } else {
    next.set("mix", parts.map((p) => `${p.trait}:${p.item.id}`).join(","));
  }
  return next;
}

export const CLEARED_QUERY: Query = EMPTY_QUERY;
