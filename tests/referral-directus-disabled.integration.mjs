// Runs only inside the disposable test container, with the feature disabled.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
if (process.env.DB_HOST !== 'database' || process.env.DB_DATABASE !== 'findelio_test' ||
    process.env.EMAIL_SMTP_HOST !== 'mail' || process.env.FINDELIO_REFERRAL_REGISTRATION_ENABLED !== 'false') {
  throw new Error('Disabled disposable environment required');
}
const host = createRequire(createRequire('/directus/package.json').resolve('@directus/api'));
const db = host('knex')({ client: 'pg', connection: { host: 'database', user: 'postgres', database: 'findelio_test' } });
async function request(path, method, body, token, status) {
  const response = await fetch('http://127.0.0.1:8055' + path, { method, headers: {
    'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}),
  }, ...(body ? { body: JSON.stringify(body) } : {}) });
  assert.equal(response.status, status, path);
  return response.json().catch(() => null);
}
try {
  const admin = (await request('/auth/login', 'POST', { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }, null, 200)).data.access_token;
  const settings = (await request('/settings', 'GET', null, admin, 200)).data;
  const email = 'disabled-flow-' + randomUUID().slice(0, 8) + '@example.com';
  const password = randomUUID() + '!Aa9';
  await request('/users', 'POST', { email, password, role: settings.public_registration_role, status: 'active' }, admin, 200);
  const userToken = (await request('/auth/login', 'POST', { email, password }, null, 200)).data.access_token;
  await db.raw('ALTER TABLE referral_redemptions RENAME TO fixture_hidden_redemptions; ALTER TABLE referral_partners RENAME TO fixture_hidden_partners;');
  try {
    await request('/findelio-referrals/register', 'POST', {}, null, 503);
    await request('/findelio-referrals/approve-revision', 'POST', {}, admin, 503);
    await request('/findelio-referrals/activate', 'POST', {}, admin, 503);
    await request('/findelio-referrals/admin/overview', 'GET', null, admin, 503);
    await request('/findelio-account-setup', 'POST', { name: 'Flag off fixture' }, userToken, 201);
    await request('/users/register', 'POST', { email: 'normal-' + email, password, first_name: 'Normal', last_name: 'Test',
      verification_url: 'http://localhost:3000/de-ch/registrierung-bestaetigen' }, null, 204);
  } finally {
    await db.raw('ALTER TABLE fixture_hidden_redemptions RENAME TO referral_redemptions; ALTER TABLE fixture_hidden_partners RENAME TO referral_partners;');
  }
  console.log('PASS disabled feature: endpoints gated, normal registration and organization setup work without referral tables');
} finally { await db.destroy(); }
