/** Run only against an approved disposable PostgreSQL sandbox. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';

if (!process.env.FINDELIO_TEST_PG_PORT || !process.env.FINDELIO_TEST_RUNTIME) {
  throw new Error('Explicit disposable test DB port and runtime path required');
}
const require = createRequire(`${process.env.FINDELIO_TEST_RUNTIME}/package.json`);

test('Premium policy migration removes nonadministrator writes and preserves reads', async () => {
  const schema = `premium_test_${randomUUID().replaceAll('-', '')}`;
  const knex = require('knex');
  const connection = {
    host: '127.0.0.1', port: Number(process.env.FINDELIO_TEST_PG_PORT),
    user: 'postgres', database: 'postgres',
  };
  const admin = knex({ client: 'pg', connection });
  const db = knex({ client: 'pg', connection, pool: {
    min: 0, max: 2,
    afterCreate(client, done) {
      client.query(`SET search_path TO "${schema}"`, error => done(error, client));
    },
  } });
  try {
    await admin.raw(`CREATE SCHEMA "${schema}"`);
    await db.schema.createTable('directus_policies', t => {
      t.uuid('id').primary(); t.boolean('admin_access');
    });
    await db.schema.createTable('directus_permissions', t => {
      t.increments('id'); t.text('collection'); t.text('action'); t.uuid('policy');
    });
    const administrator = randomUUID(), service = 'b6735d88-ef24-4a9f-ae36-dfbf522eba65', reviewer = randomUUID();
    await db('directus_policies').insert([
      { id: administrator, admin_access: true },
      { id: service, admin_access: false },
      { id: reviewer, admin_access: false },
    ]);
    for (const policy of [administrator, service, reviewer, null]) {
      await db('directus_permissions').insert(['create', 'read', 'update', 'delete'].map(action => ({ collection: 'premium_grants', action, policy })));
    }
    await db('directus_permissions').insert({ collection: 'listings', action: 'update', policy: reviewer });
    const migration = await readFile(new URL('../infra/directus/migrations/20261024_premium_grants_admin_only.sql', import.meta.url), 'utf8');
    await db.raw(migration);
    // Rerunning this permission reconciliation must be harmless.
    await db.raw(migration);
    const permissions = await db('directus_permissions').select('*');
    assert.equal(permissions.filter(p => p.collection === 'premium_grants' && p.action === 'read').length, 4);
    const writes = permissions.filter(p => p.collection === 'premium_grants' && p.action !== 'read');
    assert.equal(writes.length, 3);
    assert.ok(writes.every(p => p.policy === administrator));
    assert.ok(permissions.some(p => p.collection === 'listings' && p.action === 'update' && p.policy === reviewer));
  } finally {
    await db.destroy();
    try { await admin.raw(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); }
    finally { await admin.destroy(); }
  }
});
