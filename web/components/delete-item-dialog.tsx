"use client";

/**
 * The confirmation gate in front of deletion.
 *
 * Deletion is the only irreversible thing this app can do, and the Capture is the
 * only irreplaceable thing in the library: the design it photographed may have been
 * redesigned or taken down since. So the dialog does three specific jobs rather
 * than just asking twice.
 *
 *   It names what is about to go. Not "this item" but the source and the Capture
 *   filename, so a misclick on the wrong card is visible before it is permanent.
 *
 *   It tells the truth about recovery, and the truth is conditional. A committed
 *   Item is recoverable with `git checkout`; an Item that has never been committed
 *   is not recoverable at all. Saying "cannot be undone" flatly would be wrong half
 *   the time, and wrong reassurance is worse than none.
 *
 *   It refuses to make Delete the easy default. Cancel is the initially focused
 *   control and Escape cancels, so the fast, thoughtless path is the safe one.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteItemDialog({
  id,
  title,
  captureFile,
  onClose,
}: {
  id: string;
  title: string;
  captureFile: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Focus lands on Cancel, never on Delete. A keyboard user who hits Enter out of
  // habit should not lose a design for it.
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) {
        onClose();
        return;
      }
      // A trap rather than a preference: without it, Tab walks out of the dialog
      // into the page behind it, and the next Enter presses something invisible.
      if (event.key !== "Tab") return;
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        "button:not([disabled])",
      );
      if (focusable === undefined || focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [busy, onClose]);

  async function confirm() {
    setBusy(true);
    setProblem(null);
    try {
      const response = await fetch(`/api/items/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { problem?: string };
        setProblem(body.problem ?? `the request failed with status ${response.status}`);
        setBusy(false);
        return;
      }
      // Back to the library, then refresh so the grid re-scans from disk. Without
      // the refresh the deleted card would still be sitting in the router cache.
      router.push("/");
      router.refresh();
    } catch (error) {
      setProblem((error as Error).message);
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-title"
      aria-describedby="delete-body"
    >
      <button
        type="button"
        aria-label="Cancel"
        tabIndex={-1}
        onClick={() => !busy && onClose()}
        className="absolute inset-0 cursor-default bg-black/60 backdrop-blur-sm"
      />
      <div
        ref={panelRef}
        className="relative w-full max-w-md rounded-lg border border-line-2 bg-bg p-5 shadow-2xl"
      >
        <h2 id="delete-title" className="text-base font-medium text-ink">
          Delete this design?
        </h2>

        <div id="delete-body" className="mt-3 space-y-3 text-sm text-ink-2">
          <p>
            <span className="text-muted">You are deleting</span>{" "}
            <span className="text-ink">{title}</span>
            <span className="text-muted">, along with its capture.</span>
          </p>

          <p className="text-muted">
            This removes two files from the library and cannot be undone from this app.
            If the item has been committed to git you can restore it with{" "}
            <code className="mono text-[11px] text-ink-2">git checkout library/</code>.
            If it has not been committed yet, it is gone for good.
          </p>

          <ul className="mono space-y-1 rounded border border-line-2 bg-surface px-3 py-2 text-[11px] text-muted">
            <li>items/{id}.json</li>
            <li>captures/{captureFile}</li>
          </ul>

          <p className="text-muted">
            The capture is the part worth pausing over. The design it photographed may
            have changed or gone offline since, so it cannot necessarily be taken again.
          </p>

          {problem !== null && (
            <p role="alert" className="rounded border border-line-2 px-3 py-2 text-ink">
              Nothing was deleted: {problem}
            </p>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded border border-line-2 px-3 py-1.5 text-sm text-ink-2 hover:border-ink hover:text-ink disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={confirm}
            className="rounded border border-invert-bg bg-invert-bg px-3 py-1.5 text-sm text-invert-ink hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Deleting..." : "Delete permanently"}
          </button>
        </div>
      </div>
    </div>
  );
}
