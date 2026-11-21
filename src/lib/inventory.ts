import type {
  CatalogInput,
  InventoryState,
  Item,
  LineStatus,
  OrderBatch,
  OrderLine,
  StockFlag,
  VendorId,
} from "./types";
import { CATEGORIES, VENDOR_IDS } from "./types";

const ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,80}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const CATEGORY_SET = new Set<string>(CATEGORIES);

export function vendorLabel(vendor: VendorId): string {
  switch (vendor) {
    case "sams":
      return "Sam's Club";
    case "sysco":
      return "Sysco";
    case "triple-f":
      return "Triple F";
    case "other":
      return "Other / unknown";
    default: {
      const unexpected: never = vendor;
      throw new Error(`Unexpected vendor: ${String(unexpected)}`);
    }
  }
}

export function stockLabel(stock: StockFlag): string {
  switch (stock) {
    case "unset":
      return "Not counted";
    case "ok":
      return "In stock";
    case "low":
      return "Low";
    case "out":
      return "Out";
    default: {
      const unexpected: never = stock;
      throw new Error(`Unexpected stock: ${String(unexpected)}`);
    }
  }
}

export function statusLabel(status: LineStatus): string {
  switch (status) {
    case "submitted":
      return "To order";
    case "ordered":
      return "Ordered";
    case "received":
      return "Received";
    default: {
      const unexpected: never = status;
      throw new Error(`Unexpected status: ${String(unexpected)}`);
    }
  }
}

export function parseQty(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(number) || number < 0) return null;
  return Math.round(number * 100) / 100;
}

export function parseQtyInput(raw: string): { ok: true; value: number | null } | { ok: false } {
  const trimmed = raw.trim();
  if (trimmed === "") return { ok: true, value: null };
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return { ok: false };
  return { ok: true, value: parseQty(trimmed) };
}

export function formatQty(value: number | null): string {
  if (value === null) return "";
  return Number.isInteger(value) ? String(value) : String(value);
}

export function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Pacific/Honolulu",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return isoDate;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Pacific/Honolulu",
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

export function needsOrder(item: Item): boolean {
  if (item.discontinued || item.activeBatchId) return false;
  return item.stock === "low" || item.stock === "out";
}

export function belowPar(item: Item): boolean {
  if (item.stock !== "unset" || item.parLevel === null || item.onHand === null) return false;
  return item.onHand <= item.parLevel;
}

export function lineForItem(state: InventoryState, item: Item): OrderLine | null {
  if (!item.activeBatchId) return null;
  const batch = state.batches.find((entry) => entry.id === item.activeBatchId);
  return batch?.lines.find((line) => line.itemId === item.id) ?? null;
}

export function pendingCount(state: InventoryState): number {
  return state.batches.reduce(
    (total, batch) => total + batch.lines.filter((line) => line.status !== "received").length,
    0,
  );
}

export function groupByCategory(items: Item[]): { category: string; items: Item[] }[] {
  const buckets = new Map<string, Item[]>();
  for (const item of items) {
    const list = buckets.get(item.category);
    if (list) list.push(item);
    else buckets.set(item.category, [item]);
  }
  const extras = [...buckets.keys()].filter((category) => !CATEGORY_SET.has(category)).sort();
  const ordered = [...CATEGORIES.filter((category) => buckets.has(category)), ...extras];
  return ordered.map((category) => ({
    category,
    items: sortForCount(buckets.get(category) ?? []),
  }));
}

function sortForCount(items: Item[]): Item[] {
  return [...items].sort((a, b) => {
    const rank = (item: Item) => {
      if (item.discontinued) return 3;
      if (needsOrder(item)) return 0;
      if (item.activeBatchId) return 1;
      return 2;
    };
    const diff = rank(a) - rank(b);
    if (diff !== 0) return diff;
    return a.name.localeCompare(b.name);
  });
}

function vendorRank(vendor: VendorId): number {
  switch (vendor) {
    case "sams":
      return 0;
    case "sysco":
      return 1;
    case "triple-f":
      return 2;
    case "other":
      return 3;
    default: {
      const unexpected: never = vendor;
      throw new Error(`Unexpected vendor: ${String(unexpected)}`);
    }
  }
}

function compareLines(a: OrderLine, b: OrderLine): number {
  const vendor = vendorRank(a.vendor) - vendorRank(b.vendor);
  if (vendor !== 0) return vendor;
  if (a.priority !== b.priority) return a.priority ? -1 : 1;
  const category = a.category.localeCompare(b.category);
  if (category !== 0) return category;
  return a.name.localeCompare(b.name);
}

