import type { InventoryState, Item } from "./types";
import raw from "./seed-items.json";

export const SEED_UPDATED_AT = "2026-11-20T18:00:00.000Z";
export const STORAGE_KEY = "hhc-inventory-v1";

export function seedState(): InventoryState {
  return {
    version: 1,
    items: structuredClone(raw) as Item[],
    batches: [],
    updatedAt: SEED_UPDATED_AT,
  };
}
