import assert from 'node:assert/strict';
import test from 'node:test';
import { registerVisitorRoute, visitorInput, VISITOR_ROLE } from '../infra/directus/extensions/directus-extension-findelio-referrals/src/visitor-registration.js';
const input = { first_name: 'Anna', last_name: 'Muster', email: 'anna@example.invalid', password: 'Example123!', verification_url: 'https://example.invalid/de-ch/registrierung-bestaetigen' };
function setup(existing, enabled = true) {
  const created = [], mails = [];
  const database = name => ({ select() { return this; }, whereRaw() { return this; }, where() { return this; }, delete: async () => {}, first: async () => name === 'directus_settings' ? { public_registration: enabled } : existing });
  database.fn = { now: () => 'now' };
  database.raw = async () => ({ rows: [{}] });
  let handler;
  registerVisitorRoute({ post(path, callback) { assert.equal(path, '/register-visitor'); handler = callback; } }, {
    database, env: { SECRET: 'test-secret', USER_REGISTER_URL_ALLOW_LIST: input.verification_url }, getSchema: async () => ({}), logger: { error() {} }, services: { UsersService: class { async createOne(value) { created.push(value); } }, MailService: class {} },
  }, { sendVerificationMail: async value => mails.push(value), validatePayload: () => [] });
  return { created, mails, async call(body = input) { const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; }, send() { return this; } }; await handler({ body, ip: '127.0.0.1' }, res); return res; } };
}
test('visitor registration ignores supplied role and status and always requires email verification', async () => {
  const f = setup(); assert.equal((await f.call({ ...input, role: 'administrator', status: 'active' })).statusCode, 204);
  assert.equal(f.created.length, 1); assert.equal(f.created[0].role, VISITOR_ROLE); assert.equal(f.created[0].status, 'unverified');
  assert.equal(f.mails.length, 1); assert.equal(f.mails[0].visitor, true); assert.equal(f.mails[0].verificationUrl, input.verification_url);
});
test('existing accounts cannot be converted or overwritten; only unverified visitors get a resend', async () => {
  for (const [existing, count] of [[{ role: 'company', status: 'active' }, 0], [{ role: 'company', status: 'unverified' }, 0], [{ role: VISITOR_ROLE, status: 'active' }, 0], [{ role: VISITOR_ROLE, status: 'unverified' }, 1]]) {
    const f = setup(existing); assert.equal((await f.call()).statusCode, 204); assert.equal(f.created.length, 0); assert.equal(f.mails.length, count);
  }
});
test('disabled registration, invalid data and foreign verification links cannot create an account', async () => {
  const disabled = setup(null, false); assert.equal((await disabled.call()).statusCode, 403); assert.equal(disabled.created.length, 0);
  for (const body of [{ ...input, password: 'weak' }, { ...input, email: 'invalid' }, { ...input, verification_url: 'https://evil.invalid' }]) {
    const f = setup(); assert.equal((await f.call(body)).statusCode, 400); assert.equal(f.created.length, 0);
  }
  assert.equal(visitorInput({ ...input, password: 'x'.repeat(1025) }), null);
});
