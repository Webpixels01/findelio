import assert from "node:assert/strict";
import { test } from "node:test";
import { partnerInput, overviewInput, registerAdminRoutes } from "./referral-admin.js";

test("partner validation keeps codes stable and rejects injected fields", () => {
  const valid = { name: " Anna ", code: " ANNA-3 ", notes: " Hi ", status: "active" };
  assert.deepEqual(partnerInput(valid, true), { name: "Anna", code: "ANNA-3", notes: "Hi", status: "active" });
  for (const code of ["ab", "with space", "a/b", "a\ncode", "a".repeat(65)]) assert.equal(partnerInput({ ...valid, code }, true), null);
  assert.equal(partnerInput({ ...valid, organization: "foreign" }, true), null);
  assert.equal(partnerInput(valid, false), null);
  assert.deepEqual(partnerInput({ name: "Anna", status: "disabled" }, false), { name: "Anna", status: "disabled", notes: null });
  assert.equal(partnerInput({ name: "Anna", status: "active", notes: "a".repeat(2001) }, false), null);
});

test("overview pagination and filters reject malformed or unknown values", () => {
  assert.deepEqual(overviewInput({}), { page: 1, partner: null, status: null });
  assert.equal(overviewInput({ page: -1 }), null);
  assert.equal(overviewInput({ page: "1.2" }), null);
  assert.equal(overviewInput({ status: "arbitrary" }), null);
  assert.equal(overviewInput({ partner: "not-an-id" }), null);
  assert.equal(overviewInput({ status: "pending_activation" }).status, "pending_activation");
});

test("all admin endpoints reject feature-off, anonymous and non-admin before schema/database access", async () => {
  for (const [enabled, accountability, expected] of [
    [false, { user: "admin", admin: true }, 503], [true, null, 401],
    [true, { user: "reviewer", admin: false }, 403],
  ]) {
    const handlers = [];
    const router = Object.fromEntries(["get", "post", "patch"].map((method) => [method, (_, handler) => handlers.push(handler)]));
    registerAdminRoutes(router, {
      env: { FINDELIO_REFERRAL_REGISTRATION_ENABLED: String(enabled) }, services: {},
      database: () => { throw Error("Unexpected database access"); },
      getSchema: () => { throw Error("Unexpected schema access"); }, logger: {},
    });
    for (const handler of handlers) {
      const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
      await handler({ accountability }, res);
      assert.equal(res.code, expected);
    }
  }
});
