import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { loadServerModule } from "./helpers/load-server-module.mjs";
import { createSetupTickets, safeSetupRead, tokenClaims } from "../infra/directus/extensions/directus-extension-findelio-request-security/src/two-factor.js";

const url = "https://findelio.test/api/auth/two-factor";
const request = (body, origin = "https://findelio.test") => new Request(url, {
  method: "POST", headers: { "Content-Type": "application/json", ...(origin ? { Origin: origin } : {}) }, body: JSON.stringify(body),
});

test("setup proof binds password verification to user, generated secret and a ten-minute expiry", t => {
  const tickets = createSetupTickets("synthetic-test-signing-key");
  const ticket = tickets.issue("alice", "JBSWY3DPEHPK3PXP");
  assert.equal(tickets.read(ticket, "alice"), "JBSWY3DPEHPK3PXP");
  for (const value of [ticket + ".extra", ticket.replace(/^./, "A"), "unsigned", null, "x".repeat(3000)]) {
    assert.throws(() => tickets.read(value, "alice"));
  }
  assert.throws(() => tickets.read(ticket, "bob"));
  assert.throws(() => createSetupTickets("another-key").read(ticket, "alice"));
  const now = Date.now();
  t.mock.method(Date, "now", () => now + 600_001);
  assert.throws(() => tickets.read(ticket, "alice"));
});

test("malformed JWT claims cannot escape into the restriction query", () => {
  for (const token of [null, "invalid", "a.e30.b", "a.bnVsbA.b", "a.W10.b"]) assert.equal(tokenClaims(token), null);
});

test("pending setup profile reads cannot expand relations or alias other users", () => {
  assert.equal(safeSetupRead("/users/me", { fields: ["*", "role.id"] }), true);
  assert.equal(safeSetupRead("/users/me", { fields: "id,email,role.name" }), true);
  for (const path of ["/users/me", "/roles/me", "/settings"]) {
    for (const query of [{ fields: "*.*" }, { fields: "role.users.*" }, { fields: { nested: "*" } }, { deep: {} }, { alias: {} }]) {
      assert.equal(safeSetupRead(path, query), false);
    }
  }
});

test("login requests native OTP and never issues cookies for the challenge or wrong code", async () => {
  let saved = 0;
  const calls = [];
  class AuthError extends Error { constructor() { super(); this.code = "INVALID_OTP"; this.status = 401; } }
  const route = loadServerModule("app/api/auth/login/route.ts", {
    "@/lib/auth": { saveAuthTokens: async () => saved++ },
    "@/lib/request-security": { enforceRequestLimit: async () => null },
    "@/lib/directus-auth": { DirectusAuthError: AuthError, loginWithDirectus: async (...args) => {
      calls.push(args);
      if (args[2] !== "123456") throw new AuthError();
      return { access_token: "test-only" };
    } },
  });
  for (const otp of [undefined, "654321"]) {
    const response = await route.POST(request({ email: "User@Example.com", password: "password", otp }));
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error, "otp_required");
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(saved, 0);
  }
  const invalid = await route.POST(request({ email: "user@example.com", password: "password", otp: { value: "123456" } }));
  assert.equal(invalid.status, 400);
  assert.equal(calls.length, 2);
  assert.equal((await route.POST(request({ email: "user@example.com", password: "password", otp: "123456" }))).status, 200);
  assert.equal(saved, 1);
  assert.deepEqual(calls.at(-1), ["user@example.com", "password", "123456"]);
});

test("security mutations require origin, bounded JSON, login, valid OTP and recovery acknowledgement", async () => {
  let writes = 0, clears = 0, token = "test-token";
  const route = loadServerModule("app/api/auth/two-factor/route.ts", {
    "@/lib/auth": { getAccessToken: async () => token, clearAuthCookies: async () => clears++ },
    "@/lib/two-factor": { directusTwoFactor: async () => { writes++; return { success: true }; } },
  });
  const body = { action: "enable", otp: "123456", ticket: "signed-ticket", backedUp: true };
  for (const origin of [null, "https://attacker.test"]) assert.equal((await route.POST(request(body, origin))).status, 403);
  for (const invalid of [null, [], { ...body, backedUp: false }, { ...body, otp: "12345" }, { ...body, ticket: "x".repeat(2049) }]) {
    assert.equal((await route.POST(request(invalid))).status, 400);
  }
  assert.equal((await route.POST(request({ action: "generate", password: "x".repeat(70000) }))).status, 413);
  token = null;
  assert.equal((await route.POST(request(body))).status, 401);
  assert.equal(writes, 0);
  token = "test-token";
  const response = await route.POST(request(body));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(writes, 1);
  assert.equal(clears, 1);
});

test("all ten locales contain the security settings and OTP login messages", async () => {
  const baseline = JSON.parse(await readFile(new URL("../messages/de-ch.json", import.meta.url)));
  for (const locale of ["de-ch", "en", "sk", "cs", "hu", "pl", "ru", "pt-pt", "ro", "vi"]) {
    const messages = JSON.parse(await readFile(new URL(`../messages/${locale}.json`, import.meta.url)));
    assert.deepEqual(Object.keys(messages.TwoFactor), Object.keys(baseline.TwoFactor));
    for (const value of Object.values(messages.TwoFactor)) assert.ok(value.length > 0);
    for (const key of ["otpLabel", "otpInvalid", "otpHelp", "rateLimited"]) assert.ok(messages.Login[key]);
    assert.ok(messages.Dashboard.navigation.security);
  }
});
