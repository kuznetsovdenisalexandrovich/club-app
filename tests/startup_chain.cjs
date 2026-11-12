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
 const core=slice('(function(root){','window.__rfTransport=createRFParallelTransport');
 let checks=0;const c={module:{exports:{}},URL,Request,Response,Headers,AbortController,DOMException,setTimeout,clearTimeout,Date};vm.createContext(c);vm.runInContext(core,c);
 const transport=c.module.exports.createRFParallelTransport({endpoints:['https://primary.test','https://reserve.test'],fetch:async(url)=>{if(url.includes('readiness')){checks++;await new Promise(r=>setTimeout(r,10));return new Response(JSON.stringify({protocol:2,ready:true,node:'timeweb',own_seq:1,peer_seq:1}))}return new Response('{}',{status:url.includes('primary')?503:200})}});
 await Promise.all(Array.from({length:10},()=>transport.request('https://primary.test/users/me')));assert.equal(checks,1);
});
