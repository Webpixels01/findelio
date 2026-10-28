import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../lib/theme.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

function browser({ saved = null, systemDark = false, blocked = false } = {}) {
  const dataset = {};
  const media = Object.assign(new EventTarget(), { matches: systemDark });
  const storage = {
    getItem() { if (blocked) throw Error('Storage blocked'); return saved; },
    setItem(key, value) { if (blocked) throw Error('Storage blocked'); saved = value; },
  };
  const window = Object.assign(new EventTarget(), { localStorage: storage, matchMedia: () => media });
  const context = { exports: {}, document: { documentElement: { dataset } }, window, localStorage: storage, Event };
  runInNewContext(compiled, context);
  const theme = context.exports;
  const boot = () => runInNewContext(theme.THEME_INIT_SCRIPT, context);
  const system = dark => { media.matches = dark; media.dispatchEvent(new Event('change')); };
  const otherTab = value => {
    saved = value;
    const event = new Event('storage');
    Object.assign(event, { key: theme.THEME_STORAGE_KEY, newValue: value });
    window.dispatchEvent(event);
  };
  boot();
  return { dataset, theme, boot, system, otherTab };
}

test('first paint follows system unless a valid explicit preference is stored', () => {
  assert.equal(browser({ systemDark: true }).dataset.theme, 'dark');
  assert.equal(browser({ systemDark: false }).dataset.theme, 'light');
  assert.equal(browser({ saved: 'light', systemDark: true }).dataset.theme, 'light');
  assert.equal(browser({ saved: 'dark', systemDark: false }).dataset.theme, 'dark');
  assert.equal(browser({ saved: 'unexpected', systemDark: true }).dataset.theme, 'dark');
});

test('manual selection survives reload and ignores later system changes', () => {
  const b = browser();
  const stop = b.theme.subscribeTheme(() => {});
  b.theme.toggleTheme();
  assert.equal(b.dataset.theme, 'dark');
  b.system(false);
  assert.equal(b.dataset.theme, 'dark');
  b.boot();
  assert.equal(b.dataset.theme, 'dark');
  b.theme.toggleTheme();
  b.boot();
  assert.equal(b.dataset.theme, 'light');
  stop();
});

test('blocked browser storage still allows startup and switching in this page', () => {
  const b = browser({ blocked: true, systemDark: true });
  assert.equal(b.dataset.theme, 'dark');
  b.theme.toggleTheme();
  assert.equal(b.dataset.theme, 'light');
});

test('system and cross-tab changes update subscribers and cleanup removes listeners', () => {
  const b = browser();
  let notifications = 0;
  const stop = b.theme.subscribeTheme(() => notifications++);
  b.system(true);
  assert.equal(b.dataset.theme, 'dark');
  b.otherTab('light');
  assert.equal(b.dataset.theme, 'light');
  b.otherTab(null);
  assert.equal(b.dataset.themePreference, 'system');
  assert.equal(b.dataset.theme, 'dark');
  assert.equal(notifications, 3);
  stop();
  b.otherTab('light');
  assert.equal(notifications, 3);
  assert.equal(b.dataset.theme, 'dark');
});

test('both header toggles observe the same selection', () => {
  const b = browser();
  let desktop, mobile;
  const offDesktop = b.theme.subscribeTheme(() => { desktop = b.theme.getDarkThemeSnapshot(); });
  const offMobile = b.theme.subscribeTheme(() => { mobile = b.theme.getDarkThemeSnapshot(); });
  b.theme.toggleTheme();
  assert.equal(desktop, true);
  assert.equal(mobile, true);
  offDesktop(); offMobile();
});
