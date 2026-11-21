import { cookies } from "next/headers";
import { connection, NextResponse } from "next/server";
import { PIN_COOKIE, configuredPin, pinMatches, unlockToken } from "@/lib/auth";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function POST(request: Request) {
  await connection();
  const expected = configuredPin();
  if (!expected) return NextResponse.json({ ok: true, required: false });

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const given = isRecord(body) && typeof body.pin === "string" ? body.pin : "";
  if (!pinMatches(given, expected)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const jar = await cookies();
  jar.set(PIN_COOKIE, unlockToken(expected), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return NextResponse.json({ ok: true, required: true });
}
