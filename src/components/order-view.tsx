"use client";

import type { Ref } from "react";
import { SummaryPanel } from "@/components/summary-panel";
import { NoteField, QtyField } from "@/components/fields";
import { draftLines, formatDate, formatQty, groupLines, vendorLabel } from "@/lib/inventory";
import type { InventoryState, VendorId } from "@/lib/types";
import { VENDOR_IDS } from "@/lib/types";

function isVendor(value: string): value is VendorId {
  return VENDOR_IDS.some((vendor) => vendor === value);
}

export function OrderView({
  state,
  headingRef,
  highlightId,
  onQty,
  onNote,
  onVendor,
  onClear,
  onSend,
}: {
  state: InventoryState;
  headingRef: Ref<HTMLHeadingElement>;
  highlightId: string | null;
  onQty: (id: string, value: number | null) => void;
  onNote: (id: string, note: string) => void;
  onVendor: (id: string, vendor: VendorId) => void;
  onClear: (id: string) => void;
  onSend: () => void;
}) {
  const lines = draftLines(state);
  const groups = groupLines(lines);
  const highlighted = highlightId ? state.batches.find((batch) => batch.id === highlightId) : null;
  const latest = [...state.batches].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0] ?? null;
  const summary = highlighted ?? latest;
  const justSent = Boolean(highlighted && summary && highlighted.id === summary.id);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 ref={headingRef} tabIndex={-1} className="font-display text-2xl">
          Order list
        </h2>
        <p className="mt-1 text-sm text-muted">
          Check the vendor and the quantity. Sam’s, Sysco, and Triple F stay separate from anything still unassigned.
        </p>
      </div>
      {justSent && summary ? <SummaryPanel batch={summary} autoFocus /> : null}
      {lines.length > 0 ? (
        <button type="button" className="btn btn-primary w-full" onClick={onSend}>
          Send {lines.length} to Joe
        </button>
      ) : (
        <p className="rounded-[20px] border border-line bg-card p-4 text-sm">
          {justSent
            ? "Joe has this list. Mark more items on Count when something else runs low."
            : "Nothing is marked low or out. Mark items on Count, then come back here."}
        </p>
      )}
      {lines.length > 0
        ? groups.map((group) => (
        <section key={group.vendor} className="flex flex-col gap-2" aria-labelledby={`vendor-${group.vendor}`}>
          <h3 id={`vendor-${group.vendor}`} className="font-display text-xl">
            {vendorLabel(group.vendor)}
          </h3>
          {group.lines.length === 0 ? <p className="text-sm text-muted">Nothing for this vendor.</p> : null}
          <ul className="flex flex-col gap-2">
            {group.lines.map((line) => {
              const qty = formatQty(line.qty);
              const amount = qty ? (line.unit ? `${qty} ${line.unit}` : qty) : "Qty not set";
              return (
                <li key={line.itemId}>
                  <details className="rounded-[20px] border border-line bg-card">
                    <summary>
                      <span className="summary-row px-3">
                      <span aria-hidden className="chevron text-muted">
                        ▸
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">{line.name}</span>
                        <span className="block text-sm text-muted">
                          {amount}
                          {line.neededBy ? ` · Needed ${formatDate(line.neededBy)}` : ""}
                        </span>
                      </span>
                      {line.priority ? <span className="badge badge-clay">Priority</span> : null}
                      {line.stock === "out" ? <span className="badge badge-out">Out</span> : <span className="badge badge-low">Low</span>}
                      </span>
                    </summary>
                    <div className="flex flex-col gap-3 px-3 pb-3">
                      <label className="field">
                        <span>Vendor</span>
                        <select
                          value={line.vendor}
                          onChange={(event) => {
                            if (isVendor(event.target.value)) onVendor(line.itemId, event.target.value);
                          }}
                        >
                          {VENDOR_IDS.map((vendor) => (
                            <option key={vendor} value={vendor}>
                              {vendorLabel(vendor)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <QtyField
                        label="Order qty"
                        value={line.qty}
                        hint={line.unit ? `Unit: ${line.unit}` : "How many to buy."}
                        onCommit={(value) => onQty(line.itemId, value)}
                      />
                      <NoteField value={line.note} onCommit={(note) => onNote(line.itemId, note)} />
                      <button type="button" className="btn btn-secondary w-full" onClick={() => onClear(line.itemId)}>
                        Leave off this order
                      </button>
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        </section>
          ))
        : null}
      {lines.length > 0 ? (
        <button type="button" className="btn btn-primary w-full" onClick={onSend}>
          Send {lines.length} to Joe
        </button>
      ) : null}
      {!justSent && summary ? <SummaryPanel batch={summary} /> : null}
    </div>
  );
}
