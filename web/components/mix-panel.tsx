"use client";

import { useMemo } from "react";
import {
  mixAdvisories,
  mixRack,
  renderMix,
  type MixPart,
  type TraitName,
} from "@schema";
import { MIX_TRAITS } from "@/lib/url-state";
import { TRAIT_LABEL, itemTitle } from "@/lib/display";
import { CopyButton } from "./copy-button";

/**
 * The mix rack. A persistent set of seven named slots, not a cart (010): a Mix
 * is a partial map from trait to Item, so a slot holds at most one donor and
 * filling a full slot replaces its occupant. The rendered brief is shown before
 * it is copied, because a mix is the one artifact whose text you cannot predict
 * from what you clicked. Advisories sit beside the rack and never enter the
 * prompt.
 */
export function MixPanel({
  parts,
  onRemove,
  onClear,
  onClose,
}: {
  parts: MixPart[];
  onRemove: (trait: TraitName) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const { rack } = useMemo(() => mixRack(parts), [parts]);
  const advisories = useMemo(() => mixAdvisories(parts), [parts]);
  const filled = MIX_TRAITS.filter((t) => rack[t] !== undefined);
  const prompt = useMemo(() => renderMix(parts), [parts]);
  const empty = filled.length === 0;

  return (
    <aside className="flex h-full w-full flex-col bg-panel">
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <div className="flex items-baseline gap-2">
          <span className="tag text-ink">Mix</span>
          <span className="mono text-[11px] text-muted">
            {filled.length} / 7 traits
          </span>
        </div>
        <div className="flex items-center gap-3">
          {!empty && (
            <button
              type="button"
              onClick={onClear}
              className="mono text-[11px] text-muted underline decoration-line-2 underline-offset-2 hover:text-ink"
            >
              clear
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close mix"
            className="mono text-muted hover:text-ink"
          >
            close
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <ol className="flex flex-col gap-1.5">
          {MIX_TRAITS.map((trait) => {
            const donor = rack[trait];
            return (
              <li
                key={trait}
                className={[
                  "flex items-center justify-between gap-2 rounded-md border px-3 py-2",
                  donor
                    ? "border-line-2 bg-surface"
                    : "border-dashed border-line text-faint",
                ].join(" ")}
              >
                <span className="tag shrink-0 text-muted">{TRAIT_LABEL[trait]}</span>
                {donor ? (
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-[13px] text-ink">{itemTitle(donor)}</span>
                    <button
                      type="button"
                      onClick={() => onRemove(trait)}
                      aria-label={`Remove ${TRAIT_LABEL[trait]}`}
                      className="mono shrink-0 text-[12px] text-faint hover:text-ink"
                    >
                      remove
                    </button>
                  </div>
                ) : (
                  <span className="mono text-[11px]">empty</span>
                )}
              </li>
            );
          })}
        </ol>

        {advisories.length > 0 && (
          <div className="mt-4 flex flex-col gap-2">
            {advisories.map((a, i) => (
              <p
                key={i}
                className="rounded-md border border-line bg-surface px-3 py-2 text-[12px] leading-relaxed text-muted"
              >
                {a.message}
              </p>
            ))}
          </div>
        )}

        {!empty && (
          <div className="mt-5">
            <span className="tag text-faint">Prompt preview</span>
            <pre className="mono mt-2 max-h-72 overflow-y-auto whitespace-pre-wrap rounded-md border border-line bg-surface p-3 text-[11.5px] leading-relaxed text-ink-2">
              {prompt}
            </pre>
          </div>
        )}
      </div>

      <footer className="border-t border-line px-4 py-3">
        {empty ? (
          <p className="text-[12.5px] leading-relaxed text-muted">
            Open an item and add its traits here. Take this palette, that type
            system, another one&apos;s layout, and copy them as one brief.
          </p>
        ) : (
          <CopyButton
            getText={() => renderMix(parts)}
            label="Copy mixed prompt"
            className="w-full"
          />
        )}
      </footer>
    </aside>
  );
}
