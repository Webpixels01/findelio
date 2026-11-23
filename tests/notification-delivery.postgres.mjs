/** Opt-in offline disposable PostgreSQL fixture. No Directus or SMTP is started.
 * Requires the approved execution sandbox before running. Database must be empty.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { test, after } from 'node:test';
import { consumeVerificationBudget } from '../infra/directus/extensions/directus-extension-findelio-referrals/src/verification-budget.js';
import { sendReviewOnce } from '../infra/directus/extensions/directus-extension-findelio-review-notification/src/review-delivery.js';

if (!process.env.FINDELIO_TEST_PG_PORT || !process.env.FINDELIO_TEST_RUNTIME) {
  throw new Error('Explicit disposable test DB port and runtime path required');
}
const require = createRequire(`${process.env.FINDELIO_TEST_RUNTIME}/package.json`);
const db = require('knex')({ client: 'pg', connection: {
  host: '127.0.0.1', port: Number(process.env.FINDELIO_TEST_PG_PORT),
  user: 'postgres', database: 'findelio_notification_delivery_test',
}, pool: { min: 0, max: 8 } });
after(() => db.destroy());
for (const table of ['listing_revisions', 'listing_posts']) {
  await db.schema.createTable(table, (t) => {
    t.uuid('id').primary(); t.text('status'); t.jsonb('data'); t.integer('review_version').defaultTo(1);
    t.timestamp('submitted_at'); t.timestamp('date_updated');
  });
}
await db.raw(await readFile(new URL('../infra/directus/migrations/20261024_notification_delivery.sql', import.meta.url), 'utf8'));

test('recipient normalization, concurrent cooldown, daily ceiling and expiry', async () => {
  const email = 'fixture@example.invalid', secret = 'offline-fixture-key';
  const consume = () => consumeVerificationBudget(db, email, secret);
  const simultaneous = await Promise.all([
    consume(), consumeVerificationBudget(db, ' FIXTURE@EXAMPLE.INVALID ', secret),
  ]);
  assert.equal(simultaneous.filter(Boolean).length, 1);
  assert.equal(await consume(), false);
  for (let i = 0; i < 2; i++) {
    await db('findelio_verification_mail_budget').update({ next_allowed_at: db.raw("NOW() - INTERVAL '1 second'") });
    assert.equal(await consume(), true);
  }
  await db('findelio_verification_mail_budget').update({ next_allowed_at: db.raw("NOW() - INTERVAL '1 second'") });
  assert.equal(await consume(), false);
  const row = await db('findelio_verification_mail_budget').first();
  assert.equal(row.count, 3);
  assert.match(row.recipient_key, /^[a-f0-9]{64}$/);
  assert.ok(!JSON.stringify(row).includes(email));
  await db('findelio_verification_mail_budget').update({ expires_at: db.raw("NOW() - INTERVAL '1 second'") });
  assert.equal(await consume(), true);
});

for (const collection of ['listing_revisions', 'listing_posts']) {
  test(`${collection}: concurrent replay, unchanged state, genuine resubmission, failure retry`, async () => {
    const id = randomUUID();
    await db(collection).insert({ id, status: 'pending', data: JSON.stringify({ title: 'First' }) });
    const version = async () => (await db(collection).where({ id }).first()).review_notification_version;
    let sends = 0;
    const send = async () => { sends++; };
    const first = await version();
    assert.deepEqual((await Promise.all([
      sendReviewOnce(db, collection, id, first, send),
      sendReviewOnce(db, collection, id, first, send),
    ])).sort(), [false, true]);
    assert.equal(sends, 1);
    await db(collection).where({ id }).update({ status: 'pending', date_updated: db.fn.now(), submitted_at: db.fn.now(), review_notification_version: 999, review_version: 2 });
    assert.equal(String(await version()), String(first));
    assert.equal(await sendReviewOnce(db, collection, id, first, send), false);
    await db(collection).where({ id }).update({ data: JSON.stringify({ title: 'Changed' }) });
    const changed = await version();
    assert.notEqual(String(changed), String(first));
    assert.equal(await sendReviewOnce(db, collection, id, first, send), false);
    await assert.rejects(sendReviewOnce(db, collection, id, changed, async () => { throw Error('fixture transport rejection'); }));
    assert.equal(await sendReviewOnce(db, collection, id, changed, send), true);
    assert.equal(await sendReviewOnce(db, collection, id, changed, send), false);
    await db(collection).where({ id }).update({ status: 'rejected' });
    assert.equal(await sendReviewOnce(db, collection, id, changed, send), false);
    await db(collection).where({ id }).update({ status: 'pending' });
    assert.equal(await sendReviewOnce(db, collection, id, await version(), send), true);
    assert.equal(sends, 3);
  });
}
