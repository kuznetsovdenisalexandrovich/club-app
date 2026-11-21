/* ABORT_DIAGNOSTICS_V1: passive evidence; never retries, suppresses or controls media. */
(function(root){
  'use strict';
  const errors=new WeakMap(),recent=[];
  const ops=new Set(['unknown','media_play','media_pause','media_seek','media_source','media_close','fetch','api','visibility']);
  const files=new Set(['index.html','film-player.js','abort-diagnostics.js','client-diagnostics.js','player-diagnostics.js','quiz-recommendations.js','meeting-recordings.js','rf-parallel-transport.js']);
  let seq=0;
  const num=(v,max)=>Number.isFinite(v)?Math.max(0,Math.min(max,Math.round(v))):0;
  function abortDiagFrames(stack){
    const found=[];
    for(const match of String(stack||'').matchAll(/(?:https?:\/\/|file:\/\/\/)[^\s)]+/g)){
      const at=match[0].match(/^(.*):(\d+):(\d+)$/);if(!at)continue;
      try{const file=new URL(at[1]).pathname.split('/').pop();if(files.has(file)){found.push(file+':'+num(Number(at[2]),1000000)+':'+num(Number(at[3]),1000000));if(found.length===4)break;}}catch(e){}
    }
    return found;
  }
  function abortDiagState(video){
    if(!video)return {};
    return {position:num(video.currentTime,86400),ready:num(video.readyState,4),network:num(video.networkState,3),paused:!!video.paused};
  }
  function abortDiagRoute(url){
    try{const path=new URL(typeof url==='string'?url:url?.url||'',root.location?.href).pathname;
      return /^\/auth\//.test(path)?'auth':/^\/users\/me$/.test(path)?'profile':/^\/(?:media\/|learning\/media\/)/.test(path)?'media_manifest':/^\/(?:lectures|streams)(?:\/|$)/.test(path)?'catalog':/^\/(?:client|events|rf\/readiness)/.test(path)?'diagnostics':'other';
    }catch(e){return 'unknown';}
  }
  function abortDiagBegin(op,video,url){
    try{const item={id:seq=seq%1000000+1,op:ops.has(op)?op:'unknown',route:op==='api'||op==='fetch'?abortDiagRoute(url):'unknown',at:Date.now(),...abortDiagState(video),frames:abortDiagFrames(new Error().stack)};recent.push(item);if(recent.length>8)recent.shift();return item;}catch(e){return null;}
  }
  function abortDiagFail(error,ticket,cause='unknown'){
    try{if(ticket&&error&&(typeof error==='object'||typeof error==='function'))errors.set(error,{...ticket,failedAt:Date.now(),cause:['caller','deadline','interrupted','error'].includes(cause)?cause:'unknown'});}catch(e){}
  }
  function abortDiagScene(){
    const d=root.document;if(!d)return 'boot';
    for(const [id,name] of [['bonus-video-overlay','bonus'],['quiz-overlay','quiz'],['live-entry-overlay','meeting']])if(d.getElementById(id)?.classList.contains('open'))return name;
    if(d.getElementById('meeting-recording'))return 'meeting';
    for(const [id,name] of [['funnel-screen','film'],['live-full','meeting']]){const el=d.getElementById(id);if(el?.style.display&&el.style.display!=='none')return name;}
    for(const name of ['library','profile'])if(d.getElementById('view-'+name)?.classList.contains('active'))return name;
    return root.__APP_READY?'other':'boot';
  }
  function abortDiagSnapshot(error){
    try{
      const match=error&&(typeof error==='object'||typeof error==='function')?errors.get(error):null,now=Date.now();
      const compact=x=>({id:x.id,op:x.op,age:num(now-x.at,86400000),...(x.position!==undefined?{position:x.position,ready:x.ready,network:x.network,paused:x.paused}:{})});
      return {version:1,exact:!!match,scene:abortDiagScene(),op:match?.op||'unknown',route:match?.route||'unknown',cause:match?.cause||'unknown',id:match?.id||0,age:match?num(now-match.at,86400000):0,
        frames:abortDiagFrames(error?.stack),origin:match?.frames||[],recent:recent.filter(x=>now-x.at<30000).slice(-6).map(compact)};
    }catch(e){return null;}
  }
  function abortDiagDescribe(error){
    const s=abortDiagSnapshot(error);if(!s)return '';
    return 'trace1 '+s.scene+' '+(s.exact?'exact':'unattributed')+' '+s.op+'/'+s.route+' '+s.cause+' #'+s.id+' '+s.age+'ms\n'+
      'origin '+s.origin.join(',')+'; error '+s.frames.join(',')+'\n'+
      'attempt '+String(root.ClubClientDiagnostics?.parent()||'').replace(/[^a-f0-9-]/g,'').slice(0,40)+'\nrecent '+s.recent.map(x=>x.op+'#'+x.id+'@'+x.age+(x.position!==undefined?' p'+x.position+' r'+x.ready+' n'+x.network+(x.paused?' paused':''):'' )).join(';');
  }
  root.ClubAbortDiagnostics={begin:abortDiagBegin,fail:abortDiagFail,snapshot:abortDiagSnapshot,describe:abortDiagDescribe};
  // Capturing listeners observe native controls too; no preventDefault or play/pause calls.
  try{for(const [event,op] of [['play','media_play'],['pause','media_pause'],['seeking','media_seek'],['emptied','media_source']])root.document.addEventListener(event,e=>{
    try{if(e.target?.tagName==='VIDEO'&&e.target.closest('.native-film'))abortDiagBegin(op,e.target);}catch(ignore){}
  },true);}catch(e){}
})(window);
/* END_ABORT_DIAGNOSTICS_V1 */
