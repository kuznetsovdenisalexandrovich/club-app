/* Bounded, URL-free player telemetry. A failed report must never stop playback. */
(function(root){
  'use strict';
  root.clubMediaServer=function(url){
    try{const host=new URL(url).hostname;
      if(host==='selectel-api.youselllikeagod-magazine.ru'||host==='api.youselllikeagod-magazine.ru')return 'selectel';
      if(host==='reserve-api.youselllikeagod-magazine.ru'||host.endsWith('.twc1.net'))return 'timeweb';
      if(host.endsWith('.up.railway.app'))return 'railway';return 'other';
    }catch(e){return 'unknown';}
  };
  root.clubPlayerDiagnostics=function(content,endpoint,build,identity){
    const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
    const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
    const attempt=[hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-'),started=Date.now();
    let seq=0,queue=[],busy=false,timer=null,closed=false,retries=0;
    async function flush(){
      if(busy||!queue.length)return;
      busy=true;const batch=queue.slice(0,20);
      const controller=new AbortController(),deadline=setTimeout(()=>controller.abort(),5000);
      try{
        const r=await fetch(endpoint()+'/client/player-diagnostics',{method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({attempt,content,tg_init:identity?String(identity()||''):'',build:String(build).match(/v[0-9]+/)?.[0]||'unknown',events:batch}),keepalive:true,signal:controller.signal});
        if(!r.ok)throw Error('report');
        const accepted=new Set(batch.map(e=>e.seq));queue=queue.filter(e=>!accepted.has(e.seq));retries=0;
      }catch(e){retries++;}finally{clearTimeout(deadline);busy=false;if(queue.length&&retries<3)timer=setTimeout(flush,2000);}
    }
    function emit(data){
      if(data.event==='closed'){closed=true;root.removeEventListener('pagehide',leave);}
      if(seq>=120||(seq>=118&&!['closed','unavailable','recovered'].includes(data.event)))return;
      queue.push({...data,seq:++seq,elapsed:Math.max(0,Math.min(86400000,Date.now()-started))});
      if(queue.length>40)queue.shift();
      clearTimeout(timer);timer=setTimeout(flush,250);
      if(data.event==='closed')flush();
    }
    function leave(){if(!closed)emit({event:'closed',reason:'pagehide'});}
    root.addEventListener('pagehide',leave);
    emit({event:'attempt'});
    return emit;
  };
})(window);
