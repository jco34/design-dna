"use client";

import { useState } from "react";
import { FACETS, type FacetCounts, type FacetId, type FacetSelection } from "@schema";

/**
 * The filter rail. Every control subtracts from one grid (009): there is no
 * "apply". Values are OR within a facet and AND across facets, and a value
 * whose count would be zero is shown disabled rather than hidden, so the grid
 * can never be filtered into an accidental dead end. Primary facets are the
 * ones you hunt by; the secondary set is folded away until asked for.
 */
export function FilterRail({
  selection,
  counts,
  onToggle,
  onClearAll,
  activeCount,
}: {
  selection: FacetSelection;
  counts: FacetCounts;
  onToggle: (facet: FacetId, value: string) => void;
  onClearAll: () => void;
  activeCount: number;
}) {
  const [showSecondary, setShowSecondary] = useState(false);
  const primary = FACETS.filter((f) => f.tier === "primary");
  const secondary = FACETS.filter((f) => f.tier === "secondary");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <span className="tag text-muted">Filter</span>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            className="mono text-[11px] text-muted underline decoration-line-2 underline-offset-2 hover:text-ink"
          >
            clear {activeCount}
          </button>
        )}
      </div>

      {primary.map((facet) => (
        <FacetGroup
          key={facet.id}
          facetId={facet.id}
          label={facet.label}
          values={facet.values}
          selected={selection[facet.id] ?? []}
          counts={counts[facet.id] ?? {}}
          onToggle={onToggle}
        />
      ))}

      <div className="border-t border-line pt-4">
        <button
          type="button"
          onClick={() => setShowSecondary((v) => !v)}
          className="mono flex w-full items-center justify-between text-[11px] text-muted hover:text-ink"
        >
          <span>{showSecondary ? "hide" : "more"} traits</span>
          <span className="text-faint">{showSecondary ? "-" : "+"}</span>
        </button>
        {showSecondary && (
          <div className="mt-5 flex flex-col gap-6">
            {secondary.map((facet) => (
              <FacetGroup
                key={facet.id}
                facetId={facet.id}
                label={facet.label}
                values={facet.values}
                selected={selection[facet.id] ?? []}
                counts={counts[facet.id] ?? {}}
                onToggle={onToggle}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FacetGroup({
  facetId,
  label,
  values,
  selected,
  counts,
  onToggle,
}: {
  facetId: FacetId;
  label: string;
  values: readonly string[];
  selected: readonly string[];
  counts: Record<string, number>;
  onToggle: (facet: FacetId, value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="tag text-faint">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {values.map((value) => {
          const isSelected = selected.includes(value);
          const count = counts[value] ?? 0;
          const disabled = count === 0 && !isSelected;
          return (
            <button
              key={value}
              type="button"
              disabled={disabled}
              aria-pressed={isSelected}
              onClick={() => onToggle(facetId, value)}
              className={[
                "group inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] transition-colors duration-150",
                isSelected
                  ? "border-invert-bg bg-invert-bg text-invert-ink"
                  : disabled
                    ? "cursor-not-allowed border-line text-faint opacity-45"
                    : "border-line-2 text-ink-2 hover:border-ink hover:text-ink",
              ].join(" ")}
            >
              <span>{prettyValue(value)}</span>
              <span
                className={[
                  "mono text-[10px]",
                  isSelected ? "text-invert-ink/70" : "text-faint",
                ].join(" ")}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function prettyValue(value: string): string {
  if (value === "none") return "none";
  if (value === "not-applicable") return "n/a";
  return value.replace(/-/g, " ");
}
