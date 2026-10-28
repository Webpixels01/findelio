// Execute only in an approved offline sandbox against disposable PostgreSQL.
// Uses the real deletion endpoint; only HTTP responses and logging are stubs.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

const connection = process.env.FINDELIO_DELETION_TEST_DATABASE;
test('deletion serializes with moderation and other deletion decisions', {
  skip: !connection, timeout: 60000,
}, async (t) => {
  const { default: knex } = await import('knex');
  const { default: endpoint } = await import('../infra/directus/extensions/directus-extension-findelio-deletion-requests/dist/index.js');
  const schema = `deletion_test_${randomUUID().replaceAll('-', '')}`;
  const admin = knex({ client: 'pg', connection });
  await admin.raw(`create schema "${schema}"`);
  const db = knex({ client: 'pg', connection, pool: { min: 0, max: 8,
    afterCreate(conn, done) {
      conn.query(`set search_path to "${schema}"; set application_name to '${schema}'; set statement_timeout to '10s'`, (error) => done(error, conn));
    },
  }});
  const handlers = new Map(), errors = [];
  endpoint.handler(Object.fromEntries(['get', 'post', 'patch', 'delete'].map(method => [method,
    (path, handler) => handlers.set(`${method} ${path}`, handler)])), {
    database: db, env: {}, getSchema: async () => ({}),
    services: {}, logger: { error: (...args) => errors.push(args) },
  });
  const org = randomUUID(), listing = randomUUID(), user = randomUUID();
  const organizationRequest = randomUUID(), listingRequest = randomUUID();
  async function approve(id) {
    const response = { code: 200, status(code) { this.code = code; return this; },
      json(body) { this.body = body; return this; } };
    await handlers.get('patch /admin/:id')({ accountability: { user, admin: true },
      params: { id }, body: { action: 'approve' } }, response);
    return response;
  }
  async function waiting(count) {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const result = await admin.raw("select count(*)::int as count from pg_stat_activity where application_name = ? and wait_event_type = 'Lock'", [schema]);
      if (result.rows[0].count >= count) return;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    assert.fail(`Expected ${count} native database lock waiters`);
  }
  async function seed() {
    for (const table of ['subscriptions', 'deletion_requests', 'listing_posts', 'listing_revisions', 'listings', 'organizations']) await db(table).delete();
    await db('organizations').insert({ id: org, status: 'active' });
    await db('listings').insert({ id: listing, organization: org, status: 'pending' });
    await db('listing_revisions').insert({ id: randomUUID(), listing, status: 'pending' });
    await db('deletion_requests').insert([
      { id: organizationRequest, organization: org, entity_type: 'organization', status: 'pending' },
      { id: listingRequest, organization: org, listing, entity_type: 'listing', status: 'pending' },
    ]);
  }
  try {
    await db.raw(`create table organizations (id uuid primary key, status text);
      create table listings (id uuid primary key, organization uuid references organizations, status text);
      create table listing_revisions (id uuid primary key, listing uuid references listings, status text);
      create table listing_posts (id uuid primary key, listing uuid references listings, status text, date_updated timestamptz);
      create table subscriptions (id uuid primary key, listing uuid references listings, plan text, status text, cancel_at_period_end boolean, current_period_end timestamptz);
      create table deletion_requests (id uuid primary key, organization uuid references organizations, listing uuid references listings, entity_type text, status text, decision_note text, decided_by uuid, decided_at timestamptz, date_updated timestamptz);
      create table organization_invitations (id uuid primary key, organization uuid references organizations, status text, date_updated timestamptz)`);

    await t.test('organization archive does not invert moderation organization/listing locks', async () => {
      await seed();
      const moderation = await db.transaction();
      let deletion;
      try {
        await moderation('organizations').where({ id: org }).forUpdate().first();
        deletion = approve(organizationRequest);
        await waiting(1);
        await moderation('listings').where({ id: listing }).update({ status: 'published' });
        await moderation.commit();
      } finally { if (!moderation.isCompleted()) await moderation.rollback(); }
      assert.equal((await deletion).code, 200);
      assert.equal((await db('listings').where({ id: listing }).first()).status, 'archived');
    });

    await t.test('organization approval cancels concurrent listing request before its pending recheck', async () => {
      await seed();
      const blocker = await db.transaction();
      let first, second;
      try {
        await blocker('listings').where({ id: listing }).forUpdate().first();
        first = approve(organizationRequest);
        await waiting(1);
        second = approve(listingRequest);
        await waiting(2);
      } finally { await blocker.rollback(); }
      assert.deepEqual((await Promise.all([first, second])).map(r => r.code), [200, 404]);
      assert.equal((await db('deletion_requests').where({ id: listingRequest }).first()).status, 'cancelled');
    });

    await t.test('premium eligibility is checked after waiting for the listing lock', async () => {
      await seed();
      const billing = await db.transaction();
      let deletion;
      try {
        await billing('listings').where({ id: listing }).forUpdate().first();
        deletion = approve(listingRequest);
        await waiting(1);
        await billing('subscriptions').insert({ id: randomUUID(), listing, plan: 'premium', status: 'active' });
        await billing.commit();
      } finally { if (!billing.isCompleted()) await billing.rollback(); }
      assert.equal((await deletion).code, 409);
      assert.equal((await db('deletion_requests').where({ id: listingRequest }).first()).status, 'pending');
      assert.equal((await db('listings').where({ id: listing }).first()).status, 'pending');
    });
    assert.deepEqual(errors, []);
  } finally {
    await db.destroy();
    await admin.raw(`drop schema "${schema}" cascade`);
    await admin.destroy();
  }
});
