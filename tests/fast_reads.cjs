const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync('index.html','utf8'),a=html.indexOf('(function(root){',html.indexOf('function createRFParallelTransport')-100),b=html.indexOf('})(typeof globalThis',a),core=html.slice(a,html.indexOf(';',b)+1);
function env(mode,saved){
 const calls=[],switches=[],storage={v:saved?JSON.stringify(saved):null,getItem(){return this.v},setItem(k,v){this.v=v}};
 const response=(status,data)=>new Response(JSON.stringify(data),{status,headers:{'x-rf-own-seq':'11'}});
 const fake=(url,opt={})=>{calls.push({url,opt});const index=url.includes('reserve')?1:0;
  if(url.includes('readiness'))return Promise.resolve(response(mode==='badHealth'?503:200,{protocol:2,ready:true,node:index?'timeweb':'selectel',own_seq:11,peer_seq:mode==='stale'?2:50}));
  if(mode==='fast'||mode==='post')return Promise.resolve(response(200,{node:index}));
  if((mode==='stale'&&index===1)||(mode!=='stale'&&index===0))return new Promise((resolve,reject)=>opt.signal.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError')),{once:true}));
  return Promise.resolve(response(200,{node:index}));
 };
 const ctx={module:{exports:{}},URL,Request,Response,Headers,AbortController,DOMException,setTimeout,clearTimeout,Date,crypto:require('crypto').webcrypto};vm.createContext(ctx);vm.runInContext(core,ctx);
 return {transport:ctx.module.exports.createRFParallelTransport({endpoints:['https://primary.test','https://reserve.test'],fetch:fake,storage,hedgeMs:15,readTimeoutMs:100,timeoutMs:25,onSwitch:i=>switches.push(i)}),calls,switches};
}
(async()=>{
 let e=env('slow'),started=Date.now(),r=await e.transport.request('https://primary.test/media/film');assert.deepEqual(await r.json(),{node:1});assert(Date.now()-started<100);assert.equal(e.transport.state().active,'timeweb');assert.equal(e.transport.state().returnBarrier,11);
 e=env('fast');assert.equal((await (await e.transport.request('https://primary.test/lectures')).json()).node,0);await new Promise(r=>setTimeout(r,25));assert.equal(e.calls.length,1);
 e=env('stale',{active:1,returnBarrier:30});await assert.rejects(e.transport.request('https://reserve.test/settings'),{name:'AbortError'});assert(!e.calls.some(c=>c.url==='https://primary.test/settings'));
 e=env('slow');const c=new AbortController(),pending=e.transport.request('https://primary.test/media/film',{signal:c.signal});c.abort();await assert.rejects(pending,{name:'AbortError'});assert.equal(e.switches.length,0);
 e=env('post');await e.transport.request('https://primary.test/payments/checkouts',{method:'POST',body:'{}'});assert.equal(e.calls.length,1);assert(e.calls[0].opt.headers.has('Idempotency-Key'));
 e=env('badHealth');await assert.rejects(e.transport.request('https://primary.test/lectures'),{name:'AbortError'});assert.equal(e.switches.length,0);
 console.log('PASS: delayed primary, body readable, fast reads/writes, abort, replication barrier');
})().catch(e=>{console.error(e);process.exit(1)});
