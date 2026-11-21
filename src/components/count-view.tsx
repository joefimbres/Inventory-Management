"use client";

import { useState } from "react";
import type { Ref } from "react";
import { ItemBadges } from "@/components/badges";
import { NoteField, QtyField } from "@/components/fields";
import { belowPar, formatDate, formatQty, groupByCategory, lineForItem, needsOrder, vendorLabel } from "@/lib/inventory";
import type { InventoryState, Item, StockFlag } from "@/lib/types";

type Filter = "all" | "order" | "estimated" | "discontinued";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "order", label: "To order" },
  { id: "estimated", label: "Estimated" },
  { id: "discontinued", label: "Discontinued" },
];

function matches(item: Item, query: string, filter: Filter): boolean {
  if (filter === "order" && !needsOrder(item)) return false;
  if (filter === "estimated" && item.listing !== "estimated") return false;
  if (filter === "discontinued" && !item.discontinued) return false;
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [item.name, item.category, item.note, item.usedIn, item.unit, vendorLabel(item.vendor)]
    .join(" ")
    .toLowerCase()
    .includes(needle);
}

function countMeta(item: Item): string {
  const onHand =
    item.onHand === null
      ? "Not counted"
      : item.unit
        ? `On hand ${formatQty(item.onHand)} ${item.unit}`
        : `On hand ${formatQty(item.onHand)}`;
  const parts = [onHand, vendorLabel(item.vendor)];
  if (item.parLevel !== null) parts.push(`Par ${formatQty(item.parLevel)}`);
  return parts.join(" · ");
}

