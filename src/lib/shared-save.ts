import type { InventoryState } from "./types";

export type RemoteMode = "blob" | "shared";

export interface SaveChanges {
  changedItemIds: string[];
  removedItemIds: string[];
  changedBatchIds: string[];
  removedBatchIds: string[];
}

export interface SharedSave extends SaveChanges {
  state: InventoryState;
  /** Updated time of the shared copy this phone edited. Null means replace the whole list. */
  baseUpdatedAt: string | null;
}

export function isRemoteMode(mode: string | undefined): mode is RemoteMode {
  switch (mode) {
    case "blob":
    case "shared":
      return true;
    default:
      return false;
  }
}

export function describeChanges(base: InventoryState, next: InventoryState): SaveChanges {
  const baseItems = new Map(base.items.map((item) => [item.id, JSON.stringify(item)]));
  const nextItems = new Map(next.items.map((item) => [item.id, item]));
  const changedItemIds: string[] = [];
  const removedItemIds: string[] = [];
  for (const [id, item] of nextItems) {
    if (baseItems.get(id) !== JSON.stringify(item)) changedItemIds.push(id);
  }
  for (const id of baseItems.keys()) {
    if (!nextItems.has(id)) removedItemIds.push(id);
  }

  const baseBatches = new Map(base.batches.map((batch) => [batch.id, JSON.stringify(batch)]));
  const nextBatches = new Map(next.batches.map((batch) => [batch.id, batch]));
  const changedBatchIds: string[] = [];
  const removedBatchIds: string[] = [];
  for (const [id, batch] of nextBatches) {
    if (baseBatches.get(id) !== JSON.stringify(batch)) changedBatchIds.push(id);
  }
  for (const id of baseBatches.keys()) {
    if (!nextBatches.has(id)) removedBatchIds.push(id);
  }

  return { changedItemIds, removedItemIds, changedBatchIds, removedBatchIds };
}

/** Apply the edits listed in `save` onto `current`. Does not replace untouched rows. */
export function overlayChanges(current: InventoryState, save: SharedSave): InventoryState {
  const incomingItems = new Map(save.state.items.map((item) => [item.id, item]));
  const items = new Map(current.items.map((item) => [item.id, item]));
  for (const id of save.removedItemIds) items.delete(id);
  for (const id of save.changedItemIds) {
    const next = incomingItems.get(id);
    if (next) items.set(id, next);
    else items.delete(id);
  }

  const incomingBatches = new Map(save.state.batches.map((batch) => [batch.id, batch]));
  const batches = new Map(current.batches.map((batch) => [batch.id, batch]));
  for (const id of save.removedBatchIds) batches.delete(id);
  for (const id of save.changedBatchIds) {
    const next = incomingBatches.get(id);
    if (next) batches.set(id, next);
    else batches.delete(id);
  }

  return {
    version: 1,
    items: [...items.values()],
    batches: [...batches.values()],
    updatedAt: save.state.updatedAt,
  };
}

/**
 * Fold one phone's edits onto the latest shared list.
 * A save based on the current copy replaces it. A save based on an older copy
 * only writes the items and order batches that phone actually changed.
 */
export function mergeSharedSave(current: InventoryState, save: SharedSave): InventoryState {
  if (!save.baseUpdatedAt || current.updatedAt === save.baseUpdatedAt) return save.state;
  return overlayChanges(current, save);
}
