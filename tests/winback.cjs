const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const source=html.slice(html.indexOf('async function submitWinback(reasonKey'),html.indexOf('/* ── Предложение ПОСЛЕ'));
const actions=html.slice(html.indexOf('function winbackResultActions(d)'),html.indexOf('function winbackFreezeControls'));
const digest=html.slice(html.indexOf('async function openDigestMissed(since)'),html.indexOf('\nfunction dgsEmpty'));
function setup(){
 const els={'winback-body':{innerHTML:''},'winback-free-text':{value:'my question'}};let calls=0,refresh=0,rendered='',opened='',toast='';
 const c={console,jsArg:x=>JSON.stringify(x),openPersonalDigestOffer:async()=>{opened='personal'},API_URL:'https://api.example',telegramId:77,clubPass:'old',CLUB_PASS_KEY:'pass',localStorage:{getItem:()=>'{"77":"old","88":"keep"}',setItem:(k,v)=>assert.equal(JSON.parse(v)['88'],'keep')},sessionHeaders:()=>({'X-Session-Token':'session'}),document:{getElementById:id=>els[id]},renderWinbackReason:k=>{rendered=k;els['winback-body'].innerHTML='choices'},showToast:m=>toast=m,t:k=>k,escapeHtml:x=>x,dgsLoading:()=>{},dgsWho:()=>'?telegram_id=77',dgsEmpty:m=>opened=m,openDigest:async slug=>opened=slug,clubPassEnsure:async()=>{refresh++;c.clubPass='fresh'},apiRequest:async()=>{calls++;return {status:'ok'}}};
 vm.createContext(c);vm.runInContext(actions+'\n'+source+'\n'+digest,c);return {c,els,stats:()=>({calls,refresh,rendered,opened,toast})};
}
(async()=>{
 let x=setup(),count=0;x.c.apiRequest=async(u,o)=>{assert.equal(o.credentials,'include');if(++count===1)throw Object.assign(new Error('auth'),{status:401});return {status:'ok',actions:[{target:'missed',label:'My digest'},{target:'unsafe',label:'BAD'}]}};
 await x.c.submitWinbackSimple('nothing_watched','materials_only');assert.equal(count,2);assert.equal(x.stats().refresh,1);assert.ok(x.els['winback-body'].innerHTML.includes('My digest'));
 x=setup();x.c.apiRequest=async()=>{throw Object.assign(new Error('auth'),{status:401})};await x.c.submitWinbackSimple('no_time','accept_no_discount');assert.equal(x.stats().refresh,1);assert.equal(x.stats().rendered,'no_time');assert.ok(!x.els['winback-body'].innerHTML.includes('Секунду'));
 x=setup();x.c.apiRequest=async()=>{throw Object.assign(new Error('network'),{status:502})};await x.c.submitWinbackWithText('no_direction','guide_only');assert.equal(x.stats().refresh,0);assert.equal(x.els['winback-free-text'].value,'my question');
 x=setup();x.c.apiRequest=async()=>[{slug:'older',published_at:'2026-09-01'},{slug:'editorial',published_at:'2026-10-13'}];await x.c.legacyOpenDigestMissed();assert.equal(x.stats().opened,'editorial');
 x=setup();x.c.apiRequest=async()=>[];await x.c.legacyOpenDigestMissed();assert.equal(x.stats().opened,'digest.empty');await x.c.openDigestMissed();assert.equal(x.stats().opened,'personal');
 console.log('PASS: identity renewal, bounded retry, no retry on 502, restored choices/text, materials link, editorial digest, empty shelf');
})().catch(e=>{console.error(e);process.exit(1)});