function toLine(item: Item): OrderLine {
  return {
    itemId: item.id,
    name: item.name,
    category: item.category,
    vendor: item.vendor,
    unit: item.unit,
    qty: item.orderQty,
    note: item.note,
    priority: item.priority,
    neededBy: item.neededBy,
    stock: item.stock === "out" ? "out" : "low",
    status: "submitted",
    orderedAt: null,
    receivedAt: null,
  };
}

export function draftLines(state: InventoryState): OrderLine[] {
  return state.items.filter(needsOrder).map(toLine).sort(compareLines);
}

export function groupLines(lines: OrderLine[]): { vendor: VendorId; lines: OrderLine[] }[] {
  return VENDOR_IDS.map((vendor) => ({
    vendor,
    lines: lines.filter((line) => line.vendor === vendor),
  }));
}

export function sendToJoe(
  state: InventoryState,
  now: string,
): { state: InventoryState; batch: OrderBatch | null } {
  const lines = draftLines(state);
  if (lines.length === 0) return { state, batch: null };
  const batch: OrderBatch = {
    id: `b-${crypto.randomUUID()}`,
    submittedAt: now,
    lines,
  };
  const ids = new Set(lines.map((line) => line.itemId));
  return {
    batch,
    state: {
      ...state,
      batches: [batch, ...state.batches],
      items: state.items.map((item) => (ids.has(item.id) ? { ...item, activeBatchId: batch.id } : item)),
    },
  };
}

function withStatus(line: OrderLine, status: LineStatus, now: string): OrderLine {
  switch (status) {
    case "submitted":
      return { ...line, status, orderedAt: null, receivedAt: null };
    case "ordered":
      return { ...line, status, orderedAt: line.orderedAt ?? now, receivedAt: null };
    case "received":
      return { ...line, status, orderedAt: line.orderedAt ?? now, receivedAt: now };
    default: {
      const unexpected: never = status;
      throw new Error(`Unexpected status: ${String(unexpected)}`);
    }
  }
}

function syncItem(item: Item, line: OrderLine, batchId: string, status: LineStatus): Item {
  if (item.id !== line.itemId) return item;
  if (status === "received") {
    if (item.activeBatchId !== batchId) return item;
    return { ...item, stock: "ok", orderQty: null, priority: false, activeBatchId: null };
  }
  if (item.activeBatchId && item.activeBatchId !== batchId) return item;
  return {
    ...item,
    stock: line.stock,
    orderQty: line.qty,
    priority: line.priority,
    activeBatchId: batchId,
  };
}

export function setLineStatus(
  state: InventoryState,
  batchId: string,
  itemId: string,
  status: LineStatus,
  now: string,
): InventoryState {
  const batch = state.batches.find((entry) => entry.id === batchId);
  const current = batch?.lines.find((line) => line.itemId === itemId);
  if (!batch || !current || current.status === status) return state;
  const line = withStatus(current, status, now);
  return {
    ...state,
    batches: state.batches.map((entry) =>
      entry.id === batchId
        ? { ...entry, lines: entry.lines.map((existing) => (existing.itemId === itemId ? line : existing)) }
        : entry,
    ),
    items: state.items.map((item) => syncItem(item, line, batchId, status)),
  };
}

export function setVendorStatus(
  state: InventoryState,
  batchId: string,
  vendor: VendorId,
  status: LineStatus,
  now: string,
): InventoryState {
  const batch = state.batches.find((entry) => entry.id === batchId);
  if (!batch) return state;
  let next = state;
  for (const line of batch.lines) {
    if (line.vendor !== vendor) continue;
    if (status === "ordered" && line.status !== "submitted") continue;
    if (status === "received" && line.status === "received") continue;
    next = setLineStatus(next, batchId, line.itemId, status, now);
  }
  return next;
}

export function pullLine(state: InventoryState, batchId: string, itemId: string): InventoryState {
  const batch = state.batches.find((entry) => entry.id === batchId);
  const line = batch?.lines.find((entry) => entry.itemId === itemId);
  if (!batch || !line || line.status !== "submitted") return state;
  const lines = batch.lines.filter((entry) => entry.itemId !== itemId);
  return {
    ...state,
    batches:
      lines.length === 0
        ? state.batches.filter((entry) => entry.id !== batchId)
        : state.batches.map((entry) => (entry.id === batchId ? { ...entry, lines } : entry)),
    items: state.items.map((item) =>
      item.id === itemId && item.activeBatchId === batchId ? { ...item, activeBatchId: null } : item,
    ),
  };
}

