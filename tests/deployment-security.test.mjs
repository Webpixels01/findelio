import assert from "node:assert/strict";
import { test } from "node:test";
import { checkDeployment } from "../ops/check-deployment.mjs";
import { checkDirectusUpgrade } from "../ops/check-directus-upgrade.mjs";

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

test("upgrade check reads real CMS data with the existing filtered service permissions", async () => {
  const calls = [];
  await checkDirectusUpgrade({ env, request: async (url, options) => {
    calls.push({ url, options });
    return Response.json({ data: url.pathname === "/server/info"
      ? { version: "12.5.0", license: { source: "env" } } : [{ id: "fixture" }] });
  } });
  assert.deepEqual(calls.map(call => call.url.pathname), ["/server/info", "/items/cantons", "/items/industries", "/items/spoken_languages"]);
  assert.ok(calls.every(call => call.url.origin === env.DIRECTUS_URL && call.options.redirect === "manual"));
  assert.ok(calls.every(call => call.options.headers.Authorization === `Bearer ${env.DIRECTUS_TOKEN}`));
});

test("upgrade check rejects unlicensed CMS, old versions and inaccessible or empty reference data", async () => {
  for (const info of [{ version: "11.17.4" }, { version: "12.5.0", license: { source: null } }]) {
    await assert.rejects(checkDirectusUpgrade({ env, request: async () => Response.json({ data: info }) }), /nicht aktiv/);
  }
  for (const status of [403, 500, 200]) {
    await assert.rejects(checkDirectusUpgrade({ env, request: async url => url.pathname === "/server/info"
      ? Response.json({ data: { version: "12.5.0", license: { source: "env" } } })
      : Response.json({ data: [] }, { status }) }), /HTTP|keine freigegebenen Daten/);
  }
});

test("upgrade errors never include credentials, API bodies or fetch exception details", async () => {
  await assert.rejects(checkDirectusUpgrade({ env, request: async () => { throw new Error(env.DIRECTUS_TOKEN); } }), {
    message: "CMS-Upgrade-Prüfung: Dienst nicht erreichbar.",
  });
  await assert.rejects(checkDirectusUpgrade({ env, request: async () => new Response(env.DIRECTUS_TOKEN) }), {
    message: "CMS-Upgrade-Prüfung: ungültige Antwort.",
  });
});
