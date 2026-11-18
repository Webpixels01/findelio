import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { loadServerModule } from './helpers/load-server-module.mjs';

const { createListingImageUploader } = loadServerModule('lib/listing-image-upload.ts');
const file = name => new File(['image'], name, { type: 'image/png' });
const image = id => ({ id, assetUrl: `https://example.com/${id}.png` });

test('a full gallery stays batched; success requires server confirmation and is reused', async t => {
  const files = Array.from({ length: 10 }, (_, i) => file(`${i}.png`));
  const states = [];
  let finish;
  const fetchMock = t.mock.method(globalThis, 'fetch', (url, options) => {
    assert.equal(url, '/api/account/listings/listing/media');
    assert.equal(options.body.getAll('files').length, 10);
    return new Promise(resolve => { finish = resolve; });
  });
  const upload = createListingImageUploader('listing', (file, state) => states.push([file, state.status]));
  const first = upload(files);
  const concurrent = upload([files[0]]);
  assert.deepEqual(states.map(([, state]) => state), Array(10).fill('uploading'));
  finish(Response.json({ success: true, images: files.map((_, i) => image(String(i))) }));
  assert.deepEqual(await first, files.map((_, i) => image(String(i))));
  assert.deepEqual(await concurrent, [image('0')]);
  await upload(files);
  assert.equal(fetchMock.mock.callCount(), 1);
  assert.deepEqual(states.slice(10).map(([, state]) => state), Array(10).fill('uploaded'));
});

test('failed files can be retried individually; saving resends only unconfirmed files', async t => {
  const files = [file('one.png'), file('two.png')];
  const states = [];
  let fail = true;
  const fetchMock = t.mock.method(globalThis, 'fetch', async (_url, options) => {
    if (fail) return Response.json({ error: 'file_too_large' }, { status: 413 });
    return Response.json({ success: true, images: options.body.getAll('files').map(f => image(f.name)) });
  });
  const upload = createListingImageUploader('listing', (file, state) => states.push([file, state]));
  await assert.rejects(upload(files), { message: 'file_too_large' });
  assert.deepEqual(states.slice(-2).map(([, state]) => state), Array(2).fill({ status: 'failed', error: 'file_too_large' }));
  fail = false;
  await upload([files[0]]);
  assert.deepEqual(await upload(files), files.map(f => image(f.name)));
  assert.deepEqual(fetchMock.mock.calls[2].arguments[1].body.getAll('files').map(f => f.name), ['two.png']);
});

test('network errors, malformed success and invalid responses never show success and remain retryable', async t => {
  const fileA = file('photo.png');
  let reply;
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => reply());
  const states = [];
  const upload = createListingImageUploader('listing', (_, state) => states.push(state));
  for (const response of [
    () => { throw new TypeError('Failed to fetch'); },
    () => new Response('not JSON', { status: 502 }),
    () => Response.json({ success: true, images: [] }),
    () => Response.json({ success: true, images: [{}] }),
    () => Response.json({ error: 'unknown_upstream_error' }, { status: 500 }),
  ]) {
    reply = response;
    await assert.rejects(upload([fileA]), { message: 'upload_failed' });
    assert.deepEqual(states.at(-1), { status: 'failed', error: 'upload_failed' });
  }
  assert.equal(fetchMock.mock.callCount(), 5);
  assert.ok(!states.some(state => state.status === 'uploaded'));
});

let compiled = ts.transpileModule(readFileSync(new URL('../components/listing-upload-preview.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
compiled = compiled.replace('import Image from "next/image";', 'const Image = "img";')
  .replace(/from "(react\/jsx-runtime|react|next-intl)"/g, (_, name) => `from ${JSON.stringify(import.meta.resolve(name))}`);
const { default: Preview } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

test('every upload state and retry renders with translations in all supported languages', () => {
  for (const filename of readdirSync(new URL('../messages/', import.meta.url)).filter(name => name.endsWith('.json'))) {
    const locale = filename.replace('.json', '');
    const messages = JSON.parse(readFileSync(new URL(`../messages/${filename}`, import.meta.url), 'utf8'));
    for (const status of ['ready', 'uploading', 'uploaded', 'failed']) {
      const errors = [];
      const html = renderToStaticMarkup(React.createElement(NextIntlClientProvider, {
        locale, messages, timeZone: 'Europe/Zurich', onError: error => errors.push(error),
      }, React.createElement(Preview, {
        file: file('photo.png'), alt: 'Photo',
        state: status === 'ready' ? undefined : { status, error: 'file_too_large' },
        onRetry() {},
      })));
      assert.deepEqual(errors, [], `${locale}: ${status}`);
      assert.ok(html.includes(messages.ListingEditor.premium.upload[status]));
      assert.equal(html.includes('<button'), status === 'failed');
      assert.equal(html.includes(messages.ListingEditor.premium.upload.saveHint), status === 'uploaded');
      assert.match(html, /role="status"/);
      assert.match(html, /<img/);
    }
  }
});
