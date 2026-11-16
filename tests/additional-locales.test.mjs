import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { parse, TYPE } from '@formatjs/icu-messageformat-parser';
import { IntlMessageFormat } from 'intl-messageformat';
import registerEmail from '../infra/directus/extensions/directus-extension-findelio-registration-email/src/index.js';
import { referralMailContent } from '../infra/directus/extensions/directus-extension-findelio-review-notification/src/referral-mail.js';
import { searchParameters } from '../infra/directus/extensions/directus-extension-findelio-review-notification/src/directory-search.js';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');
const english = JSON.parse(await read('messages/en.json'));
const routingSource = await read('i18n/routing.ts');
const newLocales = ['it', 'fr', 'uk', 'bs', 'sr', 'sl'];
const intlLocales = {
  it: 'it',
  fr: 'fr',
  uk: 'uk',
  bs: 'bs',
  sr: 'sr-Latn',
  sl: 'sl',
};
const directusCodes = {
  it: 'it-IT',
  fr: 'fr-FR',
  uk: 'uk-UA',
  bs: 'bs-BA',
  sr: 'sr-Latn',
  sl: 'sl-SI',
};

function flatten(value, prefix = '') {
  return Object.fromEntries(Object.entries(value).flatMap(([key, entry]) =>
    typeof entry === 'string' ? [[prefix + key, entry]] : Object.entries(flatten(entry, prefix + key + '.'))));
}

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

const sourceMessages = flatten(english);

for (const locale of newLocales) {
  test(`${locale} covers every message and preserves ICU variables and rich-text tags`, async () => {
    const translations = flatten(JSON.parse(await read(`messages/${locale}.json`)));
    assert.deepEqual(Object.keys(translations).sort(), Object.keys(sourceMessages).sort());
    for (const [key, source] of Object.entries(sourceMessages)) {
      const text = translations[key];
      assert.ok(text.trim(), key);
      assert.equal(text, text.normalize('NFC'), `${key}: NFC`);
      assert.deepEqual(argumentsOf(parse(text)), argumentsOf(parse(source)), key);
    }
  });

  test(`${locale} messages format successfully including plural counts`, async () => {
    const messages = JSON.parse(await read(`messages/${locale}.json`));
    const translations = flatten(messages);
    for (const [key, text] of Object.entries(translations)) {
      const ast = parse(text);
      for (const count of [0, 1, 2, 25]) {
        const values = Object.fromEntries(Object.entries(argumentsOf(ast)).map(([name, type]) => [name,
          type === TYPE.tag ? chunks => chunks.join('')
            : [TYPE.plural, TYPE.number].includes(type) ? count
              : [TYPE.date, TYPE.time].includes(type) ? new Date('2026-11-16T12:00:00Z') : 'Example']));
        assert.equal(typeof new IntlMessageFormat(ast, intlLocales[locale]).format(values), 'string', key);
      }
    }
    assert.equal(typeof new IntlMessageFormat(messages.Results.count, intlLocales[locale]).format({ count: 2 }), 'string');
  });
}

test('routing and directory-search include the six new locales with Directus codes', () => {
  for (const locale of newLocales) {
    assert.match(routingSource, new RegExp(`["']${locale}["']`));
    assert.equal(searchParameters({ q: 'test', locale }).translation, directusCodes[locale]);
  }
});

let emailFilter;
registerEmail({ filter: (name, handler) => { assert.equal(name, 'email.send'); emailFilter = handler; } });

test('registration mails for new locales keep the link and existing attachments', () => {
  for (const locale of newLocales) {
    const url = `https://findelio.example/${locale}/registrierung-bestaetigen?token=synthetic-test&invitation=synthetic-invitation`;
    const result = emailFilter({
      subject: 'Verify your email address',
      attachments: [{ filename: 'existing.txt' }],
      template: { name: 'user-registration', data: { url } },
    });
    assert.equal(result.template.data.url, url);
    assert.equal(result.attachments[0].filename, 'existing.txt');
    assert.equal(result.attachments.filter(item => item.cid === 'findelio-logo').length, 1);
    assert.notEqual(result.subject, 'Verify your email address');
    assert.ok(result.template.data.registrationInstructions);
  }
  const german = emailFilter({
    subject: 'Verify your email address',
    template: { name: 'user-registration', data: { url: 'https://findelio.example/de-ch/registrierung-bestaetigen?token=x' } },
  });
  assert.equal(german.subject, 'E-Mail-Adresse bestätigen');
});

test('referral mails are localized for the six new locales', () => {
  const now = new Date('2026-11-16T10:00:00Z');
  const redemption = {
    status: 'granted',
    premium_grant: 'test-grant',
    grant_starts_at: now.toISOString(),
    grant_ends_at: '2027-02-16T11:00:00Z',
  };
  for (const locale of newLocales) {
    const mail = referralMailContent(redemption, locale, now);
    assert.ok(mail.text.trim());
    assert.equal(mail.suppressCheckout, true);
    assert.notEqual(mail.text, referralMailContent(redemption, 'de-ch', now).text);
  }
  assert.deepEqual(referralMailContent(redemption, 'sr-Latn', now), referralMailContent(redemption, 'sr', now));
  assert.deepEqual(referralMailContent(redemption, 'it-IT', now), referralMailContent(redemption, 'it', now));
});

test('deployment copies of changed Directus extensions match their reviewed sources', async () => {
  for (const [extension, file] of [
    ['team-management', 'index.js'],
    ['deletion-requests', 'index.js'],
    ['performance-report', 'index.js'],
    ['registration-email', 'index.js'],
    ['review-notification', 'referral-mail.js'],
    ['review-notification', 'directory-search.js'],
  ]) {
    const base = `infra/directus/extensions/directus-extension-findelio-${extension}/`;
    const deployed = await read(base + 'dist/' + file);
    if (['deletion-requests', 'performance-report'].includes(extension)) {
      assert.equal(deployed.trim(), 'export { default } from "../src/index.js";', extension);
    } else {
      assert.equal(await read(base + 'src/' + file), deployed, `${extension}/${file}`);
    }
  }
});
