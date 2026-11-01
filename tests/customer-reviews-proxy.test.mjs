import assert from 'node:assert/strict';
import test from 'node:test';
import { loadServerModule } from './helpers/load-server-module.mjs';

test('review proxy protects mutations, forwards session authority and excludes unapproved query parameters', async () => {
  const before = global.fetch;
  const previousUrl = process.env.DIRECTUS_URL, previousSite = process.env.NEXT_PUBLIC_SITE_URL;
  process.env.DIRECTUS_URL = 'https://cms.example.invalid';
  process.env.NEXT_PUBLIC_SITE_URL = 'https://findelio.example.invalid';
  let calls = 0;
  global.fetch = async (target, options) => {
    calls++;
    assert.equal(target.origin, 'https://cms.example.invalid');
    assert.equal(target.searchParams.has('filter'), false);
    assert.equal(options.headers.Authorization, 'Bearer user-session');
    return Response.json({ data: { reviews: [] } });
  };
  try {
    const route = loadServerModule('app/api/customer-reviews/[[...path]]/route.ts', {
      '@/lib/auth': { getAccessToken: async () => 'user-session', getRefreshToken: async () => null },
      '@/lib/directus-auth': {},
    });
    const params = { params: Promise.resolve({ path: [] }) };
    for (const origin of [null, 'https://evil.example.invalid']) {
      const headers = { 'Content-Type': 'application/json', ...(origin ? { origin } : {}) };
      const response = await route.POST(new Request('https://findelio.example.invalid/api/customer-reviews', { method: 'POST', headers, body: '{}' }), params);
      assert.equal(response.status, 403);
    }
    assert.equal(calls, 0);
    const response = await route.GET(new Request('https://findelio.example.invalid/api/customer-reviews?listing=123&filter=secret'), params);
    assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
    const invalid = await route.GET(new Request('https://findelio.example.invalid/api/customer-reviews'), { params: Promise.resolve({ path: ['..', 'users'] }) });
    assert.equal(invalid.status, 404); assert.equal(calls, 1);
  } finally {
    global.fetch = before;
    if (previousUrl === undefined) delete process.env.DIRECTUS_URL; else process.env.DIRECTUS_URL = previousUrl;
    if (previousSite === undefined) delete process.env.NEXT_PUBLIC_SITE_URL; else process.env.NEXT_PUBLIC_SITE_URL = previousSite;
  }
});
