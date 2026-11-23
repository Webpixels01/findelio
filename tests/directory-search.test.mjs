import assert from 'node:assert/strict';
import test from 'node:test';
import { searchParameters, registerDirectorySearch, directorySearchSql } from '../infra/directus/extensions/directus-extension-findelio-review-notification/src/directory-search.js';
import { loadServerModule } from './helpers/load-server-module.mjs';

test('keyword parameters are bounded and keep query text separate from SQL', () => {
  assert.equal(searchParameters({q:' Müller ',locale:'de-ch'}).query,'Müller');
  for (const input of [{q:''},{q:['name']},{q:'a'.repeat(201)},{locale:'invalid'},{page:'1.2'},{page:'0'},{ort:{}}]) {
    assert.throws(()=>searchParameters({q:'Müller',locale:'de-ch',...input}));
  }
  assert.equal(searchParameters({q:'test',locale:'vi',suggest:'1',page:'9'}).limit,6);
  assert.equal(searchParameters({q:'test',locale:'vi',suggest:'1',page:'9'}).offset,0);
  assert.equal(searchParameters({q:'test',locale:'vi'}).translation,'vi-VN');
});

test('CMS keyword endpoint requires the server role and returns bounded query results', async () => {
  let handler,role='Firmenkonto',calls=0;
  const db=()=>({select:()=>({where:()=>({first:async()=>({name:role})})})});
  db.raw=(sql,parameters)=>{ calls++; assert.equal(sql,directorySearchSql);assert.equal(parameters.query,"%' OR 1=1 --");return {timeout:async()=>({rows:[{total:0,items:[]}]})}; };
  registerDirectorySearch({get:(_,fn)=>handler=fn},{database:db,logger:{error(){}}});
  async function call(accountability){let code=200,body;const res={set(){},status(n){code=n;return res;},json(value){body=value;}};await handler({query:{q:"%' OR 1=1 --",locale:'de-ch'},accountability},res);return {code,body};}
  assert.equal((await call(null)).code,401);
  assert.equal((await call({user:'u',role:'r'})).code,403);
  assert.equal(calls,0);role='Findelio Server';
  assert.equal((await call({user:'u',role:'r'})).code,200);assert.equal(calls,1);
});

test('suggestion proxy forwards only supported filters and never exposes service credentials',async()=>{
  const calls=[];
  const {GET}=loadServerModule('app/api/directory-search/route.ts',{
    'next-intl':{hasLocale:(locales,locale)=>locales.includes(locale)},
    '@/i18n/routing':{routing:{locales:['de-ch']}},
    '@/lib/directory-search':{searchDirectory:async(...args)=>{calls.push(args);return {items:[{id:'1',name:'Müller',city:'Bern'}],total:99};}},
  });
  assert.equal((await GET(new Request('https://findelio.test/api/directory-search?locale=xx&q=name'))).status,400);
  assert.deepEqual(await (await GET(new Request('https://findelio.test/api/directory-search?locale=de-ch&q=a'))).json(),{items:[]});
  const response=await GET(new Request('https://findelio.test/api/directory-search?locale=de-ch&q=Muller&kanton=BE&token=secret'));
  assert.equal(response.status,200);assert.equal((await response.json()).total,undefined);
  assert.deepEqual(calls,[['de-ch',{q:'Muller',sprache:'',branche:'',kanton:'BE',ort:''},1,true]]);
});
