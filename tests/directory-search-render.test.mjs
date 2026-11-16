import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
const compile = path => ts.transpileModule(readFileSync(new URL('../'+path,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText
  .replace(/from ['"](react\/jsx-runtime|react|next-intl)['"]/g,(_,name)=>`from ${JSON.stringify(import.meta.resolve(name))}`);
const keywordUri = 'data:text/javascript;base64,'+Buffer.from(compile('components/directory-keyword-search.tsx')).toString('base64');
const formSource = compile('components/search-form.tsx')
  .replace('"@/components/directory-keyword-search"',JSON.stringify(keywordUri))
  .replace(/import \{[^}]+\} from "@\/lib\/directus";/,'const getCantons = async()=>[]; const getIndustries = async()=>[]; const getSpokenLanguages = async()=>[];')
  .replace('import { getTranslations } from "next-intl/server";','const getTranslations = async()=>key=>globalThis.__searchMessages.Search[key];');
const {default:SearchForm} = await import('data:text/javascript;base64,'+Buffer.from(formSource).toString('base64'));
test('search form renders all five filters, translated labels and one submit button in all supported languages',async()=>{
  for(const locale of ['de-ch','en','sk','cs','hu','pl','ru','pt-pt','ro','vi','it','fr','uk','bs','sr','sl']){
    const messages=JSON.parse(readFileSync(new URL('../messages/'+locale+'.json',import.meta.url),'utf8'));globalThis.__searchMessages=messages;
    const errors=[];
    const form=await SearchForm({locale,values:{q:'Müller & Co'}});
    const html=renderToStaticMarkup(React.createElement(NextIntlClientProvider,{locale,messages,timeZone:'Europe/Zurich',onError:error=>errors.push(error)},form));
    assert.deepEqual(errors,[]);
    for(const name of ['sprache','branche','kanton','ort','q']) assert.ok(html.includes(`name="${name}"`));
    assert.equal((html.match(/type="submit"/g)||[]).length,1);
    assert.match(html,/value="Müller &amp; Co"/);
    assert.match(html,/role="combobox"/);
    assert.match(html,/maxLength="200"/i);
    assert.ok(html.includes(messages.Search.keyword));
    assert.ok(html.includes(`action="/${locale}/unternehmen"`));
  }
  delete globalThis.__searchMessages;
});
