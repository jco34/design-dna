"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Copy is the only export surface in the whole app (locked on the map), so this
 * button is the payoff. It reports what it did in its own label: "Copy prompt"
 * becomes "Copied", which is the toast, so there is no separate one.
 */
export function CopyButton({
  text,
  label = "Copy prompt",
  copiedLabel = "Copied",
  className = "",
  variant = "solid",
  getText,
}: {
  text?: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
  variant?: "solid" | "outline";
  /** Deferred text, computed at click time. Wins over `text` when present. */
  getText?: () => string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const onCopy = useCallback(async () => {
    const payload = getText ? getText() : text ?? "";
    try {
      await navigator.clipboard.writeText(payload);
    } catch {
      // Older or permission-restricted contexts: fall back to a hidden textarea.
      const el = document.createElement("textarea");
      el.value = payload;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      try {
        document.execCommand("copy");
      } catch {
        /* nothing more to try */
      }
      document.body.removeChild(el);
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1600);
  }, [getText, text]);

  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 select-none";
  const skin =
    variant === "solid"
      ? "bg-invert-bg text-invert-ink hover:opacity-90"
      : "border border-line-2 text-ink hover:bg-panel";

  return (
    <button type="button" onClick={onCopy} className={`${base} ${skin} ${className}`} aria-live="polite">
      <span className="mono text-[13px]">{copied ? copiedLabel : label}</span>
    </button>
  );
}
