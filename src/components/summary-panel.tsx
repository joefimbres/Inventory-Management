"use client";

import { useEffect, useId, useRef, useState } from "react";
import { orderSummary } from "@/lib/inventory";
import type { OrderBatch } from "@/lib/types";

export function SummaryPanel({
  batch,
  headingId,
  autoFocus = false,
}: {
  batch: OrderBatch;
  headingId?: string;
  autoFocus?: boolean;
}) {
  const text = orderSummary(batch);
  const titleId = useId();
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [message, setMessage] = useState("");
  const canShare = typeof navigator.share === "function";

  useEffect(() => {
    if (autoFocus) headingRef.current?.focus();
  }, [autoFocus, batch.id]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setMessage("Copied.");
    } catch {
      areaRef.current?.focus();
      areaRef.current?.select();
      setMessage("Select the summary and copy it.");
    }
  }

  async function share() {
    try {
      await navigator.share({ title: "HHC order", text });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      await copy();
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-card p-4" aria-labelledby={headingId ?? titleId}>
      <h3 ref={headingRef} id={headingId ?? titleId} tabIndex={-1} className="font-display text-xl">
        Order summary
      </h3>
      <p className="mt-1 text-sm text-muted">Copy this into a text, or share it from this phone. Nothing is sent on its own.</p>
      <textarea ref={areaRef} readOnly rows={12} value={text} aria-label="Order summary" className="mt-3 font-mono text-sm leading-5" />
      <div className={canShare ? "mt-3 grid grid-cols-2 gap-2" : "mt-3"}>
        <button type="button" className="btn btn-primary w-full" onClick={() => void copy()}>
          Copy
        </button>
        {canShare ? (
          <button type="button" className="btn btn-secondary w-full" onClick={() => void share()}>
            Share
          </button>
        ) : null}
      </div>
      <p role="status" className="mt-2 min-h-6 text-sm">
        {message}
      </p>
    </section>
  );
}
