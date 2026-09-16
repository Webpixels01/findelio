import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { test } from 'node:test';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';

const componentSource = await readFile(new URL('../components/referral-admin-manager.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(componentSource, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022, jsx: ts.JsxEmit.ReactJSX,
} }).outputText.replace(/from "(react\/jsx-runtime|react|next-intl)"/g, (_, name) => `from ${JSON.stringify(import.meta.resolve(name))}`);
const { default: Manager } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const partner = { id: 'partner', name: 'Anna Muster', code: 'ANNA3', notes: 'Lokale Beispieldaten', status: 'active' };
const statuses = ['pending_organization', 'pending_approval', 'pending_activation', 'granted', 'skipped_existing_premium', 'expired_unactivated', 'void'];
const data = {
  partners: [partner, { ...partner, id: 'disabled', name: 'Ehemaliger Partner', code: 'PAUSE3', status: 'disabled' }],
  redemptions: statuses.map((status, index) => ({ id: String(index), partner: partner.id, code_snapshot: 'ANNA3', status,
    registered_at: '2026-09-11T10:00:00Z', trial_starts_at: index > 1 ? '2026-09-11T10:00:00Z' : null,
    trial_ends_at: index > 1 ? '2026-12-11T11:00:00Z' : null, organization_name: index ? 'Beispielfirma ' + index : null,
    listing_name: index ? 'Firmenprofil ' + index : null, email: 'beispiel@example.test',
    grant_revoked_at: null, grant_ends_at: '2026-12-11T11:00:00Z', skip_reason: status === 'void' ? 'previous_publication' : null })),
  total: 7, page: 1, pageCount: 1, pending: 1, asOf: '2026-09-11T12:00:00Z',
};
async function render(locale, initialData) {
  const messages = JSON.parse(await readFile(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8'));
  const errors = [];
  const html = renderToStaticMarkup(React.createElement(NextIntlClientProvider, {
    locale, messages, timeZone: 'Europe/Zurich', now: new Date(data.asOf), onError: (error) => errors.push(error),
  }, React.createElement(Manager, { locale, initialData, siteUrl: 'http://localhost:3000' })));
  assert.deepEqual(errors, []);
  return html;
}

test('admin renders populated, empty and load-error states in all nine languages', async () => {
  for (const locale of ['de-ch', 'en', 'sk', 'cs', 'hu', 'pl', 'ru', 'pt-pt', 'ro']) {
    const html = await render(locale, data);
    assert.ok(html.includes(`/${locale}/firma-eintragen?ref=ANNA3`));
    assert.ok(html.includes('Anna Muster'));
    assert.ok(html.includes('<table'));
    const empty = await render(locale, { ...data, partners: [], redemptions: [], total: 0, pending: 0 });
    assert.ok(!empty.includes('<table'));
    const failed = await render(locale, null);
    assert.ok(failed.includes('role="alert"'));
    assert.ok(!failed.includes('<form'));
  }
});

// Optional local visual fixture. No auth bypass and no route added to Findelio.
if (process.env.FINDELIO_RENDER_PREVIEW === 'true') {
  const { default: postcss } = await import('postcss');
  const { default: tailwind } = await import('@tailwindcss/postcss');
  const css = await readFile(new URL('../app/globals.css', import.meta.url), 'utf8');
  const result = await postcss([tailwind()]).process(css, { from: new URL('../app/globals.css', import.meta.url).pathname });
  await mkdir('/tmp/findelio-admin-preview', { recursive: true });
  await writeFile('/tmp/findelio-admin-preview/style.css', result.css);
  await writeFile('/tmp/findelio-admin-preview/index.html', `<!doctype html><html lang="de-CH"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="style.css"><body><main class="page-shell bg-[var(--surface)] py-10"><div class="site-container"><p class="eyebrow">LOKALE VORSCHAU · BEISPIELDATEN</p><h1 class="mt-3 text-4xl font-extrabold">Empfehlungen</h1>${await render('de-ch', data)}</div></main></body></html>`);
}
