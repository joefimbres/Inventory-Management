export const CATEGORIES = [
  "Dairy",
  "Eggs",
  "Bakery",
  "Produce",
  "Meat & seafood",
  "Syrups",
  "Coffee",
  "Tea",
  "Beverages",
  "Condiments",
  "Spices & dry goods",
  "Disposables",
] as const;

export const VENDOR_IDS = ["sams", "sysco", "triple-f", "other"] as const;

export type Category = (typeof CATEGORIES)[number];
export type VendorId = (typeof VENDOR_IDS)[number];
export type Listing = "menu" | "estimated" | "inferred";
export type StockFlag = "unset" | "ok" | "low" | "out";
export type LineStatus = "submitted" | "ordered" | "received";

export interface Item {
  id: string;
  name: string;
  category: string;
  vendor: VendorId;
  unit: string;
  parLevel: number | null;
  onHand: number | null;
  stock: StockFlag;
  orderQty: number | null;
  note: string;
  listing: Listing;
  discontinued: boolean;
  otherPlatform: boolean;
  priority: boolean;
  requestedBy: string;
  neededBy: string;
  usedIn: string;
  activeBatchId: string | null;
}

export interface OrderLine {
  itemId: string;
  name: string;
  category: string;
  vendor: VendorId;
  unit: string;
  qty: number | null;
  note: string;
  priority: boolean;
  neededBy: string;
  stock: "low" | "out";
  status: LineStatus;
  orderedAt: string | null;
  receivedAt: string | null;
}

export interface OrderBatch {
  id: string;
  submittedAt: string;
  lines: OrderLine[];
}

export interface InventoryState {
  version: 1;
  items: Item[];
  batches: OrderBatch[];
  updatedAt: string;
}

export interface CatalogInput {
  name: string;
  category: string;
  vendor: VendorId;
  unit: string;
  parLevel: number | null;
  discontinued: boolean;
  estimated: boolean;
}
