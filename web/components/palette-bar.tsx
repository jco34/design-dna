/**
 * The palette bar. The signature element of the whole interface.
 *
 * Each of the five palette roles takes horizontal room in proportion to its
 * ordinal weight, so an accent used at 2 percent reads as the sliver it is and
 * a dominant background fills the bar. It sits directly under a Capture like a
 * strip of genetic code, which answers 011's hardest question: how to show a
 * palette without the swatches fighting the screenshot's own colour. It does
 * not fight; it is a legend for it.
 *
 * An undetermined swatch is drawn as a hatched blank rather than a colour, so
 * "the agent could not read this" never masquerades as a real value.
 */
import type { Swatch } from "@/lib/display";
import { hexLabel } from "@/lib/display";

export function PaletteBar({
  swatches,
  height = 10,
  interactive = false,
}: {
  swatches: Swatch[];
  height?: number;
  interactive?: boolean;
}) {
  return (
    <div
      className="flex w-full overflow-hidden"
      style={{ height }}
      role="img"
      aria-label={
        "Palette: " +
        swatches.map((s) => `${s.role} ${hexLabel(s)}`).join(", ")
      }
    >
      {swatches.map((s) => (
        <div
          key={s.role}
          className="group/sw relative"
          style={{
            flexGrow: s.flex,
            flexBasis: 0,
            background: s.determined ? s.hex : "transparent",
            backgroundImage: s.determined
              ? undefined
              : "repeating-linear-gradient(45deg, var(--line-2) 0 2px, transparent 2px 5px)",
          }}
          title={interactive ? undefined : `${s.role}  ${hexLabel(s)}  ${s.weight}`}
        >
          {interactive && (
            <span
              className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded border border-line bg-surface px-1.5 py-1 text-[10px] opacity-0 shadow-[var(--shadow)] transition-opacity duration-150 group-hover/sw:opacity-100"
            >
              <span className="tag text-muted">{s.role}</span>
              <span className="mono ml-1.5 text-ink">{hexLabel(s)}</span>
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
