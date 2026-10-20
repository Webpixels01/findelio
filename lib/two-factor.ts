import "server-only";
import { DirectusAuthError } from "@/lib/directus-auth";

export type TwoFactorStatus = {
  enabled: boolean;
  required: boolean;
  pending: boolean;
  passwordSupported: boolean;
};

export async function directusTwoFactor<T>(accessToken: string, body?: Record<string, unknown>): Promise<T> {
  const response = await fetch(new URL("/findelio-security/tfa", process.env.DIRECTUS_URL), {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", "Cache-Control": "no-store" },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
  });
  const result = await response.json();
  if (!response.ok || !result.data) {
    throw new DirectusAuthError("Two-factor request failed", response.status, result.errors?.[0]?.extensions?.code);
  }
  return result.data as T;
}
