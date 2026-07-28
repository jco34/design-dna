"use client";

import Link from "next/link";
import type { ColourMatch, Item } from "@schema";
import { swatches, itemTitle, genreLabel, styleValues } from "@/lib/display";
import { PaletteBar } from "./palette-bar";

/**
 * A library card. Screenshot-dominant, because a wall of captures is the thing
 * worth looking at, with the palette bar as a thin legend beneath it and the
 * metadata kept to what you scan by: the source, the genre, the idiom. Depth of
 * detail lives in the item view; the card's job is to be recognised.
 *
 * At rest it is capture, title and DNA bar. On hover it lifts and reveals the
 * quick actions. When a colour query is active, the matched swatch is called
 * out so the grid explains why each card survived the filter.
 */
export function Card({
  item,
  colourMatch,
  href,
}: {
  item: Item;
  colourMatch?: ColourMatch;
  href: string;
}) {
  const sw = swatches(item);
  const styles = styleValues(item);

  return (
    <Link
      href={href}
      className="group relative flex flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-[var(--shadow)] transition-all duration-200 hover:-translate-y-0.5 hover:border-line-2 hover:shadow-[var(--shadow-lift)]"
    >
      <div className="relative aspect-[8/5] w-full overflow-hidden bg-panel">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/captures/${item.id}`}
          alt={`Capture of ${itemTitle(item)}`}
          className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.015]"
          loading="lazy"
        />
        {colourMatch && (
          <div className="absolute right-2 top-2 flex items-center gap-1.5 rounded-md border border-black/10 bg-white/85 px-1.5 py-1 backdrop-blur-sm">
            <span
              className="h-3 w-3 rounded-sm ring-1 ring-black/10"
              style={{ background: colourMatch.hex }}
            />
            <span className="mono text-[10px] text-neutral-800">
              {colourMatch.authorship === "agent" ? `~${colourMatch.hex}` : colourMatch.hex}
            </span>
          </div>
        )}
      </div>

      <PaletteBar swatches={sw} height={8} />

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[15px] font-medium text-ink">{itemTitle(item)}</span>
          <span className="tag shrink-0 text-faint">{genreLabel(item)}</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {styles.length === 0 ? (
            <span className="tag text-faint">no named idiom</span>
          ) : (
            styles.map((s) => (
              <span
                key={s}
                className="rounded border border-line px-1.5 py-0.5 text-[11px] text-muted"
              >
                {s}
              </span>
            ))
          )}
        </div>
      </div>
    </Link>
  );
}
