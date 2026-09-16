/** Run INSIDE the disposable Directus container described in docs/referral-integration.md.
 * Never loads .env files. Credentials/tokens and mail bodies are never printed.
 */
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';

if (process.env.DB_HOST !== 'database' || process.env.DB_DATABASE !== 'findelio_test' ||
    process.env.EMAIL_SMTP_HOST !== 'mail' || process.env.ADMIN_EMAIL !== 'admin@example.com') {
  throw new Error('Disposable integration environment required');
}
const host = createRequire(createRequire('/directus/package.json').resolve('@directus/api'));
const db = host('knex')({ client: 'pg', connection: { host: 'database', port: 5432, user: 'postgres', database: 'findelio_test' } });
const password = randomBytes(24).toString('base64url') + '!Aa9';
const suffix = randomUUID().slice(0, 8);
let admin;
async function request(path, { method = 'GET', body, token = admin, status = 200 } = {}) {
  const r = await fetch('http://127.0.0.1:8055' + path, { method, redirect: 'manual', headers: {
    ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}),
  }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const result = await r.json().catch(() => null);
  assert.equal(r.status, status, `${method} ${path.split('?')[0]}: status ${r.status}, code ${result?.error ?? result?.errors?.[0]?.extensions?.code ?? 'none'}`);
  return result?.data;
}
const registration = (email, code) => ({ first_name: 'Test', last_name: 'Referral', email, password,
  referral_code: code, verification_url: 'http://localhost:3000/de-ch/registrierung-bestaetigen' });
