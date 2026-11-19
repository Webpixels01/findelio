import { createHmac } from "node:crypto";

// Independent TOTP implementation for disposable test users only.
export function totp(secret, now = Date.now()) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const letter of secret) bits += alphabet.indexOf(letter).toString(2).padStart(5, "0");
  const key = Buffer.from(bits.match(/.{8}/g).map(byte => parseInt(byte, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(now / 30_000)));
  const digest = createHmac("sha1", key).update(counter).digest();
  const value = digest.readUInt32BE(digest[19] & 15) & 0x7fffffff;
  return String(value % 1_000_000).padStart(6, "0");
}

export function adminCredentials() {
  if (process.env.DB_DATABASE !== "findelio_test") throw new Error("Disposable test environment required");
  return { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD,
    ...(process.env.FINDELIO_TEST_TFA_SECRET ? { otp: totp(process.env.FINDELIO_TEST_TFA_SECRET) } : {}) };
}
