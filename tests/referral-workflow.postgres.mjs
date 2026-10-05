/** Opt-in, disposable PostgreSQL test. Real SQL/locks/transactions; ItemsService
 * and permission evaluation are ADAPTERS, not the Directus runtime.
 * See docs/referral-approval.md for setup and remaining runtime checks.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { test, after } from 'node:test';
import { createApprovalWorkflow } from '../infra/directus/extensions/directus-extension-findelio-referrals/src/referral-approval.js';
import { registerAdminRoutes } from '../infra/directus/extensions/directus-extension-findelio-referrals/src/referral-admin.js';

if (!process.env.FINDELIO_TEST_PG_PORT || !process.env.FINDELIO_TEST_RUNTIME) {
  throw new Error('Explicit disposable test DB port and runtime path required. Never uses .env files.');
}
const require = createRequire(`${process.env.FINDELIO_TEST_RUNTIME}/package.json`);
const knex = require('knex')({ client: 'pg', connection: {
  host: '127.0.0.1', port: Number(process.env.FINDELIO_TEST_PG_PORT),
  user: 'postgres', database: 'findelio_referral_workflow_test',
}, pool: { min: 0, max: 8 } });
after(() => knex.destroy());
// This script only works on an EMPTY fixture database with this fixed name.
await knex.raw(`
CREATE TABLE directus_users (id uuid PRIMARY KEY, email text);
CREATE TABLE organizations (id uuid PRIMARY KEY, name text);
CREATE TABLE listings (id uuid PRIMARY KEY, organization uuid REFERENCES organizations(id), name text, slug text,
 status text, published_at timestamptz, description text, street text, postal_code text, city text,
 canton uuid, public_email text, phone text, website_url text, address_visibility text, logo uuid,
 description_translations jsonb, social_links jsonb, custom_cta_label text, custom_cta_value text);
CREATE TABLE listing_revisions (id uuid PRIMARY KEY, listing uuid REFERENCES listings(id), status text,
 data jsonb, reviewed_by uuid, reviewed_at timestamptz, rejection_reason text);
CREATE TABLE subscriptions (id uuid PRIMARY KEY, listing uuid REFERENCES listings(id), plan text,
 status text, current_period_end timestamptz);
CREATE TABLE listings_industries (id serial PRIMARY KEY, listings_id uuid REFERENCES listings(id), industries_id uuid);
CREATE TABLE listings_spoken_languages (id serial PRIMARY KEY, listings_id uuid REFERENCES listings(id), spoken_languages_id uuid);
CREATE TABLE listings_files (id serial PRIMARY KEY, listings_id uuid REFERENCES listings(id), directus_files_id uuid);
CREATE TABLE listing_opening_hours (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), listing uuid REFERENCES listings(id), day_of_week int, opens_at time, closes_at time);
CREATE TABLE directus_collections (collection text, icon text, note text, display_template text, accountability text);
CREATE TABLE directus_fields (collection text, field text, special text, interface text, options jsonb, display text,
 readonly boolean, hidden boolean, sort int, width text, required boolean);
CREATE TABLE directus_relations (many_collection text, many_field text, one_collection text, one_deselect_action text);
CREATE TABLE directus_permissions (collection text, action text, permissions jsonb, validation jsonb, fields text, policy uuid);
`);
for (const name of ['20260810_premium_grants.sql', '20260910_referral_system.sql']) {
  await knex.raw(await readFile(new URL(`../infra/directus/migrations/${name}`, import.meta.url), 'utf8'));
}

const fixedNow = new Date('2026-09-11T10:00:00Z');
const jsonFields = new Set(['description_translations', 'social_links', 'data']);
const sqlPayload = (row) => Object.fromEntries(Object.entries(row).map(([k,v]) => [k, jsonFields.has(k) && v !== null ? JSON.stringify(v) : v]));
function workflow({ failCollection, denied = false, now = () => fixedNow, events = [] } = {}) {
  class ItemsService {
    constructor(collection, options) { this.collection = collection; this.trx = options.knex; }
    async readOne(id) { return this.trx(this.collection).where({ id }).first(); }
    async readByQuery({ filter }) {
      let q = this.trx(this.collection);
      for (const [key,value] of Object.entries(filter)) q = q.where(key, value._eq);
      return q;
    }
    check() { if (this.collection === failCollection) throw Error('injected failure'); }
    async updateOne(id, data, options) {
      this.check(); await this.trx(this.collection).where({ id }).update(sqlPayload(data));
      options?.bypassEmitAction({ event: 'updated', meta: { collection: this.collection }, context: {} });
    }
    async deleteMany(ids) { return this.trx(this.collection).whereIn('id', ids).del(); }
    async createMany(rows) { this.check(); return this.trx(this.collection).insert(rows.map(sqlPayload)); }
    async createOne(row, options) {
      this.check(); const [created] = await this.trx(this.collection).insert(sqlPayload(row)).returning('id');
      options?.bypassEmitAction({ event: 'created', meta: {}, context: {} });
      return created.id;
    }
  }
  class PermissionsService { async getItemPermissions() { return { update: { access: !denied } }; } }
  return createApprovalWorkflow({ database: knex, services: { ItemsService, PermissionsService }, getSchema: async () => ({}),
    getCollectionAccess: async () => denied ? {} : { listing_revisions: { read: { access: 'full' }, update: { access: 'full' } }, listings: { update: { access: 'full' } } },
    emitter: { emitAction: (...args) => events.push(args) }, logger: { warn() {} }, now });
}
async function fixture() {
  const user = randomUUID(), organization = randomUUID(), partner = randomUUID(), redemption = randomUUID();
  await knex('directus_users').insert({ id: user });
  await knex('organizations').insert({ id: organization });
  await knex('referral_partners').insert({ id: partner, name: 'Test partner', code: 'CODE-' + partner });
  await knex('referral_redemptions').insert({ id: redemption, partner, user, organization,
    code_snapshot: 'CODE-' + partner, status: 'pending_approval' });
  const listings = [randomUUID(), randomUUID()], revisions = [randomUUID(), randomUUID()];
  for (let i = 0; i < 2; i++) {
    await knex('listings').insert({ id: listings[i], organization, name: 'Before', status: 'pending' });
    await knex('listing_revisions').insert({ id: revisions[i], listing: listings[i], status: 'pending',
      data: JSON.stringify({ name: 'Approved', industry_ids: [randomUUID()], spoken_language_ids: [randomUUID()],
        gallery_file_ids: [randomUUID()], opening_hours: [{ day_of_week: 1, opens_at: '09:00', closes_at: '17:00' }],
        social_links: [{ platform: 'web', url: 'https://example.test' }] }) });
  }
  return { user, organization, partner, redemption, listings, revisions, accountability: { user, admin: true } };
}
const load = (f) => knex('referral_redemptions').where({ id: f.redemption }).first();

test('two concurrent approvals reserve one first profile; concurrent retries create exactly one grant', async () => {
  const f = await fixture(), w = workflow();
  await Promise.all(f.revisions.map((id) => w.approve(id, f.accountability)));
  const before = await load(f);
  assert.equal(before.status, 'pending_activation');
  assert.ok(f.listings.includes(before.trial_listing));
  assert.equal(before.trial_ends_at.toISOString(), '2026-12-11T11:00:00.000Z');
  await Promise.all([w.activate(f.redemption, f.user), w.activate(f.redemption, f.user)]);
  const after = await load(f);
  assert.equal(after.status, 'granted');
  assert.equal((await knex('premium_grants').whereIn('listing', f.listings)).length, 1);
  await w.approve(f.revisions[f.listings.indexOf(before.trial_listing)], f.accountability);
  assert.deepEqual((await load(f)).trial_starts_at, before.trial_starts_at);
  assert.equal((await knex('listings_files').whereIn('listings_id', f.listings)).length, 2);
  assert.equal((await knex('listing_opening_hours').whereIn('listing', f.listings)).length, 2);
});

test('failure late in approval rolls back listing, relationships and reservation; no action hooks emitted', async () => {
  const f = await fixture(), events = [];
  await assert.rejects(workflow({ failCollection: 'listing_revisions', events }).approve(f.revisions[0], f.accountability), /injected failure/);
  assert.equal((await load(f)).status, 'pending_approval');
  assert.equal((await load(f)).trial_listing, null);
  assert.equal((await knex('listings').where({ id: f.listings[0] }).first()).name, 'Before');
  assert.equal((await knex('listings_industries').where({ listings_id: f.listings[0] })).length, 0);
  assert.equal(events.length, 0);
});

test('activation failure preserves reservation and retry retains original dates', async () => {
  const f = await fixture(); await workflow().approve(f.revisions[0], f.accountability);
  const before = await load(f);
  await assert.rejects(workflow({ failCollection: 'premium_grants' }).activate(f.redemption, f.user), /injected failure/);
  assert.equal((await load(f)).status, 'pending_activation');
  await workflow().activate(f.redemption, f.user);
  const grant = await knex('premium_grants').where({ id: (await load(f)).premium_grant }).first();
  assert.deepEqual(grant.starts_at, before.trial_starts_at);
  assert.deepEqual(grant.ends_at, before.trial_ends_at);
});

test('failure after grant insert rolls back the grant and emits no action event', async () => {
  const f = await fixture(), events = [];
  await workflow().approve(f.revisions[0], f.accountability);
  await knex.raw(`CREATE FUNCTION fail_test_redemption() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'injected redemption update failure'; END $$;
    CREATE TRIGGER fail_test_redemption BEFORE UPDATE ON referral_redemptions
    FOR EACH ROW WHEN (NEW.id = '${f.redemption}'::uuid AND NEW.status = 'granted')
    EXECUTE FUNCTION fail_test_redemption();`);
  try {
    await assert.rejects(workflow({ events }).activate(f.redemption, f.user), /injected redemption update failure/);
    assert.equal((await load(f)).status, 'pending_activation');
    assert.equal((await knex('premium_grants').whereIn('listing', f.listings)).length, 0);
    assert.equal(events.length, 0);
  } finally {
    await knex.raw('DROP TRIGGER fail_test_redemption ON referral_redemptions; DROP FUNCTION fail_test_redemption();');
  }
  await workflow().activate(f.redemption, f.user);
  assert.equal((await load(f)).status, 'granted');
});

test('ordinary approval without a referral preserves all listing updates', async () => {
  const f = await fixture();
  await knex('referral_redemptions').where({ id: f.redemption }).del();
  const result = await workflow().approve(f.revisions[0], f.accountability);
  assert.deepEqual(result, { status: 'none' });
  assert.equal((await knex('listings').where({ id: f.listings[0] }).first()).name, 'Approved');
  assert.equal((await knex('premium_grants').whereIn('listing', f.listings)).length, 0);
});

test('an existing grant at approval is skipped; a later subscription also blocks activation', async () => {
  const a = await fixture();
  await knex('premium_grants').insert({ id: randomUUID(), listing: a.listings[0], reason: 'Existing', starts_at: fixedNow });
  await workflow().approve(a.revisions[0], a.accountability);
  assert.equal((await load(a)).trial_decision, 'skipped_existing_premium');
  const b = await fixture();
  await workflow().approve(b.revisions[0], b.accountability);
  await knex('subscriptions').insert({ id: randomUUID(), listing: b.listings[0], plan: 'premium', status: 'active' });
  await workflow().activate(b.redemption, b.user);
  assert.equal((await load(b)).skip_reason, 'activation_active_subscription');
  assert.equal((await load(b)).trial_decision, 'eligible');
});

test('existing subscription at approval remains skipped after cancellation', async () => {
  const f = await fixture();
  const id = randomUUID();
  await knex('subscriptions').insert({ id, listing: f.listings[0], plan: 'premium', status: 'active' });
  await workflow().approve(f.revisions[0], f.accountability);
  await knex('subscriptions').where({ id }).update({ status: 'canceled' });
  await workflow().activate(f.redemption, f.user);
  assert.equal((await load(f)).trial_decision, 'skipped_existing_premium');
  assert.equal((await load(f)).status, 'skipped_existing_premium');
  assert.equal((await knex('premium_grants').whereIn('listing', f.listings)).length, 0);
});

test('a grant added between approval and activation prevents an additional grant without changing approval decision', async () => {
  const f = await fixture(); await workflow().approve(f.revisions[0], f.accountability);
  await knex('premium_grants').insert({ id: randomUUID(), listing: f.listings[0], reason: 'Existing grant', starts_at: fixedNow });
  await workflow().activate(f.redemption, f.user);
  const row = await load(f);
  assert.equal(row.status, 'skipped_existing_premium');
  assert.equal(row.trial_decision, 'eligible');
  assert.equal(row.skip_reason, 'activation_active_grant');
  assert.equal((await knex('premium_grants').whereIn('listing', f.listings)).length, 1);
});

test('expired reservation never restarts and unauthorized review leaves no mutations', async () => {
  const f = await fixture();
  await assert.rejects(workflow({ denied: true }).approve(f.revisions[0], f.accountability), /forbidden/);
  assert.equal((await load(f)).status, 'pending_approval');
  await workflow().approve(f.revisions[0], f.accountability);
  await workflow({ now: () => new Date('2027-01-01') }).activate(f.redemption, f.user);
  assert.equal((await load(f)).status, 'expired_unactivated');
  assert.equal((await knex('premium_grants').whereIn('listing', f.listings)).length, 0);
});

test('previously published then suspended profile cannot claim a new referral trial', async () => {
  const f = await fixture();
  await knex('listings').where({ id: f.listings[1] }).update({ status: 'suspended', published_at: fixedNow });
  await workflow().approve(f.revisions[0], f.accountability);
  assert.equal((await load(f)).status, 'void');
  assert.equal((await load(f)).skip_reason, 'previous_publication');
});

test('migration enforces code normalization and organization uniqueness', async () => {
  const f = await fixture();
  await assert.rejects(knex('referral_partners').insert({ name: 'Other', code: 'code-' + f.partner }), (e) => e.code === '23505');
  await assert.rejects(knex('referral_partners').insert({ name: 'Other', code: ' space ' }), (e) => e.code === '23514');
  const user = randomUUID(); await knex('directus_users').insert({ id: user });
  await assert.rejects(knex('referral_redemptions').insert({ user, organization: f.organization,
    partner: f.partner, code_snapshot: 'EXAMPLE', status: 'pending_approval' }), (e) => e.code === '23505');
});

test('admin create, duplicate code, edit/deactivate, filtered paging and stable referral history', async () => {
  const routes = new Map();
  class ItemsService {
    constructor(collection) { this.collection = collection; }
    async createOne(row) { await knex(this.collection).insert(row); return row.id; }
    async updateOne(id, values) { await knex(this.collection).where({ id }).update(values); }
  }
  registerAdminRoutes(Object.fromEntries(['get', 'post', 'patch'].map((method) => [method, (path, handler) => routes.set(`${method} ${path}`, handler)])), {
    database: knex, env: { FINDELIO_REFERRAL_REGISTRATION_ENABLED: 'true' },
    getSchema: async () => ({}), services: { ItemsService }, logger: { warn() {} },
  });
  async function call(route, body = {}, query = {}, params = {}) {
    const res = { code: 200, set() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    await routes.get(route)({ body, query, params, accountability: { user: randomUUID(), admin: true } }, res);
    return res;
  }
  const created = await call('post /admin/partners', { name: 'Anna', code: 'ANNA3', status: 'active' });
  assert.equal(created.code, 201);
  const partner = created.body.data.id;
  assert.equal((await call('post /admin/partners', { name: 'Other', code: 'anna3', status: 'active' })).code, 409);
  for (let i = 0; i < 27; i++) {
    const user = randomUUID(); await knex('directus_users').insert({ id: user, email: `fixture-${i}@example.test` });
    await knex('referral_redemptions').insert({ user, partner, code_snapshot: 'ANNA3', status: 'pending_organization' });
  }
  const changed = await call('patch /admin/partners/:id', { name: 'Anna updated', notes: 'Internal', status: 'disabled' }, {}, { id: partner });
  assert.equal(changed.code, 200);
  assert.equal((await knex('referral_partners').where({ id: partner }).first()).code, 'ANNA3');
  const one = await call('get /admin/overview', {}, { partner, page: '1' });
  assert.equal(one.code, 200);
  assert.equal(one.body.data.total, 27);
  assert.equal(one.body.data.redemptions.length, 25);
  assert.equal(one.body.data.partners.find((p) => p.id === partner).status, 'disabled');
  const two = await call('get /admin/overview', {}, { partner, page: '2' });
  assert.equal(two.body.data.redemptions.length, 2);
  assert.ok(two.body.data.redemptions.every((row) => row.code_snapshot === 'ANNA3'));
  assert.ok(!two.body.data.redemptions.some((row) => one.body.data.redemptions.some((first) => first.id === row.id)));
  const empty = await call('get /admin/overview', {}, { partner, status: 'granted' });
  assert.equal(empty.body.data.total, 0);
  assert.equal(empty.body.data.redemptions.length, 0);
  assert.equal((await call('patch /admin/partners/:id', { name: 'Anna', code: 'NEWCODE', status: 'active' }, {}, { id: partner })).code, 400);
});
