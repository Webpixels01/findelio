import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createTranslator, NextIntlClientProvider } from 'next-intl';

const root = new URL('../', import.meta.url);
const locales = readdirSync(new URL('messages/', root))
  .filter(file => file.endsWith('.json')).map(file => file.slice(0, -5));
const compile = path => ts.transpileModule(readFileSync(new URL(path, root), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText.replace(/from ['"](react\/jsx-runtime|react|next-intl)['"]/g,
  (_, name) => `from ${JSON.stringify(import.meta.resolve(name))}`);
const load = source => import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const { default: ListingCreateForm } = await load(compile('components/listing-create-form.tsx')
  .replace('import { useRouter } from "@/i18n/navigation";', 'const useRouter = () => ({});'));
const { default: NotFound } = await load(compile('app/[locale]/not-found.tsx')
  .replace('import { Link } from "@/i18n/navigation";', 'const Link = "a";')
  .replace('import { getTranslations } from "next-intl/server";',
    'const getTranslations = async namespace => globalThis.__localizedPageTranslator(namespace);'));

for (const locale of locales) {
  test(`${locale}: creation form resolves plan labels and 404 renders localized text`, async () => {
    const messages = JSON.parse(readFileSync(new URL(`messages/${locale}.json`, root), 'utf8'));
    const errors = [];
    const onError = error => errors.push(error);
    const html = renderToStaticMarkup(React.createElement(NextIntlClientProvider, {
      locale, messages, timeZone: 'Europe/Zurich', onError,
    }, React.createElement(ListingCreateForm, {
      organizations: [{ id: 'example', name: 'Example' }], cantons: [],
    })));
    assert.deepEqual(errors, []);
    assert.ok(html.includes(messages.ListingCreator.plan.title), locale);
    assert.ok(html.includes(messages.ListingCreator.plan.free.price), locale);
    assert.doesNotMatch(html, /ListingCreator\.plan\./);
    globalThis.__localizedPageTranslator = namespace => createTranslator({ locale, messages, namespace, onError });
    try {
      const notFoundHtml = renderToStaticMarkup(await NotFound());
      assert.ok(notFoundHtml.includes(messages.NotFound.title), locale);
      assert.ok(notFoundHtml.includes(messages.NotFound.home), locale);
      assert.deepEqual(errors, []);
    } finally {
      delete globalThis.__localizedPageTranslator;
    }
  });
}
