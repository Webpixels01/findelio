import assert from "node:assert/strict";
import test from "node:test";
import { loadServerModule } from "./helpers/load-server-module.mjs";

function fixture(event, { unavailable = false, invalidSignature = false, subscription = {}, invoice = {} } = {}) {
  const reads = [], writes = [], updates = [];
  const current = { id: "sub_dummy", status: "canceled", metadata: { listing_id: "dummy" }, ...subscription };
  const route = loadServerModule("app/api/billing/webhook/route.ts", {
    "@/lib/directus-billing": { syncStripeSubscription: async value => writes.push(value) },
    "@/lib/stripe-billing": {
      BillingConfigurationError: class extends Error {},
      getStripeObjectId: value => typeof value === "string" ? value : value?.id ?? null,
      getStripeWebhookSecret: () => "dummy-secret",
      getStripeClient: () => ({
        webhooks: { constructEvent: () => { if (invalidSignature) throw new Error("invalid signature"); return event; } },
        invoices: { retrieve: async () => invoice },
        subscriptions: {
          retrieve: async id => { reads.push(id); if (unavailable) throw new Error("provider unavailable"); return current; },
          update: async (...args) => { updates.push(args); return current; },
        },
      }),
    },
  });
  return { reads, writes, updates, current, post: () => route.POST(new Request("https://dummy.test/api/billing/webhook", {
    method: "POST", headers: { "stripe-signature": "dummy" }, body: "signed-fixture",
  })) };
}

for (const type of ["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"]) {
  test(`${type} synchronizes current provider state instead of an old active event`, async () => {
    const f = fixture({ type, data: { object: { id: "sub_dummy", status: "active" } } });
    assert.equal((await f.post()).status, 200);
    assert.deepEqual(f.reads, ["sub_dummy"]);
    assert.deepEqual(f.writes, [f.current]);
  });
}

test("provider failure never falls back to the event snapshot", async () => {
  const f = fixture({ type: "customer.subscription.updated", data: { object: { id: "sub_dummy", status: "active" } } }, { unavailable: true });
  assert.notEqual((await f.post()).status, 200);
  assert.equal(f.writes.length, 0);
});

test("an invalid signature cannot trigger a provider read or a subscription write", async () => {
  const f = fixture({}, { invalidSignature: true });
  assert.notEqual((await f.post()).status, 200);
  assert.equal(f.reads.length, 0);
  assert.equal(f.writes.length, 0);
});

for (const [type, status, latest] of [
  ["invoice.payment_failed", "paid", "in_dummy"],
  ["invoice.payment_failed", "open", "in_newer"],
  ["invoice.paid", "paid", "in_newer"],
  ["invoice.paid", "open", "in_dummy"],
]) {
  test(`stale ${type} (${status}, latest ${latest}) cannot change cancellation`, async () => {
    const f = fixture({ type, data: { object: { id: "in_dummy" } } }, {
      invoice: { id: "in_dummy", status, parent: { subscription_details: { subscription: "sub_dummy" } } },
      subscription: { status: "active", latest_invoice: latest, metadata: { listing_id: "dummy", findelio_payment_failure_cancel_scheduled: "true" } },
    });
    assert.equal((await f.post()).status, 200);
    assert.equal(f.updates.length, 0);
    assert.deepEqual(f.writes, [f.current]);
  });
}
