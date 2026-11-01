import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';

const source = readFileSync(new URL('../components/customer-reviews.tsx', import.meta.url), 'utf8');
// Seed effect-loaded state for server rendering; retain the actual component JSX.
let compiled = ts.transpileModule(source, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022, jsx: ts.JsxEmit.ReactJSX,
} }).outputText;
compiled = compiled.replace('import { Link } from "@/i18n/navigation";', 'const Link = "a";')
  .replaceAll('useState(null)', 'useState(globalThis.__customerReviewFixture)')
  .replace(/from "(react\/jsx-runtime|react|next-intl)"/g, (_, name) => `from ${JSON.stringify(import.meta.resolve(name))}`);
const components = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const review = { id: 'review', author_name: 'Anna', rating: 4, body: '<script>alert(1)</script> Great service!', response: 'Thanks <img src=x onerror=alert(1)>', created_at: '2026-11-01T10:00:00Z', status: 'approved', version: 2, listing_name: 'Test company', listing_slug: 'test-company' };
function render(Component, data, locale, props = {}) {
  globalThis.__customerReviewFixture = data;
  const errors = [];
  const messages = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url)));
  const html = renderToStaticMarkup(React.createElement(NextIntlClientProvider, { locale, messages, timeZone: 'Europe/Zurich', onError: error => errors.push(error) }, React.createElement(Component, props)));
  assert.deepEqual(errors, []);
  delete globalThis.__customerReviewFixture;
  return html;
}
test('profile, star links, review form and both dashboard modes render in every language', () => {
  for (const locale of ['de-ch', 'en', 'sk', 'cs', 'hu', 'pl', 'ru', 'pt-pt', 'ro', 'vi']) {
    const data = { reviews: [review], count: 1, average: 4, own: { ...review, status: 'pending' }, canReview: true, authenticated: true };
    const html = render(components.CustomerReviews, data, locale, { listing: 'listing', slug: 'test-company' });
    assert.match(html, /id="reviews"/); assert.match(html, /name="rating"/); assert.match(html, /name="body"/);
    assert.ok(!html.includes('<script>')); assert.ok(!html.includes('<img src=x')); assert.match(html, /&lt;script&gt;/);
    const summary = render(components.ReviewSummary, data, locale, { listing: 'listing', slug: 'test-company' });
    assert.match(summary, /href="\/unternehmen\/test-company#reviews"/);
    assert.match(render(components.ReviewSummary, data, locale, { listing: 'listing' }), /href="#reviews"/);
    const guest = render(components.CustomerReviews, { ...data, authenticated: false, own: null }, locale, { listing: 'listing', slug: 'test-company' });
    assert.match(guest, /login\?next=/); assert.ok(!guest.includes('<form'));
    for (const admin of [true, false]) {
      const manager = render(components.ReviewManager, { admin, reviews: [review], more: false }, locale);
      assert.equal(manager.includes('name="response"'), !admin);
      assert.match(manager, /Test company/);
    }
  }
});
