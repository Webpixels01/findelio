import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { registerCustomerReviews, reviewInput } from '../infra/directus/extensions/directus-extension-findelio-review-notification/src/customer-reviews.js';

// Exercise real endpoint handlers with an in-memory query adapter. Native
// PostgreSQL locking/constraints and actual SMTP delivery require integration QA.
function fixture() {
  const author = randomUUID(), owner = randomUUID(), outsider = randomUUID(), admin = randomUUID(), listing = randomUUID(), organization = randomUUID();
  let rows = {
    directus_users: [author, owner, outsider, admin].map(id => ({ id, status: 'active', first_name: 'Anna' })),
    listings: [{ id: listing, organization, status: 'published', name: 'Example' }],
    organization_members: [{ organization, user: owner, status: 'active' }],
    findelio_customer_reviews: [],
  };
  const db = name => {
    const conditions = [], fields = [];
    let source = rows[name];
    if (name === 'findelio_customer_reviews as r') source = rows.findelio_customer_reviews.map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => ['r.' + key, value])));
    let limit = Infinity, offset = 0, aggregate = false;
    const q = {
      join(table, left, right) {
        assert.equal(table, 'listings as l');
        source = source.flatMap(row => rows.listings.filter(listing => listing[left.slice(2)] === row[right]).map(listing => ({ ...row, ...Object.fromEntries(Object.entries(listing).map(([key, value]) => ['l.' + key, value])) })));
        return q;
      },
      where(key, value) { conditions.push(typeof key === 'object' ? key : { [key]: value }); return q; },
      select(...names) { fields.push(...names); return q; },
      forUpdate() { return q; }, forShare() { return q; },
      orderBy() { return q; }, limit(value) { limit = value; return q; }, offset(value) { offset = value; return q; },
      count() { aggregate = true; return q; }, avg() { aggregate = true; return q; },
      values() { return source.filter(row => conditions.every(condition => Object.entries(condition).every(([key, value]) => row[key] === value))); },
      async first() { return (await q)[0]; },
      async insert(value) { rows[name].push({ version: 1, created_at: '2026-11-01T10:00:00Z', ...value }); },
      async update(value) { q.values().forEach(row => Object.assign(row, value)); },
      then(resolve, reject) {
        try {
          let result = q.values();
          if (aggregate) result = [{ count: result.length, average: result.length ? result.reduce((sum, row) => sum + row.rating, 0) / result.length : null }];
          else result = result.slice(offset, offset + limit).map(row => fields.length ? Object.fromEntries(fields.map(field => { const [key, alias] = field.split(" as "); return [alias || key.split(".").at(-1), row[key]]; })) : { ...row });
          return Promise.resolve(result).then(resolve, reject);
        } catch (error) { return Promise.reject(error).then(resolve, reject); }
      },
    }; return q;
  };
  db.fn = { now: () => '2026-11-01T11:00:00Z' };
  db.transaction = async fn => { const before = structuredClone(rows); try { return await fn(db); } catch (error) { rows = before; throw error; } };
  const handlers = new Map(), mails = [];
  let mailFails = false, allowed = true;
  registerCustomerReviews(Object.fromEntries(['get', 'post', 'patch'].map(method => [method, (path, fn) => handlers.set(`${method} ${path}`, fn)])), {
    database: db, env: { ADMIN_NOTIFICATION_EMAIL: 'admin@example.invalid', FINDELIO_SITE_URL: 'https://example.invalid' }, getSchema: async () => ({}), logger: { error() {} },
    services: { MailService: class { async send(mail) { if (mailFails) throw Error('SMTP unavailable'); mails.push(mail); } } },
  }, async () => allowed);
  async function call(method, suffix = '', user = author, body = {}, id, query = { listing }) {
    const res = { statusCode: 200, set() { return this; }, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; } };
    await handlers.get(`${method} /customer-reviews${suffix}`)({ accountability: user ? { user, admin: user === admin } : null, params: { id }, query, body }, res);
    return res;
  }
  return { author, owner, outsider, admin, listing, call, mails, rows: () => rows, mailFails: value => { mailFails = value; }, allowed: value => { allowed = value; } };
}
const input = { rating: 4, body: 'A very useful and friendly service.' };
test('only integer stars 1–5 and trimmed review texts of 10–3000 characters are accepted', () => {
  for (const rating of [0, 6, 2.5, '5', null, NaN]) assert.equal(reviewInput({ ...input, rating }), null);
  for (const body of ['', 'x'.repeat(9), 'x'.repeat(3001), null]) assert.equal(reviewInput({ ...input, body }), null);
  assert.deepEqual(reviewInput({ rating: 5, body: '  A good experience  ' }), { rating: 5, body: 'A good experience' });
});
test('authenticated submissions notify admin, remain hidden, and cannot duplicate or spoof approval', async () => {
  const f = fixture();
  assert.equal((await f.call('post', '', null, { ...input, listing: f.listing })).statusCode, 401);
  assert.equal((await f.call('post', '', f.owner, { ...input, listing: f.listing })).statusCode, 403);
  assert.equal((await f.call('post', '', f.author, { ...input, listing: f.listing, status: 'approved', author: f.outsider })).statusCode, 200);
  const row = f.rows().findelio_customer_reviews[0];
  assert.equal(row.status, 'pending'); assert.equal(row.author, f.author);
  assert.equal(f.mails.length, 1); assert.match(f.mails[0].text, /dashboard\/bewertungen/);
  assert.equal((await f.call('get', '', null)).body.data.count, 0);
  assert.equal((await f.call('post', '', f.author, { ...input, listing: f.listing })).statusCode, 409);
  assert.equal(f.rows().findelio_customer_reviews.length, 1);
});
test('approval is admin-only and version-bound; public responses expose no private identities', async () => {
  const f = fixture(); await f.call('post', '', f.author, { ...input, listing: f.listing });
  const row = f.rows().findelio_customer_reviews[0];
  assert.equal((await f.call('patch', '/:id', f.owner, { action: 'approve', version: 1 }, row.id)).statusCode, 403);
  assert.equal((await f.call('patch', '/:id', f.admin, { action: 'approve', version: 2 }, row.id)).statusCode, 409);
  assert.equal((await f.call('patch', '/:id', f.admin, { action: 'approve', version: 1 }, row.id)).statusCode, 200);
  const data = (await f.call('get', '', null)).body.data;
  assert.equal(data.count, 1); assert.equal(data.average, 4);
  assert.equal(data.reviews[0].author, undefined); assert.equal(data.reviews[0].reviewed_by, undefined);
  assert.equal((await f.call('patch', '/:id', f.admin, { action: 'reject', version: 1 }, row.id)).statusCode, 409);
});
test('only the listed company can reply; edits hide the review and remove stale answers', async () => {
  const f = fixture(); await f.call('post', '', f.author, { ...input, listing: f.listing });
  const id = f.rows().findelio_customer_reviews[0].id;
  assert.equal((await f.call('patch', '/:id', f.owner, { action: 'reply', version: 1, response: 'Thanks' }, id)).statusCode, 409);
  await f.call('patch', '/:id', f.admin, { action: 'approve', version: 1 }, id);
  assert.equal((await f.call('patch', '/:id', f.outsider, { action: 'reply', version: 2, response: 'Fake reply' }, id)).statusCode, 403);
  assert.equal((await f.call('patch', '/:id', f.owner, { action: 'reply', version: 2, response: 'Thanks' }, id)).statusCode, 200);
  assert.equal((await f.call('get', '', null)).body.data.reviews[0].response, 'Thanks');
  assert.equal((await f.call('post', '', f.author, { ...input, rating: 5, version: 3, listing: f.listing })).statusCode, 200);
  assert.equal((await f.call('get', '', null)).body.data.count, 0);
  assert.equal(f.rows().findelio_customer_reviews[0].response, null);
  assert.equal(f.mails.length, 2);
});
test('mail failures roll back submissions; rate limits and inactive accounts fail closed', async () => {
  const f = fixture(); f.mailFails(true);
  assert.equal((await f.call('post', '', f.author, { ...input, listing: f.listing })).statusCode, 503);
  assert.equal(f.rows().findelio_customer_reviews.length, 0);
  f.mailFails(false); f.allowed(false);
  assert.equal((await f.call('post', '', f.author, { ...input, listing: f.listing })).statusCode, 429);
  f.allowed(true); f.rows().directus_users.find(user => user.id === f.author).status = 'unverified';
  assert.equal((await f.call('post', '', f.author, { ...input, listing: f.listing })).statusCode, 403);
});
test('review translations are complete in every supported language', () => {
  const base = JSON.parse(readFileSync(new URL('../messages/de-ch.json', import.meta.url))).Reviews;
  for (const locale of ['en', 'sk', 'cs', 'hu', 'pl', 'ru', 'pt-pt', 'ro', 'vi']) {
    const messages = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url)));
    assert.deepEqual(Object.keys(messages.Reviews), Object.keys(base));
    assert.ok(messages.Dashboard.navigation.reviews);
    assert.match(messages.Reviews.count, /\{count\}/);
  }
});