export function orderSummary(batch: OrderBatch): string {
  const showStatus = batch.lines.some((line) => line.status !== "submitted");
  const chunks = ["Hiking Hawaii Cafe", `Order list · ${formatWhen(batch.submittedAt)} HST`, ""];
  for (const vendor of VENDOR_IDS) {
    const lines = batch.lines.filter((line) => line.vendor === vendor);
    chunks.push(vendorLabel(vendor).toUpperCase());
    if (lines.length === 0) {
      chunks.push("(nothing)");
    } else {
      for (const line of lines) chunks.push(`- ${lineText(line, showStatus)}`);
    }
    chunks.push("");
  }
  return `${chunks.join("\n").trimEnd()}\n`;
}

function lineText(line: OrderLine, showStatus: boolean): string {
  const parts = [line.name];
  const qty = formatQty(line.qty);
  if (qty && line.unit) parts.push(`${qty} ${line.unit}`);
  else if (qty) parts.push(qty);
  else if (line.unit) parts.push(line.unit);
  if (line.priority) parts.push("PRIORITY");
  if (line.neededBy) parts.push(`needed ${formatDate(line.neededBy)}`);
  if (showStatus) parts.push(statusLabel(line.status).toLowerCase());
  const text = parts.join(" — ");
  return line.note ? `${text} (${line.note})` : text;
}

function updateItem(state: InventoryState, id: string, recipe: (item: Item) => Item): InventoryState {
  let changed = false;
  const items = state.items.map((item) => {
    if (item.id !== id) return item;
    const next = recipe(item);
    if (next !== item) changed = true;
    return next;
  });
  return changed ? { ...state, items } : state;
}

export function setStock(state: InventoryState, id: string, stock: StockFlag): InventoryState {
  return updateItem(state, id, (item) => {
    if (item.discontinued || item.activeBatchId || item.stock === stock) return item;
    return { ...item, stock };
  });
}

export function setOnHand(state: InventoryState, id: string, onHand: number | null): InventoryState {
  return updateItem(state, id, (item) => (item.onHand === onHand ? item : { ...item, onHand }));
}

export function setOrderQty(state: InventoryState, id: string, orderQty: number | null): InventoryState {
  return updateItem(state, id, (item) => {
    if (item.activeBatchId || item.orderQty === orderQty) return item;
    return { ...item, orderQty };
  });
}

export function setNote(state: InventoryState, id: string, note: string): InventoryState {
  const trimmed = note.slice(0, 400);
  return updateItem(state, id, (item) => {
    if (item.activeBatchId || item.note === trimmed) return item;
    return { ...item, note: trimmed };
  });
}

export function setVendor(state: InventoryState, id: string, vendor: VendorId): InventoryState {
  return updateItem(state, id, (item) => {
    if (item.activeBatchId || item.vendor === vendor) return item;
    return { ...item, vendor };
  });
}

export function newItemId(name: string, items: Item[]): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "item";
  const taken = new Set(items.map((item) => item.id));
  let id = `c-${base}`;
  let n = 2;
  while (taken.has(id)) {
    id = `c-${base}-${n}`;
    n += 1;
  }
  return id;
}

export function saveCatalog(state: InventoryState, id: string | null, input: CatalogInput): InventoryState {
  const name = input.name.trim().slice(0, 120);
  if (!name) return state;
  const category = input.category.trim().slice(0, 60) || "Other";
  const unit = input.unit.trim().slice(0, 40);
  if (id) {
    return updateItem(state, id, (item) => ({
      ...item,
      name,
      category,
      vendor: input.vendor,
      unit,
      parLevel: input.parLevel,
      discontinued: input.discontinued,
      listing: input.estimated ? "estimated" : item.listing === "estimated" ? "menu" : item.listing,
      stock: input.discontinued ? "unset" : item.stock,
      priority: input.discontinued ? false : item.priority,
      orderQty: input.discontinued ? null : item.orderQty,
    }));
  }
  const item: Item = {
    id: newItemId(name, state.items),
    name,
    category,
    vendor: input.vendor,
    unit,
    parLevel: input.parLevel,
    onHand: null,
    stock: "unset",
    orderQty: null,
    note: "",
    listing: input.estimated ? "estimated" : "menu",
    discontinued: input.discontinued,
    otherPlatform: false,
    priority: false,
    requestedBy: "",
    neededBy: "",
    usedIn: "",
    activeBatchId: null,
  };
  return { ...state, items: [...state.items, item] };
}