export function CountView({
  state,
  headingRef,
  onStock,
  onHand,
  onQty,
  onNote,
  onEdit,
  onPull,
}: {
  state: InventoryState;
  headingRef: Ref<HTMLHeadingElement>;
  onStock: (id: string, stock: StockFlag) => void;
  onHand: (id: string, value: number | null) => void;
  onQty: (id: string, value: number | null) => void;
  onNote: (id: string, note: string) => void;
  onEdit: (item: Item) => void;
  onPull: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const visible = state.items.filter((item) => matches(item, query, filter));
  const sections = groupByCategory(visible);
  const orderCount = state.items.filter(needsOrder).length;
  const openSections = filter !== "all" || query.trim().length > 0;

  return (
    <div className="flex flex-col gap-3">
      <h2 ref={headingRef} tabIndex={-1} className="font-display text-2xl outline-none">
        Count
      </h2>
      <search>
        <form action="/" method="get" onSubmit={(event) => event.preventDefault()}>
          <div className="field">
            <label htmlFor="item-search">Search items</label>
            <input
              id="item-search"
              type="search"
              name="q"
              enterKeyHint="search"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </form>
      </search>
      <p className="text-sm text-muted">Blank means nobody has counted it. Blank is not zero.</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter items">
        {FILTERS.map((entry) => {
          const count =
            entry.id === "order"
              ? orderCount
              : entry.id === "estimated"
                ? state.items.filter((item) => item.listing === "estimated").length
                : entry.id === "discontinued"
                  ? state.items.filter((item) => item.discontinued).length
                  : state.items.length;
          return (
            <button
              key={entry.id}
              type="button"
              className="chip"
              aria-pressed={filter === entry.id}
              onClick={() => setFilter(entry.id)}
            >
              {entry.label} {count}
            </button>
          );
        })}
      </div>
      {sections.length === 0 ? <p className="rounded-[20px] border border-line bg-card p-4">Nothing matches.</p> : null}
      {sections.map((section) => {
        const ordering = section.items.filter(needsOrder);
        const low = ordering.filter((item) => item.stock === "low").length;
        const out = ordering.filter((item) => item.stock === "out").length;
        return (
          <details
            key={`${section.category}:${filter}:${query}`}
            className="overflow-hidden rounded-[20px] border border-line bg-card"
            {...(openSections ? { open: true } : {})}
          >
            <summary>
              <span className="summary-row px-4">
              <span aria-hidden className="chevron text-muted">
                ▸
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-xl">{section.category}</span>
                <span className="text-sm text-muted">
                  {section.items.length === 1 ? "1 item" : `${section.items.length} items`}
                </span>
              </span>
              <span className="flex flex-col items-end gap-1">
                {low > 0 ? <span className="badge badge-low">{low} low</span> : null}
                {out > 0 ? <span className="badge badge-out">{out} out</span> : null}
              </span>
              </span>
            </summary>
            <ul className="flex flex-col gap-2 px-3 pb-3">
              {section.items.map((item) => (
                <li key={item.id}>
                  <ItemCard
                    item={item}
                    state={state}
                    onStock={onStock}
                    onHand={onHand}
                    onQty={onQty}
                    onNote={onNote}
                    onEdit={onEdit}
                    onPull={onPull}
                  />
                </li>
              ))}
            </ul>
          </details>
        );
      })}
    </div>
  );
}

function ItemCard({
  item,
  state,
  onStock,
  onHand,
  onQty,
  onNote,
  onEdit,
  onPull,
}: {
  item: Item;
  state: InventoryState;
  onStock: (id: string, stock: StockFlag) => void;
  onHand: (id: string, value: number | null) => void;
  onQty: (id: string, value: number | null) => void;
  onNote: (id: string, note: string) => void;
  onEdit: (item: Item) => void;
  onPull: (id: string) => void;
}) {
  const line = lineForItem(state, item);
  const locked = line !== null;
  const request = [
    item.requestedBy,
    item.neededBy ? `Needed ${formatDate(item.neededBy)}` : "",
    needsOrder(item) && item.orderQty !== null
      ? item.unit
        ? `Order ${formatQty(item.orderQty)} ${item.unit}`
        : `Order ${formatQty(item.orderQty)}`
      : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <details className="rounded-[14px] bg-sand open:bg-paper">
      <summary>
        <span className="summary-row items-start px-3 py-2">
        <span aria-hidden className="chevron mt-1 text-muted">
          ▸
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{item.name}</span>
          <span className="mt-0.5 block text-sm text-muted">{countMeta(item)}</span>
          {request ? <span className="mt-0.5 block text-sm">{request}</span> : null}
        </span>
        <ItemBadges item={item} line={line} />
        </span>
      </summary>
      <div className="flex flex-col gap-3 px-3 pb-3">
        {item.discontinued ? (
          <p className="text-sm">Discontinued items stay off the order list.</p>
        ) : (
          <>
            {line?.status === "submitted" ? (
              <p className="text-sm">On the list sent to Joe. Quantity and vendor stay as they were sent.</p>
            ) : null}
            {line?.status === "ordered" ? (
              <p className="text-sm">Joe marked this ordered. On hand can still be updated.</p>
            ) : null}
            <div role="group" aria-label={`${item.name} stock`} className="grid grid-cols-3 gap-2">
              <button
                type="button"
                className="choice choice-ok"
                aria-pressed={item.stock === "ok"}
                disabled={locked}
                onClick={() => onStock(item.id, "ok")}
              >
                {item.stock === "ok" ? "✓ In stock" : "In stock"}
              </button>
              <button
                type="button"
                className="choice choice-low"
                aria-pressed={item.stock === "low"}
                disabled={locked}
                onClick={() => onStock(item.id, "low")}
              >
                {item.stock === "low" ? "✓ Low" : "Low"}
              </button>
              <button
                type="button"
                className="choice choice-out"
                aria-pressed={item.stock === "out"}
                disabled={locked}
                onClick={() => onStock(item.id, "out")}
              >
                {item.stock === "out" ? "✓ Out" : "Out"}
              </button>
            </div>
            {belowPar(item) ? (
              <p className="text-sm">
                On hand is at or below par.{" "}
                <button type="button" className="font-bold underline" onClick={() => onStock(item.id, "low")}>
                  Mark low
                </button>
              </p>
            ) : null}
            <div className="grid grid-cols-2 gap-2">
              <QtyField
                label="On hand"
                value={item.onHand}
                hint="Blank is not zero."
                onCommit={(value) => onHand(item.id, value)}
              />
              <QtyField
                label="Order qty"
                value={item.orderQty}
                hint={item.unit ? `Unit: ${item.unit}` : "How many to buy."}
                disabled={locked}
                onCommit={(value) => onQty(item.id, value)}
              />
            </div>
            <NoteField value={item.note} disabled={locked} onCommit={(note) => onNote(item.id, note)} />
            {line?.status === "submitted" ? (
              <button type="button" className="btn btn-secondary w-full" onClick={() => onPull(item.id)}>
                Take off Joe’s list
              </button>
            ) : null}
          </>
        )}
        {item.usedIn ? <p className="text-sm text-muted">Used in {item.usedIn}</p> : null}
        {item.note && locked ? <p className="text-sm">Note: {item.note}</p> : null}
        <button type="button" className="btn btn-secondary w-full" onClick={() => onEdit(item)}>
          Edit item
        </button>
      </div>
    </details>
  );
}
