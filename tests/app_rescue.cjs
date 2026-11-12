const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const first=html.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1];
function setup({signed=true,fetchFailure=false,hidden=false,vk=false}={}){
 const timers=new Map(),events={},docEvents={},calls=[],nodes=[];let id=0;
 const create=tag=>({tag,style:{},children:[],textContent:'',setAttribute(){},appendChild(n){this.children.push(n);return n;},remove(){this.removed=true;}});
 const root=create('html'),body=create('body');
 const d={body,documentElement:root,hidden:hidden,createElement:tag=>{const n=create(tag);nodes.push(n);return n;},addEventListener:(e,f)=>docEvents[e]=f};
 const w={location:{hash:signed?'#tgWebAppData='+encodeURIComponent('auth_date=1&user=%7B%22id%22%3A123%7D&start_param=film'):'',search:'?startapp=film',reload(){}},
  crypto:{randomUUID:()=> '12345678-abcd-1234-abcd-123456789abc'},
  fetch:async(url,opts)=>{if(fetchFailure)throw Error('offline');const data=JSON.parse(opts.body);calls.push(data);return {ok:true,json:async()=>({status:data.event==='failed'?'sent':'boot',kind:'video',bot_url:'https://t.me/youselllikeagod_bot?start=apprescue_abcdefghijklmnopqrstuvwx'})};},
  addEventListener:(e,f)=>events[e]=f};
 if(vk){w.location.hash='#film';w.location.search='?vk_user_id=123&sign=synthetic&vk_ref=other';}
 Object.assign(w,{window:w,document:d,URLSearchParams,Promise,Math,location:w.location,setTimeout:(f,ms)=>{timers.set(++id,{f,ms});return id;},clearTimeout:id=>timers.delete(id)});
 vm.createContext(w);vm.runInContext(first,w);
 return {w,d,calls,nodes,timers,events,docEvents,async deadline(){const t=[...timers.values()].find(t=>t.ms===35000);assert(t);t.f();await flush();}};
}
async function flush(){for(let i=0;i<15;i++)await Promise.resolve();}
test('rescue is inline and runs before dependencies',()=>{assert.match(first,/APP_RESCUE_V1/);assert(html.indexOf('APP_RESCUE_V1')<html.indexOf('card-motion.js'));});
test('blank page without SDK or main code raises independent banner and requests delivery',async()=>{
 const s=setup();await s.deadline();assert(s.calls.some(x=>x.event==='failed'));assert(s.nodes.some(x=>x.id==='club-app-rescue'));
 assert(s.nodes.some(x=>x.textContent==='Видео уже отправлено в бота.'));assert(s.nodes.some(x=>x.textContent==='Перезагрузить'));
});
test('successful settings profile and render cancel both watchdogs',async()=>{
 const s=setup();['settings','profile','rendered'].forEach(x=>s.w.ClubAppRescue.mark(x));await flush();
 assert(s.calls.some(x=>x.event==='ready'));assert(![...s.timers.values()].some(x=>x.ms===35000));assert(!s.nodes.some(x=>x.id==='club-app-rescue'));
});
test('one successful request does not hide a broken shell',async()=>{const s=setup();s.w.ClubAppRescue.mark('settings');await s.deadline();assert(s.nodes.some(x=>x.id==='club-app-rescue'));});
test('offline state never claims delivery or support notification',async()=>{const s=setup({fetchFailure:true});await s.deadline();assert(!s.nodes.some(x=>x.textContent.includes('уже отправлено')));assert(s.nodes.some(x=>x.textContent.includes('Сервис сейчас не отвечает')));});
test('unsigned browser still has retry and bot but never invents a recipient',async()=>{const s=setup({signed:false});await s.deadline();assert.equal(s.calls.length,0);assert(s.nodes.some(x=>x.textContent==='Перейти в бота'));});
test('changed material gets a fresh attempt and preserves target',async()=>{const s=setup();await flush();s.w.ClubAppRescue.target('ig_new_video');s.w.ClubAppRescue.fail('content_error');await flush();const call=s.calls.find(x=>x.event==='failed');assert.equal(call.target,'ig_new_video');assert.notEqual(call.attempt,s.calls[0].attempt);});
test('backgrounding cancels silence timer',async()=>{const s=setup();s.d.hidden=true;s.docEvents.visibilitychange();await flush();assert(s.calls.some(x=>x.event==='closed'));assert(![...s.timers.values()].some(x=>x.ms===35000));});

test('healthy guest login is not a failure',async()=>{const s=setup();['settings','guest','rendered'].forEach(x=>s.w.ClubAppRescue.mark(x));await flush();assert(s.calls.some(x=>x.event==='ready'));assert(![...s.timers.values()].some(x=>x.ms===35000));});

