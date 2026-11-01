import assert from 'node:assert/strict';
if (process.env.DB_DATABASE !== 'findelio_test') throw new Error('Isolated test database required');
const url = 'http://127.0.0.1:8055/items/upgrade_owned_entries';
const headers = { Authorization: 'Bearer isolated-upgrade-owner-token', 'Content-Type': 'application/json' };
const own = await fetch(url + '?fields=id,title', { headers });
assert.equal(own.status, 200);
assert.deepEqual((await own.json()).data, [{ id: 1, title: 'Own entry' }]);
assert.equal((await fetch(url)).status, 403, 'Anonymous access denied');
assert.equal((await fetch(url + '/2', { headers })).status, 403, 'Foreign read denied');
assert.equal((await fetch(url + '/2', { method: 'PATCH', headers, body: '{"title":"Forbidden"}' })).status, 403, 'Foreign write denied');
for (const title of ['Updated own entry', 'Own entry']) {
  assert.equal((await fetch(url + '/1', { method: 'PATCH', headers, body: JSON.stringify({ title }) })).status, 200, 'Own update allowed');
}
const other = await fetch(url + '?fields=id,title', { headers: { Authorization: 'Bearer isolated-upgrade-other-token' } });
assert.equal(other.status, 200);
assert.deepEqual((await other.json()).data, [{ id: 2, title: 'Other entry' }]);
console.log('PASS existing ownership rules: own reads/writes allowed, anonymous and foreign access denied');
