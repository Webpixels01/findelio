// Reference options only; never run this helper against production.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

if (process.env.DB_DATABASE !== 'findelio_test' || process.env.DB_HOST !== 'database' ||
    process.env.EMAIL_SMTP_HOST !== 'mail' || !process.env.FINDELIO_TEST_ADMIN_TOKEN) {
  throw new Error('Disposable browser environment required');
}

const snapshot = JSON.parse(await readFile(new URL('./referral-directory.json', import.meta.url), 'utf8'));
const collections = ['cantons', 'industries', 'spoken_languages'];
for (const collection of collections) {
  const rows = snapshot.collections[collection];
  assert.ok(Array.isArray(rows) && rows.length > 0);
  assert.equal(new Set(rows.map(row => row.code)).size, rows.length);
  for (const row of rows) {
    assert.ok(typeof row.code === 'string' && row.code.trim());
    assert.ok(typeof row.name === 'string' && row.name.trim());
    for (const translation of row.translations ?? []) {
      assert.ok(typeof translation.language === 'string' && translation.language.trim());
      assert.ok(typeof translation.name === 'string' && translation.name.trim());
    }
  }
}

const host = createRequire(createRequire('/directus/package.json').resolve('@directus/api'));
const db = host('knex')({ client: 'pg', connection: { host: 'database', user: 'postgres', database: 'findelio_test' } });
try {
  const counts = await db.transaction(async trx => {
    const result = {};
    for (const collection of collections) {
      let inserted = 0;
      const translationTable = collection === 'industries' ? 'fixture_industry_translations'
        : collection === 'spoken_languages' ? 'fixture_language_translations' : null;
      for (const row of snapshot.collections[collection]) {
        const matches = await trx(collection).where({ code: row.code }).select('id');
        assert.ok(matches.length <= 1, 'Duplicate reference code in local fixture');
        let id = matches[0]?.id;
        if (!id) {
          [{ id }] = await trx(collection).insert({ code: row.code, name: row.name }).returning('id');
          inserted++;
        }
        // Preserve existing options and their IDs, including selected test data.
        for (const translation of translationTable ? row.translations ?? [] : []) {
          const key = { parent: id, languages_code: translation.language };
          if (!await trx(translationTable).where(key).first('id')) {
            await trx(translationTable).insert({ ...key, name: translation.name });
          }
        }
      }
      result[collection] = { inserted, total: Number((await trx(collection).count('* as total').first()).total) };
    }
    return result;
  });
  console.log('Local directory reference options ready: ' + JSON.stringify(counts));
} finally {
  await db.destroy();
}
