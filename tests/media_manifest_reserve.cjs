const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),test=require('node:test'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const core=html.slice(html.lastIndexOf('(function(root){',html.indexOf('function createRFParallelTransport(config)')),html.indexOf('window.__rfTransport=createRFParallelTransport'));
function setup(fetch,extra={}){
 const c={module:{exports:{}},URL,Request,Response,Headers,AbortController,DOMException,setTimeout,clearTimeout,Date,crypto:require('node:crypto').webcrypto};vm.createContext(c);vm.runInContext(core,c);
 return c.module.exports.createRFParallelTransport({endpoints:['https://primary.test','https://reserve.test'],fetch,timeoutMs:15,hedgeMs:5,readTimeoutMs:200,...extra});
}
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
const pending=signal=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true}));
for(const pathname of ['/media/bonus/masterclass/i1','/media/meeting/29/replay'])for(const phase of ['headers','body'])test(pathname+' recovers from stalled '+phase+' before caller deadline',async()=>{
 const calls=[];let aborted=false;
 const transport=setup(async(url,opts)=>{
  const u=new URL(url);calls.push(u.hostname+u.pathname);
  if(u.pathname==='/rf/readiness')return json({protocol:2,ready:true,node:u.hostname==='primary.test'?'selectel':'timeweb',own_seq:1,peer_seq:1});
  assert.equal(new Headers(opts.headers).get('x-rf-tg-init'),'signed-fixture');
  if(u.hostname==='reserve.test')return json({sources:[{url:'https://media.test/reserve'}]});
  opts.signal.addEventListener('abort',()=>aborted=true);
  if(phase==='headers')return pending(opts.signal);
  return new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('{'));opts.signal.addEventListener('abort',()=>c.error(new DOMException('Aborted','AbortError')),{once:true});}}),{headers:{'content-type':'application/json'}});
 },{identity:()=>({tg_init:'signed-fixture'})});
 const ctrl=new AbortController(),deadline=setTimeout(()=>ctrl.abort(),100);
 try{const result=await transport.request('https://primary.test'+pathname+'?direct_capable=1',{signal:ctrl.signal});assert.equal((await result.json()).sources[0].url,'https://media.test/reserve');assert(aborted);assert(calls.includes('reserve.test/rf/readiness'));}
 finally{clearTimeout(deadline);}
});
test('access denial is final and does not try reserve',async()=>{
 const calls=[];const transport=setup(async url=>{calls.push(url);return json({detail:'forbidden'},403);});
 assert.equal((await transport.request('https://primary.test/media/meeting/29/replay')).status,403);assert.equal(calls.length,1);
});
test('unready replica cannot supply a media manifest',async()=>{
 const calls=[];const transport=setup(async(url,opts)=>{calls.push(url);if(url.includes('/rf/readiness'))return json({protocol:2,ready:false,node:'timeweb',own_seq:1,peer_seq:1});return pending(opts.signal);},{readTimeoutMs:40});
 await assert.rejects(transport.request('https://primary.test/media/bonus/a/b'),{name:'AbortError'});assert(!calls.some(u=>u.includes('reserve.test/media/')));
});
test('slow film manifest survives the former seven-second transport cutoff',async()=>{
 const c={module:{exports:{}},URL,Request,Response,Headers,AbortController,DOMException,Date,crypto:require('node:crypto').webcrypto,clearTimeout,setTimeout:(fn,ms)=>setTimeout(fn,ms>=7000?ms/100:ms)};
 vm.createContext(c);vm.runInContext(core,c);
 const transport=c.module.exports.createRFParallelTransport({endpoints:['https://primary.test','https://reserve.test'],timeoutMs:15,hedgeMs:5,fetch:async(url,options)=>{
  if(url.includes('/rf/readiness'))return json({ready:false});
  return new Promise((resolve,reject)=>{const timer=setTimeout(()=>resolve(json({film:'fixture',sources:[]})),85);options.signal.addEventListener('abort',()=>{clearTimeout(timer);reject(new DOMException('Aborted','AbortError'));},{once:true});});
 }});
 assert.equal((await (await transport.request('https://primary.test/media/film')).json()).film,'fixture');
});
