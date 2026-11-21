/**
 * Merge the ingredient master list with the Nov 20, 2026 floor tracker.
 * Par levels and on-hand counts stay null. Blank is not zero.
 * No prices are read or written.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const csvPath = join(root, "data", "ingredient-master-list.csv");
const outPath = join(root, "src", "lib", "seed-items.json");

const CATEGORIES = [
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
];

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function usedIn(row) {
  const raw = row.current_menu_items || row.other_platform_items || "";
  const names = [];
  for (const part of raw.split(";")) {
    const name = part.replace(/\s*\[[^\]]*\]/g, "").trim();
    if (name && !names.includes(name)) names.push(name);
  }
  if (names.length === 0) return "";
  const shown = names.slice(0, 4).join(", ");
  return names.length > 4 ? `${shown} +${names.length - 4}` : shown;
}

function categoryFor(section, name) {
  if (section.startsWith("Dairy")) return "Dairy";
  if (section === "Eggs") return "Eggs";
  if (section === "Bakery") return "Bakery";
  if (section === "Produce") return "Produce";
  if (section.startsWith("Meat")) return "Meat & seafood";
  if (section.startsWith("Dry goods")) return "Spices & dry goods";
  if (section.startsWith("Sauces")) return /syrup/i.test(name) ? "Syrups" : "Condiments";
  if (section.startsWith("Coffee")) {
    if (/syrup/i.test(name)) return "Syrups";
    if (/\btea\b/i.test(name) || /chai/i.test(name)) return "Tea";
    return "Coffee";
  }
  if (section === "Beverages") return "Beverages";
  throw new Error(`Unknown section: ${section}`);
}

function listingFor(status) {
  if (status === "ESTIMATED") return "estimated";
  if (status === "INFERRED") return "inferred";
  if (status === "STATED") return "menu";
  throw new Error(`Unknown status: ${status}`);
}

function blankItem(partial) {
  return {
    id: partial.id,
    name: partial.name,
    category: partial.category,
    vendor: partial.vendor ?? "other",
    unit: partial.unit ?? "",
    parLevel: null,
    onHand: null,
    stock: partial.stock ?? "unset",
    orderQty: partial.orderQty ?? null,
    note: partial.note ?? "",
    listing: partial.listing ?? "menu",
    discontinued: partial.discontinued ?? false,
    otherPlatform: partial.otherPlatform ?? false,
    priority: partial.priority ?? false,
    requestedBy: partial.requestedBy ?? "",
    neededBy: partial.neededBy ?? "",
    usedIn: partial.usedIn ?? "",
    activeBatchId: null,
  };
}

const rows = parseCsv(readFileSync(csvPath, "utf8"));
const header = rows[0];
const records = rows.slice(1).filter((row) => row.some((cell) => cell.trim() !== "")).map((row) => {
  const record = {};
  header.forEach((key, index) => {
    record[key] = row[index] ?? "";
  });
  return record;
});

const byId = new Map();
for (const row of records) {
  const item = blankItem({
    id: row.key,
    name: row.ingredient,
    category: categoryFor(row.section, row.ingredient),
    note: row.note,
    listing: listingFor(row.overall_status),
    discontinued: row.discontinued === "yes",
    otherPlatform: row.only_on_old_or_other_platforms === "yes",
    usedIn: usedIn(row),
  });
  if (byId.has(item.id)) throw new Error(`Duplicate key ${item.id}`);
  byId.set(item.id, item);
}

const overlays = {
  soy_milk: {
    name: "Soy milk",
    discontinued: true,
    stock: "unset",
    note: "Discontinued — phasing out as of Nov 20, 2026. Still listed as a SkyTab option.",
  },
  hoagie: {
    unit: "bag of 6",
    stock: "low",
    orderQty: 3,
    requestedBy: "Chris",
    neededBy: "2026-11-21",
    note: "3 bags of 6 requested.",
  },
  avocado: {
    stock: "low",
    requestedBy: "Chris",
    neededBy: "2026-11-21",
  },
  bell_pepper: {
    stock: "low",
    requestedBy: "Chris",
    neededBy: "2026-11-21",
  },
  mushroom: {
    name: "Cremini mushrooms",
    stock: "low",
    requestedBy: "Chris",
    neededBy: "2026-11-21",
    note: "Menu lists these as mushrooms.",
  },
  potato: {
    name: "Russet potatoes",
    unit: "bag",
    stock: "low",
    orderQty: 1,
    requestedBy: "Chris",
    neededBy: "2026-11-21",
    note: "1 bag requested.",
  },
  syr_cookie: {
    name: "Cookie dough syrup",
    stock: "low",
    orderQty: 3,
    priority: true,
    requestedBy: "FOH",
    note: "Top priority.",
  },
  syr_macnut: {
    name: "Mac nut syrup",
    stock: "low",
    orderQty: 2,
    requestedBy: "FOH",
  },
  syr_vanilla: {
    name: "Vanilla syrup",
    stock: "low",
    orderQty: 1,
    requestedBy: "FOH",
  },
  espresso: {
    name: "Espresso beans (Royal Kona)",
    stock: "low",
    requestedBy: "FOH",
    note: "Royal Kona Espresso Roast, 10% Kona blend, Hawaii Coffee Company.",
  },
};

for (const [id, patch] of Object.entries(overlays)) {
  const current = byId.get(id);
  if (!current) throw new Error(`Overlay missing ${id}`);
  byId.set(id, { ...current, ...patch, parLevel: null, onHand: null, activeBatchId: null });
}

const extras = [
  blankItem({
    id: "banana_muffins",
    name: "Banana muffins",
    category: "Bakery",
    stock: "low",
    requestedBy: "FOH",
  }),
  blankItem({
    id: "cinnamon_muffins",
    name: "Cinnamon muffins",
    category: "Bakery",
    stock: "low",
    requestedBy: "FOH",
  }),
  blankItem({
    id: "croissants",
    name: "Croissants",
    category: "Bakery",
    vendor: "sams",
    stock: "low",
    requestedBy: "Chris and FOH",
    neededBy: "2026-11-20",
    note: "On Chris’s list and both FOH lists. No quantity given.",
  }),
  blankItem({
    id: "whipping_cream",
    name: "Heavy whipping cream",
    category: "Dairy",
    unit: "qt",
    stock: "low",
    orderQty: 4,
    requestedBy: "Chris",
    neededBy: "2026-11-21",
    note: "4 qt requested.",
  }),
  blankItem({
    id: "whole_milk",
    name: "Whole milk",
    category: "Dairy",
    vendor: "sams",
    unit: "gal",
    stock: "low",
    orderQty: 2,
    requestedBy: "Chris",
    neededBy: "2026-11-20",
    note: "2 gallons requested.",
  }),
  blankItem({
    id: "papaya",
    name: "Papaya",
    category: "Produce",
    stock: "low",
    requestedBy: "Chris",
    neededBy: "2026-11-21",
    note: "Separate from the generic tropical-fruit line.",
  }),
  blankItem({
    id: "tea_chamomile",
    name: "Cozy Chamomile tea bags",
    category: "Tea",
    stock: "low",
    requestedBy: "FOH",
  }),
  blankItem({
    id: "tea_earl_grey",
    name: "Earl Grey tea bags",
    category: "Tea",
    stock: "low",
    requestedBy: "FOH",
  }),
  blankItem({
    id: "tea_english_breakfast",
    name: "English Breakfast tea bags",
    category: "Tea",
    stock: "low",
    requestedBy: "FOH",
  }),
  blankItem({
    id: "tea_green",
    name: "Green tea bags",
    category: "Tea",
    stock: "low",
    requestedBy: "FOH",
    note: "Type or brand not confirmed.",
  }),
  blankItem({
    id: "tea_herbal",
    name: "Herbal tea bags",
    category: "Tea",
    stock: "low",
    requestedBy: "FOH",
    note: "May be the same as Cozy Chamomile. Confirm before ordering.",
  }),
  blankItem({
    id: "ginger_ale",
    name: "Ginger ale",
    category: "Beverages",
    stock: "low",
    requestedBy: "FOH",
  }),
  blankItem({
    id: "ito_en",
    name: "Ito En green tea",
    category: "Beverages",
    stock: "low",
    requestedBy: "FOH",
  }),
  blankItem({
    id: "pepsi",
    name: "Pepsi",
    category: "Beverages",
    stock: "low",
    requestedBy: "FOH",
  }),
  blankItem({
    id: "sprite",
    name: "Sprite",
    category: "Beverages",
    stock: "low",
    requestedBy: "FOH",
  }),
  blankItem({
    id: "ketchup_packets",
    name: "Ketchup packets",
    category: "Condiments",
    stock: "low",
    requestedBy: "FOH",
    note: "Packets, not bottles.",
  }),
  blankItem({
    id: "hot_cups",
    name: "Large hot cups",
    category: "Disposables",
    stock: "low",
    requestedBy: "FOH",
  }),
];

for (const extra of extras) {
  if (byId.has(extra.id)) throw new Error(`Extra id collides with master list: ${extra.id}`);
  byId.set(extra.id, extra);
}

const items = [...byId.values()].sort((a, b) => {
  const category = CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category);
  if (category !== 0) return category;
  return a.name.localeCompare(b.name);
});

for (const item of items) {
  if (item.parLevel !== null || item.onHand !== null) {
    throw new Error(`Count was filled in for ${item.id}`);
  }
  if (JSON.stringify(item).toLowerCase().includes("price")) {
    throw new Error(`Price-like text on ${item.id}`);
  }
}

writeFileSync(outPath, `${JSON.stringify(items, null, 2)}\n`);

const low = items.filter((item) => item.stock === "low").length;
const estimated = items.filter((item) => item.listing === "estimated").length;
const inferred = items.filter((item) => item.listing === "inferred").length;
const discontinued = items.filter((item) => item.discontinued).length;
console.log(
  `Wrote ${items.length} items (${records.length} from the master list, ${extras.length} tracker-only). Low ${low}, estimated ${estimated}, inferred ${inferred}, discontinued ${discontinued}.`,
);
