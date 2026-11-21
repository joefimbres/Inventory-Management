import { connection, NextResponse } from "next/server";
import { hasUnlock } from "@/lib/auth";
import { sanitizeState } from "@/lib/inventory";
import { readShared, redisCredentials, writeShared, writeSharedIfEmpty } from "@/lib/redis";
import { seedState } from "@/lib/seed";

const noStore = { "Cache-Control": "no-store" };

export async function GET() {
  await connection();
  if (!(await hasUnlock())) {
    return NextResponse.json({ pinRequired: true }, { status: 401, headers: noStore });
  }
  if (!redisCredentials()) {
    return NextResponse.json({ mode: "local", warning: "unconfigured", state: null }, { headers: noStore });
  }
  try {
    let stored = await readShared<unknown>();
    if (!stored) {
      await writeSharedIfEmpty(seedState());
      stored = await readShared<unknown>();
    }
    const state = sanitizeState(stored) ?? seedState();
    return NextResponse.json({ mode: "shared", state }, { headers: noStore });
  } catch {
    return NextResponse.json({ mode: "local", warning: "unavailable", state: null }, { headers: noStore });
  }
}

export async function PUT(request: Request) {
  await connection();
  if (!(await hasUnlock())) {
    return NextResponse.json({ pinRequired: true }, { status: 401, headers: noStore });
  }
  if (!redisCredentials()) {
    return NextResponse.json({ mode: "local", warning: "unconfigured" }, { headers: noStore });
  }

  let text: string;
  try {
    text = await request.text();
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400, headers: noStore });
  }
  if (text.length > 1_500_000) {
    return NextResponse.json({ error: "too large" }, { status: 413, headers: noStore });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400, headers: noStore });
  }
  const state = sanitizeState(parsed);
  if (!state) return NextResponse.json({ error: "invalid" }, { status: 400, headers: noStore });

  try {
    await writeShared(state);
  } catch {
    return NextResponse.json({ mode: "local", warning: "unavailable" }, { status: 503, headers: noStore });
  }
  return NextResponse.json({ mode: "shared", state }, { headers: noStore });
}
