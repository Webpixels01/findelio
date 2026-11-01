import { createHmac } from "node:crypto";

export const normalizeLoginEmail = (value) => typeof value === "string" ? value.trim().toLowerCase() : "";

export function loginAccountKey(secret, email) {
  return `cms-login-account:${createHmac("sha256", String(secret)).update(normalizeLoginEmail(email)).digest("hex")}`;
}
