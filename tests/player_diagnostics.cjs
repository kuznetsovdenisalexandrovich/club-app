const fs=require('fs'),vm=require('vm'),assert=require('assert'),crypto=require('crypto').webcrypto;
let timers=new Map(),id=0,requests=[],fail=true;const listeners={};
const ctx={crypto,Uint8Array,AbortController,URL,Date,setTimeout:fn=>{timers.set(++id,fn);return id;},clearTimeout:id=>timers.delete(id),addEventListener:(k,fn)=>listeners[k]=fn,removeEventListener:k=>delete listeners[k],fetch:async(url,options)=>{requests.push(JSON.parse(options.body));return {ok:!fail};}};ctx.window=ctx;
vm.runInNewContext(fs.readFileSync(require('path').join(__dirname,'../player-diagnostics.js'),'utf8'),ctx);
async function tick(){const work=[...timers.values()];timers.clear();for(const fn of work)await fn();await Promise.resolve();}
(async()=>{
 assert.equal(ctx.clubMediaServer('https://reserve-api.youselllikeagod-magazine.ru/x?signature=secret'),'timeweb');
 const emit=ctx.clubPlayerDiagnostics('film',()=> 'https://api.test','v517 · diagnostic');
 emit({event:'play'});await tick();assert.equal(requests.length,1);fail=false;await tick();
 assert.deepEqual(requests[0],requests[1],'Retry keeps the same session and sequence IDs');
 assert.match(requests[0].attempt,/^[0-9a-f-]{36}$/);assert.equal(requests[0].build,'v517');
 emit({event:'closed'});await Promise.resolve();assert(!listeners.pagehide);
 assert.equal(requests.at(-1).events[0].event,'closed');
 const managed=ctx.clubPlayerDiagnostics('film',()=> 'https://api.test','v583',()=> 'signed-test-data',()=>true);
 managed({event:'unavailable'});await tick();
 assert.equal(requests.at(-1).tg_init,'signed-test-data');assert.equal(requests.at(-1).managed_rescue,true);
 const rollbackCalls=[];ctx.fetch=async(url,options)=>{const body=JSON.parse(options.body);rollbackCalls.push(body);return body.events.some(e=>'os' in e||e.event==='probe')?{ok:false,status:422}:{ok:true};};
 const legacy=ctx.clubPlayerDiagnostics('film',()=> 'https://api.test','v592',()=> 'identity',()=>true);
 legacy({event:'play',delivery:'direct'});legacy({event:'unavailable',buffer_ms:0});legacy({event:'probe',probe_result:'network'});await tick();
 assert.equal(rollbackCalls.length,2);assert.equal(rollbackCalls[0].attempt,rollbackCalls[1].attempt);assert(rollbackCalls[1].events.some(e=>e.event==='unavailable'));assert(rollbackCalls[1].events.every(e=>!('os' in e)&&!('buffer_ms' in e)&&e.event!=='probe'));
 console.log('OK diagnostic batching, stable retry IDs, safe server classification, close flush, legacy schema fallback');
})().catch(e=>{console.error(e);process.exit(1);});
