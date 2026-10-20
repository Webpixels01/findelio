import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { setImmediate } from "node:timers/promises";
import { loadServerModule } from "./helpers/load-server-module.mjs";
import endpoint from "../infra/directus/extensions/directus-extension-findelio-review-notification/src/index.js";

const listingId = "11111111-1111-4111-8111-111111111111";
const fileId = "22222222-2222-4222-8222-222222222222";
const jsonRequest = (value, headers = {}) => new Request("https://site.example/api/test", {
  method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(value),
});
const locales = { routing: { locales: ["de-ch", "en"], defaultLocale: "de-ch" } };
const unlimited = { enforceRequestLimit: async () => null, requestIdentity: () => "a".repeat(64) };

test("bounded body reader rejects declared and chunked oversized bodies and cancels the stream", async () => {
  const { readBoundedBody } = loadServerModule("lib/request-body.ts");
  await assert.rejects(readBoundedBody(jsonRequest({}, { "Content-Length": "9000" }), 100), { status: 413 });
  let cancelled = false;
  const stream = new ReadableStream({
    pull(controller) { controller.enqueue(new Uint8Array(32)); },
    cancel() { cancelled = true; },
  });
  await assert.rejects(readBoundedBody(new Request("http://test.invalid", {
    method: "POST", body: stream, duplex: "half",
  }), 64), { status: 413 });
  assert.equal(cancelled, true);
});

test("bounded body reader times out stalled uploads", async () => {
  const { readBoundedBody } = loadServerModule("lib/request-body.ts");
  let cancelled = false;
  const request = new Request("http://test.invalid", {
    method: "POST", duplex: "half",
    body: new ReadableStream({ cancel() { cancelled = true; } }),
  });
  await assert.rejects(readBoundedBody(request, 100, 10), { status: 408 });
  assert.equal(cancelled, true);
});

test("JSON reader rejects null, arrays, primitives, malformed and oversized input", async () => {
  const { readJsonObject } = loadServerModule("lib/request-body.ts");
  for (const input of [null, [], "text", 123]) {
    await assert.rejects(readJsonObject(jsonRequest(input)), { status: 400 });
  }
  await assert.rejects(readJsonObject(new Request("http://test.invalid", {
    method: "POST", body: "{",
  })), { status: 400 });
  await assert.rejects(readJsonObject(jsonRequest({ name: "x".repeat(65536) })), { status: 413 });
  assert.deepEqual(await readJsonObject(jsonRequest({ name: "Test" })), { name: "Test" });
});

test("image validation rejects MIME spoofing, SVG and broken images", async () => {
  const { validateUploadImage, InvalidUploadImageError } = loadServerModule("lib/upload-image.ts");
  for (const bytes of ["not an image", '<svg xmlns="http://www.w3.org/2000/svg"/>',
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])]) {
    await assert.rejects(validateUploadImage(new File([bytes], "fake.png", { type: "image/png" })), InvalidUploadImageError);
  }
  const image = await sharp({ create: { width: 32, height: 32, channels: 3, background: "red" } }).png().toBuffer();
  await assert.rejects(validateUploadImage(new File([image], "fake.jpg", { type: "image/jpeg" })), InvalidUploadImageError);
  await assert.rejects(validateUploadImage(new File([image.subarray(0, image.length - 24)], "broken.png", { type: "image/png" })), InvalidUploadImageError);
});

test("image validation accepts original formats, resolution and metadata without re-encoding", async () => {
  const { validateUploadImage } = loadServerModule("lib/upload-image.ts");
  for (const format of ["png", "jpeg", "webp"]) {
    const image = await sharp({ create: { width: 3000, height: 16, channels: 3, background: "#123456" } })
      .withMetadata().toFormat(format).toBuffer();
    const file = new File([image], "photo." + format, {
      type: "image/" + format,
    });
    await validateUploadImage(file);
    assert.equal(file.name, "photo." + format);
    assert.equal(file.type, "image/" + format);
    assert.deepEqual(Buffer.from(await file.arrayBuffer()), image);
  }
});

test("image validation rejects dimensions beyond the configured bound", async () => {
  const { validateUploadImage } = loadServerModule("lib/upload-image.ts");
  const image = await sharp({ create: { width: 8001, height: 1, channels: 3, background: "red" } }).png().toBuffer();
  await assert.rejects(validateUploadImage(new File([image], "wide.png", { type: "image/png" })));
});

