/* BOT_DIRECT_TRANSPORT_V1: inline before rescue; no SDK or DNS failover. */
(function(root){
'use strict';
function createClubBotTransport(fetcher,config={}){
 const bases=config.bases||['https://selectel-api.youselllikeagod-magazine.ru/club-bot','https://kuznetsovdenisalexandrovich-club-bot-9e57.twc1.net'];
 const health=config.health||[bases[0]+'/health',bases[1]+'/'];
 const canonical='https://bot.youselllikeagod-magazine.ru';
 let selected=null,pending=null,verifiedAt=0;
 function pathOf(input){
  const raw=typeof input==='string'?input:input&&input.url||String(input);
  const u=new URL(raw,root.location&&root.location.href||canonical);
  if(u.origin!==canonical||!u.pathname.startsWith('/content/'))return null;
  return u.pathname+u.search;
 }
 async function probe(i){
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),config.probeMs||5000);
  try{
   const r=await fetcher(health[i],{signal:ctrl.signal,cache:'no-store',credentials:'omit',redirect:'error'});
   if(!r.ok)throw Error('Bot unavailable');
   const d=await r.json();
   if(d.service!=='club-bot'||d.role!=='main'||d.db_ok!==true)throw Error('Bot not ready');
   return i;
  }finally{clearTimeout(timer);}
 }
 async function choose(){
  if(selected!==null&&Date.now()-verifiedAt<1000)return selected;
  if(!pending)pending=Promise.any([probe(0),probe(1)]).then(i=>{selected=i;verifiedAt=Date.now();return i;}).finally(()=>{pending=null;});
  return pending;
 }
 async function request(input,options={}){
  const path=pathOf(input);
  if(path===null)return fetcher(input,options);
  // Preserve Request bodies and cancellation; never send a write twice.
  if(typeof Request!=='undefined'&&input instanceof Request){
   const r=new Request(input,options);
   options={method:r.method,headers:r.headers,credentials:r.credentials,cache:r.cache,keepalive:r.keepalive,signal:r.signal,
    body:['GET','HEAD'].includes(r.method)?undefined:await r.clone().blob()};
  }
  const signal=options.signal;
  if(signal&&signal.aborted)throw new DOMException('Aborted','AbortError');
  const i=await choose();
  if(signal&&signal.aborted)throw new DOMException('Aborted','AbortError');
  try{
   const r=await fetcher(bases[i]+path,{...options,redirect:'error'});
   if(r.status>=500){selected=null;verifiedAt=0;}
   return r;
  }catch(e){selected=null;verifiedAt=0;throw e;}
 }
 // Signed PDF links are navigations, not fetches. Keep their token and path;
 // only an explicitly allowed content link can be mapped to the verified node.
 async function directLink(input){
  const path=pathOf(input);if(path===null||!path.startsWith('/content/pdf/'))throw Error('Unexpected download');
  return bases[await choose()]+path;
 }
 return {request,directLink};
}
if(typeof module==='object'&&module.exports)module.exports={createClubBotTransport};
else {root.createClubBotTransport=createClubBotTransport;const t=createClubBotTransport(root.fetch.bind(root));root.clubBotTransport=t;root.fetch=t.request;}
})(typeof window==='object'?window:globalThis);
/* END_BOT_DIRECT_TRANSPORT_V1 */