test('visible permission gate cancels startup watchdog without demanding API data',async()=>{const s=setup();s.w.ClubAppRescue.mark('gate');await flush();assert(s.calls.some(x=>x.event==='ready'));assert(![...s.timers.values()].some(x=>x.ms===35000));});
test('actual video frame proves useful content loaded',async()=>{const s=setup();s.w.ClubAppRescue.mark('content');await flush();assert(s.calls.some(x=>x.event==='ready'));assert(![...s.timers.values()].some(x=>x.ms===35000));});
test('initially hidden page never arms server or client watchdog',async()=>{const s=setup({hidden:true});await flush();assert.equal(s.calls.length,0);assert(![...s.timers.values()].some(x=>x.ms===35000));});
test('failure includes observed startup stages',async()=>{const s=setup();s.w.ClubAppRescue.mark('rendered');await s.deadline();assert(s.calls.find(x=>x.event==='failed').marks.includes('rendered'));});
test('player diagnostics retain signed identity independently of delivery ownership',()=>{assert(!html.includes("ClubAppRescue.accepted?'':ivIdent()"));assert(html.includes('()=>ivIdent().tg_init,()=>!!(window.ClubAppRescue'));});
test('late useful startup removes emergency UI and stops polling',async()=>{
 const s=setup();await s.deadline();const panel=s.nodes.find(n=>n.id==='club-app-rescue');assert(panel&&!panel.removed);
 ['settings','profile','rendered'].forEach(x=>s.w.ClubAppRescue.mark(x));await flush();assert(panel.removed);assert(s.calls.some(x=>x.event==='ready'));
});
test('profile refresh cannot dismiss content failure; actual frame can',async()=>{
 const s=setup();['settings','profile','rendered'].forEach(x=>s.w.ClubAppRescue.mark(x));s.w.ClubAppRescue.fail('content_error');await flush();
 const panel=s.nodes.find(n=>n.id==='club-app-rescue');s.w.ClubAppRescue.mark('profile');assert(!panel.removed);s.w.ClubAppRescue.mark('content');await flush();assert(panel.removed);
});
test('player distinguishes failed source with remaining fallback from final failure',()=>{
 const calls=[],reports=[];const ctx={window:{clubPlayerDiagnostics:()=>event=>reports.push(event),ClubAppRescue:{}},ClubAppRescue:{mark:x=>calls.push('mark:'+x),fail:x=>calls.push('fail:'+x)},API_URL:'',APP_BUILD:'v586',ivIdent:()=>({tg_init:'signed'})};
 const start=html.indexOf('function filmDiagnostics('),end=html.indexOf('// Failure reporting',start);vm.createContext(ctx);vm.runInContext(html.slice(start,end),ctx);
 const recovering=ctx.filmDiagnostics('film',()=>true);recovering({event:'manifest_error'});assert.equal(calls.length,0);assert.equal(reports.length,1);
 const final=ctx.filmDiagnostics('bonus');final({event:'unavailable'});assert(calls.includes('fail:content_error'));final({event:'recovered'});assert(calls.includes('mark:content'));
});

test('VK startup preserves material and offers local bot without Telegram identity',async()=>{
 const s=setup({vk:true});await s.deadline();assert(s.calls.length>0);assert(s.calls.every(x=>x.platform==='vk'&&x.launch.includes('vk_user_id=123')));assert(s.calls.every(x=>x.target==='film'));
 const link=s.nodes.find(n=>n.textContent==='Перейти в бота');assert(link.href.startsWith('https://vk.me/club232119632'));
});

test('partial startup sends bounded stages without premature ready',async()=>{
 const s=setup();s.w.ClubAppRescue.mark('sdk');s.w.ClubAppRescue.mark('main');const progress=[...s.timers.values()].find(t=>t.ms===1000);assert(progress);progress.f();await flush();const partial=s.calls.find(c=>c.event==='status');assert(partial);assert(partial.marks.includes('html'));assert(partial.marks.includes('sdk'));assert(partial.stage_ms.main>=0);assert(!s.calls.some(c=>c.event==='ready'));
 ['settings','profile','rendered'].forEach(x=>s.w.ClubAppRescue.mark(x));await flush();assert(s.calls.some(c=>c.event==='ready'));
});
test('JS error is evidence without declaring useful screen failure',async()=>{
 const s=setup();s.events.error();[...s.timers.values()].find(t=>t.ms===1000).f();await flush();assert(s.calls.some(c=>c.event==='status'&&c.marks.includes('scriptError')));assert(!s.calls.some(c=>c.event==='failed'));
});
