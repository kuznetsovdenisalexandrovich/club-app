const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),test=require('node:test');
const html=fs.readFileSync(require('path').join(__dirname,'../index.html'),'utf8');
const slice=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
const flush=async()=>{for(let i=0;i<15;i++)await Promise.resolve()};
test('deep-link boot loads identity/settings, portal loads once when opened',async()=>{
 const calls=[],c={Promise,appStartParamRaw:()=> 'film_ig',startLiveWatch:()=>calls.push('live')};
 for(const name of ['loadAppSettings','loadProfile','loadContinueWidget','loadNews','loadWidgetMonth','loadSavedSlugs','loadCards','loadRaffle','loadDigestBlock','loadStories'])c[name]=()=>{calls.push(name);return Promise.resolve()};
 vm.createContext(c);vm.runInContext(slice('let portalDataPending=','function startApp(){'),c);
 const start=html.indexOf('  const boot = Promise.allSettled(',html.indexOf('function startApp(){')),end=html.indexOf('\n  const cap',start);
 await vm.runInContext('(async()=>{'+html.slice(start,end)+';await boot;})()',c);assert.deepEqual(calls,['loadAppSettings','loadProfile']);
 await Promise.all([c.loadPortalData(),c.loadPortalData()]);assert.equal(calls.filter(x=>x==='loadCards').length,1);assert(calls.includes('loadNews'));
 c.appStartParamRaw=()=>'';assert(c.bootNeedsPortal());c.appStartParamRaw=()=> 'quiz';assert(!c.bootNeedsPortal());
 for(const label of ['u_instagram','unknown_campaign','bm','welcome','cards','schedule']){c.appStartParamRaw=()=>label;assert(c.bootNeedsPortal(),label);}
});
test('news renders before support/tester replies and keeps later replies',async()=>{
 const pending={},card={style:{},classList:{add(){}},innerHTML:''},head={style:{},classList:{add(){}}};
 const c={Promise,API_URL:'https://api.test',telegramId:99,isMember:false,supportReplies:[],qaTickets:[],qaVkId:()=>'',qaTicketShow:()=>true,qaTicketHtml:x=>x.text,supportLinkify:x=>x,liteRemindDue:()=>false,t:x=>x,escapeHtml:x=>x,hasVisibleText:x=>!!x,document:{getElementById:id=>id==='news-card'?card:head},apiRequest:(url)=>new Promise(resolve=>pending[new URL(url).pathname]=resolve)};
 vm.createContext(c);vm.runInContext(slice('let newsGeneration=','async function loadNotifications'),c);const job=c.loadNews();
 pending['/news/latest']({common_text:'NEWS'});await flush();assert(card.innerHTML.includes('NEWS'));assert.equal(card.style.display,'block');
 pending['/support/my']([{id:1,reply:'SUPPORT'}]);await flush();assert(card.innerHTML.includes('NEWS')&&card.innerHTML.includes('SUPPORT'));
 pending['/news/urgent']({text:null});pending['/tester/my']({tickets:[]});await job;assert(card.innerHTML.includes('NEWS'));
});
test('API timeout also covers a stalled response body',async()=>{
 const c={AbortController,DOMException,setTimeout,clearTimeout,fetch:async(url,opts)=>({ok:true,json:()=>new Promise((resolve,reject)=>opts.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError'))))})};vm.createContext(c);vm.runInContext(slice('async function apiRequest(','async function diagPingApi'),c);
 await assert.rejects(c.apiRequest('https://api.test',{},15),{name:'AbortError'});
});
test('concurrent failed API reads share one health request, without caching replication state',async()=>{
 const end=html.indexOf('window.__rfTransport=createRFParallelTransport');
 const core=html.slice(html.lastIndexOf('(function(root){',end),end);
 let checks=0;const c={module:{exports:{}},URL,Request,Response,Headers,AbortController,DOMException,setTimeout,clearTimeout,Date};vm.createContext(c);vm.runInContext(core,c);
 const transport=c.module.exports.createRFParallelTransport({endpoints:['https://primary.test','https://reserve.test'],fetch:async(url)=>{if(url.includes('readiness')){checks++;await new Promise(r=>setTimeout(r,10));return new Response(JSON.stringify({protocol:2,ready:true,node:'timeweb',own_seq:1,peer_seq:1}))}return new Response('{}',{status:url.includes('primary')?503:200})}});
 await Promise.all(Array.from({length:10},()=>transport.request('https://primary.test/users/me')));assert.equal(checks,1);
});
test('card motion defaults are available inline without a blocking startup request',()=>{
 assert(!/<script\b[^>]*src="card-motion\.js/.test(html));
 const source=fs.readFileSync(require('path').join(__dirname,'../card-motion.js'),'utf8').trim();assert(html.includes(source),'Keep the app and dashboard motion defaults in sync');
 const context={window:{}};vm.createContext(context);vm.runInContext(source,context);assert.equal(context.window.ClubCardMotion.tilt,9.6);
 assert(html.indexOf(source)<html.indexOf('<script id="club-telegram-sdk">'),'Motion does not delay SDK parsing');
});

test('stalled VK bridge cannot block authenticated startup indefinitely',async()=>{
 const timers=new Map();let id=0,auth=0,started=0;
 const c={Promise,AbortController,setTimeout:(fn,ms)=>{timers.set(++id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),window:null,vkBridge:{send:()=>new Promise(()=>{})},vkAskMessages(){},filmContactName:()=>new Promise(()=>{}),API_URL:'https://api.test',vkLaunchQuery:()=> 'signed-fixture',fetch:async(url,opts)=>{auth++;assert(opts.signal);return {ok:true,json:async()=>({found:true,telegram_id:-77})}},startApp:()=>started++};c.window=c;vm.createContext(c);
 vm.runInContext(slice('async function boundedVkInit(){','/* ── Разовая ссылка'),c);const result=c.startVkSession();await flush();assert.equal(auth,0);
 const bridge=[...timers.values()].find(t=>t.ms===3500);assert(bridge);bridge.fn();assert.equal(await result,true);assert.equal(auth,1);assert.equal(started,1);assert.equal(c.telegramId,-77);assert.equal(timers.size,0);
});
for(const platform of ['tg','vk'])test(platform+' session stops after its deadline even when response headers arrived',async()=>{
 const timers=new Map();let id=0,started=0;
 const c={Promise,AbortController,DOMException,setTimeout:(fn,ms)=>{timers.set(++id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),window:{},API_URL:'https://api.test',vkLaunchQuery:()=> 'signed',tgLaunchData:()=> 'signed',startApp:()=>started++,flushPendingAttribution(){},fetch:async(url,opts)=>({ok:true,json:()=>new Promise((resolve,reject)=>opts.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true}))})};vm.createContext(c);
 const code=platform==='tg'?html.slice(html.indexOf('async function startTgSessionFallback(){'),html.indexOf('\n}\n',html.indexOf('async function startTgSessionFallback(){'))+3):slice('async function boundedVkInit(){','/* ── Разовая ссылка');
 vm.runInContext(code,c);const pending=platform==='tg'?c.startTgSessionFallback():c.startVkSession();await flush();const deadline=[...timers.values()].find(t=>t.ms===12000);assert(deadline);deadline.fn();assert.equal(await pending,false);assert.equal(started,0);assert.equal(timers.size,0);
});

test('inline SDK exactly matches vendored source and has no blocking fetch',()=>{const source=require('fs').readFileSync(require('path').join(__dirname,'../telegram-web-app.js'),'utf8');assert(html.includes('<script id="club-telegram-sdk">\n'+source+'\n</script>'));assert(!html.includes('<script src="telegram-web-app.js"'));});
