import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';

let compiled = ts.transpileModule(readFileSync(new URL('../components/customer-reviews.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
compiled = compiled.replace('import { Link } from "@/i18n/navigation";', 'const Link = "a";')
  .replaceAll('useState(null)', 'useState(globalThis.__myReviewsFixture)')
  .replace(/from "(react\/jsx-runtime|react|next-intl)"/g, (_, name) => `from ${JSON.stringify(import.meta.resolve(name))}`);
const { MyReviews } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

test('visitor reviews render statuses and replies without edit, delete or rating controls', async () => {
  globalThis.__myReviewsFixture = { more: false, reviews: ['approved', 'pending', 'rejected'].map((status, i) => ({
    id: String(i), author_name: 'Anna', rating: 5 - i, body: i === 0 ? 'Freundlicher Service und eine sehr gute Beratung.' : 'Meine Erfahrung mit diesem Unternehmen.',
    response: i === 0 ? 'Vielen Dank für deine Bewertung!' : null, status, created_at: '2026-11-01T10:00:00Z',
    listing_name: ['Beispielfirma Zürich', 'Beispielfirma Bern', 'Beispielfirma Luzern'][i], listing_slug: 'beispiel-' + i, listing_status: i === 2 ? 'draft' : 'published',
  })) };
  try {
    const errors = [];
    const messages = JSON.parse(readFileSync(new URL('../messages/de-ch.json', import.meta.url)));
    const html = renderToStaticMarkup(React.createElement(NextIntlClientProvider, { locale: 'de-ch', messages, timeZone: 'Europe/Zurich', onError: error => errors.push(error) }, React.createElement(MyReviews)));
    assert.deepEqual(errors, []);
    for (const text of ['Meine Rezensionen', 'Veröffentlicht', 'Wird geprüft', 'Nicht freigegeben', 'Vielen Dank für deine Bewertung!']) assert.ok(html.includes(text));
    assert.doesNotMatch(html, /<(form|input|textarea|select|button)\b/);
    assert.match(html, /href="\/unternehmen\/beispiel-0#reviews"/);
    assert.doesNotMatch(html, /href="\/unternehmen\/beispiel-2/);
    await mkdir('/tmp/findelio-account-preview', { recursive: true });
    await writeFile('/tmp/findelio-account-preview/content.html', html);
  } finally { delete globalThis.__myReviewsFixture; }
});
