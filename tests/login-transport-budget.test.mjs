import assert from "node:assert/strict";
import test from "node:test";
import hook from "../infra/directus/extensions/directus-extension-findelio-request-security/src/index.js";

// Service-boundary fixture: tests actual REST middleware and WS filter sharing
// one pre-password counter. Native ordering was inspected in the pinned image.
function fixture() {
  const counters = new Map(), filters = new Map(), initializers = [];
  let login, fail = false;
  const database = () => ({
    select() { return this; }, whereRaw() { return this; }, where() { return this; },
    async first() { return undefined; }, async delete() {},
  });
  database.fn = { now: () => new Date() };
  database.raw = async (_sql, [key, , max]) => {
    if (fail) throw new Error("offline");
    const count = counters.get(key) ?? 0;
    if (count >= max) return { rows: [] };
    counters.set(key, count + 1);
    return { rows: [{ count: count + 1 }] };
  };
  hook({ filter: (name, fn) => filters.set(name, fn), init: (_name, fn) => initializers.push(fn) }, {
    database, env: { SECRET: "dummy-test-key" }, services: {}, logger: { error() {} },
  });
  const app = { get() {}, post() {}, use: (path, fn) => { if (path === "/auth/login") login = fn; } };
  for (const init of initializers) init({ app });
  return {
    fail: () => { fail = true; },
    async rest(email) {
      let status = 200;
      const res = { set() {}, status(value) { status = value; return this; }, json() {} };
      let next = false;
      await login({ method: "POST", ip: "127.0.0.1", body: { email, password: "dummy" } }, res, () => { next = true; });
      if (next) {
        try { await filters.get("auth.login")({ email, password: "dummy" }, { provider: "default", status: "pending" }); }
        catch (error) { status = error.status; }
      }
      return status;
    },
    async ws(message) {
      if (Object.hasOwn(message, "email") || Object.hasOwn(message, "password")) {
        await filters.get("auth.login")(message, { provider: "default", status: "pending" });
      }
      return filters.get("websocket.authenticate")(null, { message });
    },
    counters,
  };
}

test("REST and WebSocket credential attempts exhaust the same normalized account budget", async () => {
  const f = fixture();
  for (let i = 0; i < 5; i++) {
    assert.equal(await f.rest(" User@Example.test "), 200);
    assert.equal(await f.ws({ email: "user@example.test", password: "dummy" }), null);
  }
  assert.equal(await f.rest("USER@example.test"), 429);
  await assert.rejects(f.ws({ email: " user@example.test ", password: "dummy" }), { code: "REQUESTS_EXCEEDED", status: 429 });
  assert.equal([...f.counters.keys()].filter(k => k.startsWith("cms-login-account:")).length, 1);
});

test("mixed token and credential messages cannot escape an exhausted account budget", async () => {
  const f = fixture();
  for (let i = 0; i < 10; i++) await f.rest("user@example.test");
  await assert.rejects(f.ws({ email: "user@example.test", password: "dummy", access_token: "dummy-token" }), { status: 429 });
});

test("token-only authentication does not consume a credential budget", async () => {
  const f = fixture();
  await f.ws({ access_token: "dummy-token" });
  assert.equal(f.counters.size, 0);
});

test("limiter failure closes both credential paths and invalid WS fields cannot bypass it", async () => {
  const f = fixture();
  for (const message of [{ password: "dummy" }, { email: {} }, { email: "x".repeat(255) }]) {
    await assert.rejects(f.ws(message), { status: 400 });
  }
  f.fail();
  assert.equal(await f.rest("user@example.test"), 503);
  await assert.rejects(f.ws({ email: "user@example.test", password: "dummy" }), { code: "SERVICE_UNAVAILABLE", status: 503 });
});
