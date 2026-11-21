const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),test=require('node:test');
const html=fs.readFileSync('index.html','utf8');
function fn(name){const start=html.search(new RegExp('^(?:async )?function '+name+'\\(','m'));assert(start>=0);const next=html.slice(start+1).search(/\n(?:async )?function /);return html.slice(start,start+1+next);}
test('quiz purchase opens payment directly and restores a hidden entry shell',()=>{
 for(const display of ['none','','block']){
  const calls=[],c={document:{getElementById:()=>({style:{display}})},closeQuiz:()=>calls.push('close'),enterDemoMode:()=>calls.push('shell'),openAccessPage:()=>calls.push('payment')};
  vm.runInNewContext(fn('openQuizFullAccess'),c);c.openQuizFullAccess();
  assert.deepEqual(calls,display==='block'?['close','payment']:['close','shell','payment']);
 }
});
test('AI game final keeps one primary guest action; members keep next-game action',()=>{
 for(const member of [false,true])for(const next of [null,{key:'next',title:'Next'}]){
  const el={},c={isMember:member,onbDone:()=>{},t:()=>'',escapeHtml:x=>String(x),jsArg:JSON.stringify,ggS:{game_key:'current'},document:{getElementById:()=>el},ggShow:()=>{}};
  vm.runInNewContext(fn('ggFinal'),c);c.ggFinal({status:'won',score:90,next_game:next});
  assert.equal((el.innerHTML.match(/gg-btn-primary/g)||[]).length,1);
  assert.equal(el.innerHTML.includes("rsGamePay('final')"),!member);
  assert(!el.innerHTML.includes('club-info'));
 }
});
test('direct game payment preserves correct resume context and uses existing payment route',()=>{
 for(const which of ['note','final','member']){
  const calls=[],c={ggS:{game_key:'current'},rsGameKey:'locked',ggFind:key=>({title:key}),rsSave:x=>calls.push(x),track:()=>{},openAccessPage:()=>calls.push('payment')};
  vm.runInNewContext(fn('rsGamePay'),c);c.rsGamePay(which);
  assert.equal(calls[0].ref,which==='member'?'locked':'current');assert.equal(calls[1],'payment');
 }
});
