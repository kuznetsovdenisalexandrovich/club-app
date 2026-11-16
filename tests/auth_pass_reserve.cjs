const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),test=require('node:test'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const core=html.slice(html.lastIndexOf('(function(root){',html.indexOf('function createRFParallelTransport(config)')),html.indexOf('window.__rfTransport=createRFParallelTransport'));
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
function setup(fetch,extra={}){
 const c={module:{exports:{}},URL,Request,Response,Headers,AbortController,DOMException,setTimeout,clearTimeout,Date,crypto:require('node:crypto').webcrypto};vm.createContext(c);vm.runInContext(core,c);
 return c.module.exports.createRFParallelTransport({endpoints:['https://primary.test','https://reserve.test'],fetch,timeoutMs:12,hedgeMs:5,readTimeoutMs:90,requestTimeoutMs:300,...extra});
}
const pending=signal=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true}));
for(const phase of ['headers','body'])test('auth pass uses ready reserve when '+phase+' stall despite healthy primary',async()=>{
 const calls=[];let cancelled=false;
 const t=setup(async(url,opts)=>{
  const u=new URL(url);calls.push({host:u.hostname,path:u.pathname,body:opts.body,key:new Headers(opts.headers).get('idempotency-key')});
  if(u.pathname==='/rf/readiness')return json({protocol:2,ready:true,node:u.hostname==='primary.test'?'selectel':'timeweb',own_seq:5,peer_seq:5});
  if(u.hostname==='reserve.test')return json({passes:{77:'synthetic-pass'}});
  opts.signal.addEventListener('abort',()=>cancelled=true,{once:true});
  if(phase==='headers')return pending(opts.signal);
  return new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('{'));opts.signal.addEventListener('abort',()=>c.error(new DOMException('Aborted','AbortError')),{once:true});}}),{headers:{'content-type':'application/json'}});
 });
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),70);
 try{
  const r=await t.request('https://primary.test/auth/pass',{method:'POST',body:'{"tg_launch":"synthetic-signed-launch"}',signal:ctrl.signal});
  assert.equal((await r.json()).passes['77'],'synthetic-pass');assert(cancelled);
  const auth=calls.filter(c=>c.path==='/auth/pass');assert.equal(auth.length,2);assert.equal(auth[0].body,auth[1].body);assert.equal(auth[0].key,auth[1].key);
 }finally{clearTimeout(timer);}
});
test('auth access denial remains final',async()=>{
 const calls=[];const t=setup(async url=>{calls.push(url);return json({detail:{code:'access_restricted'}},403);});
 assert.equal((await t.request('https://primary.test/auth/pass',{method:'POST',body:'{}'})).status,403);assert.equal(calls.length,1);
});
test('auth reserve must be ready and satisfy return barrier',async()=>{
 const calls=[];const t=setup(async(url,opts)=>{calls.push(url);if(url.endsWith('/rf/readiness'))return json({protocol:2,ready:true,node:'selectel',own_seq:5,peer_seq:1});return pending(opts.signal);},{storage:{getItem:()=>JSON.stringify({active:1,returnBarrier:4}),setItem(){}}});
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),60);
 try{await assert.rejects(t.request('https://primary.test/auth/pass',{method:'POST',body:'{}',signal:ctrl.signal}),{name:'AbortError'});assert(!calls.includes('https://primary.test/auth/pass'));}
 finally{clearTimeout(timer);}
});
for(const pathname of ['/auth/tg/session','/auth/vk/session','/auth/verify','/payments/checkouts'])test('state-changing '+pathname+' is never hedged',async()=>{
 const calls=[];const t=setup(async(url,opts)=>{calls.push(url);if(url.endsWith('/rf/readiness'))return json({protocol:2,ready:true,node:'selectel',own_seq:5,peer_seq:5});return pending(opts.signal);});
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),50);
 try{await assert.rejects(t.request('https://primary.test'+pathname,{method:'POST',body:'{}',signal:ctrl.signal}));assert(!calls.some(url=>url.startsWith('https://reserve.test')));}
 finally{clearTimeout(timer);}
});
