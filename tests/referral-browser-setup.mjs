// Synthetic policies for the disposable browser fixture, NOT production policy definitions.
import { createRequire } from 'node:module';
if (process.env.DB_DATABASE !== 'findelio_test' || process.env.DB_HOST !== 'database' ||
    process.env.EMAIL_SMTP_HOST !== 'mail' || !process.env.FINDELIO_TEST_ADMIN_TOKEN) {
  throw new Error('Disposable browser environment required');
}
const host = createRequire(createRequire('/directus/package.json').resolve('@directus/api'));
const db = host('knex')({ client: 'pg', connection: { host: 'database', user: 'postgres', database: 'findelio_test' } });
let admin;
async function api(path, method, body) {
  const response = await fetch('http://127.0.0.1:8055' + path, { method, headers: { 'Content-Type': 'application/json',
    ...(admin ? { Authorization: 'Bearer ' + admin } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  if (!response.ok) throw new Error('Browser fixture setup failed: ' + path + ' ' + response.status);
  return (await response.json()).data;
}
try {
  admin = (await api('/auth/login', 'POST', { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD })).access_token;
  const policy = await api('/policies', 'POST', { name: 'Browser company fixture' });
  const role = await api('/roles', 'POST', { name: 'Firmenkonto', policies: [{ policy: policy.id }] });
  const reads = {
    directus_users: { fields: ['id', 'email', 'first_name', 'last_name', 'status', 'avatar', 'role'], permissions: { id: { _eq: '$CURRENT_USER' } } },
    directus_roles: { fields: ['id', 'name'] },
    organization_members: { permissions: { user: { _eq: '$CURRENT_USER' } } },
    organizations: {}, listings: {}, subscriptions: {}, cantons: {}, industries: {}, spoken_languages: {},
    listings_industries: {}, listings_spoken_languages: {}, listings_files: {}, listing_opening_hours: {},
  };
  for (const [collection, rule] of Object.entries(reads)) {
    await api('/permissions', 'POST', { policy: policy.id, collection, action: 'read', fields: ['*'], permissions: {}, ...rule });
  }
  for (const action of ['create', 'update']) {
    await api('/permissions', 'POST', { policy: policy.id, collection: 'listings', action, fields: ['*'], permissions: {}, validation: {} });
  }
  await api('/settings', 'PATCH', { public_registration: true, public_registration_role: role.id,
    public_registration_verify_email: true, auth_password_policy: '/^.{12,}$/' });
  await api('/findelio-referrals/admin/partners', 'POST', { name: 'Browser Test Partner', code: 'BROWSERTEST', status: 'active' });
  await db('directus_users').where({ email: process.env.ADMIN_EMAIL }).update({ token: process.env.FINDELIO_TEST_ADMIN_TOKEN });
  console.log('Browser fixtures ready: directory data, company role and test referral');
} finally { await db.destroy(); }
