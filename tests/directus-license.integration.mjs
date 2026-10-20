import assert from 'node:assert/strict';

if (process.env.DB_DATABASE !== 'findelio_test' || process.env.EMAIL_SMTP_HOST !== 'mail') {
  throw new Error('Disposable integration environment required');
}
const base = 'http://127.0.0.1:8055';
const login = await fetch(base + '/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }),
});
assert.equal(login.status, 200, 'Isolated admin login');
const token = (await login.json()).data.access_token;
const headers = { Authorization: `Bearer ${token}` };
const response = await fetch(base + '/license', { headers });
assert.equal(response.status, 200, 'License status endpoint');
const license = (await response.json()).data;
if (process.argv[2] === 'deactivate') {
  assert.ok(!process.env.LICENSE_KEY, 'Remove env-managed license before deactivation');
  if (license.source !== null) {
    const deleted = await fetch(base + '/license', { method: 'DELETE', headers });
    assert.equal(deleted.status, 204, 'Release disposable license activation');
    const after = await fetch(base + '/license', { headers });
    assert.equal((await after.json()).data.source, null, 'No retained test activation');
  }
  console.log('PASS disposable license activation released');
} else {
  assert.equal(license.source, 'env', 'License loaded from LICENSE_KEY');
  assert.equal(license.status, 'active', 'License must be active, not grace');
  assert.equal(license.invalid_reason, null, 'License validation succeeded');
  for (const name of ['custom_permission_rules_enabled', 'production_enabled']) {
    const entitlement = license.entitlements[name];
    assert.equal(entitlement?.override ?? entitlement?.default, true, name);
  }
  console.log('PASS active license enables production and custom permission rules');
}
