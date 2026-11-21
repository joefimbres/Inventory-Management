import assert from "node:assert/strict";
import { test } from "node:test";
import {
  belowPar,
  draftLines,
  needsOrder,
  orderSummary,
  parseQty,
  pendingCount,
  pullLine,
  sanitizeState,
  sendToJoe,
  setLineStatus,
  setOnHand,
  setVendorStatus,
} from "./inventory";
import { seedState } from "./seed";
import { CATEGORIES } from "./types";

test("seed leaves every count blank and keeps the Nov 20 requests", () => {
  const state = seedState();
  assert.equal(state.items.length, 152);
  assert.ok(state.items.every((item) => item.parLevel === null && item.onHand === null));
  const ids = state.items.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const item of state.items) {
    assert.ok(CATEGORIES.includes(item.category as (typeof CATEGORIES)[number]), item.category);
    assert.equal(JSON.stringify(item).toLowerCase().includes("price"), false);
  }

  const soy = state.items.find((item) => item.id === "soy_milk");
  assert.ok(soy);
  assert.equal(soy.discontinued, true);
  assert.equal(needsOrder(soy), false);

  const milk = state.items.find((item) => item.id === "whole_milk");
  assert.ok(milk);
  assert.equal(milk.vendor, "sams");
  assert.equal(milk.orderQty, 2);
  assert.equal(milk.onHand, null);
  assert.equal(needsOrder(milk), true);

  const cookie = state.items.find((item) => item.id === "syr_cookie");
  assert.ok(cookie);
  assert.equal(cookie.priority, true);
  assert.equal(cookie.orderQty, 3);
  assert.equal(cookie.name, "Cookie dough syrup");

  const butter = state.items.find((item) => item.id === "butter");
  assert.equal(butter?.listing, "estimated");
  assert.equal(draftLines(state).length, 26);
});

test("blank on-hand is not zero, and a counted zero stays zero", () => {
  assert.equal(parseQty(""), null);
  assert.equal(parseQty(null), null);
  assert.equal(parseQty(0), 0);
  const state = setOnHand(seedState(), "whole_milk", 0);
  assert.equal(state.items.find((item) => item.id === "whole_milk")?.onHand, 0);
  assert.equal(belowPar({ ...state.items[0], parLevel: 2, onHand: null, stock: "unset" }), false);
  assert.equal(belowPar({ ...state.items[0], parLevel: 2, onHand: 2, stock: "unset" }), true);
  assert.equal(belowPar({ ...state.items[0], parLevel: null, onHand: 0, stock: "unset" }), false);
});

test("send, order, and receive round trip", () => {
  const now = "2026-11-21T18:00:00.000Z";
  const sent = sendToJoe(seedState(), now);
  assert.ok(sent.batch);
  assert.equal(draftLines(sent.state).length, 0);
  assert.equal(pendingCount(sent.state), 26);
  assert.equal(sendToJoe(sent.state, now).batch, null);

  const summary = orderSummary(sent.batch);
  assert.match(summary, /SAM'S CLUB/);
  assert.match(summary, /SYSCO/);
  assert.match(summary, /TRIPLE F/);
  assert.match(summary, /OTHER \/ UNKNOWN/);
  assert.match(summary, /Whole milk — 2 gal/);
  assert.match(summary, /Cookie dough syrup — 3 — PRIORITY/);
  assert.equal(summary.includes("$"), false);
  assert.equal(summary.toLowerCase().includes("price"), false);
  assert.match(summary, /\(nothing\)/);

  const ordered = setVendorStatus(sent.state, sent.batch.id, "sams", "ordered", now);
  const milkLine = ordered.batches[0].lines.find((line) => line.itemId === "whole_milk");
  assert.equal(milkLine?.status, "ordered");
  assert.equal(ordered.items.find((item) => item.id === "whole_milk")?.activeBatchId, sent.batch.id);

  const received = setLineStatus(ordered, sent.batch.id, "whole_milk", "received", now);
  const milk = received.items.find((item) => item.id === "whole_milk");
  assert.equal(milk?.stock, "ok");
  assert.equal(milk?.onHand, null);
  assert.equal(milk?.activeBatchId, null);
  assert.equal(milk?.orderQty, null);
  assert.equal(pendingCount(received), 25);

  const undone = setLineStatus(received, sent.batch.id, "whole_milk", "ordered", now);
  const restored = undone.items.find((item) => item.id === "whole_milk");
  assert.equal(restored?.activeBatchId, sent.batch.id);
  assert.equal(restored?.stock, "low");
  assert.equal(restored?.orderQty, 2);
  assert.equal(needsOrder(restored!), false);
});

test("a submitted line can come off the list before it is ordered", () => {
  const sent = sendToJoe(seedState(), "2026-11-21T18:00:00.000Z");
  assert.ok(sent.batch);
  const pulled = pullLine(sent.state, sent.batch.id, "whole_milk");
  const milk = pulled.items.find((item) => item.id === "whole_milk");
  assert.equal(milk?.activeBatchId, null);
  assert.equal(needsOrder(milk!), true);
  assert.equal(pulled.batches[0].lines.some((line) => line.itemId === "whole_milk"), false);

  const ordered = setLineStatus(sent.state, sent.batch.id, "whole_milk", "ordered", "2026-11-21T19:00:00.000Z");
  const stuck = pullLine(ordered, sent.batch.id, "whole_milk");
  assert.equal(stuck, ordered);
});

test("a sent list survives a save and reload", () => {
  const sent = sendToJoe(seedState(), "2026-11-21T18:00:00.000Z");
  const clean = sanitizeState(JSON.parse(JSON.stringify(sent.state)) as unknown);
  assert.ok(clean);
  assert.equal(clean.batches.length, 1);
  assert.equal(clean.batches[0].lines.length, 26);
  assert.equal(clean.items.find((item) => item.id === "whole_milk")?.activeBatchId, clean.batches[0].id);
  assert.equal(draftLines(clean).length, 0);
});

test("sanitize drops prices and phone numbers and keeps a real zero", () => {
  const clean = sanitizeState({
    version: 1,
    updatedAt: "2026-11-21T00:00:00.000Z",
    items: [
      {
        id: "whole_milk",
        name: "Whole milk",
        price: 4.5,
        cost: 3,
        phone: "808-555-0100",
        onHand: 0,
        parLevel: "",
        stock: "low",
        vendor: "sams",
        category: "Dairy",
        listing: "menu",
      },
    ],
    batches: [],
  });
  assert.ok(clean);
  assert.equal(clean.items[0].onHand, 0);
  assert.equal(clean.items[0].parLevel, null);
  const serialized = JSON.stringify(clean);
  assert.equal(serialized.includes("4.5"), false);
  assert.equal(serialized.includes("808"), false);
  assert.equal("price" in clean.items[0], false);

  const blank = sanitizeState({
    version: 1,
    items: [{ id: "eggs", name: "Eggs", category: "Eggs" }],
  });
  assert.equal(blank?.items[0].onHand, null);
  assert.equal(blank?.items[0].parLevel, null);
  assert.equal(blank?.items[0].stock, "unset");
});
