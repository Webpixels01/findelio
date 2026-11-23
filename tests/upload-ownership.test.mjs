import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { loadServerModule } from './helpers/load-server-module.mjs';

const listingId = '11111111-1111-4111-8111-111111111111';
const fileId = '22222222-2222-4222-8222-222222222222';
const user = 'customer', folder = 'public-folder';
function fixture(t) {
  process.env.DIRECTUS_URL = 'https://cms.example'; process.env.DIRECTUS_TOKEN = 'test-service-token';
  const account = loadServerModule('lib/directus-account.ts', {
    '@/lib/directus-assets': { getDirectusAssetUrl: id => `https://cms.example/assets/${id}` },
    '@/lib/directus-premium': {}, '@/lib/mail': {},
  });
  let uploaded, ownerMode = 'success', authorized = true;
  const mutations = [];
  const listing = { id: listingId, name: 'Test', status: 'published', organization: { id: 'org' }, logo: null, gallery: [] };
  t.mock.method(globalThis, 'fetch', async (value, options = {}) => {
    const url = new URL(value), path = url.pathname;
    if (options.method === 'POST' && path === '/files') {
      mutations.push('upload');
      assert.equal(options.body.get('uploaded_by'), null);
      uploaded = { id: fileId, type: 'image/png', folder, uploaded_by: 'service-user' };
      return Response.json({ data: { id: fileId } });
    }
    if (options.method === 'PATCH' && path === `/files/${fileId}`) {
      mutations.push('assign');
      assert.deepEqual(JSON.parse(options.body), { uploaded_by: user });
      if (ownerMode === 'denied') return Response.json({ errors: [{ extensions: { code: 'FORBIDDEN' } }] }, { status: 403 });
      if (ownerMode === 'success') uploaded.uploaded_by = user;
      return Response.json({ data: uploaded });
    }
    if (path === '/items/organization_members') return Response.json({ data: authorized ? [{ status: 'active', organization: { id: 'org' } }] : [] });
    if (path === `/items/listings/${listingId}`) return Response.json({ data: listing });
    if (path === '/items/listings_files' || path === '/items/listing_revisions') return Response.json({ data: [] });
    if (path === '/items/subscriptions') return Response.json({ data: [{ plan: 'premium', status: 'active' }] });
    if (path === '/folders') return Response.json({ data: [{ id: folder }] });
    if (path === '/files') return Response.json({ data: uploaded ? [uploaded] : [] });
    throw new Error('Unexpected request: ' + path);
  });
  return { account, listing, mutations, mode: value => { ownerMode = value; }, deny: () => { authorized = false; } };
}
async function image() {
  const bytes = await sharp({ create: { width: 287, height: 384, channels: 4, background: '#eeeeee' } }).png().toBuffer();
  return new File([bytes], 'image.png', { type: 'image/png' });
}
test('upload assigns a service-created image to the verified customer before the listing ownership check', async t => {
  const f = fixture(t);
  const result = await f.account.uploadAccountListingImages('customer-token', listingId, [await image()], user);
  assert.deepEqual(f.mutations, ['upload', 'assign']);
  assert.equal(result[0].id, fileId);
  await f.account.validatePremiumFileIds(f.listing, [fileId], user);
  await assert.rejects(f.account.validatePremiumFileIds(f.listing, [fileId], 'other-customer'), { code: 'INVALID_FILE' });
});
test('upload does not return usable files when ownership assignment fails or is ignored', async t => {
  const f = fixture(t);
  for (const mode of ['denied', 'ignored']) {
    f.mode(mode);
    await assert.rejects(f.account.uploadAccountListingImages('customer-token', listingId, [await image()], user), { code: mode === 'denied' ? 'FORBIDDEN' : 'UPLOAD_OWNER_MISMATCH' });
  }
});
test('unauthorized listing uploads create or reassign no files', async t => {
  const f = fixture(t); f.deny();
  await assert.rejects(f.account.uploadAccountListingImages('customer-token', listingId, [await image()], user), { code: 'FORBIDDEN' });
  assert.deepEqual(f.mutations, []);
});
