const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),test=require('node:test');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const slice=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
const core=slice('(function(root){','window.__rfTransport=createRFParallelTransport');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function transport(fetch){
 const c={module:{exports:{}},URL,Request,Response,Headers,AbortController,DOMException,setTimeout,clearTimeout,Date,crypto:require('crypto').webcrypto};vm.createContext(c);vm.runInContext(core,c);
 return c.module.exports.createRFParallelTransport({endpoints:['https://primary.test','https://reserve.test'],fetch,timeoutMs:20,requestTimeoutMs:150});
}
function stalled(signal){return new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('{'));signal.addEventListener('abort',()=>c.error(new DOMException('Aborted','AbortError')),{once:true});}}),{headers:{'Content-Type':'application/json'}});}
test('screen deadline covers JSON body through the actual RF transport',async()=>{
 const calls=[];const t=transport(async(url,opts)=>{calls.push(url);return stalled(opts.signal);});
 const c={fetch:t.request,AbortController,DOMException,setTimeout,clearTimeout};vm.createContext(c);vm.runInContext(slice('async function apiRequest(','async function diagPingApi'),c);
 const result=await Promise.race([c.apiRequest('https://primary.test/users/me',{},20).then(()=> 'unexpected',e=>e.name),wait(100).then(()=> 'hung')]);
 assert.equal(result,'AbortError');assert.equal(calls.length,1,'Caller cancellation must not trigger reserve');
});
test('lost checkout response body cannot trigger another payment request',async()=>{
 const calls=[];const t=transport(async(url,opts)=>{calls.push(url);return stalled(opts.signal);});const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),20);
 const result=await Promise.race([(async()=>{const r=await t.request('https://primary.test/payments/checkouts',{method:'POST',body:'{}',signal:ctrl.signal});return r.json()})().then(()=> 'unexpected',e=>e.name),wait(100).then(()=> 'hung')]);clearTimeout(timer);
 assert.equal(result,'AbortError');assert.equal(calls.length,1);
});
test('ordinary binary responses remain streaming and readable',async()=>{
 const t=transport(async()=>new Response('media bytes',{headers:{'Content-Type':'video/mp2t'}}));const r=await t.request('https://primary.test/media/sample.ts');assert.equal(await r.text(),'media bytes');
});
function authSetup(){
 const calls=[],storage=new Map();let release;
 const c={URL,Headers,AbortSignal,AbortController,DOMException,setTimeout,clearTimeout,Date,JSON,Promise,API_PROD:'https://primary.test',API_STANDBY:'https://reserve.test',API_URL:'https://primary.test',telegramId:77,location:{href:'https://app.test/'},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},sessionHeaders:()=>({}),launchIdentity:()=>({}),tgLaunchData:()=>'',showAccessRestricted:()=>{},fetch:async(url,opts)=>{calls.push(url);if(url.includes('/auth/pass'))await new Promise(r=>release=r);return new Response(JSON.stringify(url.includes('/auth/pass')?{passes:{77:'77.'+(Math.floor(Date.now()/1000)+86400*30)+'.signed'}}:{ok:true}),{headers:{'Content-Type':'application/json'}});}};
 c.window=c;vm.createContext(c);vm.runInContext(slice("let clubPass = '', clubPassId = '';",'/* ══ v464 · ПЕРЕХОД')+slice('function clubPassTgData(){','function showAccessRestricted(){'),c);return {c,calls,release:()=>release()};
}
test('cancelled request stops waiting for shared auth without issuing its API request',async()=>{
 const s=authSetup(),ctrl=new AbortController();const result=s.c.fetch('https://primary.test/users/me',{signal:ctrl.signal}).then(()=> 'unexpected',e=>e.name);ctrl.abort();
 const observed=await Promise.race([result,wait(40).then(()=> 'hung')]);s.release();await wait(5);
 assert.equal(observed,'AbortError');assert.equal(s.calls.length,1,'Do not send an API request after its deadline');
});
test('explicit bootstrap and concurrent blocks share a single auth request',async()=>{
 const s=authSetup();const boot=s.c.clubPassEnsure();const one=s.c.fetch('https://primary.test/users/me'),two=s.c.fetch('https://primary.test/media/bonus/a/b');
 const count=s.calls.filter(u=>u.includes('/auth/pass')).length;s.release();assert.equal(count,1);await Promise.all([boot,one,two]);assert.equal(s.calls.length,3);
});