test('own review overview is authenticated, author-scoped, paginated and includes all moderation states', async () => {
  const f = fixture();
  assert.equal((await f.call('get', '/mine', null)).statusCode, 401);
  for (let i = 0; i < 22; i++) f.rows().findelio_customer_reviews.push({ id: String(i), listing: f.listing, author: f.author, author_name: 'Anna', rating: 4, body: 'Own review', status: ['pending', 'approved', 'rejected'][i % 3], response: 'Company reply', created_at: '2026-11-01T10:00:00Z', reviewed_by: f.admin });
  f.rows().findelio_customer_reviews.push({ id: 'private', listing: f.listing, author: f.outsider, body: 'Other person', status: 'pending' });
  const first = await f.call('get', '/mine', f.author, {}, undefined, { author: f.outsider });
  assert.equal(first.statusCode, 200);
  assert.equal(first.body.data.reviews.length, 20);
  assert.equal(first.body.data.more, true);
  assert.deepEqual(new Set(first.body.data.reviews.map(r => r.status)), new Set(['pending', 'approved', 'rejected']));
  for (const row of first.body.data.reviews) {
    assert.equal(row.body, 'Own review'); assert.equal(row.response, 'Company reply');
    assert.equal(row.listing_name, 'Example'); assert.equal(row.author, undefined); assert.equal(row.reviewed_by, undefined);
  }
  const second = await f.call('get', '/mine', f.author, {}, undefined, { page: '1' });
  assert.equal(second.body.data.reviews.length, 2); assert.equal(second.body.data.more, false);
  assert.equal((await f.call('get', '/mine', f.owner)).body.data.reviews.length, 0);
  f.rows().directus_users.find(u => u.id === f.author).status = 'unverified';
  assert.equal((await f.call('get', '/mine', f.author)).statusCode, 403);
});
