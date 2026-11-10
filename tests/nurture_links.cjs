const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync('index.html','utf8');
const blocks=[...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(x=>x[1]);
const main=blocks.find(x=>x.includes('async function resolveNurtureStart(){'));
assert(main.includes('function ivIdent(){'),'Launch identity must be declared in the same script as nurture startup');
assert.equal(blocks.filter(x=>x.includes('function ivIdent(){')).length,1);
const funcs=html.slice(html.indexOf('async function resolveNurtureStart'),html.indexOf('function track(event'));
const param=html.slice(html.indexOf('function appStartParam(){'),html.indexOf('function sendSellerTouch'));
(async()=>{
 for(const target of ['film','nl_tg_club_1234567890123456_nurt','la_funnels_p01_l01_lecture','pay_tg_pain','promo_film-day10-month','namedfilm_v123','sb-demo_bot-s7-film']){
  let requests=0;const c={nurtureOfferSignal:async()=>({}),window:{},sellerTouch:null,raw:'nt_'+'a'.repeat(32)+'_0',API_URL:'https://api.test',appStartParamRaw(){return this.raw},ivIdent:()=>({tg_init:'signed'}),isInsideVk:()=>false,vkLaunchQuery:()=>'',showToast:()=>{},apiRequest:async(url,o)=>{requests++;assert.equal(JSON.parse(o.body).tg_init,'signed');return {target,tracked:true,token:'a'.repeat(32)}}};
  c.appStartParamRaw=()=>c.raw;vm.createContext(c);vm.runInContext(funcs+param,c);
  assert(await c.resolveNurtureStart());assert.equal(c.appStartParam(),/^(namedfilm_|sb-)/.test(target)?'film':target);assert(await c.resolveNurtureStart());assert.equal(requests,1);
  assert.equal(c.nurtureEventToken('member_pay_click',''),'a'.repeat(32));
  if(target.startsWith('la_')){assert.equal(c.nurtureEventToken('lecture_view','different'),'');assert.equal(c.nurtureEventToken('lecture_view','funnels_p01_l01_lecture'),'a'.repeat(32))}
 }
 const c={window:{},appStartParamRaw:()=> 'film'};vm.createContext(c);vm.runInContext(funcs,c);assert(await c.resolveNurtureStart());assert.equal(c.nurtureEventToken('sales_video','funnel'),'');
 console.log('PASS tracked TG/VK-compatible targets, source preservation, single resolution, content scope, ordinary entry isolation');
})();
