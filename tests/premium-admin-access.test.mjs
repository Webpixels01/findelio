import assert from 'node:assert/strict';
import test from 'node:test';
import { loadServerModule } from './helpers/load-server-module.mjs';

function environment(t) {
  const previous = process.env.DIRECTUS_URL;
  process.env.DIRECTUS_URL = 'https://directus.example.invalid';
  t.after(() => {
    if (previous === undefined) delete process.env.DIRECTUS_URL;
    else process.env.DIRECTUS_URL = previous;
  });
}

test('native administrator access requires a strict true response and fails closed', async t => {
  environment(t);
  const { hasDirectusAdminAccess } = loadServerModule('lib/directus-auth.ts');
  let response;
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(new URL(url).pathname, '/policies/me/globals');
    assert.equal(init.headers.Authorization, 'Bearer caller');
    assert.equal(init.cache, 'no-store');
    if (response instanceof Error) throw response;
    return response;
  });
  for (const value of [false, undefined, 'true', 1, true]) {
    response = Response.json({ data: { admin_access: value } });
    assert.equal(await hasDirectusAdminAccess('caller'), value === true);
  }
  response = Response.json({ data: { admin_access: true } }, { status: 403 });
  assert.equal(await hasDirectusAdminAccess('caller'), false);
  response = new Error('offline');
  assert.equal(await hasDirectusAdminAccess('caller'), false);
});

for (const isAdmin of [false, true]) {
  test(`Premium routes require native admin access, admin=${isAdmin}`, async t => {
    environment(t);
    const writes = [];
    let listingReads = 0;
    t.mock.method(globalThis, 'fetch', async (url, init) => {
      assert.equal(init.headers.Authorization, 'Bearer caller');
      const path = new URL(url).pathname;
      if (path === '/users/me') return Response.json({ data: { id: 'actor', role: { name: 'Administrator' } } });
      if (path === '/policies/me/globals') return Response.json({ data: { admin_access: isAdmin } });
      // Reviewer permissions and an administrator-looking role name never grant access.
      if (path === '/permissions/me') return Response.json({ data: {
        listing_revisions: { read: { access: 'full' }, update: { access: 'full' } },
        listings: { update: { access: 'full' } },
      } });
      throw Error(`Unexpected request ${path}`);
    });
    const mocks = {
      '@/lib/auth': {
        getAccessToken: async () => 'caller', getRefreshToken: async () => null,
      },
      '@/lib/directus-premium': {
        getAdminPremiumListings: async () => { listingReads++; return [{ id: 'listing', status: 'published', grants: [] }]; },
        createPremiumGrant: async input => { writes.push(input); return { id: 'grant' }; },
        revokePremiumGrant: async input => { writes.push(input); return { id: 'grant' }; },
      },
    };
    const post = loadServerModule('app/api/admin/premium-grants/route.ts', mocks).POST;
    const remove = loadServerModule('app/api/admin/premium-grants/[id]/route.ts', mocks).DELETE;
    const created = await post(new Request('https://example.invalid/api/admin/premium-grants', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ listing_id: 'listing', reason: 'Fixture reason' }),
    }));
    const removed = await remove(new Request('https://example.invalid/api/admin/premium-grants/grant', { method: 'DELETE' }), { params: Promise.resolve({ id: 'grant' }) });
    assert.equal(created.status, isAdmin ? 200 : 401);
    assert.equal(removed.status, isAdmin ? 200 : 403);
    assert.equal(listingReads, isAdmin ? 1 : 0);
    assert.equal(writes.length, isAdmin ? 2 : 0);
    for (const write of writes) assert.equal(write.accessToken, 'caller');
  });
}

test('Premium mutators forward caller credentials and reject missing credentials', async t => {
  environment(t);
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push({ url, init });
    return Response.json({ data: { id: 'grant' } });
  });
  const { createPremiumGrant, revokePremiumGrant } = loadServerModule('lib/directus-premium.ts');
  const grant = { listing: 'listing', grantedBy: 'actor', reason: 'Fixture', endsAt: null };
  const revoke = { grantId: 'grant', revokedBy: 'actor' };
  await assert.rejects(createPremiumGrant(grant), /Caller access token required/);
  await assert.rejects(revokePremiumGrant({ ...revoke, accessToken: ' ' }), /Caller access token required/);
  assert.equal(calls.length, 0);
  await createPremiumGrant({ ...grant, accessToken: 'caller' });
  await revokePremiumGrant({ ...revoke, accessToken: 'caller' });
  assert.deepEqual(calls.map(({ init }) => init.method), ['POST', 'PATCH']);
  for (const { init } of calls) assert.equal(init.headers.Authorization, 'Bearer caller');
});