async function mailFor(email) {
  for (let n = 0; n < 20; n++) {
    const listing = await (await fetch('http://mail:8025/api/v1/messages')).json();
    const match = listing.messages.find(m => m.To.some(to => to.Address === email));
    if (match) return (await fetch('http://mail:8025/api/v1/message/' + match.ID)).json();
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('Expected local test mail missing');
}
const ok = message => console.log('PASS ' + message);
try {
  admin = (await request('/auth/login', { method: 'POST', token: null,
    body: { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD } })).access_token;
  await request('/findelio-referrals/admin/access');
  const role = (await request('/roles', { method: 'POST', body: { name: 'Firmenkonto' } })).id;
  await request('/settings', { method: 'PATCH', body: { public_registration: true, public_registration_role: role,
    public_registration_verify_email: true, auth_password_policy: '/^.{12,}$/' } });
  const code = 'LOCAL-' + suffix;
  const partner = (await request('/findelio-referrals/admin/partners', { method: 'POST', status: 201,
    body: { name: 'Local integration ' + suffix, code, status: 'active' } })).id;
  await request('/findelio-referrals/admin/partners', { method: 'POST', status: 409,
    body: { name: 'Duplicate', code: code.toLowerCase(), status: 'active' } });
  ok('real admin partner creation and case-insensitive duplicate protection');
  const email = `referral-${suffix}@example.com`;
  const weakEmail = `weak-${suffix}@example.com`;
  await request('/findelio-referrals/register', { method: 'POST', token: null, status: 400,
    body: { ...registration(weakEmail, code), password: 'weak' } });
  assert.equal((await db('directus_users').where({ email: weakEmail })).length, 0);
  await request('/findelio-referrals/register', { method: 'POST', token: null, status: 400, body: registration(email, 'INVALID') });
  assert.equal(await db('directus_users').where({ email }).first(), undefined);
  await request('/findelio-referrals/register', { method: 'POST', token: null, status: 204, body: registration(email, code) });
  const user = await db('directus_users').where({ email }).first();
  assert.equal(user.status, 'unverified');
  assert.equal((await db('referral_redemptions').where({ user: user.id })).length, 1);
  const mail = await mailFor(email);
  await request('/findelio-referrals/register', { method: 'POST', token: null, status: 204, body: registration(email, code) });
  assert.equal((await db('referral_redemptions').where({ user: user.id })).length, 1);
  const match = (mail.HTML + mail.Text).match(/token=([A-Za-z0-9_.-]+)/);
  assert.ok(match, 'Verification token in local mail');
  await request('/users/register/verify-email?token=' + encodeURIComponent(match[1]), { token: null, status: 302 });
  ok('new user, atomic redemption and real verification mail/token');
  const userToken = (await request('/auth/login', { method: 'POST', token: null, body: { email, password } })).access_token;
  await request('/findelio-referrals/register', { method: 'POST', token: null, status: 204, body: registration(email, code) });
  assert.equal((await db('referral_redemptions').where({ user: user.id })).length, 1);
  await request('/findelio-referrals/admin/overview', { token: userToken, status: 403 });
  const organization = await request('/findelio-account-setup', { method: 'POST', token: userToken, status: 201, body: { name: 'Test company ' + suffix } });
  const redemption = await db('referral_redemptions').where({ user: user.id }).first();
  assert.equal(redemption.organization, organization.id);
  assert.equal(redemption.status, 'pending_approval');
  await request('/findelio-account-setup', { method: 'POST', token: userToken, status: 409, body: { name: 'Duplicate' } });
  ok('verified user login, organization binding, no duplicate redemption and admin isolation');
  const listing = randomUUID(), revision = randomUUID();
  await db('listings').insert({ id: listing, organization: organization.id, name: 'Before', slug: 'test-' + suffix, status: 'pending' });
  await db('listing_revisions').insert({ id: revision, listing, status: 'pending', submitted_by: user.id,
    data: JSON.stringify({ name: 'After', industry_ids: [], spoken_language_ids: [], gallery_file_ids: [], opening_hours: [] }) });
  await request('/findelio-referrals/approve-revision', { method: 'POST', token: userToken, status: 403, body: { revision_id: revision } });
  const approved = await request('/findelio-referrals/approve-revision', { method: 'POST', body: { revision_id: revision } });
  assert.equal(approved.status, 'granted');
  await request('/findelio-referrals/approve-revision', { method: 'POST', body: { revision_id: revision } });
  assert.equal((await db('premium_grants').where({ listing })).length, 1);
  assert.equal((await db('listings').where({ id: listing }).first()).name, 'After');
  await request('/findelio-referrals/activate', { method: 'POST', token: userToken, status: 403, body: { redemption_id: redemption.id } });
  await request('/findelio-referrals/activate', { method: 'POST', body: { redemption_id: redemption.id } });
  ok('real ItemsService approval, grant activation, idempotent retry and permission enforcement');
  await request('/findelio-review-notification/decision', { method: 'POST', status: 204, body: { revision_id: revision, action: 'approve' } });
  const decision = await mailFor(email);
  assert.match(decision.HTML + decision.Text, /Premium/);
  const overview = await request('/findelio-referrals/admin/overview');
  assert.ok(overview.redemptions.some(r => r.id === redemption.id && r.status === 'granted'));
  ok('real decision mail and persisted admin overview');
  const existingEmail = `existing-${suffix}@example.com`;
  const existing = await request('/users', { method: 'POST', body: { email: existingEmail, password, role, status: 'active' } });
  await request('/findelio-referrals/register', { method: 'POST', token: null, status: 204, body: registration(existingEmail, code) });
  assert.equal((await db('referral_redemptions').where({ user: existing.id })).length, 0);
  const raceEmail = `race-${suffix}@example.com`;
  await Promise.all([1, 2].map(() => request('/findelio-referrals/register', { method: 'POST', token: null, status: 204, body: registration(raceEmail, code) })));
  const raceUsers = await db('directus_users').where({ email: raceEmail });
  assert.equal(raceUsers.length, 1);
  assert.equal((await db('referral_redemptions').where({ user: raceUsers[0].id })).length, 1);
  ok('existing accounts excluded; concurrent registration creates one user and redemption');
  const rollbackEmail = `rollback-${suffix}@example.com`;
  await db.raw(`CREATE OR REPLACE FUNCTION fail_referral_fixture() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'fixture rollback'; END $$;
    CREATE TRIGGER fail_referral_fixture BEFORE INSERT ON referral_redemptions
    FOR EACH ROW EXECUTE FUNCTION fail_referral_fixture();`);
  try {
    await request('/findelio-referrals/register', { method: 'POST', token: null, status: 500, body: registration(rollbackEmail, code) });
    assert.equal((await db('directus_users').where({ email: rollbackEmail })).length, 0);
  } finally {
    await db.raw('DROP TRIGGER fail_referral_fixture ON referral_redemptions; DROP FUNCTION fail_referral_fixture();');
  }
  ok('real UsersService transaction rolls back user when redemption insert fails');
  await request('/settings', { method: 'PATCH', body: { public_registration_email_filter: { email: { _ends_with: '@allowed.example.com' } } } });
  await request('/findelio-referrals/register', { method: 'POST', token: null, status: 403, body: registration(`filter-${suffix}@example.com`, code) });
  await request('/settings', { method: 'PATCH', body: { public_registration_email_filter: null } });
  const reviewerPolicy = (await request('/policies', { method: 'POST', body: { name: 'Fixture reviewer ' + suffix } })).id;
  for (const collection of ['listings', 'listing_revisions', 'listings_industries', 'listings_spoken_languages', 'listings_files', 'listing_opening_hours']) {
    for (const action of ['read', 'create', 'update', 'delete']) {
      await request('/permissions', { method: 'POST', body: { policy: reviewerPolicy, collection, action, fields: ['*'], permissions: {}, validation: {} } });
    }
  }
  const reviewerRole = (await request('/roles', { method: 'POST', body: { name: 'Fixture reviewer', policies: [{ policy: reviewerPolicy }] } })).id;
  const reviewerEmail = `reviewer-${suffix}@example.com`;
  await request('/users', { method: 'POST', body: { email: reviewerEmail, password, role: reviewerRole, status: 'active' } });
  const reviewerToken = (await request('/auth/login', { method: 'POST', token: null, body: { email: reviewerEmail, password } })).access_token;
  await request('/findelio-referrals/admin/access', { token: reviewerToken, status: 403 });
  await request('/findelio-referrals/activate', { method: 'POST', token: reviewerToken, status: 403, body: { redemption_id: redemption.id } });
  const nextListing = randomUUID(), nextRevision = randomUUID();
  await db('listings').insert({ id: nextListing, organization: organization.id, name: 'Second', status: 'pending' });
  await db('listing_revisions').insert({ id: nextRevision, listing: nextListing, status: 'pending', submitted_by: user.id,
    data: JSON.stringify({ name: 'Second approved', industry_ids: [], spoken_language_ids: [], gallery_file_ids: [], opening_hours: [] }) });
  await request('/findelio-referrals/approve-revision', { method: 'POST', token: reviewerToken, body: { revision_id: nextRevision } });
  assert.equal((await db('listings').where({ id: nextListing }).first()).status, 'published');
  assert.equal((await db('premium_grants').where({ listing: nextListing })).length, 0);
  ok('real non-admin review policy approves without referral administration or second trial');
  await request('/findelio-referrals/admin/partners/' + partner, { method: 'PATCH', body: { name: 'Disabled test', status: 'disabled' } });
  await request('/findelio-referrals/register', { method: 'POST', token: null, status: 400, body: registration(`disabled-${suffix}@example.com`, code) });
  assert.equal((await db('referral_redemptions').where({ id: redemption.id }).first()).status, 'granted');
  ok('real registration email filter and partner deactivation preserve prior entitlement');
} finally { await db.destroy(); }
