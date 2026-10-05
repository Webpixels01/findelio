import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setImmediate } from 'node:timers/promises';
import { test } from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../components/registration-verification.tsx', import.meta.url), 'utf8');
const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
let instance = 0;

async function harness(t, response, props = {}) {
  const events = [];
  const requests = [];
  const hooksUrl = moduleUrl(`
    // Isolated effect boundary for test ${instance++}.
    export const effects = [], updates = [];
    export const useEffect = effect => effects.push(effect);
    export const useRef = value => ({ current: value });
    export const useState = value => [value, update => updates.push(update)];
  `);
  const hooks = await import(hooksUrl);
  const translationsUrl = moduleUrl('export const useTranslations = () => key => key;');
  const compiled = ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText
    .replace(/from "react"/g, `from ${JSON.stringify(hooksUrl)}`)
    .replace(/from "react\/jsx-runtime"/g, `from ${JSON.stringify(import.meta.resolve('react/jsx-runtime'))}`)
    .replace(/from "next-intl"/g, `from ${JSON.stringify(translationsUrl)}`)
    .replace('import { Link } from "@/i18n/navigation";', 'const Link = "a";');
  const { default: Verification } = await import(moduleUrl(compiled));
  const previousWindow = globalThis.window;
  globalThis.window = {
    location: { pathname: '/de-ch/registrierung-bestaetigen', replace: path => events.push(['navigate', path]) },
    history: { replaceState: (_state, _title, path) => events.push(['clear-url', path]) },
  };
  t.after(() => {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  });
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    requests.push({ url, body: JSON.parse(options.body) });
    return response();
  });
  Verification({ token: 'synthetic-single-use-token', invitationToken: '', locale: 'de-ch', ...props });
  return { ...hooks, events, requests };
}

test('keeps the token URL while pending, submits once on effect replay and navigates to a stable success page', async t => {
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const h = await harness(t, () => pending);
  h.effects[0]();
  h.effects[0]();
  assert.equal(h.requests.length, 1);
  assert.deepEqual(h.events, [], 'URL must not change while verification is pending');
  finish({ ok: true, json: async () => ({ success: true }) });
  await setImmediate();
  assert.deepEqual(h.events, [['navigate', '/de-ch/registrierung-bestaetigt']]);
  assert.deepEqual(h.updates, []);
});

test('invalid verification shows an error and removes the token without claiming success', async t => {
  const h = await harness(t, async () => ({ ok: false, json: async () => ({ error: 'INVALID_TOKEN' }) }));
  h.effects[0]();
  await setImmediate();
  assert.deepEqual(h.updates, ['error']);
  assert.deepEqual(h.events, [['clear-url', '/de-ch/registrierung-bestaetigen']]);
});

test('network failure shows an error and removes the token', async t => {
  const h = await harness(t, async () => { throw new Error('Offline'); });
  h.effects[0]();
  await setImmediate();
  assert.deepEqual(h.updates, ['error']);
  assert.deepEqual(h.events, [['clear-url', '/de-ch/registrierung-bestaetigen']]);
});

test('completed invitation navigates to its dashboard with the new session', async t => {
  const h = await harness(t, async () => ({ ok: true, json: async () => ({ success: true, redirectPath: '/en/dashboard/firmenprofile' }) }),
    { invitationToken: 'synthetic-invitation', locale: 'en' });
  h.effects[0]();
  await setImmediate();
  assert.equal(h.requests[0].body.invitationToken, 'synthetic-invitation');
  assert.deepEqual(h.events, [['navigate', '/en/dashboard/firmenprofile']]);
  assert.deepEqual(h.updates, []);
});

test('opening the verification page without a token never submits a request', async t => {
  const h = await harness(t, async () => { throw new Error('Unexpected request'); }, { token: '' });
  h.effects[0]();
  await setImmediate();
  assert.equal(h.requests.length, 0);
  assert.deepEqual(h.events, []);
});
