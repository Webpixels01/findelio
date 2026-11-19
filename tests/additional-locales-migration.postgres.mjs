// Opt-in SQL regression test against an isolated, disposable PostgreSQL 17.
// No host ports, network, credentials or production data are used.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';

if (!process.argv.includes('--isolated')) throw new Error('Pass --isolated to start the disposable database');
const container = 'findelio-locales-test-' + randomUUID().slice(0, 8);
const directory = JSON.parse(await readFile(new URL('./fixtures/referral-directory.json', import.meta.url), 'utf8')).collections;
const vietnamese = await readFile(new URL('../infra/directus/migrations/20261005_vietnamese_locale.sql', import.meta.url), 'utf8');
const migration = await readFile(new URL('../infra/directus/migrations/20261116_additional_locales.sql', import.meta.url), 'utf8');
function docker(args, input) {
  const result = spawnSync('docker', args, { input, encoding: 'utf8' });
  if (result.error || result.status !== 0) throw new Error(result.stderr || result.error?.message || 'Docker test failed');
  return result.stdout.trim();
}
const quote = value => "'" + value.replaceAll("'", "''") + "'";
const sql = input => docker(['exec', '-i', container, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'findelio_locales_test'], input);
const localeTables = ['organization_invitations', 'deletion_requests', 'blog_posts'];
const previousLocales = ['de-ch', 'en', 'sk', 'cs', 'hu', 'pl', 'ru', 'pt-pt', 'ro'];
const newLocales = ['it', 'fr', 'uk', 'bs', 'sr', 'sl'];
const newLanguageCodes = ['it-IT', 'fr-FR', 'uk-UA', 'bs-BA', 'sr-Latn', 'sl-SI'];
let started = false;
try {
  docker(['run', '--detach', '--name', container, '--network', 'none', '--tmpfs', '/var/lib/postgresql/data',
    '-e', 'POSTGRES_DB=findelio_locales_test', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:17-alpine']);
  started = true;
  let ready = false;
  for (let n = 0; n < 45; n++) {
    try { sql('SELECT 1;'); ready = true; break; } catch { await setTimeout(500); }
  }
  assert.ok(ready, 'PostgreSQL ready');

  sql(`CREATE TABLE languages (code varchar(255) PRIMARY KEY);
    CREATE TABLE industries (id uuid PRIMARY KEY, code varchar(255), name varchar(255));
    CREATE TABLE spoken_languages (id uuid PRIMARY KEY, code varchar(255), name varchar(255));
    CREATE TABLE industries_translations (id serial PRIMARY KEY, industries_id uuid REFERENCES industries,
      languages_code varchar(255) REFERENCES languages, name varchar(255));
    CREATE TABLE spoken_languages_translations (id serial PRIMARY KEY, spoken_languages_id uuid REFERENCES spoken_languages,
      languages_code varchar(255) REFERENCES languages, name varchar(255));
    CREATE TABLE directus_fields (collection varchar(255), field varchar(255), options json);
    ${localeTables.map(table => `CREATE TABLE ${table} (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), locale varchar(10),
      CONSTRAINT ${table}_locale_check CHECK (locale IN (${previousLocales.map(quote).join(',')})));
      INSERT INTO ${table}(locale) VALUES ${previousLocales.map(locale => '(' + quote(locale) + ')').join(',')};
      INSERT INTO directus_fields VALUES ('${table}', 'locale', '{"otherOption":true,"choices":[{"text":"Deutsch","value":"de-ch"}]}');`).join('\n')}
    INSERT INTO languages VALUES ${['de-CH', 'en-US', 'sk-SK', 'cs-CZ', 'hu-HU', 'pl-PL', 'ru-RU', 'pt-PT', 'ro-RO'].map(code => '(' + quote(code) + ')').join(',')};
    ${['industries', 'spoken_languages'].map(collection => `INSERT INTO ${collection} VALUES ${directory[collection].map(row =>
      `(gen_random_uuid(),${quote(row.code)},${quote(row.name)})`).join(',')};`).join('\n')}
    INSERT INTO industries_translations (industries_id,languages_code,name) SELECT id,'de-CH',name FROM industries;
    INSERT INTO spoken_languages_translations (spoken_languages_id,languages_code,name) SELECT id,'de-CH',name FROM spoken_languages;`);

  sql(vietnamese);
  sql(migration);

  for (const code of newLanguageCodes) {
    assert.equal(sql(`SELECT count(*) FROM languages WHERE code=${quote(code)};`), '1');
  }
  for (const code of newLocales) {
    assert.equal(sql(`SELECT count(*) FROM spoken_languages WHERE code=${quote(code)};`), '1');
  }
  for (const code of newLanguageCodes) {
    assert.equal(sql(`SELECT count(*) FROM industries_translations WHERE languages_code=${quote(code)};`), '39');
    assert.equal(sql(`SELECT count(*) FROM spoken_languages_translations WHERE languages_code=${quote(code)};`), '27');
  }
  for (const table of localeTables) {
    for (const locale of newLocales) sql(`INSERT INTO ${table}(locale) VALUES (${quote(locale)});`);
    assert.throws(() => sql(`INSERT INTO ${table}(locale) VALUES ('zz');`), /locale_check/);
  }
  for (const locale of newLocales) {
    assert.equal(sql(`SELECT count(*) FROM directus_fields WHERE options::jsonb->'choices' @> '[{"value":"${locale}"}]';`), '3');
  }

  sql("UPDATE industries_translations SET name='Traduzione personalizzata' WHERE languages_code='it-IT' AND industries_id=(SELECT id FROM industries WHERE code='bau-handwerk');");
  const snapshotQuery = `SELECT jsonb_build_object('industries', (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM industries_translations t),
    'languages', (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM spoken_languages_translations t),
    'choices', (SELECT jsonb_agg(to_jsonb(t) ORDER BY collection) FROM directus_fields t));`;
  const before = sql(snapshotQuery);
  sql(migration);
  assert.equal(sql(snapshotQuery), before);
  console.log('PASS: additional locales migration, 6 languages, 39 industries each, 27 spoken-language names each, locale constraints, repeat execution.');
} finally {
  if (started) docker(['rm', '--force', container]);
}
