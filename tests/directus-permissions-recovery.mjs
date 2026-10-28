import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

if (process.env.DB_DATABASE !== 'findelio_test') throw new Error('Isolated test database required');
const expected = Number(process.argv[2]);
assert.ok([200, 403].includes(expected));
const response = await fetch('http://127.0.0.1:8055/items/recovery_directory?fields=id,name', {
  headers: { Authorization: 'Bearer isolated-recovery-fixture-token' },
});
assert.equal(response.status, expected);
if (expected === 200) assert.deepEqual((await response.json()).data, [{ id: 1, name: 'Published fixture' }]);
const require = createRequire(createRequire('/directus/package.json').resolve('@directus/api'));
const db = require('knex')({ client: 'pg', connection: { host: 'database', user: 'postgres', database: 'findelio_test' } });
try {
  const rows = await db('recovery_directory').orderBy('id');
  assert.deepEqual(rows, [
    { id: 1, name: 'Published fixture', is_active: true },
    { id: 2, name: 'Private fixture', is_active: false },
  ]);
  const rule = await db('directus_permissions').where({ collection: 'recovery_directory', action: 'read' }).first();
  assert.deepEqual(typeof rule.permissions === 'string' ? JSON.parse(rule.permissions) : rule.permissions, { is_active: { _eq: true } });
} finally { await db.destroy(); }
console.log(`PASS pre-existing filtered service permission: HTTP ${expected}, data and rule preserved`);
