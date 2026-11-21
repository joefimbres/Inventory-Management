import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const PIN_COOKIE = "hhc_unlock";

export function configuredPin(): string | null {
  const pin = process.env.INVENTORY_PIN?.trim() ?? "";
  return pin.length > 0 ? pin : null;
}

export function unlockToken(pin: string): string {
  return createHash("sha256").update(`hhc-inventory-v1:${pin}`).digest("hex");
}

export function pinMatches(given: string, expected: string): boolean {
  const actual = Buffer.from(unlockToken(given), "hex");
  const wanted = Buffer.from(unlockToken(expected), "hex");
  return timingSafeEqual(actual, wanted);
}

export async function hasUnlock(): Promise<boolean> {
  const pin = configuredPin();
  if (!pin) return true;
  const jar = await cookies();
  const got = jar.get(PIN_COOKIE)?.value;
  if (!got) return false;
  try {
    const actual = Buffer.from(got, "hex");
    const wanted = Buffer.from(unlockToken(pin), "hex");
    if (actual.length !== wanted.length) return false;
    return timingSafeEqual(actual, wanted);
  } catch {
    return false;
  }
}
