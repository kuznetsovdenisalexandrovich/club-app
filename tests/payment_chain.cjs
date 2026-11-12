const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),test=require('node:test');
const html=fs.readFileSync(require('path').join(__dirname,'../index.html'),'utf8');
const external=fs.readFileSync(require('path').join(__dirname,'../rf-parallel.js'),'utf8');
const core=external.slice(external.indexOf('(function(root){'),external.indexOf(';',external.indexOf('})(typeof globalThis'))+1);
const a=html.lastIndexOf('(function(root){',html.indexOf('function createRFParallelTransport')),b=html.indexOf('})(typeof globalThis',a);
assert.equal(html.slice(a,html.indexOf(';',b)+1).trim(),core.trim());
function setup(mode,platform='telegram'){
 const calls=[],records=new Map();let provider=0;
 const c={module:{exports:{}},URL,URLSearchParams,Request,Response,Headers,AbortController,DOMException,setTimeout,clearTimeout,Date,Map,crypto:require('crypto').webcrypto};vm.createContext(c);vm.runInContext(core,c);
 const fake=async(url,opt)=>{
   calls.push({url,opt});
   if(url.includes('readiness'))return new Response(JSON.stringify({protocol:2,ready:true,node:'timeweb',own_seq:5,peer_seq:5}));
   if(mode==='lost')throw new TypeError('network');
   if(mode==='route'&&url.includes('primary'))return new Response('{}',{status:425});
   const p=JSON.parse(opt.body);provider++;
   if(mode==='provider')return new Response('{}',{status:502});
   return new Response(JSON.stringify({platform,platform_user_id:'99',request_id:p.request_id,plan:p.plan,source:'app',status:'pending',checkout_id:'ck',payment_url:'https://demo.payform.ru/link',expires_at:new Date(Date.now()+3600000).toISOString()}),{status:201});
 };
 const transport=c.module.exports.createRFParallelTransport({endpoints:['https://primary.test','https://reserve.test'],fetch:fake});
 Object.assign(c,{fetch:transport.request,API_URL:'https://primary.test',ivIdent:()=>platform==='telegram'?{tg_init:'signed'}:{vk_query:'signed'},telegramId:99,vkUserId:()=>99,localStorage:{getItem:k=>records.get(k),setItem:(k,v)=>records.set(k,v),removeItem:k=>records.delete(k)}});
 vm.runInContext(html.slice(html.indexOf('function personalPaymentIdentity(){'),html.indexOf('async function openAccessPage')),c);
 return {c,calls,provider:()=>provider};
}
for(const platform of ['telegram','vk'])test(platform+': only selected tariff is created, explicit repeat keeps its key',async()=>{
 const s=setup('ok',platform);assert((await s.c.personalPaymentLinks('monthly')).monthly_link);await s.c.personalPaymentLinks('monthly');
 const bodies=s.calls.map(x=>JSON.parse(x.opt.body));assert.deepEqual(bodies.map(x=>x.plan),['monthly','monthly']);assert.equal(bodies[0].request_id,bodies[1].request_id);
});
test('provider 502 is not replayed on second node',async()=>{const s=setup('provider');await assert.rejects(s.c.personalPaymentLinks('monthly'));assert.equal(s.provider(),1);assert.equal(s.calls.length,1);});
test('ambiguous network result is not automatically replayed',async()=>{const s=setup('lost');await assert.rejects(s.c.personalPaymentLinks('monthly'));assert.equal(s.calls.length,1);});
test('425 rejection before execution can safely use reserve',async()=>{const s=setup('route');assert((await s.c.personalPaymentLinks('monthly')).monthly_link);assert.equal(s.provider(),1);assert.equal(s.calls.filter(x=>x.url.includes('checkouts')).length,2);});
test('payment screen makes no order until selection and suppresses double clicks',async()=>{
 const c=setup('ok').c,status={textContent:'',innerHTML:''},el={innerHTML:''},buttons=[{},{}];let finish,calls=0,opened=0;
 Object.assign(c,{window:{},document:{getElementById:id=>id==='server-payment-status'?status:el,querySelectorAll:()=>buttons},personalPaymentLinks:()=>{calls++;return new Promise(r=>finish=r)},goToPayment:()=>opened++,accessLinksErrorHtml:()=>'<button>Help</button>'});
 vm.runInContext(html.slice(html.indexOf('let serverPaymentBusy='),html.indexOf('function renderAccessButtons(result)')),c);
 c.renderServerPaymentChoices();assert.equal(calls,0);assert(el.innerHTML.includes('monthly'));
 const pending=c.chooseServerPayment('monthly');await c.chooseServerPayment('monthly');assert.equal(calls,1);assert(buttons.every(b=>b.disabled));finish({monthly_link:'https://demo.payform.ru/link'});await pending;assert.equal(opened,1);assert(buttons.every(b=>!b.disabled));
 c.personalPaymentLinks=async()=>{throw Error('provider')};await c.chooseServerPayment('lifetime');assert.equal(opened,1);assert(status.innerHTML.includes('Help'));assert(el.innerHTML.includes('monthly'));
});
