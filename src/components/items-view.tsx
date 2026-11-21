"use client";

import { useState } from "react";
import type { Ref } from "react";
import { ItemBadges } from "@/components/badges";
import { formatQty, groupByCategory, vendorLabel } from "@/lib/inventory";
import type { InventoryState, Item } from "@/lib/types";

export function ItemsView({
  state,
  headingRef,
  onEdit,
  onCreate,
}: {
  state: InventoryState;
  headingRef: Ref<HTMLHeadingElement>;
  onEdit: (item: Item) => void;
  onCreate: () => void;
}) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const visible = state.items.filter((item) => {
    if (!needle) return true;
    return [item.name, item.category, vendorLabel(item.vendor), item.unit].join(" ").toLowerCase().includes(needle);
  });
  const sections = groupByCategory(visible);

  return (
    <div className="flex flex-col gap-3">
      <h2 ref={headingRef} tabIndex={-1} className="font-display text-2xl">
        Items
      </h2>
      <p className="text-sm text-muted">Name, section, vendor, unit, and par. Par stays blank until someone sets it.</p>
      <button type="button" className="btn btn-primary w-full" onClick={onCreate}>
        Add item
      </button>
      <search>
        <form action="/" method="get" onSubmit={(event) => event.preventDefault()}>
          <div className="field">
            <label htmlFor="catalog-search">Search the catalog</label>
            <input
              id="catalog-search"
              type="search"
              name="catalog"
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
      {sections.length === 0 ? <p className="rounded-2xl border border-line bg-card p-4">Nothing matches.</p> : null}
      {sections.map((section) => (
        <details
          key={`${section.category}:${query}`}
          className="overflow-hidden rounded-2xl border border-line bg-card"
          {...(needle.length > 0 ? { open: true } : {})}
        >
          <summary>
            <span className="summary-row px-4">
              <span aria-hidden className="chevron text-muted">
                ▸
              </span>
              <span className="font-display text-xl">{section.category}</span>
              <span className="ml-auto text-sm text-muted">{section.items.length}</span>
            </span>
          </summary>
          <ul className="border-t border-line">
            {section.items.map((item) => (
              <li key={item.id} className="border-b border-line last:border-b-0">
                <button type="button" className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left" onClick={() => onEdit(item)}>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{item.name}</span>
                    <span className="block text-sm text-muted">
                      {vendorLabel(item.vendor)}
                      {item.unit ? ` · ${item.unit}` : ""}
                      {item.parLevel === null ? " · Par not set" : ` · Par ${formatQty(item.parLevel)}`}
                    </span>
                  </span>
                  <ItemBadges item={item} />
                </button>
              </li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}