export function removeItem(state: InventoryState, id: string): InventoryState {
  if (!state.items.some((item) => item.id === id)) return state;
  return { ...state, items: state.items.filter((item) => item.id !== id) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clip(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function asVendor(value: unknown): VendorId {
  return VENDOR_IDS.find((vendor) => vendor === value) ?? "other";
}

function asStock(value: unknown): StockFlag {
  if (value === "unset" || value === "ok" || value === "low" || value === "out") return value;
  return "unset";
}

function asListing(value: unknown): Item["listing"] {
  if (value === "menu" || value === "estimated" || value === "inferred") return value;
  return "menu";
}

function asStatus(value: unknown): LineStatus {
  if (value === "submitted" || value === "ordered" || value === "received") return value;
  return "submitted";
}

function sanitizeItem(value: unknown): Item | null {
  if (!isRecord(value)) return null;
  const id = clip(value.id, 81);
  const name = clip(value.name, 120);
  if (!ID_PATTERN.test(id) || !name) return null;
  const neededBy = clip(value.neededBy, 10);
  const activeBatchId = clip(value.activeBatchId, 80);
  return {
    id,
    name,
    category: clip(value.category, 60) || "Other",
    vendor: asVendor(value.vendor),
    unit: clip(value.unit, 40),
    parLevel: parseQty(value.parLevel),
    onHand: parseQty(value.onHand),
    stock: asStock(value.stock),
    orderQty: parseQty(value.orderQty),
    note: clip(value.note, 400),
    listing: asListing(value.listing),
    discontinued: value.discontinued === true,
    otherPlatform: value.otherPlatform === true,
    priority: value.priority === true,
    requestedBy: clip(value.requestedBy, 80),
    neededBy: DATE_PATTERN.test(neededBy) ? neededBy : "",
    usedIn: clip(value.usedIn, 180),
    activeBatchId: activeBatchId && ID_PATTERN.test(activeBatchId) ? activeBatchId : null,
  };
}

function sanitizeLine(value: unknown): OrderLine | null {
  if (!isRecord(value)) return null;
  const itemId = clip(value.itemId, 81);
  const name = clip(value.name, 120);
  if (!ID_PATTERN.test(itemId) || !name) return null;
  const neededBy = clip(value.neededBy, 10);
  const stock = value.stock === "out" ? "out" : "low";
  return {
    itemId,
    name,
    category: clip(value.category, 60) || "Other",
    vendor: asVendor(value.vendor),
    unit: clip(value.unit, 40),
    qty: parseQty(value.qty),
    note: clip(value.note, 400),
    priority: value.priority === true,
    neededBy: DATE_PATTERN.test(neededBy) ? neededBy : "",
    stock,
    status: asStatus(value.status),
    orderedAt: typeof value.orderedAt === "string" ? value.orderedAt.slice(0, 40) : null,
    receivedAt: typeof value.receivedAt === "string" ? value.receivedAt.slice(0, 40) : null,
  };
}

function sanitizeBatch(value: unknown): OrderBatch | null {
  if (!isRecord(value) || !Array.isArray(value.lines)) return null;
  const id = clip(value.id, 80);
  if (!ID_PATTERN.test(id)) return null;
  const lines = value.lines.slice(0, 200).map(sanitizeLine).filter((line): line is OrderLine => line !== null);
  if (lines.length === 0) return null;
  return {
    id,
    submittedAt: typeof value.submittedAt === "string" ? value.submittedAt.slice(0, 40) : "",
    lines,
  };
}

export function sanitizeState(input: unknown): InventoryState | null {
  if (!isRecord(input) || input.version !== 1 || !Array.isArray(input.items)) return null;
  const items: Item[] = [];
  const seen = new Set<string>();
  for (const raw of input.items) {
    const item = sanitizeItem(raw);
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    items.push(item);
    if (items.length >= 500) break;
  }
  if (items.length === 0) return null;
  const batches = Array.isArray(input.batches)
    ? input.batches.slice(0, 100).map(sanitizeBatch).filter((batch): batch is OrderBatch => batch !== null)
    : [];
  return {
    version: 1,
    items,
    batches,
    updatedAt: typeof input.updatedAt === "string" ? input.updatedAt.slice(0, 40) : "",
  };
}
