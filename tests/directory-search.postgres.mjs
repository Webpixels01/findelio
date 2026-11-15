// Isolated PostgreSQL only: no Directus license, production data or host ports.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';
import { directorySearchSql, searchParameters } from '../infra/directus/extensions/directus-extension-findelio-review-notification/src/directory-search.js';
if (!process.argv.includes('--isolated')) throw new Error('Pass --isolated');
const container = 'findelio-search-' + randomUUID().slice(0, 8);
function docker(args, input) {
  const result = spawnSync('docker', args, { input, encoding: 'utf8' });
  if (result.error || result.status !== 0) throw new Error(result.stderr || result.error?.message || 'Docker failed');
  return result.stdout.trim();
}
const sql = input => docker(['exec', '-i', container, 'psql', '-XqAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres'], input);
const quote = value => typeof value === 'number' ? String(value) : "'" + value.replaceAll("'", "''") + "'";
function search(q, filters = {}) {
  const params = searchParameters({ locale: 'de-ch', q, ...filters });
  const query = directorySearchSql.replace(/(?<!:):([a-z]+)/g, (_, key) => quote(params[key]));
  return JSON.parse(sql(`SELECT row_to_json(result) FROM (${query}) result;`));
}
let started = false;
try {
  docker(['run', '-d', '--name', container, '--network', 'none', '--tmpfs', '/var/lib/postgresql/data', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:17-alpine']);
  started = true;
  for (let i = 0; i < 40; i++) {
    try { sql('SELECT 1'); break; } catch { if (i === 39) throw new Error('Postgres unavailable'); await setTimeout(500); }
  }
  const migration = await readFile(new URL('../infra/directus/migrations/20261115_directory_search.sql', import.meta.url), 'utf8');
  sql(migration); sql(migration);
  sql(`CREATE TABLE listings(id int PRIMARY KEY, name text, city text, postal_code text, status text, description text, description_translations jsonb, canton int);
    CREATE TABLE subscriptions(listing int, plan text, status text, current_period_end timestamptz);
    CREATE TABLE premium_grants(listing int, revoked_at timestamptz, starts_at timestamptz, ends_at timestamptz);
    CREATE TABLE cantons(id int, code text);
    CREATE TABLE industries(id int, code text, name text);
    CREATE TABLE industries_translations(industries_id int, languages_code text, name text);
    CREATE TABLE listings_industries(listings_id int, industries_id int);
    CREATE TABLE spoken_languages(id int, code text);
    CREATE TABLE listings_spoken_languages(listings_id int, spoken_languages_id int);
    INSERT INTO cantons VALUES(1,'ZH'),(2,'BE');
    INSERT INTO industries VALUES(1,'treuhand','Treuhand'),(2,'it','Computer');
    INSERT INTO industries_translations VALUES(1,'sk-SK','Účtovníctvo');
    INSERT INTO spoken_languages VALUES(1,'sk'),(2,'de');
    INSERT INTO listings VALUES
      (1,'Müller','Zürich','8000','published','Steuererklärung','{"sk":"Súkromný preklad"}',1),
      (2,'Müller Treuhand','Bern','3000','published','Steuererklärung','{"sk":"Daňové priznanie"}',2),
      (3,'Andere Firma','Zürich','8000','published','Müller Steuererklärung',NULL,1),
      (4,'Müller geheim','Zürich','8000','draft','Steuererklärung',NULL,1),
      (5,'HTML','Bern','3000','published','<p class="secretclass">Catering</p>',NULL,2);
    INSERT INTO subscriptions VALUES(2,'premium','active',NULL),(3,'premium','active',NULL);
    INSERT INTO listings_industries VALUES(1,1),(2,1),(3,2);
    INSERT INTO listings_spoken_languages VALUES(1,1),(2,2),(3,1);`);
  assert.deepEqual(search('MULLER').items.map(x=>x.id),[1,2,3], 'Exact regular name precedes premium partial and description matches');
  assert.deepEqual(search('muller steuer').items.map(x=>x.id),[3,2,1], 'All words must match, premium breaks equal relevance ties');
  assert.deepEqual(search('ucTovnictvo',{locale:'sk'}).items.map(x=>x.id),[2,1]);
  assert.equal(search('danove',{locale:'sk'}).total,1);
  assert.equal(search('sukromny',{locale:'sk'}).total,0,'Hidden nonpremium translation is not searchable');
  assert.equal(search('secretclass').total,0,'HTML attributes are not content');
  assert.equal(search('catering').total,1);
  assert.deepEqual(search('muller',{sprache:'sk',branche:'treuhand',kanton:'ZH',ort:'Zurich'}).items.map(x=>x.id),[1]);
  assert.equal(search('muller',{ort:'3000'}).items[0].id,2);
  for (const q of ["%' OR 1=1 --",'%', '_', 'geheim']) assert.equal(search(q).total,0);
  sql(`INSERT INTO listings SELECT n, 'Service ' || lpad(n::text,3,'0'),'Bern','3000','published','Reparatur',NULL,2 FROM generate_series(10,34) n`);
  const pages=[1,2,3].map(page=>search('service',{page:String(page)}));
  assert.deepEqual(pages.map(p=>p.items.length),[10,10,5]);
  assert.ok(pages.every(p=>p.total===25));
  assert.equal(new Set(pages.flatMap(p=>p.items.map(x=>x.id))).size,25);
  assert.deepEqual(search('service',{page:'4'}),{total:25,items:[]});
  assert.equal(search('service',{suggest:'1'}).items.length,6);
  sql(`INSERT INTO premium_grants VALUES (1,NULL,NOW()-INTERVAL '1 day',NULL)`);
  assert.equal(search('sukromny',{locale:'sk'}).total,1,'An active grant unlocks the visible translated description');
  console.log('PASS search SQL: publication, relevance, accents, words, filters, translations, HTML, injection, pagination and grants');
} finally { if (started) docker(['rm','-f',container]); }
