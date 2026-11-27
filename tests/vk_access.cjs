const fs=require('fs'),vm=require('vm'),test=require('node:test'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('path').join(__dirname,'../index.html'),'utf8');
const code=html.slice(html.indexOf('let vkJoinBusy='),html.indexOf('\nfunction proceedAfterVkAccess()',html.indexOf('let vkJoinBusy=')));
function setup(fetch,inside=false){
 const els={},opened=[],calls=[];
 const element=id=>els[id]||=( {textContent:'',style:{},className:'',classList:{add(){},remove(){}},setAttribute(){},appendChild(el){els[el.id]=el;}});
 const c={fetch,AbortSignal,API_URL:'https://api.test',telegramId:123,isMember:true,vkAccessGranted:false,vkAccessWatch:false,clubPass:'old',clubPassId:'123',crypto:{randomUUID:()=> 'stable-request'},sessionHeaders:()=>({'X-Session':'signed'}),isInsideVk:()=>inside,vkLaunchQuery:()=> 'signed-launch',vkBridge:{send:async(method,data)=>calls.push({method,data})},document:{getElementById:id=>id==='vk-join-renew'?(els[id]||null):element(id),createElement:()=>({setAttribute(){}})},openUrl:url=>opened.push(url),openPaywall(){calls.push('paywall')},pollForVkAccess(){calls.push('poll')},waitProfile:async()=>{},clubPassEnsure:async()=>{},loadProfile:async()=>{},switchView(){},funnelLeave(){},vkAccessFresh:async()=>false,proceedAfterVkAccess(){calls.push('proceed')}};
 vm.createContext(c);vm.runInContext(code,c);return {c,els,opened,calls};
}
test('failed or missing handshake URL never opens unlinked group',async()=>{
 for(const body of [{ok:false,status:503,json:async()=>({detail:'Ошибка связи'})},{ok:true,json:async()=>({})}]){
  const {c,opened,els}=setup(async()=>body);await c.grantVkAccessAndJoin();assert.equal(opened.length,0);assert(els['vk-join-status'].textContent);
 }
});
test('TG access uses authenticated native handshake and stable request',async()=>{
 const requests=[];const {c,opened}=setup(async(url,o)=>{requests.push({url,o});return {ok:true,json:async()=>({url:'https://vk.ru/app54715238#vkjoin_lt'+'a'.repeat(32)})}});
 await c.grantVkAccessAndJoin();await c.grantVkAccessAndJoin();assert.equal(requests.length,2);
 assert.equal(JSON.parse(requests[0].o.body).request_id,JSON.parse(requests[1].o.body).request_id);
 assert(requests[0].o.headers['X-Session']);assert(opened.every(x=>x.includes('#vkjoin_lt')));
});
test('VK requests group join, rechecks approval and then opens group',async()=>{
 let n=0;const {c,calls,opened}=setup(async()=>({ok:true,json:async()=>({linked:true,is_member:true,telegram_id:123,group_id:232119632,url:'https://vk.ru/club232119632',in_group:++n>1})}),true);
 await c.grantVkAccessAndJoin();assert.equal(n,2);assert.equal(calls[0].method,'VKWebAppJoinGroup');assert.equal(c.vkAccessGranted,true);assert.equal(opened.length,1);
});
test('unconfirmed approval stays pending instead of reporting access',async()=>{
 const {c,calls,opened,els}=setup(async()=>({ok:true,json:async()=>({linked:true,is_member:true,telegram_id:123,group_id:232119632,url:'https://vk.ru/club232119632',in_group:false})}),true);
 await c.grantVkAccessAndJoin();assert.equal(c.vkAccessGranted,false);assert.equal(opened.length,0);assert(calls.includes('poll'));assert.match(els['vk-join-status'].textContent,/Проверяем/);
});
test('already-have-access requires actual VK confirmation',async()=>{
 const {c,calls}=setup(async()=>{});await c.alreadyHaveVkAccess();assert.equal(c.vkAccessGranted,false);assert(!calls.includes('proceed'));
});
test('claim restores canonical paid identity and clears old pass',async()=>{
 const {c,els}=setup(async()=>({ok:true,json:async()=>({linked:true,is_member:true,telegram_id:321,group_id:232119632,url:'https://vk.ru/club232119632',in_group:true})}),true);
 await c.claimVkMembership('lt'+'a'.repeat(32));assert.equal(c.telegramId,321);assert.equal(c.clubPass,'');assert.equal(c.vkAccessGranted,true);assert.match(els['vk-join-status'].textContent,/связаны/);
});
test('private access route precedes marketing; rescue never stores its ticket',()=>{
 const branch=html.indexOf('await claimVkMembership(accessStart.slice(7))');assert(branch>0&&branch<html.indexOf('if(!await resolveNurtureStart())return;',branch));
 assert(html.includes("if(/^vkjoin_/.test(target))target='vk_access'"));
});
test('expired personal VK link offers a stable TG entry without reusing the ticket',async()=>{
 const {c,els,opened}=setup(async()=>({ok:false,json:async()=>({code:'ticket_expired',detail:'Билет истёк'})}),true);
 await c.claimVkMembership('lt'+'a'.repeat(32));
 assert.equal(els['vk-join-renew'].href,'https://t.me/youselllikeagod_bot/app?startapp=vk');
 assert.match(els['vk-join-status'].textContent,/получи новую/);assert.equal(opened.length,0);
});
test('fresh VK check never falls back to a stale positive flag',async()=>{
 const source=html.slice(html.indexOf('async function vkAccessFresh(){'),html.indexOf('\nasync function openVkAccessGate'));
 for(const response of [{ok:true,json:async()=>({found:true,in_group:false})},{ok:true,json:async()=>({found:true,in_group:true,error:'unavailable'})},null]){
  const c={telegramId:123,vkAccessGranted:true,API_URL:'https://test',AbortSignal,fetch:async()=>{if(!response)throw Error('offline');return response;}};
  vm.createContext(c);vm.runInContext(source,c);assert.equal(await c.vkAccessFresh(),false);assert.equal(c.vkAccessGranted,false);
 }
});
test('shared entry copy describes linking and contains no temporary ticket',()=>{
 const modal=html.slice(html.indexOf('id="vk-access-overlay"'),html.indexOf('id="tg-access-overlay"'));
 assert.match(modal,/Доступ к группе ВК/);assert.match(modal,/Свяжем твой аккаунт/);assert(!modal.includes('library.a1'));
});
