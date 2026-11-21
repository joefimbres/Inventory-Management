import assert from "node:assert/strict";
import { test } from "node:test";
import { seedState } from "./seed";
import { describeChanges, mergeSharedSave } from "./shared-save";
import type { InventoryState, Item } from "./types";

function withItem(state: InventoryState, id: string, patch: Partial<Item>, updatedAt: string): InventoryState {
  return {
    ...state,
    updatedAt,
    items: state.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
  };
}

test("a save based on the current list replaces it", () => {
  const current = seedState();
  const incoming = withItem(current, "whole_milk", { onHand: 1 }, "2026-11-21T20:00:00.000Z");
  const merged = mergeSharedSave(current, {
    state: incoming,
    baseUpdatedAt: current.updatedAt,
    ...describeChanges(current, incoming),
  });
  assert.equal(merged.items.find((item) => item.id === "whole_milk")?.onHand, 1);
  assert.equal(merged.updatedAt, incoming.updatedAt);
});

test("a stale save does not wipe another phone's edit", () => {
  const base = seedState();
  const server = withItem(base, "whole_milk", { onHand: 4, stock: "ok" }, "2026-11-21T20:01:00.000Z");
  const phone = withItem(base, "egg", { stock: "out", orderQty: 2 }, "2026-11-21T20:02:00.000Z");
  const merged = mergeSharedSave(server, {
    state: phone,
    baseUpdatedAt: base.updatedAt,
    ...describeChanges(base, phone),
  });
  assert.equal(merged.items.find((item) => item.id === "whole_milk")?.onHand, 4);
  assert.equal(merged.items.find((item) => item.id === "whole_milk")?.stock, "ok");
  assert.equal(merged.items.find((item) => item.id === "egg")?.stock, "out");
  assert.equal(merged.items.find((item) => item.id === "egg")?.orderQty, 2);
  assert.equal(merged.items.length, base.items.length);
});

test("removing an item from a stale save deletes only that item", () => {
  const base = seedState();
  const server = withItem(base, "whole_milk", { note: "from the other phone" }, "2026-11-21T20:03:00.000Z");
  const phone: InventoryState = {
    ...base,
    updatedAt: "2026-11-21T20:04:00.000Z",
    items: base.items.filter((item) => item.id !== "egg"),
  };
  const merged = mergeSharedSave(server, {
    state: phone,
    baseUpdatedAt: base.updatedAt,
    ...describeChanges(base, phone),
  });
  assert.equal(merged.items.some((item) => item.id === "egg"), false);
  assert.equal(merged.items.find((item) => item.id === "whole_milk")?.note, "from the other phone");
});
