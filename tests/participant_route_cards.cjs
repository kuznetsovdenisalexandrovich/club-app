const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function between(start,end){const a=html.indexOf(start);assert(a>=0);const b=html.indexOf(end,a);assert(b>a);return html.slice(a,b);}
function context(values){const c=vm.createContext(values);return c;}
const profile=between('async function loadProfile()','/* ══ НЕУДАЧНОЕ СПИСАНИЕ');
test('anonymous refresh avoids authenticated profile and false incident',async()=>{
 let requests=0;const c=context({telegramId:null,apiRequest:()=>{requests++;throw Error('unexpected')}});vm.runInContext(profile,c);await c.loadProfile();assert.equal(requests,0);
});
test('identified profile failures are still reported',async()=>{
 const reports=[];const c=context({telegramId:77,API_URL:'https://api.invalid',profileFailureReports:0,apiRequest:async()=>{throw {status:401}},track:()=>{},window:{__reportError:(...v)=>reports.push(v)},document:{getElementById:()=>({appendChild:()=>{}}),createElement:()=>({})}});
 vm.runInContext(profile,c);await c.loadProfile();assert.equal(reports.length,1);assert.equal(reports[0][2],'profile_http_401');
});
test('every unfinished stage keeps a concrete action and progress entry',()=>{
 for(const mandatory of [false,true]){
 const host={};const c=context({isMember:true,nbState:{active:true,level:1,steps:[{done:1,cap:1},{done:0,cap:1}],next:{k:'ask',mand:mandatory,n:'Спроси помощника'}},document:{getElementById:()=>host},nbSeen:()=>true,nbStepKey:k=>k,nbT:()=>'',esc2:x=>x,nbStepName:n=>n.n,nbStepWhy:()=> 'Найди ответ',nbIsHero:()=>false});
 vm.runInContext(between('function nbRenderStart(){','function nbStaffCached'),c);c.nbRenderStart();
 assert.match(host.innerHTML,/Спроси помощника/);assert.match(host.innerHTML,/nbDoStep\('ask'\)/);assert.match(host.innerHTML,/Все шаги и мой прогресс/);assert.doesNotMatch(host.innerHTML,/Что ещё есть/);
 }
});
test('failed screen catalogue can be retried on next opening',async()=>{
 let calls=0;const c=context({PR_SCREENS:null,API_URL:'https://api.invalid',apiRequest:async()=>{if(++calls===1)throw Error('offline');return{screens:{dark:[{key:'ok'}]}}}});
 vm.runInContext(between('async function prLoadScreens(){','/* Один набор на тему'),c);
 await c.prLoadScreens();assert.equal(c.PR_SCREENS,null);await c.prLoadScreens();assert.equal(c.PR_SCREENS.dark[0].key,'ok');assert.equal(calls,2);
});
test('failed critical assets use local fallback and stale sessions do not change current pack',async()=>{
 for(const stale of [false,true]){
 let refresh=0,release;const c=context({PR:{themeCard:null},PR_PICKED:{dark:{stage:'bad',back:'bad'}},PR_ASSETS:{dark:{stage:['stage.webp'],back:['back.webp']}},PR_KEY_KINDS:['stage','back'],PR_LOADING_CAP_MS:1,prSession:1,prTheme:()=> 'dark',prPickAsset:()=> 'bad',prLoadOne:()=>new Promise(r=>release=r),prRefreshBacks:()=>refresh++,prApplyAssets:()=>{}});
 // Resolve both image waits together.
 const pending=[];c.prLoadOne=()=>new Promise(r=>pending.push(r));vm.runInContext(between('async function prWaitAssets(){','var prSession'),c);
 const promise=c.prWaitAssets();if(stale)c.prSession++;pending.forEach(r=>r(false));await promise;
 assert.equal(refresh,stale?0:2);assert.equal(c.PR_PICKED.dark.stage,stale?'bad':'images/reveal/screens/stage.webp');
 }
});
test('share picker is attached above the source overlay without closing it',()=>{
 const el={style:{},classList:{add:k=>el.open=k}};let attached=false;
 const c=context({window:{},localStorage:{getItem:()=>null},SHARE_WHERE_KEY:'key',sharePending:null,document:{getElementById:()=>el,body:{appendChild:()=>attached=true}}});
 vm.runInContext(between('function shareWithChoice(text, payload){','function shareWhereClose'),c);c.shareWithChoice('Идеи','li_test');assert(attached);assert.equal(el.open,'gg-open');assert.equal(el.style.zIndex,'31000');assert.equal(c.sharePending.payload,'li_test');
});
test('closed single pack is centered and two-card pack is symmetric',()=>{
 for(const count of [1,2,3]){
  const ids=Array.from({length:count},(_,i)=>i+1),els=ids.map(()=>({style:{setProperty(k,v){this[k]=v}}}));
  const c=context({PR:{ids,hero:null,opened:[]},PR_POS:[[-86,-34,-9],[0,-56,0],[86,-34,9]],prEl:()=>({querySelector:s=>els[Number(s.match(/\d+/)[0])-1]})});
  vm.runInContext(between('function prLayout(){','function prApplyTheme('),c);c.prLayout();
  if(count===1){assert.equal(els[0].style['--x'],'0px');assert.equal(els[0].style['--y'],'0px');assert.equal(els[0].style['--r'],'0deg');}
  if(count===2)assert.equal(parseFloat(els[0].style['--x'])+parseFloat(els[1].style['--x']),0);
 }
});
