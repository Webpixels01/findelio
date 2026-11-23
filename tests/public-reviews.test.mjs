import assert from 'node:assert/strict';
import test from 'node:test';
import { loadServerModule } from './helpers/load-server-module.mjs';

const { getPublicReviews } = loadServerModule('lib/public-reviews.ts');

test('public profile reviews use anonymous requests and never expose account data', async (t) => {
  const original = process.env.DIRECTUS_URL;
  process.env.DIRECTUS_URL = 'https://cms.example.test';
  t.after(() => { if (original === undefined) delete process.env.DIRECTUS_URL; else process.env.DIRECTUS_URL = original; });
  const reviews = [{ id: 'approved', author_name: 'Anna', rating: 4, body: 'Helpful service', created_at: '2026-11-01' }];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url.origin, 'https://cms.example.test');
    assert.equal(url.searchParams.get('listing'), 'listing-id');
    assert.equal(options.headers, undefined);
    assert.equal(options.cache, 'no-store');
    assert.ok(options.signal instanceof AbortSignal);
    return Response.json({ data: { reviews, average: 4, count: 1, own: { body: 'Private draft' }, authenticated: true, canReview: true } });
  });
  assert.deepEqual(await getPublicReviews('listing-id'), { reviews, average: 4, count: 1, own: null, authenticated: false, canReview: false });
});

test('review outages and invalid summaries do not break public profiles or produce ratings', async (t) => {
  const original = process.env.DIRECTUS_URL;
  process.env.DIRECTUS_URL = 'https://cms.example.test';
  t.after(() => { if (original === undefined) delete process.env.DIRECTUS_URL; else process.env.DIRECTUS_URL = original; });
  const mock = t.mock.method(globalThis, 'fetch');
  for (const response of [new Response(null, { status: 503 }), new Response('invalid json'),
    Response.json({ data: { reviews: [], count: 1, average: 6 } }), Response.json({ data: null })]) {
    mock.mock.mockImplementation(async () => response);
    assert.equal(await getPublicReviews('listing-id'), null);
  }
  mock.mock.mockImplementation(async () => { throw new Error('timeout'); });
  assert.equal(await getPublicReviews('listing-id'), null);
  mock.mock.mockImplementation(async () => Response.json({ data: { reviews: [], count: 0, average: 0 } }));
  assert.equal((await getPublicReviews('listing-id')).count, 0);
});
