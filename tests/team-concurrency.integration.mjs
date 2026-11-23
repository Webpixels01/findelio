// Native PostgreSQL regression fixture. Run ONLY in an approved offline sandbox
// against an empty disposable database, with knex and pg installed in the fixture:
// FINDELIO_TEAM_TEST_DATABASE=postgres://... node --test tests/team-concurrency.integration.mjs
// This executes the real endpoint with real transactions. Only HTTP responses and
// mail delivery are stubs. It does not validate Directus hooks/policies or sessions.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

const connection = process.env.FINDELIO_TEAM_TEST_DATABASE;
test('team mutations serialize native PostgreSQL authorization and quotas', {
  skip: !connection,
  timeout: 60000,
}, async (t) => {
  const { default: knex } = await import('knex');
  const { default: endpoint } = await import('../infra/directus/extensions/directus-extension-findelio-team-management/dist/index.js');
  const schema = `team_test_${randomUUID().replaceAll('-', '')}`;
  const admin = knex({ client: 'pg', connection });
  await admin.raw(`create schema "${schema}"`);
  const db = knex({ client: 'pg', connection, pool: { min: 0, max: 8,
    afterCreate(conn, done) {
      conn.query(`set search_path to "${schema}"; set application_name to '${schema}'; set statement_timeout to '10s'`, (error) => done(error, conn));
    },
  }});
  const handlers = new Map();
  const mail = [];
  const errors = [];
  let sendHook;
  endpoint.handler(Object.fromEntries(['get', 'post', 'patch', 'delete'].map(method => [method,
    (path, handler) => handlers.set(`${method} ${path}`, handler)])), {
    database: db, env: { FINDELIO_SITE_URL: 'https://example.invalid' },
    getSchema: async () => ({}), logger: { error: (...args) => errors.push(args) },
    services: { MailService: class { async send(message) { mail.push(message); if (sendHook) await sendHook(message); } } },
  });
  async function call(method, path, user, body = {}, id) {
    const response = { code: 200, status(code) { this.code = code; return this; },
      json(body) { this.body = body; return this; }, send() { return this; } };
    await handlers.get(`${method} ${path}`)({ accountability: { user }, params: { id }, body }, response);
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
  const org = randomUUID(), otherOrg = randomUUID();
  const owner = randomUUID(), manager = randomUUID(), editor = randomUUID();
  const ownerMember = randomUUID(), managerMember = randomUUID(), target = randomUUID();
  async function seed() {
    await db('organization_invitations').delete();
    await db('organization_members').delete();
    await db('directus_users').delete();
    await db('organizations').delete();
    await db('organizations').insert([org, otherOrg].map(id => ({ id, name: 'Fixture', status: 'active' })));
    await db('directus_users').insert([owner, manager, editor].map(id => ({ id, email: `${id}@example.invalid`, status: 'active' })));
    await db('organization_members').insert([
      { id: ownerMember, organization: org, user: owner, role: 'owner', status: 'active' },
      { id: managerMember, organization: org, user: manager, role: 'admin', status: 'active' },
      { id: target, organization: org, user: editor, role: 'editor', status: 'active' },
      { id: randomUUID(), organization: otherOrg, user: owner, role: 'owner', status: 'active' },
    ]);
  }
  try {
    await db.raw(`create table organizations (id uuid primary key, name text, status text);
      create table directus_users (id uuid primary key, email text, status text);
      create table organization_members (id uuid primary key, organization uuid references organizations, "user" uuid references directus_users, role text, status text, unique(organization, "user"));
      create table organization_invitations (id uuid primary key, organization uuid references organizations, email text, role text, status text, token_hash text, invited_by uuid references directus_users, expires_at timestamptz, locale text, date_created timestamptz default now(), date_updated timestamptz, accepted_at timestamptz);
      create unique index pending_email on organization_invitations(organization, lower(email)) where status = 'pending'`);

    for (const promotionFirst of [false, true]) {
      await t.test(`promotion/removal overlap, promotion first: ${promotionFirst}`, async () => {
        await seed();
        const blocker = await db.transaction();
        let first, second;
        try {
          await blocker('organization_members').where({ id: target }).forUpdate().first();
          const promote = () => call('patch', '/members/:id', owner, { role: 'admin' }, target);
          const remove = () => call('delete', '/members/:id', manager, {}, target);
          first = promotionFirst ? promote() : remove();
          await waiting(1);
          second = promotionFirst ? remove() : promote();
          await waiting(2);
        } finally { await blocker.rollback(); }
        const outcomes = await Promise.all([first, second]);
        assert.deepEqual(outcomes.map(r => r.code), promotionFirst ? [200, 403] : [204, 404]);
        const final = await db('organization_members').where({ id: target }).first();
        assert.equal(final.role, promotionFirst ? 'admin' : 'editor');
        assert.equal(final.status, promotionFirst ? 'active' : 'disabled');
      });
    }

    await t.test('administrator authority is reread after a concurrent demotion', async () => {
      await seed();
      const blocker = await db.transaction();
      let demotion, removal;
      try {
        await blocker('organization_members').where({ id: managerMember }).forUpdate().first();
        demotion = call('patch', '/members/:id', owner, { role: 'editor' }, managerMember);
        await waiting(1);
        removal = call('delete', '/members/:id', manager, {}, target);
        await waiting(2);
      } finally { await blocker.rollback(); }
      assert.deepEqual((await Promise.all([demotion, removal])).map(r => r.code), [200, 403]);
      assert.equal((await db('organization_members').where({ id: target }).first()).status, 'active');
    });

    for (const actorWide of [true, false]) {
      await t.test(actorWide ? 'actor quota spans organizations' : 'organization quota spans actors', async () => {
        await seed();
        await db('organization_invitations').insert(Array.from({ length: actorWide ? 19 : 24 }, (_, index) => ({
          id: randomUUID(), organization: org, email: `existing${index}@example.invalid`, role: 'editor',
          status: actorWide ? 'cancelled' : 'pending', invited_by: actorWide ? owner : editor,
          expires_at: new Date(Date.now() + 86400000),
        })));
        const blocker = await db.transaction();
        let first, second;
        const priorMail = mail.length;
        try {
          // Block INSERT's invited_by foreign-key check, after quota reads.
          // Ordinary user SELECTs and expired-invitation cleanup still proceed.
          // Without the protocol both requests consume the same last free slot.
          await blocker('directus_users').whereIn('id', [owner, manager])
            .orderBy('id').forUpdate();
          first = call('post', '/invitations', owner, { organization_id: org, email: 'first@example.invalid', role: 'editor' });
          await waiting(1);
          second = call('post', '/invitations', actorWide ? owner : manager, {
            organization_id: actorWide ? otherOrg : org, email: 'second@example.invalid', role: 'editor',
          });
          await waiting(2);
        } finally { await blocker.rollback(); }
        const outcomes = await Promise.all([first, second]);
        assert.deepEqual(outcomes.map(r => r.code), actorWide ? [201, 429] : [201, 409]);
        assert.equal(mail.length - priorMail, 1);
        const count = await db('organization_invitations').modify(q => actorWide
          ? q.where('invited_by', owner) : q.where({ organization: org, status: 'pending' })).count('* as count').first();
        assert.equal(Number(count.count), actorWide ? 20 : 25);
      });
    }
    assert.deepEqual(errors, []);
    for (const acceptedBeforeFailure of [false, true]) {
      await t.test(`mail failure compensation preserves accepted state: ${acceptedBeforeFailure}`, async () => {
        await seed();
        await db('organization_members').where({ id: target }).delete();
        const blocker = await db.transaction();
        let signalLocked;
        const locked = new Promise(resolve => { signalLocked = resolve; });
        let request;
        sendHook = async (message) => {
          if (acceptedBeforeFailure) {
            const link = message.text.match(/https:\/\/[^\s]+/)[0];
            const token = new URL(link).searchParams.get('invitation');
            assert.equal((await call('post', '/accept', editor, { token })).code, 200);
          }
          await blocker('organizations').where({ id: org }).forUpdate().first();
          signalLocked();
          throw new Error('Simulated ambiguous SMTP failure');
        };
        try {
          request = call('post', '/invitations', owner, {
            organization_id: org, email: `${editor}@example.invalid`, role: 'editor',
          });
          await locked;
          await waiting(1); // Compensation must join the organization protocol.
        } finally {
          await blocker.rollback();
          sendHook = undefined;
        }
        assert.equal((await request).code, 500);
        const invitation = await db('organization_invitations').first();
        assert.equal(invitation.status, acceptedBeforeFailure ? 'accepted' : 'cancelled');
        assert.equal(await db('organization_members').where({ organization: org, user: editor, status: 'active' }).first().then(Boolean), acceptedBeforeFailure);
      });
    }
    assert.equal(errors.length, 2);
    assert.ok(errors.every(([error]) => error.message === 'Simulated ambiguous SMTP failure'));
  } finally {
    await db.destroy();
    await admin.raw(`drop schema "${schema}" cascade`);
    await admin.destroy();
  }
});
