import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { loadServerModule } from './helpers/load-server-module.mjs';
const locales = ['de-ch', 'en', 'sk', 'cs', 'hu', 'pl', 'ru', 'pt-pt', 'ro', 'vi'];
function setup(t) {
  const original = { NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL, DIRECTUS_URL: process.env.DIRECTUS_URL };
  process.env.NEXT_PUBLIC_SITE_URL = 'https://findelio.test'; process.env.DIRECTUS_URL = 'https://cms.test';
  t.after(() => { for (const [key, value] of Object.entries(original)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
  const calls = [], limits = [];
  let cleared = 0, response = () => new Response(null, { status: 204 }), limited = false;
  t.mock.method(globalThis, 'fetch', async (url, options) => { calls.push({ url: String(url), ...options, body: JSON.parse(options.body) }); return response(); });
  const { POST } = loadServerModule('app/api/auth/password/route.ts', {
    'next-intl': { hasLocale: (locales, value) => locales.includes(value) },
    '@/i18n/routing': { routing: { locales } },
    '@/lib/auth': { clearAuthCookies: async () => cleared++ },
    '@/lib/request-security': { enforceRequestLimit: async (_request, scope, identity) => { limits.push({ scope, identity }); return limited ? Response.json({ error: 'rate_limited' }, { status: 429 }) : null; } },
  });
  return { calls, limits, cleared: () => cleared, setResponse: value => { response = value; }, limit: () => { limited = true; }, call: (body, origin = 'https://findelio.test') => POST(new Request('https://findelio.test/api/auth/password', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(origin ? { origin } : {}) }, body: JSON.stringify(body) })) };
}
test('reset mail uses a fixed localized allow-listed URL and normalizes email without accepting a supplied redirect', async t => {
  const f = setup(t);
  for (const locale of locales) {
    const response = await f.call({ action: 'request', locale, email: ' Alice@Example.test ', reset_url: 'https://evil.test' });
    assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(f.calls.at(-1).body, { email: 'alice@example.test', reset_url: `https://findelio.test/${locale}/passwort-zuruecksetzen` });
    assert.equal(f.calls.at(-1).url, 'https://cms.test/auth/password/request');
    assert.equal(f.calls.at(-1).headers.Authorization, undefined);
  }
  assert.ok(f.limits.some(l => l.scope === 'password-email-account' && l.identity === 'alice@example.test'));
  f.setResponse(() => Response.json({ errors: [{ extensions: { code: 'RECORD_NOT_FOUND' } }] }, { status: 404 }));
  assert.deepEqual(await (await f.call({ action: 'request', locale: 'de-ch', email: 'unknown@example.test' })).json(), { success: true });
});
test('reset requests reject foreign origins, invalid payloads and rate limits before contacting Directus', async t => {
  const f = setup(t), valid = { action: 'request', locale: 'de-ch', email: 'alice@example.test' };
  for (const origin of [null, 'https://evil.test']) assert.equal((await f.call(valid, origin)).status, 403);
  for (const body of [null, [], { ...valid, locale: '//evil.test' }, { ...valid, email: 'bad' }, { action: 'reset', token: '', password: 'Strong123!' }, { action: 'reset', token: 'x', password: 'weak' }]) assert.equal((await f.call(body)).status, 400);
  assert.equal(f.calls.length, 0);
  f.limit(); assert.equal((await f.call(valid)).status, 429); assert.equal(f.calls.length, 0);
});
test('password changes require Directus token validation and clear local sessions only after success', async t => {
  const f = setup(t), payload = { action: 'reset', token: 'test-one-time-token', password: ' Strong123! ' };
  for (const code of ['INVALID_TOKEN', 'TOKEN_EXPIRED', 'INVALID_CREDENTIALS']) {
    f.setResponse(() => Response.json({ errors: [{ extensions: { code } }] }, { status: 401 }));
    const response = await f.call(payload); assert.equal(response.status, 400); assert.equal((await response.json()).error, 'invalidToken');
    assert.equal(f.cleared(), 0);
  }
  f.setResponse(() => Response.json({ errors: [{ extensions: { code: 'FAILED_VALIDATION' } }] }, { status: 400 }));
  assert.equal((await (await f.call(payload)).json()).error, 'passwordError');
  f.setResponse(() => new Response(null, { status: 503 }));
  assert.equal((await f.call(payload)).status, 503); assert.equal(f.cleared(), 0);
  f.setResponse(() => new Response(null, { status: 204 }));
  assert.equal((await f.call(payload)).status, 200); assert.equal(f.cleared(), 1);
  assert.equal(f.calls.at(-1).url, 'https://cms.test/auth/password/reset');
  assert.deepEqual(f.calls.at(-1).body, { token: payload.token, password: payload.password });
});
test('all supported locales provide reset and review overview text and deployment allows their reset URLs', () => {
  for (const locale of locales) {
    const messages = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url)));
    for (const key of ['title', 'resetTitle', 'sent', 'done', 'invalidToken', 'requestNew']) assert.ok(messages.PasswordReset[key]);
    for (const key of ['reviewsTitle', 'reviewsIntro', 'reviewsEmpty', 'reviewPending', 'reviewApproved', 'reviewRejected']) assert.ok(messages.Visitor[key]);
    for (const filename of ['compose.production.yaml', 'infra/compose.yaml']) assert.ok(readFileSync(new URL('../' + filename, import.meta.url), 'utf8').includes(`/${locale}/passwort-zuruecksetzen`));
  }
});

test('Directus accepts the password limiter scopes and enforces their shared budgets', async () => {
  const { default: endpoint } = await import('../infra/directus/extensions/directus-extension-findelio-review-notification/src/index.js');
  const routes = new Map(), counters = new Map();
  const database = () => ({ select() { return this; }, where() { return this; }, first: async () => ({ name: 'Findelio Server' }), delete: async () => {} });
  database.fn = { now: () => new Date() };
  database.raw = async (_query, [key, seconds, max]) => {
    assert.ok(seconds > 0);
    const count = counters.get(key) || 0;
    if (count >= max) return { rows: [] };
    counters.set(key, count + 1); return { rows: [{}] };
  };
  endpoint.handler({ get() {}, patch() {}, post: (path, handler) => routes.set(path, handler) }, { database, env: {}, services: {}, logger: { error() {} } });
  for (const [scope, max] of [['password-email-ip', 20], ['password-email-account', 5], ['password-reset', 30]]) {
    for (let i = 0; i <= max; i++) {
      const res = { statusCode: 200, set() {}, status(code) { this.statusCode = code; return this; }, send() {}, json() {} };
      await routes.get('/rate-limit')({ accountability: { user: 'server', role: 'server-role' }, body: { scope, client_key: 'a'.repeat(64) } }, res);
      assert.equal(res.statusCode, i === max ? 429 : 204);
    }
  }
});
