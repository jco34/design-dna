"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  renderPrompt,
  traitState,
  type Item,
  type TraitName,
  type TraitState,
} from "@schema";
import {
  TRAIT_LABEL,
  TRAIT_ORDER,
  glossFor,
  itemTitle,
  moodValues,
  genreLabel,
  sourceLabel,
  styleValues,
  swatches,
} from "@/lib/display";
import { readMix, withMix } from "@/lib/url-state";
import { PaletteBar } from "./palette-bar";
import { CopyButton } from "./copy-button";
import { MixPanel } from "./mix-panel";
import { DeleteItemDialog } from "./delete-item-dialog";

export function ItemDetail({ item, allItems }: { item: Item; allItems: Item[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  const itemsById = useMemo(
    () => new Map(allItems.map((i) => [i.id, i] as const)),
    [allItems],
  );
  const { parts: mixParts } = useMemo(
    () => readMix(search, itemsById),
    [search, itemsById],
  );
  const rackOpen = searchParams.get("rack") === "1";
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const commit = useCallback(
    (next: URLSearchParams) => {
      const qs = next.toString();
      router.replace(qs ? `?${qs}` : `?`, { scroll: false });
    },
    [router],
  );

  const slotDonorId = useMemo(() => {
    const map = new Map<TraitName, string>();
    for (const p of mixParts) map.set(p.trait, p.item.id);
    return map;
  }, [mixParts]);

  const toggleTrait = useCallback(
    (trait: TraitName) => {
      const mine = slotDonorId.get(trait) === item.id;
      const others = mixParts.filter((p) => p.trait !== trait);
      const next = mine ? others : [...others, { trait, item }];
      const params = withMix(new URLSearchParams(search), next);
      params.set("rack", "1");
      commit(params);
    },
    [commit, item, mixParts, search, slotDonorId],
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
      commit(withMix(new URLSearchParams(search), mixParts.filter((p) => p.trait !== trait)));
    },
    [commit, mixParts, search],
  );

  const clearMix = useCallback(() => {
    const next = withMix(new URLSearchParams(search), []);
    next.delete("rack");
    commit(next);
  }, [commit, search]);

  const sw = swatches(item);
  const backHref = search ? `/?${stripDetailKeys(search)}` : "/";
  const filledTraitCount = new Set(mixParts.map((p) => p.trait)).size;

  return (
    <div className="mx-auto max-w-[1400px] px-5 pb-24 pt-6 lg:px-8">
      <div className="flex items-center justify-between gap-4">
        <Link
          href={backHref}
          className="mono inline-flex items-center gap-1.5 text-[12px] text-muted hover:text-ink"
        >
          <span aria-hidden>&larr;</span> library
        </Link>
        <button
          type="button"
          onClick={() => setRackOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-md border border-line-2 px-3 py-1.5 hover:border-ink"
        >
          <span className="mono text-[12px] text-ink">Mix</span>
          <span
            className={[
              "mono min-w-5 rounded-full px-1.5 text-center text-[11px]",
              filledTraitCount > 0 ? "bg-invert-bg text-invert-ink" : "text-faint",
            ].join(" ")}
          >
            {filledTraitCount}
          </span>
        </button>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        {/* The capture and its palette */}
        <div className="lg:sticky lg:top-[73px] lg:h-fit">
          <div className="overflow-hidden rounded-lg border border-line bg-surface shadow-[var(--shadow)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/captures/${item.id}`}
              alt={`Capture of ${itemTitle(item)}`}
              className="w-full"
            />
            <PaletteBar swatches={sw} height={16} interactive />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
            {sw.map((s) => (
              <div key={s.role} className="flex items-center gap-1.5">
                <span
                  className="h-3 w-3 rounded-sm ring-1 ring-line-2"
                  style={{
                    background: s.determined ? s.hex : "transparent",
                    backgroundImage: s.determined
                      ? undefined
                      : "repeating-linear-gradient(45deg, var(--line-2) 0 2px, transparent 2px 5px)",
                  }}
                />
                <span className="tag text-faint">{s.role}</span>
                <span className="mono text-[11px] text-muted">
                  {s.determined ? (s.approximate ? `~${s.hex}` : s.hex) : "unread"}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11.5px] leading-relaxed text-faint">
            Hexes marked <span className="mono">~</span> were read from the capture by the agent, so
            they are approximate rather than sampled.
          </p>
        </div>

        {/* The DNA */}
        <div className="flex flex-col gap-6">
          <div>
            <h1 className="text-2xl font-medium tracking-tight text-ink">{itemTitle(item)}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <MetaChip label="kind" value={genreLabel(item)} />
              <MetaChip label="scope" value={item.scope} />
              {styleValues(item).map((s) => (
                <span
                  key={s}
                  title={glossFor("style", s)}
                  className="rounded border border-line px-1.5 py-0.5 text-[11px] text-muted"
                >
                  {s}
                </span>
              ))}
              {moodValues(item).map((m) => (
                <span
                  key={m}
                  title={glossFor("mood", m)}
                  className="rounded border border-line px-1.5 py-0.5 text-[11px] text-muted"
                >
                  {m}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <CopyButton getText={() => renderPrompt(item)} label="Copy prompt" />
            <span className="text-[12px] text-muted">
              the whole design as one brief, rendered on demand
            </span>
            {/*
              Pushed to the far right and styled as quiet text rather than a button,
              because it is the one irreversible control on this page and should not
              sit next to Copy looking like a peer of it.
            */}
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="ml-auto text-[12px] text-faint underline decoration-line-2 underline-offset-4 hover:text-ink"
            >
              Delete
            </button>
          </div>

          {item.note && (
            <div className="rounded-md border-l-2 border-line-2 bg-panel py-2 pl-4 pr-3">
              <p className="tag text-faint">Note</p>
              <p className="mt-1 text-[14px] leading-relaxed text-ink-2">{item.note}</p>
            </div>
          )}

          <div className="flex flex-col divide-y divide-line border-t border-line">
            {TRAIT_ORDER.map((trait) => (
              <TraitRow
                key={trait}
                item={item}
                trait={trait}
                state={traitState(item, trait)}
                inMixAsThis={slotDonorId.get(trait) === item.id}
                inMixAsOther={slotDonorId.has(trait) && slotDonorId.get(trait) !== item.id}
                onToggle={() => toggleTrait(trait)}
              />
            ))}
          </div>

          <div className="mt-2">
            <p className="tag text-faint">Source</p>
            <p className="mono mt-1 break-all text-[12px] text-muted">{sourceLabel(item)}</p>
            <p className="mono mt-1 text-[11px] text-faint">
              {`captured ${formatDate(item.capture.takenAt)} · ${item.capture.pixelWidth}x${item.capture.pixelHeight} · ${item.authoredBy.kind}${item.authoredBy.model ? ` · ${item.authoredBy.model}` : ""}`}
            </p>
          </div>
        </div>
      </div>

      {rackOpen && (
        <>
          <button
            type="button"
            aria-label="Close mix"
            onClick={() => setRackOpen(false)}
            className="fixed inset-0 z-30 bg-black/30 lg:bg-transparent"
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

      {confirmingDelete && (
        <DeleteItemDialog
          id={item.id}
          title={itemTitle(item)}
          captureFile={item.capture.file}
          onClose={() => setConfirmingDelete(false)}
        />
      )}
    </div>
  );
}

function TraitRow({
  item,
  trait,
  state,
  inMixAsThis,
  inMixAsOther,
  onToggle,
}: {
  item: Item;
  trait: TraitName;
  state: TraitState;
  inMixAsThis: boolean;
  inMixAsOther: boolean;
  onToggle: () => void;
}) {
  const readable = state === "present";
  return (
    <div className="flex items-start justify-between gap-4 py-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="tag text-ink">{TRAIT_LABEL[trait]}</span>
          {state === "not_applicable" && (
            <span className="mono text-[10px] text-faint">not applicable to this scope</span>
          )}
          {state === "undetermined" && (
            <span className="mono text-[10px] text-faint">not read from the capture</span>
          )}
        </div>
        {readable ? (
          <div className="mt-1.5 text-[13.5px] leading-relaxed text-ink-2">
            <TraitBody item={item} trait={trait} />
          </div>
        ) : (
          <p className="mt-1.5 text-[13px] italic text-faint">
            {state === "not_applicable"
              ? "A capture at this scope structurally cannot carry it."
              : "The agent looked and could not read it. A re-run or an override could fill it."}
          </p>
        )}
      </div>
      <button
        type="button"
        disabled={!readable}
        aria-pressed={inMixAsThis}
        onClick={onToggle}
        title={
          inMixAsOther ? "Another item holds this slot; adding replaces it" : undefined
        }
        className={[
          "mono shrink-0 rounded-md border px-2.5 py-1 text-[11px] transition-colors duration-150",
          !readable
            ? "cursor-not-allowed border-line text-faint opacity-45"
            : inMixAsThis
              ? "border-invert-bg bg-invert-bg text-invert-ink"
              : "border-line-2 text-ink-2 hover:border-ink hover:text-ink",
        ].join(" ")}
      >
        {inMixAsThis ? "in mix" : inMixAsOther ? "replace" : "+ mix"}
      </button>
    </div>
  );
}

function TraitBody({ item, trait }: { item: Item; trait: TraitName }) {
  const dna = item.dna;
  switch (trait) {
    case "palette":
      return <span>Five roles read from the capture, weighted by how much of the design each carries. See the bar and swatches on the left.</span>;
    case "typography":
      return (
        <span>
          {describeFamily(dna.typography.headingFamily, "heading")} {dna.typography.headingCharacter}{" "}
          {describeFamily(dna.typography.bodyFamily, "body")} {dna.typography.bodyCharacter}{" "}
          <span className="text-muted">Scale {dna.typography.scale}, {dna.typography.weightRange} weights.</span>
        </span>
      );
    case "composition":
      return (
        <span>
          {dna.composition.structure}{" "}
          <span className="text-muted">Content width {dna.composition.contentWidth}.</span>
        </span>
      );
    case "spacing":
      return (
        <span>
          <span className="text-muted">{cap(dna.spacing.density)}.</span> {dna.spacing.rhythm}
        </span>
      );
    case "surfaceTreatment":
      return (
        <span>
          {dna.surfaceTreatment.finish}{" "}
          <span className="text-muted">
            {dna.surfaceTreatment.corners} corners, {dna.surfaceTreatment.borders} borders,{" "}
            {dna.surfaceTreatment.elevation} elevation.
          </span>
        </span>
      );
    case "imagery":
      return (
        <span>
          <span className="text-muted">{cap(dna.imagery.kind.replace(/-/g, " "))}.</span>{" "}
          {dna.imagery.treatment}
        </span>
      );
    case "motion":
      return <MotionBody item={item} />;
    case "philosophy":
      return <span>{dna.philosophy.text}</span>;
    default:
      return null;
  }
}

/**
 * Motion is the only trait whose absence needs explaining rather than hiding.
 *
 * Every other trait is read off the Capture, so "no value" means the analysis
 * could not read the image. Motion is read off the live page instead, which gives
 * it a third case the others do not have: the Item may simply never have had a
 * live page to observe, because its Capture was a supplied still image. Rendering
 * that as blank space invites the reader to conclude the design does not move.
 *
 * So an Undetermined motion trait says which of the two situations it is in, and
 * `presence: 'none'` is stated positively rather than left implicit, because "this
 * design deliberately does not move" is a finding.
 */
function MotionBody({ item }: { item: Item }) {
  const m = item.dna.motion;
  const suppliedStill = item.capture.mode === "supplied";
  const unread =
    m.presence === "undetermined" &&
    m.triggers.length === 0 &&
    m.character.trim() === "" &&
    m.choreography.trim() === "";

  if (unread) {
    return (
      <span className="text-muted">
        {suppliedStill
          ? "Not observed. This item was saved from a still image, and a single frame cannot show whether a design moves."
          : "Not observed. Re-run the capture with the exploration pass to read it."}
      </span>
    );
  }

  const timing = [
    m.easing === "undetermined" ? null : m.easing,
    m.pace === "undetermined" ? null : `${m.pace} pace`,
  ].filter((part): part is string => part !== null);

  return (
    <span>
      {m.presence === "none" ? (
        <span className="text-muted">Nothing moves; the stillness is deliberate.</span>
      ) : (
        <span className="text-muted">{cap(m.presence)}.</span>
      )}{" "}
      {m.character}{" "}
      {m.choreography && <span>{m.choreography} </span>}
      {(m.triggers.length > 0 || timing.length > 0) && (
        <span className="text-muted">
          {m.triggers.length > 0 && (
            <>Triggered by {m.triggers.map((t) => t.replace(/-/g, " ")).join(", ")}.</>
          )}
          {timing.length > 0 && <> {cap(timing.join(", "))}.</>}
        </span>
      )}
    </span>
  );
}

function describeFamily(family: string, role: string): string {
  return family ? `${cap(role)} ${family}.` : `${cap(role)} face unnamed.`;
}

function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded border border-line-2 px-2 py-0.5">
      <span className="tag text-faint">{label}</span>
      <span className="mono text-[11px] text-ink-2">{value}</span>
    </span>
  );
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatDate(iso: string | null): string {
  if (!iso) return "date unknown";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** Drop the detail-only keys (rack) when returning to the grid. */
function stripDetailKeys(search: string): string {
  const p = new URLSearchParams(search);
  p.delete("rack");
  return p.toString();
}
