const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),test=require('node:test'),path=require('node:path');
const root=path.join(__dirname,'..');
const core=fs.readFileSync(path.join(root,'rf-parallel.js'),'utf8').split('\n(function(){')[0];
const json=(d,status=200)=>new Response(JSON.stringify(d),{status,headers:{'content-type':'application/json'}});
function setup(fetch,peer=17){
 const c={module:{exports:{}},URL,Request,Response,Headers,AbortController,DOMException,setTimeout,clearTimeout,Date,crypto:require('node:crypto').webcrypto};vm.createContext(c);vm.runInContext(core,c);
 const calls=[];
 const t=c.module.exports.createRFParallelTransport({endpoints:['https://primary.test','https://reserve.test'],storage:{getItem:()=>JSON.stringify({active:1,returnBarrier:17}),setItem(){}},timeoutMs:40,fetch:async(url,o)=>{
  calls.push({url,headers:new Headers(o.headers),method:o.method||'GET'});
  if(url.endsWith('/rf/readiness'))return json({protocol:2,ready:true,node:'selectel',own_seq:100,peer_seq:peer});
  return fetch(url,o);
 }});return {t,calls};
}
for(const pathname of ['/guest-experiment/state','/guest-experiment/start','/learning/media/texting_p01_l11_lecture','/learning/recommendations'])test('new endpoint '+pathname+' avoids older reserve without changing global route',async()=>{
 const {t,calls}=setup(async url=>url.startsWith('https://reserve.test')?json({detail:'Not Found'},404):json({ok:true}));
 const r=await t.request('https://primary.test'+pathname,{method:pathname.endsWith('/start')?'POST':'GET',body:pathname.endsWith('/start')?'{}':undefined});
 assert.equal(r.status,200);assert(calls.every(c=>c.url.startsWith('https://primary.test')));
 const business=calls.filter(c=>!c.url.endsWith('/rf/readiness'));assert.equal(business.length,1);assert.equal(business[0].headers.get('x-rf-min-timeweb'),'17');
 if(pathname.endsWith('/start'))assert(business[0].headers.get('idempotency-key'));
 assert.equal(t.state().active,'timeweb');
});
test('feature settings can be read from primary without replacing ordinary settings routing',async()=>{
 const {t,calls}=setup(async url=>json(url.startsWith('https://primary.test')?{guest_experiment_available:true}:{}));
 assert.equal((await (await t.request('https://primary.test/settings')).json()).guest_experiment_available,undefined);
 assert.equal((await (await t.request('https://primary.test/settings',{rfPrimaryOnly:true})).json()).guest_experiment_available,true);
 assert.equal(t.state().active,'timeweb');
});
test('lagging primary cannot receive a new feature mutation',async()=>{
 const {t,calls}=setup(async()=>{throw Error('business request must not run');},16);
 await assert.rejects(t.request('https://primary.test/guest-experiment/start',{method:'POST',body:'{}'}));
 assert(calls.every(c=>c.url.endsWith('/rf/readiness')));
});
test('lost feature response is never replayed on older reserve',async()=>{
 const {t,calls}=setup(async()=>{throw new TypeError('network');});
 await assert.rejects(t.request('https://primary.test/guest-experiment/next',{method:'POST',body:'{"branch":"A"}'}));
 assert.equal(calls.filter(c=>c.method==='POST').length,1);assert(calls.every(c=>c.url.startsWith('https://primary.test')));
});
test('access denial is final and unrelated payment stays on existing route',async()=>{
 const {t,calls}=setup(async()=>json({detail:'denied'},403));
 assert.equal((await t.request('https://primary.test/guest-experiment/state')).status,403);
 calls.length=0;await t.request('https://primary.test/payments/checkouts',{method:'POST',body:'{}'});
 assert.equal(calls.length,1);assert(calls[0].url.startsWith('https://reserve.test'));
});
function feature(apiRequest,flag){
 const nodes={};const node=id=>nodes[id]||(nodes[id]={classList:{add(){},remove(){}},appendChild(){},remove(){},innerHTML:''});
 const c={appSettings:flag===undefined?{}:{guest_experiment_available:flag},API_URL:'https://primary.test',apiRequest,document:{addEventListener(){},getElementById:node,createElement:()=>node('nav')},qzSetLook(){},appSyncNavigation(){},closeQuiz(){c.closed++;c.GuestExperiment.dispose();},closed:0,funnelLeave(){},enterDemoMode(){},bwClose(){},openQuiz(){},QUIZ_RESULTS:{},telegramId:77,isMember:false};c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(root,'guest-experiment.js'),'utf8'),c);return c;
}
test('missing flag from old settings does not silently discard enabled experiment',async()=>{
 const calls=[];const c=feature(async(url,o)=>{calls.push({url,o});if(url.endsWith('/settings'))return {guest_experiment_available:true};if(url.endsWith('/start'))return {active:true,current:'A',seen:['A'],completed:{}};return {active:true};});
 assert.equal(await c.GuestExperiment.afterFilm(),true);assert.equal(calls[0].o.rfPrimaryOnly,true);assert.equal(calls.filter(x=>x.url.endsWith('/start')).length,1);
});
test('disabled feature preserves legacy flow without requests',async()=>{
 const c=feature(async()=>{throw Error('unexpected request');},false);assert.equal(await c.GuestExperiment.afterFilm(),false);
});
test('closing while discovering availability cannot reopen experiment',async()=>{
 let release;const calls=[];const c=feature(async url=>{calls.push(url);return new Promise(r=>release=r);});
 const pending=c.GuestExperiment.afterFilm();c.GuestExperiment.dispose();release({guest_experiment_available:true});
 await pending;assert.equal(calls.length,1);assert.equal(c.GuestExperiment.active(),false);
});
test('signed profile bootstrap restores an existing guest branch after loading, only on home',async()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const start=html.indexOf('  const boot = Promise.allSettled(',html.indexOf('function startApp(){'));
 const code=html.slice(start,html.indexOf('\n  const cap',start));
 for(const onHome of [true,false]){
  let resume=0,releaseProfile,releaseSettings;
  const c={Promise,loadProfile:()=>new Promise(r=>releaseProfile=r),loadAppSettings:()=>new Promise(r=>releaseSettings=r),bootNeedsPortal:()=>false,document:{getElementById:()=>({classList:{contains:()=>onHome}})},window:{GuestExperiment:{maybeResume:()=>resume++}}};
  vm.createContext(c);vm.runInContext(code,c);await Promise.resolve();assert.equal(resume,0);
  releaseProfile();await Promise.resolve();assert.equal(resume,0);releaseSettings();
  await vm.runInContext('boot',c);await Promise.resolve();assert.equal(resume,onHome?1:0);
 }
});