test("media requests verify anonymous, forged and unauthorized sessions before reading any bytes", async () => {
  class AuthError extends Error { status = 401; }
  class AccountError extends Error { status = 404; }
  for (const scenario of ["anonymous", "forged", "foreign-listing"]) {
    let reads = 0;
    const request = {
      url: "https://site.example/api/media",
      headers: new Headers({ "Content-Type": "multipart/form-data; boundary=test" }),
      get body() { reads++; throw new Error("Body must not be read"); },
    };
    const route = loadServerModule("app/api/account/listings/[id]/media/route.ts", {
      "@/lib/auth": {
        getAccessToken: async () => scenario === "anonymous" ? null : "synthetic-token",
        getRefreshToken: async () => null, clearAuthCookies: async () => {},
      },
      "@/lib/directus-auth": {
        DirectusAuthError: AuthError,
        getDirectusCurrentUser: async () => { if (scenario === "forged") throw new AuthError(); return { id: "user" }; },
      },
      "@/lib/directus-account": {
        DirectusAccountError: AccountError, authorizeAccountListingImageUpload: async () => { throw new AccountError(); },
      },
      "@/lib/request-security": unlimited,
    });
    const response = await route.POST(request, { params: Promise.resolve({ id: listingId }) });
    assert.equal(response.status, scenario === "foreign-listing" ? 404 : 401);
    assert.equal(reads, 0);
  }
});

test("authorized multipart upload still works and rejects empty forms", async () => {
  const route = loadServerModule("app/api/account/listings/[id]/media/route.ts", {
    "@/lib/auth": { getAccessToken: async () => "synthetic-token" },
    "@/lib/directus-auth": { getDirectusCurrentUser: async () => ({ id: "user" }) },
    "@/lib/directus-account": {
      authorizeAccountListingImageUpload: async () => ({}),
      uploadAccountListingImages: async (_token, listing, files, user) => {
        assert.equal(listing, listingId); assert.equal(user, "user"); assert.equal(files.length, 1);
        return [{ id: fileId }];
      },
    },
    "@/lib/request-security": unlimited,
  });
  for (const populated of [true, false]) {
    const form = new FormData();
    if (populated) form.append("files", new File(["fixture"], "test.png", { type: "image/png" }));
    const response = await route.POST(new Request("https://site.example/api/media", {
      method: "POST", body: form,
    }), { params: Promise.resolve({ id: listingId }) });
    assert.equal(response.status, populated ? 200 : 400);
  }
});

test("upload concurrency is bounded before body reads and slots are released", async () => {
  const releases = [];
  const route = loadServerModule("app/api/account/listings/[id]/media/route.ts", {
    "@/lib/auth": { getAccessToken: async () => "synthetic-token" },
    "@/lib/directus-auth": { getDirectusCurrentUser: async () => ({ id: "user" }) },
    "@/lib/directus-account": {
      authorizeAccountListingImageUpload: async () => ({}),
      uploadAccountListingImages: async () => new Promise(resolve => releases.push(() => resolve([]))),
    },
    "@/lib/request-security": unlimited,
  });
  const upload = () => {
    const body = new FormData();
    body.append("files", new File(["image"], "test.png", { type: "image/png" }));
    return route.POST(new Request("https://site.example/api/media", { method: "POST", body }),
      { params: Promise.resolve({ id: listingId }) });
  };
  const first = upload(), second = upload();
  for (let i = 0; i < 100 && releases.length < 2; i++) await setImmediate();
  assert.equal(releases.length, 2);
  const blocked = await route.POST({
    url: "https://site.example/api/media", headers: new Headers({ "Content-Type": "multipart/form-data" }),
    get body() { throw new Error("Busy uploads must not read the body"); },
  }, { params: Promise.resolve({ id: listingId }) });
  assert.equal(blocked.status, 429);
  releases.splice(0).forEach(release => release());
  assert.equal((await first).status, 200);
  assert.equal((await second).status, 200);
  const next = upload();
  for (let i = 0; i < 100 && releases.length === 0; i++) await setImmediate();
  assert.equal(releases.length, 1);
  releases[0]();
  assert.equal((await next).status, 200);
});

test("post create, edit and published replacement reject foreign file IDs before any mutation", async t => {
  process.env.DIRECTUS_URL = "https://cms.example";
  process.env.DIRECTUS_TOKEN = "synthetic-test-token";
  const account = loadServerModule("lib/directus-account.ts", {
    "@/lib/directus-assets": {}, "@/lib/directus-premium": {}, "@/lib/mail": {},
  });
  let writes = 0, status = "draft", owner = "another-user";
  t.mock.method(globalThis, "fetch", async (url, options = {}) => {
    const path = new URL(url).pathname;
    if (options.method && options.method !== "GET") { writes++; return Response.json({ data: { id: "post-id" } }); }
    if (path === "/items/listing_revisions") return Response.json({ data: [] });
    if (path === "/folders") return Response.json({ data: [{ id: "public-folder" }] });
    if (path === "/files") return Response.json({ data: [{ id: fileId, type: "image/webp", uploaded_by: owner, folder: "public-folder" }] });
    if (path === "/items/listing_posts") return Response.json({ data: [{ id: "post-id", status, image: null }] });
    throw new Error("Unexpected URL " + path);
  });
  const growth = loadServerModule("lib/directus-growth.ts", {
    "@/lib/directus-account": {
      DirectusAccountError: account.DirectusAccountError,
      validatePremiumFileIds: account.validatePremiumFileIds,
      getAccountListingBillingData: async () => ({ premiumEnabled: true, listing: { id: listingId, gallery: [] } }),
    },
  });
  const input = { image: fileId, title: "Test", type: "update", status: "draft" };
  await assert.rejects(growth.createAccountListingPost("user-token", listingId, "user", input), { code: "INVALID_FILE" });
  for (status of ["draft", "published"]) {
    await assert.rejects(growth.updateAccountListingPost("user-token", listingId, "post-id", "user", input), { code: "INVALID_FILE" });
  }
  assert.equal(writes, 0);
  owner = "user";
  await growth.createAccountListingPost("user-token", listingId, "user", input);
  await growth.updateAccountListingPost("user-token", listingId, "post-id", "user", input);
  assert.equal(writes, 2, "Owned public images remain usable");
});

