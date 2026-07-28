"use client";

import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  COLOUR_TOLERANCE,
  EMPTY_QUERY,
  SORTS,
  explainEmpty,
  facetCounts,
  runQuery,
  type FacetId,
  type Item,
  type Query,
  type SortId,
} from "@schema";
import { readMix, readQuery, withMix, withQuery } from "@/lib/url-state";
import { Card } from "./card";
import { FilterRail } from "./filter-rail";
import { MixPanel } from "./mix-panel";

export function LibraryView({ items }: { items: Item[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  const itemsById = useMemo(
    () => new Map(items.map((item) => [item.id, item] as const)),
    [items],
  );

  const query = useMemo(() => readQuery(search), [search]);
  const { parts: mixParts } = useMemo(
    () => readMix(search, itemsById),
    [search, itemsById],
  );
  const mixOpen = searchParams.get("mix") !== null || searchParams.get("rack") === "1";

  const result = useMemo(() => runQuery(items, query), [items, query]);
  const counts = useMemo(() => facetCounts(items, query), [items, query]);

  const activeFacetCount = useMemo(
    () => Object.values(query.facets).reduce((n, v) => n + (v?.length ?? 0), 0),
    [query.facets],
  );

  const commit = useCallback(
    (next: URLSearchParams) => {
      const qs = next.toString();
      router.replace(qs ? `/?${qs}` : "/", { scroll: false });
    },
    [router],
  );

  const setQuery = useCallback(
    (next: Query) => commit(withQuery(new URLSearchParams(search), next)),
    [commit, search],
  );

  const toggleFacet = useCallback(
    (facet: FacetId, value: string) => {
      const current = query.facets[facet] ?? [];
      const has = current.includes(value);
      const nextValues = has
        ? current.filter((v) => v !== value)
        : [...current, value];
      const facets = { ...query.facets };
      if (nextValues.length === 0) delete facets[facet];
      else facets[facet] = nextValues;
      setQuery({ ...query, facets });
    },
    [query, setQuery],
  );

  const setRackOpen = useCallback(
    (open: boolean) => {
      const next = new URLSearchParams(search);
      if (open) next.set("rack", "1");
      else next.delete("rack");
      commit(next);
    },
    [commit, search],
  );

  const removeTrait = useCallback(
    (trait: string) => {
      const remaining = mixParts.filter((p) => p.trait !== trait);
      commit(withMix(new URLSearchParams(search), remaining));
    },
    [commit, mixParts, search],
  );

  const clearMix = useCallback(() => {
    const next = withMix(new URLSearchParams(search), []);
    next.delete("rack");
    commit(next);
  }, [commit, search]);

  const filledTraitCount = new Set(mixParts.map((p) => p.trait)).size;

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col">
      <TopBar
        query={query}
        total={result.total}
        showing={result.items.length}
        onSearch={(text) => setQuery({ ...query, text })}
        onColour={(hex) =>
          setQuery({
            ...query,
            colour: hex ? { hex, tolerance: COLOUR_TOLERANCE.near } : null,
          })
        }
        onSort={(sort) => setQuery({ ...query, sort })}
        mixCount={filledTraitCount}
        onOpenMix={() => setRackOpen(true)}
      />

      <div className="flex gap-8 px-5 pb-16 pt-6 lg:px-8">
        <aside className="sticky top-[73px] hidden h-fit w-56 shrink-0 md:block">
          <FilterRail
            selection={query.facets}
            counts={counts}
            onToggle={toggleFacet}
            onClearAll={() => setQuery({ ...EMPTY_QUERY, text: query.text, sort: query.sort })}
            activeCount={activeFacetCount}
          />
        </aside>

        <main className="min-w-0 flex-1">
          {result.items.length === 0 ? (
            <EmptyState
              hasLibrary={items.length > 0}
              query={query}
              relaxations={explainEmpty(items, query)}
              onReset={() => setQuery(EMPTY_QUERY)}
            />
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {result.items.map((item) => (
                <Card
                  key={item.id}
                  item={item}
                  colourMatch={result.colourMatches.get(item.id)}
                  href={`/item/${item.id}${search ? `?${search}` : ""}`}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      {mixOpen && (
        <>
          <button
            type="button"
            aria-label="Close mix"
            onClick={() => setRackOpen(false)}
            className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          />
          <div className="fixed right-0 top-0 z-40 h-full w-[380px] max-w-[90vw] border-l border-line shadow-[var(--shadow-lift)]">
            <MixPanel
              parts={mixParts}
              onRemove={removeTrait}
              onClear={clearMix}
              onClose={() => setRackOpen(false)}
            />
          </div>
        </>
      )}
    </div>
  );
}

function TopBar({
  query,
  total,
  showing,
  onSearch,
  onColour,
  onSort,
  mixCount,
  onOpenMix,
}: {
  query: Query;
  total: number;
  showing: number;
  onSearch: (text: string) => void;
  onColour: (hex: string | null) => void;
  onSort: (sort: SortId) => void;
  mixCount: number;
  onOpenMix: () => void;
}) {
  const colour = query.colour?.hex ?? null;
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur-md">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-3 lg:px-8">
        <a href="/" className="flex shrink-0 items-baseline gap-2">
          <span className="tag text-[13px] tracking-[0.14em] text-ink">DESIGN DNA</span>
        </a>

        <div className="order-3 flex min-w-[240px] flex-1 items-center gap-2 lg:order-2">
          <div className="flex flex-1 items-center gap-2 rounded-md border border-line-2 bg-field px-3 py-1.5 focus-within:border-ink">
            <span className="mono text-[13px] text-faint">/</span>
            <input
              value={query.text}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="search philosophy, notes, source, fonts, or a #hex"
              spellCheck={false}
              className="mono w-full bg-transparent text-[13px] text-ink placeholder:text-faint focus:outline-none"
            />
            <label
              className="relative h-5 w-5 shrink-0 cursor-pointer rounded ring-1 ring-line-2"
              style={{
                background:
                  colour ??
                  "repeating-linear-gradient(45deg, var(--line-2) 0 3px, transparent 3px 7px)",
              }}
              title="Filter by colour"
            >
              <input
                type="color"
                value={colour ?? "#808080"}
                onChange={(e) => onColour(e.target.value)}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </label>
            {colour && (
              <button
                type="button"
                onClick={() => onColour(null)}
                className="mono shrink-0 text-[11px] text-faint hover:text-ink"
              >
                clear
              </button>
            )}
          </div>
        </div>

        <div className="order-2 flex shrink-0 items-center gap-4 lg:order-3">
          <span className="mono hidden text-[11px] text-muted sm:inline">
            {showing} / {total}
          </span>
          <select
            value={query.sort}
            onChange={(e) => onSort(e.target.value as SortId)}
            className="mono rounded-md border border-line-2 bg-field px-2 py-1.5 text-[12px] text-ink-2 focus:border-ink focus:outline-none"
            aria-label="Sort order"
          >
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={onOpenMix}
            className="inline-flex items-center gap-1.5 rounded-md border border-line-2 px-3 py-1.5 hover:border-ink"
          >
            <span className="mono text-[12px] text-ink">Mix</span>
            <span
              className={[
                "mono min-w-5 rounded-full px-1.5 text-center text-[11px]",
                mixCount > 0 ? "bg-invert-bg text-invert-ink" : "text-faint",
              ].join(" ")}
            >
              {mixCount}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}

function EmptyState({
  hasLibrary,
  query,
  relaxations,
  onReset,
}: {
  hasLibrary: boolean;
  query: Query;
  relaxations: ReturnType<typeof explainEmpty>;
  onReset: () => void;
}) {
  const filtering =
    query.text !== "" ||
    query.colour !== null ||
    Object.values(query.facets).some((v) => (v?.length ?? 0) > 0);

  if (!hasLibrary) {
    return (
      <div className="mx-auto max-w-md rounded-lg border border-dashed border-line-2 bg-panel px-8 py-16 text-center">
        <p className="tag text-muted">Empty library</p>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
          Nothing has been saved yet. Items are written by the producer, not from
          inside this app: run the <span className="mono text-ink">dna add</span>{" "}
          command against a URL or an image, and it will appear here.
        </p>
      </div>
    );
  }

  if (!filtering) return null;

  return (
    <div className="mx-auto max-w-md rounded-lg border border-dashed border-line-2 bg-panel px-8 py-14 text-center">
      <p className="tag text-muted">No matches</p>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
        Nothing in the library matches every filter at once.
      </p>
      {relaxations.length > 0 && (
        <ul className="mt-4 flex flex-col gap-1.5 text-left">
          {relaxations.slice(0, 3).map((r, i) => (
            <li key={i} className="mono text-[12px] text-muted">
              clear {r.label.toLowerCase()} to show {r.wouldShow}
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={onReset}
        className="mono mt-6 rounded-md border border-line-2 px-3 py-1.5 text-[12px] text-ink hover:bg-surface"
      >
        clear all filters
      </button>
    </div>
  );
}
