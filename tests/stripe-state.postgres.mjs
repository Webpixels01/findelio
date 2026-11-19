/** Opt-in native PostgreSQL fixture; run only in the approved disposable sandbox.
 * Uses its own schema in the postgres database and removes it after the test.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';

if (!process.env.FINDELIO_TEST_PG_PORT || !process.env.FINDELIO_TEST_RUNTIME) {
  throw new Error('Explicit disposable test DB port and runtime path required');
}
const require = createRequire(`${process.env.FINDELIO_TEST_RUNTIME}/package.json`);

test('Stripe migration preserves terminal state under native concurrent writes', { timeout: 30000 }, async () => {
  const schema = `stripe_test_${randomUUID().replaceAll('-', '')}`;
  const connection = {
    host: '127.0.0.1', port: Number(process.env.FINDELIO_TEST_PG_PORT),
    user: 'postgres', database: 'postgres',
  };
  const knex = require('knex');
  const admin = knex({ client: 'pg', connection, pool: { min: 0, max: 2 } });
  const db = knex({ client: 'pg', connection, pool: {
    min: 0, max: 4,
    afterCreate(client, done) {
      client.query(`SET search_path TO "${schema}"; SET statement_timeout TO '8s'`, error => done(error, client));
    },
  } });
  try {
    await admin.raw(`CREATE SCHEMA "${schema}"`);
    await db.schema.createTable('subscriptions', t => {
      t.integer('id').primary();
      t.text('payment_provider');
      t.text('provider_subscription_id');
      t.text('status');
      t.boolean('cancel_at_period_end').defaultTo(false);
    });
    await db.raw(await readFile(new URL('../infra/directus/migrations/20261024_stripe_terminal_state.sql', import.meta.url), 'utf8'));
    const subscription = (id, providerId, status = 'active') => ({
      id, payment_provider: 'stripe', provider_subscription_id: providerId,
      status, cancel_at_period_end: false,
    });
    await db('subscriptions').insert(subscription(1, 'sub_original'));
    await db('subscriptions').where({ id: 1 }).update({ cancel_at_period_end: true });
    assert.equal((await db('subscriptions').where({ id: 1 }).first()).cancel_at_period_end, true);
    await db('subscriptions').where({ id: 1 }).update({ cancel_at_period_end: false });
    assert.equal((await db('subscriptions').where({ id: 1 }).first()).cancel_at_period_end, false);

    await assert.rejects(db('subscriptions').insert(subscription(2, 'sub_original')), { code: '23505' });
    // Independent subscriptions retain their own lifecycle.
    await db('subscriptions').insert(subscription(2, 'sub_new'));
    await assert.rejects(db('subscriptions').where({ id: 1 }).update({ provider_subscription_id: 'sub_replacement' }), { code: '23514' });
    await assert.rejects(db('subscriptions').where({ id: 1 }).update({ payment_provider: 'manual' }), { code: '23514' });

    const cancellation = await db.transaction({ isolationLevel: 'read committed' });
    const delayed = await db.transaction({ isolationLevel: 'read committed' });
    let delayedWrite;
    try {
      // Simulate the older provider snapshot obtained before cancellation.
      const stale = await delayed('subscriptions').where({ id: 1 }).first();
      await cancellation('subscriptions').where({ id: 1 }).update({ status: 'cancelled' });
      const [{ pid }] = (await delayed.raw('SELECT pg_backend_pid() AS pid')).rows;
      delayedWrite = delayed('subscriptions').where({ id: 1 }).update({ status: stale.status }).then(
        value => ({ value }), error => ({ error }),
      );
      const deadline = Date.now() + 5000;
      while (true) {
        const result = await admin.raw('SELECT cardinality(pg_blocking_pids(?)) > 0 AS blocked', [pid]);
        if (result.rows[0].blocked) break;
        assert.ok(Date.now() < deadline, 'Stale update must wait on the cancellation row lock');
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      await cancellation.commit();
      const outcome = await delayedWrite;
      if (outcome.error) throw outcome.error;
      await delayed.commit();
    } finally {
      if (!cancellation.isCompleted()) await cancellation.rollback();
      if (delayedWrite) await delayedWrite;
      if (!delayed.isCompleted()) await delayed.rollback();
    }
    assert.equal((await db('subscriptions').where({ id: 1 }).first()).status, 'cancelled');
    assert.equal((await db('subscriptions').where({ id: 2 }).first()).status, 'active');
    await db('subscriptions').where({ id: 2 }).update({ status: 'expired' });
    await db('subscriptions').where({ id: 2 }).update({ status: 'past_due' });
    assert.equal((await db('subscriptions').where({ id: 2 }).first()).status, 'expired');
    await db('subscriptions').insert(subscription(3, 'sub_after_cancellation'));
    assert.equal((await db('subscriptions').where({ id: 3 }).first()).status, 'active');
  } finally {
    await db.destroy();
    try { await admin.raw(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); }
    finally { await admin.destroy(); }
  }
});
