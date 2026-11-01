import assert from 'node:assert/strict';
import { mkdir, writeFile, copyFile } from 'node:fs/promises';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
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

const destination = '/tmp/findelio-reviews-preview';
await mkdir(destination, { recursive: true });
const samples = [
  { ...review, id: 'one', author_name: 'Anna', rating: 5, body: 'Sehr freundliche Beratung und schnelle Hilfe. Besonders angenehm war, dass wir alles auf Slowakisch besprechen konnten. Vielen Dank!', response: 'Vielen Dank, Anna! Es freut uns, dass wir dir weiterhelfen konnten. Du bist jederzeit wieder willkommen.' },
  { ...review, id: 'two', author_name: 'Martin', rating: 4, body: 'Kompetenter Service und transparente Preise. Für einen Termin musste ich etwas warten, ansonsten hat alles gut geklappt.', response: null },
];
const data = { reviews: samples, count: 2, average: 4.5, own: null, canReview: true, authenticated: true };
const summary = render(components.ReviewSummary, data, 'de-ch', { listing: 'demo' });
const profile = render(components.CustomerReviews, data, 'de-ch', { listing: 'demo', slug: 'beispielfirma' });
const pending = { ...samples[0], listing_name: 'Beispielfirma Zürich', response: null, status: 'pending' };
const admin = render(components.ReviewManager, { admin: true, reviews: [pending], more: false }, 'de-ch');
const company = render(components.ReviewManager, { admin: false, reviews: [{ ...samples[1], listing_name: 'Beispielfirma Zürich' }], more: false }, 'de-ch');
const root = new URL('../', import.meta.url);
const css = await postcss([tailwind()]).process(readFileSync(new URL('app/globals.css', root), 'utf8'), { from: new URL('app/globals.css', root).pathname });
await writeFile(destination + '/style.css', css.css + readFileSync(new URL('app/dark-mode.css', root), 'utf8'));
await copyFile(new URL('public/findelio-logo-horizontal.svg', root), destination + '/logo.svg');
await writeFile(destination + '/index.html', `<!doctype html><html lang="de-CH"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Findelio · Bewertungen Vorschau</title><link rel="stylesheet" href="style.css"><style>
.previewbar { position:sticky;top:0;z-index:20;background:#001734;color:white;padding:14px 24px;display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap }
.previewbar button {border:1px solid #54718e;border-radius:8px;padding:7px 13px;cursor:pointer} .previewbar button[aria-pressed=true] {background:#0277ee;border-color:#0277ee} main {max-width:1000px;margin:auto;padding:32px 24px 70px} [hidden] {display:none!important} .demo-header {padding:22px 28px;background:white;border-bottom:1px solid var(--border)} .demo-profile {border:1px solid var(--border);border-radius:16px;background:var(--background);padding:28px} .notice {font-size:13px;color:var(--muted);margin-bottom:22px} button,a {cursor:pointer} #toast {padding:12px;background:#e8f3ff;color:#001734;border-radius:8px;margin-top:20px}
</style></head><body><div class="previewbar"><strong>Vorschau · Beispieldaten</strong><div><button data-view="profile" aria-pressed="true">Unternehmensprofil</button> <button data-view="admin" aria-pressed="false">Admin-Freigabe</button> <button data-view="company" aria-pressed="false">Unternehmensantwort</button> <button id="theme">Hell / Dunkel</button></div></div><header class="demo-header"><img src="logo.svg" alt="Findelio" width="164"></header><main><p class="notice">Lokale Darstellung der eingebauten Komponenten. Bewertungen und Firmendaten sind erfunden. Es werden keine Daten gespeichert oder E-Mails versendet.</p><div id="profile" data-panel><div class="demo-profile"><p class="eyebrow">FIRMENPROFIL · ZÜRICH</p><h1 class="text-3xl font-extrabold mt-3">Beispielfirma Zürich</h1>${summary}<p class="mt-4 text-[var(--muted)]">Persönliche Beratung und Dienstleistungen in deiner Sprache.</p></div>${profile}</div><div id="admin" data-panel hidden>${admin}</div><div id="company" data-panel hidden>${company}</div><p id="toast" role="status" hidden></p></main><script>
for(const button of document.querySelectorAll('[data-view]'))button.onclick=()=>{document.querySelectorAll('[data-panel]').forEach(p=>p.hidden=p.id!==button.dataset.view);document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));document.querySelector('#toast').hidden=true;window.scrollTo(0,0)};
document.querySelector('#theme').onclick=()=>document.documentElement.dataset.theme=document.documentElement.dataset.theme==='dark'?'light':'dark';
function demo(e){e.preventDefault();const toast=document.querySelector('#toast');toast.hidden=false;toast.textContent='Vorschau: Diese Aktion würde im echten System gespeichert. Hier werden keine Daten geändert.';toast.scrollIntoView({behavior:'smooth',block:'nearest'})}
document.querySelectorAll('form').forEach(f=>f.onsubmit=demo);document.querySelectorAll('#admin button').forEach(b=>b.onclick=demo);document.querySelectorAll('a').forEach(a=>{if(!a.getAttribute('href').startsWith('#'))a.onclick=demo});
</script></body></html>`);
console.log(destination + '/index.html');
