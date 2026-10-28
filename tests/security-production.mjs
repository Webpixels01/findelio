// Mount into the final production image and run with --network none.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { setTimeout } from "node:timers/promises";
import { createRequire } from "node:module";
import { checkDeployment } from "./check-deployment.mjs";

assert.notEqual(process.getuid(), 0, "Production must run as a non-root user");
const sharp = createRequire("/app/package.json")("sharp");
const pixels = await sharp({ create: { width: 16, height: 16, channels: 3, background: "red" } }).webp().toBuffer();
assert.equal((await sharp(pixels).metadata()).format, "webp");
const counters = new Map();
let loginRequests = 0;
const backend = createServer(async (req, res) => {
  if (req.url === "/server/ping") {
    res.writeHead(200);
    return res.end("pong");
  }
  let raw = "";
  for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw || "{}");
  if (req.url === "/findelio-review-notification/contact" && !req.headers.authorization) {
    res.writeHead(401);
    return res.end();
  }
  assert.equal(req.headers.authorization, "Bearer synthetic-service-token");
  if (req.method === "GET" && /^\/items\/(spoken_languages|industries|cantons)\?/.test(req.url)) {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ data: [] }));
  }
  if (req.url === "/auth/login") {
    loginRequests++;
    res.writeHead(401, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ errors: [{ message: "Invalid credentials", extensions: { code: "INVALID_CREDENTIALS" } }] }));
  }
  if (req.url === "/findelio-review-notification/rate-limit") {
    const key = body.scope + body.client_key;
    assert.match(body.client_key, /^[a-f0-9]{64}$/);
    const count = (counters.get(key) ?? 0) + 1;
    counters.set(key, count);
    res.writeHead(count > (body.scope === "login-account" ? 10 : 30) ? 429 : 204);
    return res.end();
  }
  res.writeHead(503);
  res.end();
});
await new Promise(resolve => backend.listen(8055, "127.0.0.1", resolve));
const app = spawn(process.execPath, ["/app/server.js"], {
  cwd: "/app", stdio: "ignore",
  env: { ...process.env, NODE_ENV: "production", HOSTNAME: "127.0.0.1", PORT: "3000",
    DIRECTUS_URL: "http://127.0.0.1:8055", DIRECTUS_TOKEN: "synthetic-service-token",
    NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3000" },
});
const post = (path, body, headers = {}) => fetch("http://127.0.0.1:3000" + path, {
  method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body),
});
try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    if (await fetch("http://127.0.0.1:3000/api/health").then(r => r.ok).catch(() => false)) { ready = true; break; }
    await setTimeout(250);
  }
  assert.ok(ready, "Production server starts");
  await checkDeployment({ env: { DIRECTUS_URL: "http://127.0.0.1:8055", DIRECTUS_TOKEN: "synthetic-service-token" } });
  for (const [path, body] of [
    ["/api/contact", null], ["/api/account/organizations", { name: 123 }],
    ["/api/auth/register", null], ["/api/auth/verify-registration", { token: 123 }],
  ]) assert.equal((await post(path, body)).status, 400, path);
  assert.equal((await post("/api/contact", { message: "x".repeat(65536) })).status, 413);
  const form = new FormData();
  form.append("files", new File(["not an image"], "fake.png", { type: "image/png" }));
  assert.equal((await fetch("http://127.0.0.1:3000/api/account/listings/11111111-1111-4111-8111-111111111111/media",
    { method: "POST", body: form })).status, 401);
  for (let i = 0; i < 20; i++) {
    const response = await post("/api/auth/login", { email: "user@example.com", password: "wrong" },
      { "x-forwarded-for": `192.0.2.${i}, 198.51.100.1` });
    assert.equal(response.status, i < 10 ? 401 : 429);
  }
  assert.equal(loginRequests, 10);
  const image = await fetch("http://127.0.0.1:3000/_next/image?url=http%3A%2F%2F127.0.0.1%3A8055%2Fassets%2Ftest&w=640&q=75");
  assert.equal(image.status, 400);
  console.log("PASS production container: automatic deployment checks, native image decoder, non-root startup, malformed/oversized JSON, unauthorized upload, login limits and private image rejection");
} finally {
  app.kill("SIGTERM");
  await new Promise(resolve => { if (app.exitCode !== null) resolve(); else app.once("exit", resolve); });
  await new Promise(resolve => backend.close(resolve));
}
