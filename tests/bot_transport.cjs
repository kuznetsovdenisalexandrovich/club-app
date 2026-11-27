const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {createClubBotTransport}=require('../bot-transport.js');
const canonical='https://bot.youselllikeagod-magazine.ru/content/app-rescue';
const primary='https://selectel-api.youselllikeagod-magazine.ru/club-bot',reserve='https://kuznetsovdenisalexandrovich-club-bot-9e57.twc1.net';
const ready=()=>Response.json({service:'club-bot',role:'main',db_ok:true});
function setup(mode={}){const calls=[];const t=createClubBotTransport(async(u,o={})=>{calls.push({u,o});if(u.endsWith('/health')||u===reserve+'/'){if(u.startsWith(primary)&&mode.primaryDown)throw Error('primary off');if(u.startsWith(reserve)&&!mode.reserveUp)throw Error('reserve stopped');return mode.badHealth?Response.json({db_ok:true}):ready();}if(mode.lost)throw Error('response lost after commit');return Response.json({status:'ok'});});return {t,calls};}
test('primary off: signed mutation sent once to direct reserve, never legacy DNS',async()=>{const {t,calls}=setup({primaryDown:true,reserveUp:true});const body=JSON.stringify({launch:'signed',attempt:'same',seq:7});await t.request(canonical,{method:'POST',body});const writes=calls.filter(c=>c.o.method==='POST');assert.equal(writes.length,1);assert.equal(writes[0].u,reserve+'/content/app-rescue');assert.equal(writes[0].o.body,body);assert(!calls.some(c=>c.u.startsWith('https://bot.yousell')));});
test('lost write response cannot replay on reserve',async()=>{const {t,calls}=setup({lost:true,reserveUp:true});await assert.rejects(t.request(canonical,{method:'POST',body:'x'}));assert.equal(calls.filter(c=>c.o.method==='POST').length,1);});
test('both unavailable: no mutation reaches either server',async()=>{const {t,calls}=setup({primaryDown:true});await assert.rejects(t.request(canonical,{method:'POST',body:'x'}));assert.equal(calls.filter(c=>c.o.method==='POST').length,0);});
test('wrong service or db health cannot authorize selection',async()=>{const {t,calls}=setup({badHealth:true,reserveUp:true});await assert.rejects(t.request(canonical,{method:'POST',body:'x'}));assert.equal(calls.filter(c=>c.o.method==='POST').length,0);});
test('other APIs and media pass through unchanged without probes',async()=>{const {t,calls}=setup();const u='https://selectel-api.youselllikeagod-magazine.ru/payments/checkouts',o={method:'POST',body:'original'};await t.request(u,o);assert.equal(calls.length,1);assert.equal(calls[0].u,u);assert.strictEqual(calls[0].o,o);});
test('cancelled request sends no signed data',async()=>{const {t,calls}=setup();const c=new AbortController();c.abort();await assert.rejects(t.request(canonical,{signal:c.signal,method:'POST',body:'signed'}),{name:'AbortError'});assert.equal(calls.length,0);});
test('Request object preserves body, headers and query',async()=>{const {t,calls}=setup();await t.request(new Request(canonical+'?a=1',{method:'POST',headers:{'X-Test':'yes'},body:'signed'}));const c=calls.find(c=>c.o.method==='POST');assert.equal(c.u,primary+'/content/app-rescue?a=1');assert.equal(await c.o.body.text(),'signed');assert.equal(c.o.headers.get('x-test'),'yes');});
test('signed pdf navigation maps only approved path',async()=>{const {t}=setup({primaryDown:true,reserveUp:true});assert.equal(await t.directLink('https://bot.youselllikeagod-magazine.ru/content/pdf/a?sig=keep'),reserve+'/content/pdf/a?sig=keep');await assert.rejects(t.directLink('https://evil.test/content/pdf/a'));});
test('inline copy is exact and installed before rescue captures fetch',()=>{const h=fs.readFileSync(require('path').join(__dirname,'../index.html'),'utf8'),s=fs.readFileSync(require('path').join(__dirname,'../bot-transport.js'),'utf8');assert(h.includes(s));assert(h.indexOf('END_BOT_DIRECT_TRANSPORT_V1')<h.indexOf('var nativeFetch=w.fetch'));});
test('ready acknowledgement survives the observed 2.6 second health response',async()=>{
 const calls=[];
 const t=createClubBotTransport(async(u,o={})=>{
  if(u===reserve+'/')throw Error('standby');
  if(u===primary+'/health')return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>resolve(ready()),2600);
   o.signal.addEventListener('abort',()=>{clearTimeout(timer);reject(new DOMException('Aborted','AbortError'));},{once:true});
  });
  calls.push({u,body:o.body});return Response.json({status:'ready'});
 });
 const body=JSON.stringify({event:'ready',attempt:'same-attempt',seq:3});
 assert.equal((await t.request(canonical,{method:'POST',body})).status,200);
 assert.deepEqual(calls,[{u:primary+'/content/app-rescue',body}]);
});
