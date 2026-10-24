import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFile, cp } from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';
// Run only inside an approved offline sandbox after a production build.
if (process.env.FINDELIO_DISPOSABLE_PRODUCTION_TEST !== '1' || process.env.DIRECTUS_URL !== 'http://127.0.0.1:8055') {
  throw new Error('Explicit disposable production fixture required');
}
let offline=false;
const backend=createServer((req,res)=>{
 if(offline){res.writeHead(503);res.end();return;}
 if(req.url==='/server/ping'){res.end('pong');return;}
 res.setHeader('Content-Type','application/json');
 if(new URL(req.url,'http://fixture').searchParams.has('aggregate[countDistinct]')){res.end(JSON.stringify({data:[{countDistinct:{id:0}}]}));return;}
 if(req.url.startsWith('/items/')){res.end(JSON.stringify({data:[],meta:{filter_count:0,total_count:0}}));return;}
 if(req.url==='/findelio-review-notification/rate-limit'){res.writeHead(204);res.end();return;}
 res.writeHead(401);res.end(JSON.stringify({errors:[{extensions:{code:'INVALID_CREDENTIALS'}}]}));
});
await new Promise(resolve=>backend.listen(8055,'127.0.0.1',resolve));
await cp('public','.next/standalone/public',{recursive:true});
await cp('.next/static','.next/standalone/.next/static',{recursive:true});
const child=spawn(process.execPath,['.next/standalone/server.js'],{stdio:['ignore','pipe','pipe'],env:{...process.env,HOSTNAME:'127.0.0.1',PORT:'3000'}});
let logs='';for(const stream of [child.stdout,child.stderr])stream.on('data',data=>{logs+=data.toString();if(logs.length>200000)logs=logs.slice(-200000);});
let checks=0;
async function check(path,status=200){const r=await fetch('http://127.0.0.1:3000'+path,{redirect:'manual',signal:AbortSignal.timeout(10000)});assert.equal(r.status,status,path);checks++;return r;}
try{
 let ready=false;for(let i=0;i<60;i++){try{const r=await fetch('http://127.0.0.1:3000/api/health');if(r.ok){ready=true;break;}}catch{}await setTimeout(250);}
 assert.ok(ready,logs);
 await check('/api/health');
 for(const locale of ['de-ch','en','sk','cs','hu','pl','ru','pt-pt','ro','vi']){
  const response=await check('/'+locale+'/login');const html=await response.text();
  const note=JSON.parse(await readFile('messages/'+locale+'.json','utf8')).Login.note;
  assert.ok(html.includes(note),locale+' login translation');assert.ok(!note.includes('Directus'));
 }
 for(const path of ['/de-ch','/en','/de-ch/unternehmen','/de-ch/fuer-unternehmen','/de-ch/kontakt','/de-ch/blog','/de-ch/impressum','/de-ch/datenschutz','/de-ch/agb','/robots.txt','/sitemap.xml'])await check(path);
 for(const path of ['/de-ch/firmenkonto-einrichten','/de-ch/dashboard','/de-ch/dashboard/premium','/de-ch/dashboard/pruefung'])await check(path,307);
 const login=await fetch('http://127.0.0.1:3000/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json','Origin':'http://127.0.0.1:3000'},body:JSON.stringify({email:'dummy@example.invalid',password:'wrong-fixture-password'})});assert.equal(login.status,401);checks++;
 offline=true;await check('/api/health',503);offline=false;await check('/api/health');
 console.log(`PASS production build HTTP smoke: ${checks} checks, 10 translated logins, public pages, anonymous dashboard guards, rejected login, CMS outage/recovery`);
 console.log('CMS responses are an isolated fixture; no live Directus or Stripe data used.');
} catch(error){console.error(logs);throw error;}finally{child.kill('SIGTERM');await new Promise(resolve=>backend.close(resolve));}
