import { connection, NextResponse } from "next/server";
import { hasUnlock } from "@/lib/auth";
import { blobConfigured, loadBlobState, saveBlobState } from "@/lib/blob-store";
import { sanitizeState } from "@/lib/inventory";
import { readShared, redisCredentials, writeShared, writeSharedIfEmpty } from "@/lib/redis";
import { seedState } from "@/lib/seed";
import { mergeSharedSave, type SharedSave } from "@/lib/shared-save";
import type { InventoryState } from "@/lib/types";

const noStore = { "Cache-Control": "no-store" };

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: noStore });
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string").slice(0, 500);
}

function readSave(input: unknown): SharedSave | null {
  if (!input || typeof input !== "object") return null;
  const record = input as Record<string, unknown>;
  const state = sanitizeState(record.state ?? input);
  if (!state) return null;
  const base = record.baseUpdatedAt;
  return {
    state,
    baseUpdatedAt: typeof base === "string" ? base.slice(0, 40) : null,
    changedItemIds: asStringList(record.changedItemIds),
    removedItemIds: asStringList(record.removedItemIds),
    changedBatchIds: asStringList(record.changedBatchIds),
    removedBatchIds: asStringList(record.removedBatchIds),
  };
}

async function loadRedis(): Promise<InventoryState> {
  const stored = sanitizeState(await readShared<unknown>());
  if (stored) return stored;
  const seed = seedState();
  await writeSharedIfEmpty(seed);
  return sanitizeState(await readShared<unknown>()) ?? seed;
}

async function saveRedis(save: SharedSave): Promise<InventoryState> {
  const current = sanitizeState(await readShared<unknown>());
  const next = current ? mergeSharedSave(current, save) : save.state;
  await writeShared(next);
  return next;
}

export async function GET() {
  await connection();
  if (!(await hasUnlock())) return json({ pinRequired: true }, 401);

  if (blobConfigured()) {
    try {
      const state = await loadBlobState();
      return json({ mode: "blob", state });
    } catch {
      return json({ mode: "local", warning: "unavailable", state: null });
    }
  }

  if (redisCredentials()) {
    try {
      const state = await loadRedis();
      return json({ mode: "shared", state });
    } catch {
      return json({ mode: "local", warning: "unavailable", state: null });
    }
  }

  return json({ mode: "local", warning: "unconfigured", state: null });
}

export async function PUT(request: Request) {
  await connection();
  if (!(await hasUnlock())) return json({ pinRequired: true }, 401);

  let text: string;
  try {
    text = await request.text();
  } catch {
    return json({ error: "invalid" }, 400);
  }
  if (text.length > 1_500_000) return json({ error: "too large" }, 413);

  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    return json({ error: "invalid" }, 400);
  }
  const save = readSave(parsed);
  if (!save) return json({ error: "invalid" }, 400);

  if (blobConfigured()) {
    try {
      const state = await saveBlobState(save);
      return json({ mode: "blob", state });
    } catch {
      return json({ mode: "local", warning: "unavailable" }, 503);
    }
  }

  if (redisCredentials()) {
    try {
      const state = await saveRedis(save);
      return json({ mode: "shared", state });
    } catch {
      return json({ mode: "local", warning: "unavailable" }, 503);
    }
  }

  return json({ mode: "local", warning: "unconfigured" });
}
