/* Bounded, URL-free player telemetry. A failed report must never stop playback. */
(function(root){
  'use strict';
  const probeFetch=root.fetch&&root.fetch.bind(root); // Captured before app failover wrappers.
  root.clubMediaServer=function(url){
    try{const host=new URL(url).hostname;
      if(host==='selectel-api.youselllikeagod-magazine.ru'||host==='api.youselllikeagod-magazine.ru')return 'selectel';
      if(host==='reserve-api.youselllikeagod-magazine.ru'||host.endsWith('.twc1.net'))return 'timeweb';
      if(host.endsWith('.up.railway.app'))return 'railway';return 'other';
    }catch(e){return 'unknown';}
  };
  // Snapshots contain enums/numbers only. Signed URLs remain inside the browser.
  root.clubVideoEvidence=function(video,source,lastProgress){
    const out={online:typeof navigator==='undefined'||navigator.onLine!==false};
    try{
      const url=new URL(source?.url||'');
      const host=mediaHost(url.href);
      out.delivery=['selectel_storage','railway_storage'].includes(host)?'direct':/^\/media\/(?:bonus-)?hls\//.test(url.pathname)?(url.searchParams.get('direct')==='1'?'direct':'proxy'):'unknown';
      if(['selectel_storage','railway_storage'].includes(host))out.media_server=host;
      if(out.delivery==='direct'&&['selectel_storage','railway_storage','other'].includes(source.storage))out.media_server=source.storage;
      const id=url.pathname.match(/\/([a-f0-9]{32})\/([a-f0-9]{16})\//);
      if(id){out.asset=id[1];out.release=id[2];}
    }catch(e){}
    if(!video)return out;
    out.paused=!!video.paused;out.seeking=!!video.seeking;
    out.video_height=Math.min(10000,Math.max(0,video.videoHeight||0));
    out.since_progress_ms=lastProgress?Math.min(86400000,Math.max(0,Date.now()-lastProgress)):0;
    try{
      out.buffer_ms=0;
      for(let i=0;i<Math.min(video.buffered.length,32);i++)if(video.buffered.start(i)<=video.currentTime&&video.buffered.end(i)>video.currentTime){out.buffer_ms=Math.min(86400000,Math.round((video.buffered.end(i)-video.currentTime)*1000));break;}
      const q=video.getVideoPlaybackQuality?.();
      if(q){out.frames=Math.min(100000000,Math.max(0,q.totalVideoFrames||0));out.dropped=Math.min(100000000,Math.max(0,q.droppedVideoFrames||0));}
    }catch(e){}
    return out;
  };
  function mediaHost(url){
    try{const host=new URL(url).hostname;
      if(host.endsWith('.storage.selcloud.ru'))return 'selectel_storage';
      if(host==='t3.storageapi.dev'||host.endsWith('.t3.storageapi.dev'))return 'railway_storage';
      return root.clubMediaServer(url);
    }catch(e){return 'unknown';}
  }
  root.clubMediaStorage=mediaHost;
  function allowedMedia(url){
    try{const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password&&['selectel','timeweb','railway','selectel_storage','railway_storage'].includes(mediaHost(url));}catch(e){return false;}
  }
  // One comparison after final failure, never on the healthy playback path.
  // Samples 360p at the saved position; it is NOT the native player's HTTP result.
  root.clubProbeVideo=async function(source,position,emit){
    if(!source?.lowUrl||!allowedMedia(source.lowUrl)||!probeFetch||!root.AbortController)return;
    const original=new URL(source.lowUrl);
    if(!/^\/media\/(?:bonus-)?hls\/[a-f0-9]{32}\/[a-f0-9]{16}\/[01]\/360\/index\.m3u8$/.test(original.pathname))return;
    const plans=[original];
    if(original.searchParams.get('direct')==='1'){const proxy=new URL(original);proxy.searchParams.delete('direct');plans.push(proxy);}
    for(const plan of plans){
      let phase='playlist',http=0,bytes=0,server=mediaHost(plan.href),result='network';
      const start=Date.now(),ctrl=new root.AbortController();let timedOut=false;
      const timer=setTimeout(()=>{timedOut=true;ctrl.abort();},5000);
      async function get(url,playlist){
        if(!allowedMedia(url))throw Error('unsupported');
        server=mediaHost(url);
        const response=await probeFetch(url,{credentials:'omit',signal:ctrl.signal,cache:'no-store',redirect:'error'});
        http=response.status;
        if(!response.ok){result='http';if(response.body)response.body.cancel().catch(()=>{});throw Error('http');}
        if(!response.body?.getReader){result='unsupported';throw Error('unsupported');}
        const reader=response.body.getReader();let data='',size=0;
        try{
          const decoder=playlist?new TextDecoder():null;
          while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;
            if(playlist){if(size>524288){result='oversize';throw Error('oversize');}data+=decoder.decode(part.value,{stream:true});}
            else if(size>=16384)break;
          }
          if(decoder)data+=decoder.decode();bytes=size;return data;
        }finally{reader.cancel().catch(()=>{});}
      }
      try{
        const playlist=await get(plan.href,true);let cursor=0,duration=0,segment='';
        for(const line of playlist.split(/\r?\n/)){
          if(line.startsWith('#EXTINF:'))duration=Number(line.slice(8).split(',')[0])||0;
          else if(line&&!line.startsWith('#')){if(!segment||cursor<=position)segment=new URL(line,plan).href;cursor+=duration;if(cursor>position)break;}
        }
        if(!segment){result='invalid_playlist';throw Error('playlist');}
        phase='segment';http=0;bytes=0;await get(segment,false);result=bytes>0?'ok':'empty';
      }catch(e){if(timedOut)result='timeout';else if(e.message==='unsupported')result='unsupported';}
      finally{clearTimeout(timer);ctrl.abort();}
      try{emit({event:'probe',reason:'sample_360',quality:'360',delivery:plan.searchParams.get('direct')==='1'?'direct':'proxy',probe_phase:phase,probe_result:result,probe_ms:Math.min(60000,Math.max(0,Date.now()-start)),probe_bytes:Math.min(1048576,bytes),media_server:server,http});}catch(e){}
    }
  };

  root.clubPlayerDiagnostics=function(content,endpoint,build,identity,managedRescue){
    const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
    const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
    const attempt=[hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-'),started=Date.now();
    let seq=0,queue=[],busy=false,timer=null,closed=false,retries=0,legacySchema=false;
    async function flush(){
      if(busy||!queue.length)return;
      busy=true;const batch=queue.slice(0,20);
      const controller=new AbortController(),deadline=setTimeout(()=>controller.abort(),5000);
      try{
        async function send(){
          let events=batch;
          if(legacySchema){
            const allowed=['seq','elapsed','event','source','server','engine','reason','http','media','ready','network','position','visible','fatal','quality'];
            events=batch.filter(e=>!['probe','milestone'].includes(e.event)).map(e=>Object.fromEntries(Object.entries(e).filter(([key])=>allowed.includes(key))));
            if(!events.length)return {ok:true};
          }
          return fetch(endpoint()+'/client/player-diagnostics',{method:'POST',headers:{'Content-Type':'application/json'},
            body:JSON.stringify({attempt,content,managed_rescue:!!(managedRescue&&managedRescue()),tg_init:identity?String(identity()||''):'',build:String(build).match(/v[0-9]+/)?.[0]||'unknown',events}),keepalive:true,signal:controller.signal});
        }
        let r=await send();if(r.status===422&&!legacySchema){legacySchema=true;r=await send();}
        if(!r.ok)throw Error('report');
        const accepted=new Set(batch.map(e=>e.seq));queue=queue.filter(e=>!accepted.has(e.seq));retries=0;
      }catch(e){retries++;}finally{clearTimeout(deadline);busy=false;if(queue.length&&retries<3)timer=setTimeout(flush,2000);}
    }
    function environment(){
      try{
        const n=root.navigator||{},ua=n.userAgent||'',platform=root.Telegram?.WebApp?.platform||'';
        return {os:/iPhone|iPad|iPod/.test(ua)||(/Macintosh/.test(ua)&&n.maxTouchPoints>1)?'ios':/Android/.test(ua)?'android':/Windows/.test(ua)?'windows':/Macintosh/.test(ua)?'macos':'other',
          shell:['ios','android','android_x','tdesktop','macos','web','weba','webk'].includes(platform)?platform:'unknown',online:n.onLine!==false};
      }catch(e){return {};}
    }
    function emit(data){
      if(data.event==='closed'){closed=true;root.removeEventListener('pagehide',leave);}
      if(seq>=120||(seq>=118&&!['closed','unavailable','recovered'].includes(data.event)))return;
      queue.push({...environment(),...data,seq:++seq,elapsed:Math.max(0,Math.min(86400000,Date.now()-started))});
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
