import ts from 'typescript';
import { readFile, writeFile, readdir } from 'node:fs/promises';

// Reuse the tested TS date source in Directus's JS-only extension runtime.
const base = new URL('../infra/directus/extensions/directus-extension-findelio-referrals/', import.meta.url);
const source = await readFile(new URL('../lib/referral-dates.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
});
await writeFile(new URL('src/referral-dates.js', base), '// Generated from lib/referral-dates.ts by scripts/build-referral-extension.mjs.\n' + outputText);
for (const file of await readdir(new URL('src/', base))) {
  if (file.endsWith('.js')) await writeFile(new URL('dist/' + file, base), await readFile(new URL('src/' + file, base)));
}
