const fs=require('fs'),vm=require('vm'),test=require('node:test'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('path').join(__dirname,'../index.html'),'utf8');
const code=html.slice(html.indexOf('var PAID_TOKEN_KEY ='),html.indexOf('/* Не опознали — ведём',html.indexOf('var PAID_TOKEN_KEY =')));
function setup(fetch){
 const store=new Map(),els={};const c={fetch,API_URL:'https://api.test',telegramId:123,isMember:false,localStorage:{setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},document:{getElementById:id=>els[id]||=( {textContent:'',innerHTML:'',classList:{add(){},remove(){}}})},window:{},t:x=>x,hideSplash(){},escapeHtml:x=>x,track(){},setTimeout};
 vm.createContext(c);vm.runInContext(code,c);return {c,store,els};
}
test('aborted claim retains token and offers explicit retry, not a false invalid-link verdict',async()=>{
 const calls=[];let count=0;const {c,store,els}=setup(async(u,o)=>{calls.push(JSON.parse(o.body));if(!count++)throw Object.assign(new Error('Aborted'),{name:'AbortError'});return {ok:true,json:async()=>({status:'ok',is_member:true,until:'2026-12-16'})};});
 await c.claimManualAccess('same-token');assert.equal(calls.length,1);assert.equal(c.isMember,false);assert.equal(store.get(c.PAID_TOKEN_KEY),'same-token');
 assert(!els['paid-claim-text'].textContent.includes('Aborted'));assert(els['paid-claim-actions'].innerHTML.includes('paidClaimRetry()'));
 await c.paidClaimRetry();assert.equal(calls.length,2);assert.equal(calls[0].token,calls[1].token);assert.equal(c.isMember,true);assert.equal(store.size,0);
});
test('concurrent clicks issue one request; malformed success cannot claim access',async()=>{
 let finish,calls=0;const {c,store}=setup(()=>{calls++;return new Promise(r=>finish=r)});
 const first=c.claimManualAccess('one');await c.claimManualAccess('one');await c.paidClaimRetry();assert.equal(calls,1);
 finish({ok:true,json:async()=>({})});await first;assert.equal(c.isMember,false);assert.equal(store.get(c.PAID_TOKEN_KEY),'one');assert.equal(c.paidClaimPending,false);
});
test('expired invite preserves the server explanation without retry button',async()=>{
 const {c,els}=setup(async()=>({ok:false,status:410,json:async()=>({detail:'Ссылка устарела'})}));
 await c.claimManualAccess('expired');assert.equal(els['paid-claim-text'].textContent,'Ссылка устарела');assert(!els['paid-claim-actions'].innerHTML.includes('paidClaimRetry()'));
});
