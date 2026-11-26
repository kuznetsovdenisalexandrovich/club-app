const fs=require('fs'),vm=require('vm'),test=require('node:test'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('path').join(__dirname,'../index.html'),'utf8');
const code=html.slice(html.indexOf('async function paidClaimConnectionCode('),html.indexOf('/* Не опознали — ведём',html.indexOf('var PAID_TOKEN_KEY =')));
function setup(fetch){
 const store=new Map(),els={};const c={fetch,AbortController,AbortSignal,clearTimeout,clubConnectionProbeFetch:async()=>({ok:true,json:async()=>({protocol:2,ready:true})}),API_URL:'https://api.test',telegramId:123,isMember:false,localStorage:{setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},document:{getElementById:id=>els[id]||=( {textContent:'',innerHTML:'',classList:{add(){},remove(){}}})},window:{},t:x=>x,hideSplash(){},escapeHtml:x=>x,track(){},setTimeout:(fn,ms)=>ms===2000?setTimeout(fn,0):setTimeout(fn,ms)};
 vm.createContext(c);vm.runInContext(code,c);return {c,store,els};
}
test('lost response resumes same invitation automatically without duplicate user action',async()=>{
 const calls=[];let count=0;const {c,store,els}=setup(async(u,o)=>{calls.push(JSON.parse(o.body));assert(o.signal);if(!count++)throw Object.assign(new Error('Aborted'),{name:'AbortError'});return {ok:true,json:async()=>({status:'ok',is_member:true,until:'2026-12-16'})};});
 await c.claimManualAccess('same-token');assert.equal(calls.length,2);assert.equal(calls[0].token,calls[1].token);assert.equal(c.isMember,true);assert.equal(store.size,0);assert.equal(els['paid-claim-title'].textContent,'paid.ok_t');
});
test('persistent network failure is bounded and keeps an explicit retry',async()=>{
 let calls=0;const {c,store,els}=setup(async()=>{calls++;throw new TypeError('Network unavailable')});
 await c.claimManualAccess('one');assert.equal(calls,3);assert.equal(c.isMember,false);assert.equal(store.get(c.PAID_TOKEN_KEY),'one');assert(els['paid-claim-actions'].innerHTML.includes('paidClaimRetry()'));
});
test('pending receipt retries automatically but identity conflicts do not',async()=>{
 let calls=0;const {c,els}=setup(async()=>{calls++;return calls===1?{ok:false,status:409,json:async()=>({code:'manual_claim_pending',detail:'waiting'})}:{ok:true,json:async()=>({status:'ok',is_member:true})}});
 await c.claimManualAccess('one');assert.equal(calls,2);assert.equal(c.isMember,true);
 const b=setup(async()=>{throw Object.assign(new Error('Other member'),{status:409})});await b.c.claimManualAccess('one');assert.equal(b.c.isMember,false);
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

test('connection diagnostics probe only public readiness without identity or access token',async()=>{
 const {c}=setup(()=>{throw Error('Must not send a claim')});const calls=[];
 c.clubConnectionProbeFetch=async(url,opts)=>{calls.push({url,opts});if(calls.length===1)throw new TypeError('private URL');return {ok:true,json:async()=>({protocol:2,ready:true})};};
 const code=await c.paidClaimConnectionCode({name:'AbortError',message:'secret-token'});
 assert.equal(code,'653 / abort / S:network / T:ok');assert.equal(calls.length,2);
 for(const {url,opts} of calls){assert(url.endsWith('/rf/readiness'));assert.equal(opts.method,'GET');assert.equal(opts.credentials,'omit');assert(!opts.body&&!opts.headers);}
 assert(!code.includes('secret'));
});

test('fresh paid deep link outranks an expired token saved before startup',async()=>{
 const calls=[];const {c,store}=setup(async(u,o)=>{calls.push(JSON.parse(o.body).token);return {ok:false,status:410,json:async()=>({detail:'Ссылка устарела'})};});
 c.localStorage.getItem=k=>store.get(k);c.appStartParamRaw=()=> 'paid_'+'a'.repeat(24);
 store.set(c.PAID_TOKEN_KEY,'old-expired');
 const retry=html.slice(html.indexOf('function paidClaimRetryIfPending(){'),html.indexOf('/* Имя и ник с той площадки',html.indexOf('function paidClaimRetryIfPending(){')));
 vm.runInContext(retry,c);c.paidClaimRetryIfPending();
 await c.claimManualAccess('a'.repeat(24));
 assert.deepEqual(calls,['a'.repeat(24)]);assert.equal(store.size,0);
});

test('only a confirmed rendered access result closes the startup watchdog',async()=>{
 let marks=[];const {c}=setup(async()=>({ok:true,json:async()=>({status:'ok',is_member:true})}));c.ClubAppRescue={mark:x=>marks.push(x)};c.window.ClubAppRescue=c.ClubAppRescue;
 await c.claimManualAccess('one');assert.deepEqual(marks,['gate']);
 const b=setup(async()=>({ok:true,json:async()=>({})}));b.c.ClubAppRescue={mark:x=>marks.push(x)};b.c.window.ClubAppRescue=b.c.ClubAppRescue;
 await b.c.claimManualAccess('two');assert.deepEqual(marks,['gate']);
});
