"use client";

import type { Ref } from "react";
import { SummaryPanel } from "@/components/summary-panel";
import { formatQty, formatWhen, groupLines, pendingCount, statusLabel, vendorLabel } from "@/lib/inventory";
import type { InventoryState, LineStatus, OrderBatch, VendorId } from "@/lib/types";

export function JoeView({
  state,
  headingRef,
  onStatus,
  onVendorStatus,
  onPull,
}: {
  state: InventoryState;
  headingRef: Ref<HTMLHeadingElement>;
  onStatus: (batchId: string, itemId: string, status: LineStatus) => void;
  onVendorStatus: (batchId: string, vendor: VendorId, status: LineStatus) => void;
  onPull: (batchId: string, itemId: string) => void;
}) {
  const batches = [...state.batches].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  const open = batches.filter((batch) => batch.lines.some((line) => line.status !== "received"));
  const done = batches.filter((batch) => batch.lines.every((line) => line.status === "received"));
  const waiting = state.batches.reduce(
    (total, batch) => total + batch.lines.filter((line) => line.status === "submitted").length,
    0,
  );
  const ordered = state.batches.reduce(
    (total, batch) => total + batch.lines.filter((line) => line.status === "ordered").length,
    0,
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 ref={headingRef} tabIndex={-1} className="font-display text-2xl">
          Joe’s list
        </h2>
        <p className="mt-1 text-sm text-muted">
          Mark what you ordered, then what arrived. It stays pending until you check it in.
        </p>
      </div>
      <p className="rounded-2xl border border-line bg-card p-4 font-semibold">
        {pendingCount(state) === 0
          ? "Nothing is waiting."
          : `${waiting} to order · ${ordered} ordered, not here yet`}
      </p>
      {open.length === 0 && done.length === 0 ? (
        <p className="text-sm text-muted">When the floor taps Send to Joe, the list shows up here.</p>
      ) : null}
      {open.map((batch) => (
        <BatchCard
          key={batch.id}
          batch={batch}
          onStatus={onStatus}
          onVendorStatus={onVendorStatus}
          onPull={onPull}
        />
      ))}
      {done.length > 0 ? (
        <details className="rounded-2xl border border-line bg-card">
          <summary>
            <span className="summary-row px-4">
              Checked in ({done.reduce((total, batch) => total + batch.lines.length, 0)})
            </span>
          </summary>
          <div className="flex flex-col gap-3 px-3 pb-3">
            {done.map((batch) => (
              <article key={batch.id} className="rounded-xl bg-sand p-3">
                <p className="text-sm text-muted">Sent {formatWhen(batch.submittedAt)}</p>
                <ul className="mt-2 flex flex-col gap-2">
                  {batch.lines.map((line) => (
                    <li key={line.itemId} className="flex items-center justify-between gap-3">
                      <span>{line.name}</span>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => onStatus(batch.id, line.itemId, "ordered")}
                      >
                        Undo
                      </button>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function BatchCard({
  batch,
  onStatus,
  onVendorStatus,
  onPull,
}: {
  batch: OrderBatch;
  onStatus: (batchId: string, itemId: string, status: LineStatus) => void;
  onVendorStatus: (batchId: string, vendor: VendorId, status: LineStatus) => void;
  onPull: (batchId: string, itemId: string) => void;
}) {
  const openLines = batch.lines.filter((line) => line.status !== "received");
  const received = batch.lines.filter((line) => line.status === "received");
  const groups = groupLines(openLines).filter((group) => group.lines.length > 0);

  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-3">
      <h3 className="font-display text-xl">Sent {formatWhen(batch.submittedAt)}</h3>
      {groups.map((group) => {
        const waiting = group.lines.filter((line) => line.status === "submitted");
        return (
          <section key={group.vendor} className="flex flex-col gap-2" aria-labelledby={`${batch.id}-${group.vendor}`}>
            <h4 id={`${batch.id}-${group.vendor}`} className="font-semibold">
              {vendorLabel(group.vendor)}
            </h4>
            <ul className="flex flex-col gap-2">
              {group.lines.map((line) => {
                const qty = formatQty(line.qty);
                return (
                  <li key={line.itemId} className="rounded-xl bg-sand p-3">
                    <p className="font-semibold">{line.name}</p>
                    <p className="text-sm text-muted">
                      {statusLabel(line.status)}
                      {qty ? ` · ${qty}${line.unit ? ` ${line.unit}` : ""}` : ""}
                      {line.priority ? " · Priority" : ""}
                    </p>
                    {line.note ? <p className="text-sm">{line.note}</p> : null}
                    <div className="mt-3 flex flex-col gap-2">
                      {line.status === "submitted" ? (
                        <button type="button" className="btn btn-primary w-full" onClick={() => onStatus(batch.id, line.itemId, "ordered")}>
                          Mark ordered
                        </button>
                      ) : null}
                      {line.status === "ordered" ? (
                        <button type="button" className="btn btn-primary w-full" onClick={() => onStatus(batch.id, line.itemId, "received")}>
                          Mark received
                        </button>
                      ) : null}
                      {line.status === "submitted" ? (
                        <button type="button" className="btn btn-secondary w-full" onClick={() => onStatus(batch.id, line.itemId, "received")}>
                          Mark received
                        </button>
                      ) : null}
                      {line.status === "ordered" ? (
                        <button type="button" className="btn btn-secondary w-full" onClick={() => onStatus(batch.id, line.itemId, "submitted")}>
                          Undo
                        </button>
                      ) : null}
                      {line.status === "submitted" ? (
                        <button type="button" className="btn btn-secondary w-full" onClick={() => onPull(batch.id, line.itemId)}>
                          Take off list
                        </button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
            {waiting.length > 1 ? (
              <button type="button" className="btn btn-secondary w-full" onClick={() => onVendorStatus(batch.id, group.vendor, "ordered")}>
                Mark all {vendorLabel(group.vendor)} ordered
              </button>
            ) : null}
          </section>
        );
      })}
      {received.length > 0 ? (
        <details>
          <summary>
            <span className="summary-row">Received in this list ({received.length})</span>
          </summary>
          <ul className="flex flex-col gap-2 py-2">
            {received.map((line) => (
              <li key={line.itemId} className="flex items-center justify-between gap-3">
                <span>{line.name}</span>
                <button type="button" className="btn btn-secondary" onClick={() => onStatus(batch.id, line.itemId, "ordered")}>
                  Undo
                </button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      <details>
        <summary>
          <span className="summary-row">Copy this list</span>
        </summary>
        <div className="pt-3">
          <SummaryPanel batch={batch} />
        </div>
      </details>
    </article>
  );
}
