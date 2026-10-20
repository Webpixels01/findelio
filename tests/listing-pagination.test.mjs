import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { fixture, reply } from './fixtures/listing-pagination.mjs';
const require = createRequire(import.meta.url);
const modules = new Map();
function load(path) {
  if (modules.has(path)) return modules.get(path);
  const source = readFileSync(new URL(`../${path}.ts`, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} };
  new Function('require', 'exports', 'module', compiled)(name => name === 'server-only' ? {} : name.startsWith('@/') ? load(name.slice(2)) : require(name), mod.exports, mod);
  modules.set(path, mod.exports);
  return mod.exports;
}
const { getListingsPage } = load('lib/directus');
const { normalizeListingPage, listingPageHref, dailyListingRank } = load('lib/listing-pagination');
process.env.DIRECTUS_URL = 'https://directus.test';
process.env.DIRECTUS_TOKEN = 'test-token';
async function usingFixture(callback, count) {
  const original = global.fetch;
  const data = fixture(count);
  global.fetch = async url => {
    try { return Response.json(reply(url, data)); }
    catch { return Response.json({ error: 'unavailable' }, { status: 503 }); }
  };
  try { await callback(data); } finally { global.fetch = original; }
}
test('all 137 published listings load once in pages of ten, with premium globally first', async () => usingFixture(async data => {
  const ids = [];
  for (let page = 1; page <= 14; page++) {
    const result = await getListingsPage('sk', {}, page, '2026-10-16');
    assert.equal(result.total, 137);
    assert.equal(result.listings.length, page === 14 ? 7 : 10);
    ids.push(...result.listings.map(x => x.id));
    for (const item of result.listings) assert.equal(item.description, data.premium.includes(item.id) ? 'Slovenský opis' : 'Deutsche Beschreibung');
  }
  assert.equal(new Set(ids).size, 137);
  assert(!ids.includes('draft-id'));
  assert.deepEqual(ids.slice(0, 13), [...data.premium].sort((a,b) => dailyListingRank(a,'2026-10-16') - dailyListingRank(b,'2026-10-16') || a.localeCompare(b)));
  assert.equal((await getListingsPage('en', {}, 15)).listings.length, 0);
  const details = data.requests.filter(u => u.pathname === '/items/listings' && u.searchParams.get('fields')?.includes('description'));
  assert(details.every(u => Number(u.searchParams.get('limit')) <= 10));
}));
test('total and pages respect combined filters, blank filters, no matches and new publications', async () => usingFixture(async data => {
  const filters = { language: 'sk', industry: 'it', canton: 'ZH', location: ' zür ' };
  const result = await getListingsPage('en', filters, 1);
  assert.equal(result.total, 68);
  assert.equal(result.listings.length, 10);
  assert(result.listings.every(x => x.city === 'Zürich'));
  assert.equal((await getListingsPage('en', { location: '8000' })).total, 68);
  assert.equal((await getListingsPage('en', { industry: ' auto ', language: 'sk' })).total, 0);
  assert.equal((await getListingsPage('en', { location: '   ' })).total, 137);
  data.listings.push({ ...data.listings[0], id: 'new-id', name: 'New company' });
  assert.equal((await getListingsPage('en')).total, 138);
}));
test('premium ID lookup crosses the former 100-item limit', async () => usingFixture(async data => {
  data.premium = data.listings.filter(x => x.status === 'published').slice(0, 120).map(x => x.id);
  const ids=[];
  for (let page=1;page<=14;page++) ids.push(...(await getListingsPage('en',{},page)).listings.map(x=>x.id));
  assert.equal(new Set(ids).size,137);
  assert(ids.slice(0,120).every(id=>data.premium.includes(id)));
}));
test('empty directory and upstream errors do not become incorrect totals', async () => usingFixture(async data => {
  data.listings=[];data.premium=[];
  assert.equal((await getListingsPage('en')).total,0);
  data.failListings=true;
  await assert.rejects(getListingsPage('en'), /503/);
}));
test('page inputs and fallback URLs remain bounded and preserve filters', () => {
  for (const value of [undefined, null, 'abc', '-1', '1.5', 0, Infinity, {}, '1000001']) assert.equal(normalizeListingPage(value),1);
  assert.equal(normalizeListingPage('12'),12);
  assert.equal(listingPageHref({ sprache:'sk', ort:'Zürich & Bern', page:'99' },2),'/unternehmen?sprache=sk&ort=Z%C3%BCrich+%26+Bern&page=2');
  assert.equal(listingPageHref({},1),'/unternehmen');
});
