/* Full-app RF transport. Enable only with the parallel journal runtime. */
(function(root){
'use strict';
function createRFParallelTransport(config){
  const fetcher=config.fetch || root.fetch.bind(root);
  const endpoints=config.endpoints;
  if (!Array.isArray(endpoints)||endpoints.length!==2||new Set(endpoints).size!==2) throw Error('Two distinct endpoints required');
  endpoints.forEach(x=>{const u=new URL(x);if(u.pathname!=='/'||u.search||u.hash||u.username||u.password||(!config.isolated && u.protocol!=='https:'))throw Error('Invalid endpoint');});
  const timeout=config.timeoutMs || 3500;
  let active=0, streak=0, returnBarrier=0;
  const storage=config.storage;const storageKey='club_rf_parallel_route_v2';
  try{const saved=JSON.parse(storage.getItem(storageKey)||'null');if(saved&&[0,1].includes(saved.active)&&Number.isSafeInteger(saved.returnBarrier)&&saved.returnBarrier>=0){active=saved.active;returnBarrier=saved.returnBarrier;}}catch(e){}
  function persist(){try{storage.setItem(storageKey,JSON.stringify({active,returnBarrier}));}catch(e){}}
  async function timed(url,options,healthIndex=null){
    const controller=new AbortController();
    const parent=options && options.signal;
    if(parent && parent.aborted)throw new DOMException('Aborted','AbortError');
    const abort=()=>controller.abort();
    if(parent)parent.addEventListener('abort',abort,{once:true});
    let timer,done=false;
    const started=Date.now();
    const check=async()=>{
      if(done)return;
      if(healthIndex===null || Date.now()-started>=(config.requestTimeoutMs||120000))return abort();
      const alive=await readiness(healthIndex);
      if(done)return;
      if(!alive)return abort();
      timer=setTimeout(check,timeout);
    };
    timer=setTimeout(check,timeout);
    try{
      const raw=await fetcher(url,{...options,signal:controller.signal});
      // JSON is consumed by every API caller. Keep cancellation/deadlines alive
      // until its body arrives, not just until HTTP headers arrive.
      if(!/\bapplication\/(?:[a-z0-9.-]+\+)?json\b/i.test(raw.headers.get('content-type')||''))return raw;
      const bytes=await raw.arrayBuffer();
      const response=new Response([204,205,304].includes(raw.status)||(options.method||'GET').toUpperCase()==='HEAD'?null:bytes,
        {status:raw.status,statusText:raw.statusText,headers:raw.headers});
      Object.defineProperty(response,'url',{value:raw.url});
      return response;
    }
    finally{done=true;clearTimeout(timer);if(parent)parent.removeEventListener('abort',abort);}
  }
  const healthPending=[null,null];
  function readiness(index){
    if(healthPending[index])return healthPending[index];
    healthPending[index]=(async()=>{
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
      try{
        const r=await fetcher(endpoints[index]+'/rf/readiness',{cache:'no-store',redirect:'error',signal:controller.signal});
        if(!r.ok)return null;
        const d=await r.json();
        return d.protocol===2 && d.ready===true && d.node===['selectel','timeweb'][index] && Number.isSafeInteger(d.own_seq) && Number.isSafeInteger(d.peer_seq) ? d : null;
      }catch(e){return null;}
      finally{clearTimeout(timer);}
    })().finally(()=>{healthPending[index]=null;});
    return healthPending[index];
  }
  function remember(response,index){
    const seq=Number(response.headers.get('x-rf-own-seq'));
    if(index===1 && Number.isSafeInteger(seq)&&seq>=0){returnBarrier=Math.max(returnBarrier,seq);persist();}
  }
  // Race only catalogue/bootstrap reads. Writes keep the serial idempotent path.
  function fastRead(path,method){
    return ['GET','HEAD'].includes(method) && (/^\/(?:settings|app-texts|streams(?:\/[^/]+\/lectures)?|lectures(?:\/[^/]+)?|media\/(?:film|onboarding))(?:\?|$)/.test(path));
  }
  async function hedgedRead(path,options,headers){
    const origin=active,target=1-origin;
    const controller=new AbortController(),parent=options.signal;
    if(parent&&parent.aborted)throw new DOMException('Aborted','AbortError');
    let timer,deadline,finished=false,otherStarted=false,completed=0,lastResponse,lastError;
    return await new Promise((resolve,reject)=>{
      const finish=(response,error,index)=>{
        if(finished)return;finished=true;clearTimeout(timer);clearTimeout(deadline);
        if(parent)parent.removeEventListener('abort',abort);controller.abort();
        if(response){remember(response,index);if(![425,502,503,504].includes(response.status)&&active!==index){active=index;streak=0;persist();if(config.onSwitch)config.onSwitch(active);}resolve(response);}
        else reject(error||new Error('Both API nodes unavailable'));
      };
      const abort=()=>finish(null,new DOMException('Aborted','AbortError'));
      if(parent)parent.addEventListener('abort',abort,{once:true});
      const fail=()=>{if(++completed===2)finish(lastResponse,lastError,lastResponse?lastResponse.__rfIndex:origin);};
      const send=async index=>{
        try{
          const h=new Headers(headers);
          if(index===0&&returnBarrier)h.set('x-rf-min-timeweb',String(returnBarrier));else h.delete('x-rf-min-timeweb');
          const raw=await fetcher(endpoints[index]+path,{...options,headers:h,redirect:'error',signal:controller.signal});
          const bytes=await raw.arrayBuffer();
          const r=new Response([204,205].includes(raw.status)||(options.method||'GET')==='HEAD'?null:bytes,{status:raw.status,statusText:raw.statusText,headers:raw.headers});
          Object.defineProperty(r,'url',{value:raw.url});
          if(finished)return;
          if(![425,502,503,504].includes(r.status))return finish(r,null,index);
          lastResponse=r;lastResponse.__rfIndex=index;
        }catch(e){lastError=e;}
        if(!finished){fail();startOther();}
      };
      const startOther=async()=>{
        if(otherStarted||finished)return;otherStarted=true;
        const ready=await readiness(target);
        if(finished)return;
        if(!ready||(target===0&&ready.peer_seq<returnBarrier)){fail();return;}
        send(target);
      };
      deadline=setTimeout(abort,config.readTimeoutMs||7000);
      timer=setTimeout(startOther,config.hedgeMs||900);
      send(origin);
    });
  }
  async function request(input,options={}){
    if(input instanceof URL)input=input.href;
    if(typeof Request!=='undefined' && input instanceof Request){
      const request=new Request(input,options);
      options={method:request.method,headers:request.headers,mode:request.mode,
        credentials:request.credentials,cache:request.cache,referrer:request.referrer,
        referrerPolicy:request.referrerPolicy,integrity:request.integrity,
        keepalive:request.keepalive,signal:request.signal,
        body:['GET','HEAD'].includes(request.method)?undefined:await request.clone().blob()};
      input=request.url;
    }
    if(typeof input!=='string' || !/^https?:\/\//i.test(input))return fetcher(input,options);
    const u=new URL(input);
    if(!endpoints.includes(u.origin) && !(config.aliases||[]).includes(u.origin))return fetcher(input,options);
    const method=(options.method||'GET').toUpperCase();
    const headers=new Headers(options.headers||{});
    if(config.identity){const identity=config.identity();if(identity.tg_init)headers.set("x-rf-tg-init",identity.tg_init);if(identity.vk_query)headers.set("x-rf-vk-query",identity.vk_query);}
    const mutation=!['GET','HEAD','OPTIONS'].includes(method);
    if(mutation&&!headers.has('Idempotency-Key')){
      if(!root.crypto||!root.crypto.randomUUID)throw Error('Secure operation ID unavailable');
      headers.set('Idempotency-Key',root.crypto.randomUUID());
    }
    const retry=true;
    const path=u.pathname+u.search;
    const send=async i=>{if(i===0&&returnBarrier)headers.set('x-rf-min-timeweb',String(returnBarrier));else headers.delete('x-rf-min-timeweb');const r=await timed(endpoints[i]+path,{...options,headers,redirect:'error'},i);remember(r,i);return r;};
    if(fastRead(path,method))return hedgedRead(path,options,headers);
    const original=active;

    let response,error;
    try{response=await send(original);if(![425,502,503,504].includes(response.status))return response;}
    catch(e){error=e;if(options.signal&&options.signal.aborted)throw e;}
    // A checkout may still be running after a lost response. Only 425 proves
    // rejection before execution; provider retries belong to the server alone.
    if(method==='POST' && ['/payments/checkouts','/nurture/offers/checkout'].includes(u.pathname) && (!response || response.status!==425)){
      if(error)throw error;return response;
    }
    if(!retry){if(error)throw error;return response;}
    const target=1-original;
    const ready=await readiness(target);
    // Returning requires a positive proof that the primary includes reserve writes.
    if(!ready || (target===0 && ready.peer_seq<returnBarrier)) {if(error)throw error;return response;}
    const next=await send(target);
    if(![425,502,503,504].includes(next.status)){active=target;streak=0;persist();if(config.onSwitch)config.onSwitch(active);}
    return next;
  }
  let returning=false;
  async function considerReturn(){
    if(returning)return false;
    returning=true;
    try{
    if(active!==1)return false;
    const reserve=await readiness(1);
    if(reserve){returnBarrier=Math.max(returnBarrier,reserve.own_seq);persist();}
    const primary=await readiness(0);
    if(!primary||primary.peer_seq<returnBarrier){streak=0;return false;}
    if(++streak<3)return false;
    active=0;streak=0;persist();if(config.onSwitch)config.onSwitch(active);return true;
    }finally{returning=false;}
  }
  return {request,considerReturn,state:()=>({active:['selectel','timeweb'][active],returnBarrier})};
}
if(typeof module==='object'&&module.exports)module.exports={createRFParallelTransport};
else root.createRFParallelTransport=createRFParallelTransport;
})(typeof globalThis==='object'?globalThis:this);

(function(){
 if(window.__rfTransport)return;
 const transport=createRFParallelTransport({
  endpoints:['https://selectel-api.youselllikeagod-magazine.ru','https://kuznetsovdenisalexandrovich-club-backend-3c7e.twc1.net'],
  aliases:['https://api.youselllikeagod-magazine.ru','https://reserve-api.youselllikeagod-magazine.ru','https://club-backend-production-fc7f.up.railway.app'],
  fetch:window.fetch.bind(window),storage:(()=>{try{return localStorage;}catch(e){return null;}})()
 });
 window.__rfTransport=transport;window.fetch=transport.request;
 setInterval(()=>transport.considerReturn().catch(()=>{}),5000);
})();
