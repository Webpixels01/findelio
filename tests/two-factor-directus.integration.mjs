import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { adminCredentials, totp } from "./directus-test-auth.mjs";

if (process.env.DB_DATABASE !== "findelio_test" || process.env.EMAIL_SMTP_HOST !== "mail") throw new Error("Disposable environment required");
const host = createRequire(createRequire("/directus/package.json").resolve("@directus/api"));
const db = host("knex")({ client: "pg", connection: { host: "database", user: "postgres", database: "findelio_test" } });
const base = "http://127.0.0.1:8055";
const endpoint = "/findelio-security/tfa";
const pass = text => console.log("PASS " + text);
async function api(path, { body, token, status = 200, method = body ? "POST" : "GET" } = {}) {
  const response = await fetch(base + path, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json().catch(() => null);
  assert.equal(response.status, status, `${method} ${path}: ${data?.errors?.[0]?.extensions?.code ?? "none"}`);
  return data?.data;
}
const login = (email, password, otp, status = 200) => api("/auth/login", { body: { email, password, ...(otp ? { otp } : {}) }, status });
async function wsAuth(message, expected) {
  const socket = new WebSocket("ws://127.0.0.1:8055/websocket");
  try {
    const result = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("WebSocket auth timeout")), 5000);
      socket.onopen = () => socket.send(JSON.stringify({ type: "auth", ...message }));
      socket.onmessage = event => {
        const value = JSON.parse(event.data);
        if (value.type === "auth") { clearTimeout(timeout); resolve(value.status); }
      };
      socket.onerror = () => { clearTimeout(timeout); reject(new Error("WebSocket error")); };
    });
    assert.equal(result, expected);
  } finally { socket.close(); }
}
try {
  const admin = (await api("/auth/login", { body: adminCredentials() })).access_token;
  const password = randomBytes(24).toString("base64url") + "!aA9";
  const email = `tfa-${randomUUID()}@example.com`;
  const role = await api("/roles", { token: admin, body: { name: "Optional TFA customer" } });
  const customer = await api("/users", { token: admin, body: { email, password, role: role.id, status: "active" } });
  let session = await login(email, password);
  let token = session.access_token;
  assert.deepEqual(await api(endpoint, { token }), { enabled: false, required: false, pending: false, passwordSupported: true });
  await api(endpoint, { status: 401 });
  await api(endpoint, { token, body: { action: "generate", password: "wrong" }, status: 401 });
  const setup = await api(endpoint, { token, body: { action: "generate", password } });
  assert.ok(setup.url.startsWith("otpauth://totp/"));
  const enable = { action: "enable", ticket: setup.ticket, otp: totp(setup.secret), backedUp: true };
  await api(endpoint, { token, body: { ...enable, backedUp: false }, status: 400 });
  await api(endpoint, { token, body: { ...enable, ticket: "forged" }, status: 400 });
  await api(endpoint, { token, body: { ...enable, otp: totp(setup.secret, Date.now() - 300_000) }, status: 400 });
  const other = await api("/users", { token: admin, body: { email: `other-${randomUUID()}@example.com`, password, role: role.id, status: "active" } });
  const otherToken = (await login(other.email, password)).access_token;
  await api(endpoint, { token: otherToken, body: enable, status: 400 });
  await api(endpoint, { token, body: { ...enable, otp: totp(setup.secret) } });
  await api("/auth/refresh", { body: { refresh_token: session.refresh_token }, status: 401 });
  await login(email, password, null, 401);
  await login(email, password, totp(setup.secret, Date.now() - 300_000), 401);
  session = await login(email, password, totp(setup.secret));
  token = session.access_token;
  const status = await api(endpoint, { token });
  assert.equal(status.enabled, true);
  assert.equal(status.required, false);
  assert.ok(!JSON.stringify(status).includes(setup.secret));
  pass("customer opt-in: password, signed setup, backup acknowledgement, native TOTP and fresh login");
  await db("findelio_request_limits").where({ key: `tfa:${customer.id}` }).delete();
  await api(endpoint, { token, body: { action: "disable", password: "wrong", otp: totp(setup.secret) }, status: 401 });
  await api(endpoint, { token, body: { action: "disable", password, otp: totp(setup.secret, Date.now() - 300_000) }, status: 400 });
  await api(endpoint, { token, body: { action: "disable", password, otp: totp(setup.secret) } });
  session = await login(email, password);
  assert.equal((await api(endpoint, { token: session.access_token })).enabled, false);
  pass("customer opt-out requires current password and OTP; password-only login works afterwards");

  const adminRole = (await db("directus_users").where({ email: process.env.ADMIN_EMAIL }).first()).role;
  const adminUser = await api("/users", { token: admin, body: { email: `tfa-admin-${randomUUID()}@example.com`, password, role: adminRole, status: "active" } });
  const pending = await login(adminUser.email, password);
  assert.equal(JSON.parse(Buffer.from(pending.access_token.split(".")[1], "base64url")).enforce_tfa, true);
  assert.equal((await api(endpoint, { token: pending.access_token })).required, true);
  await api("/users", { token: pending.access_token, status: 403 });
  await api("/users/me?fields=*,role.id", { token: pending.access_token });
  await api("/users/me?fields=role.users.*", { token: pending.access_token, status: 403 });
  await api("/roles/me?fields=users.*", { token: pending.access_token, status: 403 });
  await api("/settings?fields=project_logo.uploaded_by.*", { token: pending.access_token, status: 403 });
  assert.deepEqual(await api("/fields", { token: pending.access_token }), []);
  assert.deepEqual(await api("/flows", { token: pending.access_token }), []);
  assert.deepEqual(await api("/policies/me/globals", { token: pending.access_token }), { app_access: true, admin_access: false, enforce_tfa: true });
  await api("/graphql", { token: pending.access_token, body: { query: "{ __typename }" }, status: 403 });
  await api("/findelio-referrals/admin/access", { token: pending.access_token, status: 403 });
  const refreshed = await api("/auth/refresh", { body: { refresh_token: pending.refresh_token } });
  await api("/users", { token: refreshed.access_token, status: 403 });
  await wsAuth({ access_token: pending.access_token }, "error");
  await wsAuth({ email: adminUser.email, password }, "error");
  const native = await api("/users/me/tfa/generate", { token: pending.access_token, body: { password } });
  await api("/users/me/tfa/enable", { token: pending.access_token, body: { secret: native.secret, otp: totp(native.secret) }, status: 204 });
  await api("/users", { token: pending.access_token, status: 403 });
  await api("/auth/refresh", { body: { refresh_token: refreshed.refresh_token }, status: 401 });
  await login(adminUser.email, password, null, 401);
  const secured = await login(adminUser.email, password, totp(native.secret));
  await api("/users", { token: secured.access_token });
  await wsAuth({ access_token: secured.access_token }, "ok");
  for (const target of ["me", adminUser.id, adminUser.id.toUpperCase(), "%" + adminUser.id.charCodeAt(0).toString(16) + adminUser.id.slice(1)]) {
    await api(`/users/${target}/tfa/disable`, { token: secured.access_token, body: { otp: totp(native.secret) }, status: 403 });
  }
  await api(endpoint, { token: secured.access_token, body: { action: "disable", password, otp: totp(native.secret) }, status: 403 });
  const graphql = await fetch(base + "/graphql/system", {
    method: "POST", headers: { Authorization: `Bearer ${secured.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: "mutation Disable($otp: String!) { users_me_tfa_disable(otp: $otp) }", variables: { otp: totp(native.secret) } }),
  });
  const graphResult = await graphql.json();
  assert.ok(graphResult.errors?.some(error => error.extensions?.code === "TFA_REQUIRED"));
  assert.equal((await api(endpoint, { token: secured.access_token })).enabled, true);
  pass("administrator setup blocks REST, GraphQL, extensions, WebSockets and refresh bypass; native Studio enrollment works");

  // Warm a Directus cache entry, then remove enrollment without a cache purge.
  await api("/users", { token: secured.access_token });
  await db("directus_users").where({ id: adminUser.id }).update({ tfa_secret: null });
  await api("/users", { token: secured.access_token, status: 403 });
  await db("directus_users").where({ id: adminUser.id }).update({ tfa_secret: native.secret });
  pass("administrator enforcement runs before cached API responses");

  const policy = await api("/policies", { token: admin, body: { name: "Future admin TFA", admin_access: true, enforce_tfa: false } });
  assert.equal(policy.enforce_tfa, true);
  await api(`/policies/${policy.id}`, { token: admin, method: "PATCH", body: { enforce_tfa: false } });
  assert.equal((await api(`/policies/${policy.id}`, { token: admin })).enforce_tfa, true);
  // Directly assigned policies and inherited roles must also require enrollment.
  await db("directus_access").insert({ id: randomUUID(), user: other.id, policy: policy.id });
  assert.equal((await api(endpoint, { token: otherToken })).required, true);
  await api("/users", { token: otherToken, status: 403 });
  pass("new admin policies cannot disable enrollment; direct user policy assignments are covered");

  await db("findelio_request_limits").where({ key: `tfa:${customer.id}` }).delete();
  for (let i = 0; i < 11; i++) await api(endpoint, { token: session.access_token, body: { action: "generate", password: "wrong" }, status: i < 10 ? 401 : 429 });
  pass("two-factor management is limited at the CMS boundary");
} finally { await db.destroy(); }
