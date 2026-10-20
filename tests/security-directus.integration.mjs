/** Only run inside the disposable, network-isolated integration stack. */
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { createRequestLimiter } from "/directus/extensions/directus-extension-findelio-review-notification/dist/request-security.js";

if (process.env.DB_DATABASE !== "findelio_test" || process.env.EMAIL_SMTP_HOST !== "mail") {
  throw new Error("Disposable integration environment required");
}
const host = createRequire(createRequire("/directus/package.json").resolve("@directus/api"));
const db = host("knex")({ client: "pg", connection: { host: "database", user: "postgres", database: "findelio_test" } });
const endpoint = "/findelio-review-notification";
const key = () => randomBytes(32).toString("hex");
async function request(path, body, token) {
  return fetch("http://127.0.0.1:8055" + path, {
    method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
}
async function create(path, body, token) {
  const response = await request(path, body, token);
  assert.equal(response.status, 200, path);
  return (await response.json()).data;
}
const pass = (message) => console.log("PASS " + message);
try {
  const admin = (await create("/auth/login", { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD })).access_token;
  const serverRole = await create("/roles", { name: "Findelio Server" }, admin);
  const regularRole = await create("/roles", { name: "Security fixture customer" }, admin);
  const serviceToken = randomBytes(32).toString("hex");
  const userToken = randomBytes(32).toString("hex");
  const email = `security-${randomUUID()}@example.com`;
  const password = randomBytes(24).toString("base64url") + "!Aa9";
  await create("/users", { email: `service-${randomUUID()}@example.com`, role: serverRole.id, token: serviceToken, status: "active" }, admin);
  const user = await create("/users", { email, password, role: regularRole.id, token: userToken, status: "active" }, admin);
  const login = await create("/auth/login", { email, password }, serviceToken);
  const me = await fetch("http://127.0.0.1:8055/users/me", { headers: { Authorization: `Bearer ${login.access_token}` } });
  assert.equal((await me.json()).data.id, user.id);
  pass("service-authenticated website login returns the customer's session");
  for (const path of ["/contact", "/metrics", "/rate-limit"]) {
    for (const [token, status] of [[null, 401], [userToken, 403], [admin, 403]]) {
      const response = await request(endpoint + path, { client_key: key() }, token);
      assert.equal(response.status, status, path);
    }
    assert.equal((await request(endpoint + path, { client_key: "spoofed" }, serviceToken)).status, 400);
  }
  pass("real CMS endpoints deny unauthenticated users, customers and non-service admins");

  const client = key();
  const attempts = await Promise.all(Array.from({ length: 30 }, () =>
    request(endpoint + "/rate-limit", { scope: "login-account", client_key: client }, serviceToken)));
  assert.equal(attempts.filter(r => r.status === 204).length, 10);
  assert.equal(attempts.filter(r => r.status === 429).length, 20);
  pass("atomic login limit survives simultaneous HTTP requests");

  const limiterA = createRequestLimiter(db), limiterB = createRequestLimiter(db);
  const shared = "test-shared:" + key();
  const concurrent = await Promise.all(Array.from({ length: 40 }, (_, i) =>
    (i % 2 ? limiterA : limiterB)(shared, 10, 900)));
  assert.equal(concurrent.filter(Boolean).length, 10);
  await db("findelio_request_limits").where({ key: shared }).update({ expires_at: new Date(Date.now() - 1000) });
  assert.equal(await limiterB(shared, 10, 900), true);
  pass("independent limiter instances share counters and correctly reset expired windows");

  const contact = { client_key: key(), name: "Security test", email: "sender@example.com",
    subject: "general", message: "Isolated test message; sent only to local Mailpit." };
  const contacts = await Promise.all(Array.from({ length: 6 }, () => request(endpoint + "/contact", contact, serviceToken)));
  assert.equal(contacts.filter(r => r.status === 204).length, 5);
  assert.equal(contacts.filter(r => r.status === 429).length, 1);
  pass("contact delivery allows five messages and blocks the sixth at the CMS boundary");

  const listing = randomUUID();
  await db("listings").insert({ id: listing, name: "Security metrics fixture", status: "published" });
  await db("subscriptions").insert({ id: randomUUID(), listing, plan: "premium", status: "active" });
  const metric = { client_key: key(), listing_ids: [listing], event: "profile_views" };
  const metrics = await Promise.all(Array.from({ length: 20 }, () => request(endpoint + "/metrics", metric, serviceToken)));
  assert.ok(metrics.every(r => r.status === 204));
  assert.equal((await db("listing_metrics_daily").where({ listing }).first()).profile_views, 1);
  assert.equal((await request(endpoint + "/metrics", { ...metric, client_key: key() }, serviceToken)).status, 204);
  assert.equal((await db("listing_metrics_daily").where({ listing }).first()).profile_views, 2);
  await db("findelio_request_limits").where({ key: "metrics:" + metric.client_key }).update({ count: 120 });
  assert.equal((await request(endpoint + "/metrics", metric, serviceToken)).status, 429);
  pass("metric replay is deduplicated atomically; different visitors count and the request cap applies");

  await db.schema.renameTable("findelio_request_limits", "findelio_request_limits_unavailable");
  try {
    assert.equal((await request(endpoint + "/rate-limit", { scope: "login-ip", client_key: key() }, serviceToken)).status, 503);
  } finally {
    await db.schema.renameTable("findelio_request_limits_unavailable", "findelio_request_limits");
  }
  pass("missing limiter storage fails closed");

  for (let i = 0; i < 10; i++) {
    const response = await request("/auth/login", { email, password: "wrong" });
    assert.equal(response.status, i < 9 ? 401 : 429);
  }
  pass("direct CMS login cannot bypass the per-account brute-force limit");
} finally {
  await db.destroy();
}
