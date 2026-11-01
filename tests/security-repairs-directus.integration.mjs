/** Native Directus 12.5 smoke, only in an offline disposable container.
 * Prerequisites: bootstrapped findelio_test system schema; admin with fixture
 * password and FINDELIO_TEST_TFA_SECRET already installed as tfa_secret;
 * findelio_request_limits(key text PRIMARY KEY, count integer NOT NULL,
 * expires_at timestamptz NOT NULL); request-security extension enabled;
 * sibling review-notification/dist/request-security.js available for import.
 * WEBSOCKETS_ENABLED=true. No mail, app collections, or license needed by tests.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { adminCredentials } from './directus-test-auth.mjs';
import { loginAccountKey } from '../infra/directus/extensions/directus-extension-findelio-request-security/src/login-budget.js';

if (process.env.DB_DATABASE !== 'findelio_test' || process.env.FINDELIO_DISPOSABLE_NATIVE_TEST !== '1') {
  throw new Error('Explicit disposable native fixture required');
}
if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD || !process.env.FINDELIO_TEST_TFA_SECRET || !process.env.SECRET) {
  throw new Error('Dummy administrator, fixture TFA secret and server secret required');
}
const require = createRequire(createRequire('/directus/package.json').resolve('@directus/api'));
const db = require('knex')({ client: 'pg', connection: {
  host: process.env.DB_HOST ?? 'database', port: Number(process.env.DB_PORT ?? 5432),
  user: process.env.DB_USER ?? 'postgres', database: 'findelio_test',
  ...(process.env.DB_PASSWORD ? { password: process.env.DB_PASSWORD } : {}),
} });
const base = 'http://127.0.0.1:8055';
const adminKey = loginAccountKey(process.env.SECRET, process.env.ADMIN_EMAIL);
const customerCredentials = { email: 'fixture-customer@example.com', password: 'Offline-customer-fixture-only-123!' };
const key = loginAccountKey(process.env.SECRET, customerCredentials.email);

async function rest(path, body, token) {
  const response = await fetch(base + path, {
    method: body ? 'POST' : 'GET', signal: AbortSignal.timeout(10000),
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, body: await response.json().catch(() => null) };
}

async function websocket(message) {
  const socket = new WebSocket('ws://127.0.0.1:8055/websocket');
  let timeout;
  try {
    return await new Promise((resolve, reject) => {
      timeout = setTimeout(() => reject(new Error('WebSocket authentication timed out')), 7000);
      socket.onopen = () => socket.send(JSON.stringify({ type: 'auth', ...message }));
      socket.onmessage = event => {
        const data = JSON.parse(event.data);
        if (data.type === 'auth') resolve(data);
      };
      socket.onerror = () => reject(new Error('WebSocket transport failed'));
      socket.onclose = () => reject(new Error('WebSocket closed before auth response'));
    });
  } finally {
    clearTimeout(timeout);
    socket.close();
  }
}

try {
  const health = await rest('/server/ping');
  assert.equal(health.status, 200);
  const login = await rest('/auth/login', adminCredentials());
  assert.equal(login.status, 200, JSON.stringify(login.body));
  const token = login.body.data.access_token;
  const globals = await rest('/policies/me/globals', undefined, token);
  assert.equal(globals.status, 200);
  assert.equal(globals.body.data.admin_access, true);
  assert.equal((await websocket({ access_token: token })).status, 'ok');
  // A token-only WS authentication must not charge a password attempt.
  assert.equal((await db('findelio_request_limits').where({ key: adminKey }).first()).count, 1);
  // Directus 12.5's WebSocket credential path does not pass the separate OTP
  // login option. Use a customer without TFA for the successful password control;
  // administrators connect using their already TFA-authenticated access token.
  const created = await rest('/users', { ...customerCredentials, status: 'active' }, token);
  assert.equal(created.status, 200, JSON.stringify(created.body));
  assert.equal((await rest('/auth/login', customerCredentials)).status, 200);
  assert.equal((await websocket(customerCredentials)).status, 'ok');
  assert.equal((await db('findelio_request_limits').where({ key }).first()).count, 2);
  await db('findelio_request_limits').where({ key }).delete();

  const invalid = { email: customerCredentials.email, password: 'deliberately-wrong-fixture-password' };
  for (let attempt = 0; attempt < 5; attempt++) {
    const denied = await rest('/auth/login', invalid);
    assert.equal(denied.status, 401);
    assert.equal(denied.body.errors[0].extensions.code, 'INVALID_CREDENTIALS');
    const ws = await websocket(invalid);
    assert.equal(ws.status, 'error');
    // Native Directus WebSocket auth deliberately masks credential errors.
    assert.equal(ws.error.code, 'AUTH_FAILED');
  }
  assert.equal((await db('findelio_request_limits').where({ key }).first()).count, 10);
  // Correct credentials still fail after mixed transports exhaust the allowance.
  const blocked = await rest('/auth/login', customerCredentials);
  assert.equal(blocked.status, 429);
  assert.equal(blocked.body.errors[0].extensions.code, 'REQUESTS_EXCEEDED');
  const blockedWs = await websocket(customerCredentials);
  assert.equal(blockedWs.status, 'error');
  assert.equal(blockedWs.error.code, 'AUTH_FAILED');
  assert.equal((await db('findelio_request_limits').where({ key }).first()).count, 10);
  console.log('PASS native Directus administrator/TFA login, admin_access and shared pre-password REST/WS budget');
} finally {
  await db.destroy();
}
