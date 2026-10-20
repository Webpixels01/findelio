import assert from "node:assert/strict";
import { test } from "node:test";
import { checkDeployment } from "../ops/check-deployment.mjs";

const env = { DIRECTUS_URL: "http://cms.invalid", DIRECTUS_TOKEN: "synthetic-service-token" };

function expectedResponse(url) {
  if (url.pathname.endsWith("/rate-limit")) return 204;
  if (url.pathname.endsWith("/contact") || url.pathname.endsWith("/media")) return 401;
  return 200;
}

test("deployment check verifies the running endpoints without sending mail or uploading files", async () => {
  const calls = [];
  const request = async (url, options) => {
    calls.push({ url, ...options });
    return new Response(null, { status: expectedResponse(url) });
  };
  await checkDeployment({ env, request });
  assert.equal(calls.length, 6);
  const authenticated = calls.filter(call => call.headers?.Authorization);
  assert.equal(authenticated.length, 1);
  assert.equal(authenticated[0].url.origin, env.DIRECTUS_URL);
  assert.equal(authenticated[0].url.pathname, "/findelio-review-notification/rate-limit");
  const payload = JSON.parse(authenticated[0].body);
  assert.equal(payload.scope, "login-ip");
  assert.match(payload.client_key, /^[a-f0-9]{64}$/);
  assert.equal(calls.find(call => call.url.pathname.endsWith("/contact")).body, "{}");
  assert.equal(calls.find(call => call.url.pathname.endsWith("/media")).body, undefined);
  assert.ok(calls.every(call => call.redirect === "manual"));
});

test("deployment check fails for an old backend, wrong token, missing table or missing access guard", async () => {
  for (const [path, status] of [["rate-limit", 404], ["rate-limit", 403], ["rate-limit", 503], ["contact", 200], ["media", 200]]) {
    await assert.rejects(checkDeployment({ env, request: async url => new Response(null, {
      status: url.pathname.endsWith("/" + path) ? status : expectedResponse(url),
    }) }), new RegExp(`HTTP ${status}, erwartet`));
  }
});

test("deployment errors do not expose credentials or server response bodies", async () => {
  await assert.rejects(checkDeployment({ env, request: async () => {
    throw new Error(env.DIRECTUS_TOKEN);
  } }), { message: "Website-Status: Dienst nicht erreichbar." });
  await assert.rejects(checkDeployment({ env, request: async () => new Response(env.DIRECTUS_TOKEN, { status: 500 }) }), {
    message: "Website-Status: HTTP 500, erwartet 200.",
  });
});
