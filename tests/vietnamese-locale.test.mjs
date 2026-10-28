import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { parse, TYPE } from '@formatjs/icu-messageformat-parser';
import { IntlMessageFormat } from 'intl-messageformat';
import registerEmail from '../infra/directus/extensions/directus-extension-findelio-registration-email/src/index.js';
import { referralMailContent } from '../infra/directus/extensions/directus-extension-findelio-review-notification/src/referral-mail.js';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');
const english = JSON.parse(await read('messages/en.json'));
const vietnamese = JSON.parse(await read('messages/vi.json'));
function flatten(value, prefix = '') {
  return Object.fromEntries(Object.entries(value).flatMap(([key, entry]) =>
    typeof entry === 'string' ? [[prefix + key, entry]] : Object.entries(flatten(entry, prefix + key + '.'))));
}
const sourceMessages = flatten(english);
const translations = flatten(vietnamese);

function argumentsOf(nodes, result = {}) {
  for (const node of nodes) {
    if ([TYPE.argument, TYPE.number, TYPE.date, TYPE.time, TYPE.select, TYPE.plural, TYPE.tag].includes(node.type)) {
      result[node.value] = node.type;
    }
    if (node.options) for (const option of Object.values(node.options)) argumentsOf(option.value, result);
    if (node.children) argumentsOf(node.children, result);
  }
  return result;
}

test('Vietnamese covers every message and preserves ICU variables and rich-text tags', () => {
  assert.deepEqual(Object.keys(translations).sort(), Object.keys(sourceMessages).sort());
  for (const [key, source] of Object.entries(sourceMessages)) {
    const text = translations[key];
    assert.ok(text.trim(), key);
    assert.equal(text, text.normalize('NFC'), key + ': composed Vietnamese accents');
    assert.deepEqual(argumentsOf(parse(text)), argumentsOf(parse(source)), key);
  }
});

test('all Vietnamese messages format successfully, including zero and plural counts', () => {
  for (const [key, text] of Object.entries(translations)) {
    const ast = parse(text);
    for (const count of [0, 1, 2, 25]) {
      const values = Object.fromEntries(Object.entries(argumentsOf(ast)).map(([name, type]) => [name,
        type === TYPE.tag ? chunks => chunks.join('')
          : [TYPE.plural, TYPE.number].includes(type) ? count
            : [TYPE.date, TYPE.time].includes(type) ? new Date('2026-10-05T12:00:00Z') : 'Ví dụ']));
      assert.equal(typeof new IntlMessageFormat(ast, 'vi').format(values), 'string', key);
    }
  }
  const message = new IntlMessageFormat(vietnamese.Results.count, 'vi');
  assert.equal(message.format({ count: 0 }), 'Không tìm thấy doanh nghiệp');
  assert.equal(message.format({ count: 2 }), 'Tìm thấy 2 doanh nghiệp');
});

let emailFilter;
registerEmail({ filter: (name, handler) => { assert.equal(name, 'email.send'); emailFilter = handler; } });
test('Vietnamese verification mail keeps the link and existing attachments; other locales stay unchanged', () => {
  for (const locale of ['vi', 'de-ch', 'en']) {
    const url = `https://findelio.example/${locale}/registrierung-bestaetigen?token=synthetic-test&invitation=synthetic-invitation`;
    const result = emailFilter({ subject: 'Verify your email address', attachments: [{ filename: 'existing.txt' }],
      template: { name: 'user-registration', data: { url } } });
    assert.equal(result.template.data.url, url);
    assert.equal(result.attachments[0].filename, 'existing.txt');
    assert.equal(result.attachments.filter(item => item.cid === 'findelio-logo').length, 1);
    assert.equal(result.subject, locale === 'vi' ? 'Xác nhận địa chỉ email' : 'E-Mail-Adresse bestätigen');
    if (locale === 'vi') assert.match(result.template.data.registrationInstructions, /kích hoạt tài khoản/);
    else assert.equal(result.template.data.registrationInstructions, undefined);
  }
  assert.doesNotThrow(() => emailFilter({ template: { name: 'user-registration' } }));
  assert.doesNotThrow(() => emailFilter({ template: { name: 'user-registration', data: { url: 'invalid' } } }));
});

test('Vietnamese and regional Vietnamese referral mail are localized instead of falling back to German', () => {
  const now = new Date('2026-10-05T10:00:00Z');
  const redemption = { status: 'granted', premium_grant: 'test-grant',
    grant_starts_at: now.toISOString(), grant_ends_at: '2027-01-05T11:00:00Z' };
  const vi = referralMailContent(redemption, 'vi', now);
  assert.match(vi.text, /Thời gian dùng thử Premium ba tháng/);
  assert.equal(vi.suppressCheckout, true);
  assert.deepEqual(referralMailContent(redemption, 'vi-VN', now), vi);
});

test('deployment copies of changed Directus extensions match their reviewed sources', async () => {
  for (const [extension, file] of [
    ['team-management', 'index.js'], ['deletion-requests', 'index.js'],
    ['performance-report', 'index.js'], ['registration-email', 'index.js'],
    ['review-notification', 'referral-mail.js'],
  ]) {
    const base = `infra/directus/extensions/directus-extension-findelio-${extension}/`;
    const deployed = await read(base + 'dist/' + file);
    if (['deletion-requests', 'performance-report'].includes(extension)) {
      assert.equal(deployed.trim(), 'export { default } from "../src/index.js";', extension);
    } else {
      assert.equal(await read(base + 'src/' + file), deployed, extension);
    }
  }
});