test("login attempts share account limits and cannot rotate an attacker-supplied XFF prefix", async t => {
  process.env.DIRECTUS_URL = "https://cms.example";
  process.env.DIRECTUS_TOKEN = "synthetic-test-token";
  const counters = new Map();
  let logins = 0;
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    const { scope, client_key } = JSON.parse(options.body);
    const key = scope + client_key;
    const count = (counters.get(key) ?? 0) + 1;
    counters.set(key, count);
    return new Response(null, { status: count > (scope === "login-account" ? 10 : 30) ? 429 : 204 });
  });
  class AuthError extends Error { status = 401; }
  t.mock.method(console, "warn", () => {});
  const route = loadServerModule("app/api/auth/login/route.ts", {
    "@/lib/auth": {},
    "@/lib/directus-auth": { DirectusAuthError: AuthError, loginWithDirectus: async () => { logins++; throw new AuthError(); } },
  });
  for (let i = 0; i < 30; i++) {
    const result = await route.POST(jsonRequest({ email: "User@example.com", password: "wrong" }, {
      "x-forwarded-for": `192.0.2.${i}, 198.51.100.10`,
    }));
    assert.equal(result.status, i < 10 ? 401 : 429);
  }
  assert.equal(logins, 10);
  assert.equal(counters.size, 2);
});

test("unavailable rate limiter fails closed without contacting login", async t => {
  t.mock.method(globalThis, "fetch", async () => { throw new Error("Offline"); });
  const route = loadServerModule("app/api/auth/login/route.ts", {
    "@/lib/auth": {}, "@/lib/directus-auth": {},
  });
  assert.equal((await route.POST(jsonRequest({ email: "test@example.com", password: "test" }))).status, 503);
});

test("malformed contact, organization and auth payloads return 400 rather than 500", async () => {
  const mocks = {
    "@/lib/auth": {}, "@/lib/mail": {}, "@/lib/directus-account": {},
    "@/lib/directus-auth": {}, "@/lib/directus-referral": {},
    "@/lib/directus-team": {}, "@/i18n/routing": locales,
    "@/lib/request-security": unlimited,
  };
  for (const path of ["contact", "account/organizations", "auth/login", "auth/register", "auth/verify-registration"]) {
    const route = loadServerModule(`app/api/${path}/route.ts`, mocks);
    for (const body of [null, { name: 123, email: 123, firstName: 123, token: 123 }, []]) {
      assert.equal((await route.POST(jsonRequest(body))).status, 400, path);
    }
  }
});

test("Directus contact, metrics and limit endpoints reject public, normal and admin users", async () => {
  const routes = new Map();
  let effects = 0;
  const database = () => ({
    select() { return this; }, where() { return this; }, async first() { return { name: "Firmenkonto" }; },
  });
  database.raw = async () => { effects++; throw new Error("No counter writes allowed"); };
  endpoint.handler({ post: (path, handler) => routes.set(path, handler) }, {
    database, env: {}, services: {}, logger: { error() {} },
  });
  for (const path of ["/contact", "/metrics", "/rate-limit"]) {
    for (const accountability of [null, { user: "user", role: "role" }, { user: "admin", role: "role", admin: true }]) {
      const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json() { return this; } };
      await routes.get(path)({ accountability, body: { client_key: "a".repeat(64) } }, res);
      assert.equal(res.statusCode, accountability ? 403 : 401);
    }
  }
  assert.equal(effects, 0);
});

test("Directus deployment copies match the tested source", async () => {
  for (const [extension, files] of [
    ["review-notification", ["index.js", "request-security.js", "referral-mail.js"]],
    ["request-security", ["index.js", "two-factor.js"]],
  ]) {
    for (const file of files) {
      const base = new URL(`../infra/directus/extensions/directus-extension-findelio-${extension}/`, import.meta.url);
      assert.equal(await readFile(new URL(`src/${file}`, base), "utf8"), await readFile(new URL(`dist/${file}`, base), "utf8"));
    }
  }
});
