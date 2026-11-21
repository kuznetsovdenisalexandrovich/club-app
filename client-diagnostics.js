/* CLIENT_DIAGNOSTICS_V1: independent, anonymous, bounded, never blocks startup. */
(function(w,d){
 'use strict';
 if(!w.fetch||!w.AbortController)return;
 var fetcher=w.fetch.bind(w),endpoint='https://club-bot-production-2b38.up.railway.app/client-diagnostics';
 var queue=[],sent=0,total=0,busy=false,timer=null,checks=false,parent='',disabled=false;
 var resources=[],resourceSeen={},abortReports=0;
 try{disabled=new URLSearchParams(w.location.search).has('view');}catch(e){}
 function bounded(n,max){return Number.isFinite(n)?Math.max(0,Math.min(max,Math.round(n))):0;}
 function emit(fact){
  try{
   if(disabled||total>=40||!fact||!/^[a-f0-9-]{16,40}$/.test(fact.attempt||''))return;
   var isAbort=fact.kind==='javascript'&&fact.error==='AbortError';
   if(isAbort){if(abortReports>=4)return;abortReports++;}else if(total>=36)return;
   var item={attempt:fact.attempt,build:w.CLUB_BUILD_ID||'app-v0',kind:fact.kind,event:fact.event,at:Date.now(),visible:!d.hidden,online:!w.navigator||w.navigator.onLine!==false};
   ['elapsed','http','duration','position','buffer_ms','frames','line','column'].forEach(function(k){if(fact[k]!==undefined)item[k]=bounded(fact[k],k==='http'?599:k==='duration'?60000:k==='position'?86400:k==='frames'?100000000:k==='line'||k==='column'?1000000:86400000);});
   ['route','outcome','error','content'].forEach(function(k){if(fact[k])item[k]=fact[k];});
   if(fact.trace)item.trace=fact.trace;
   if(fact.marks)item.marks=fact.marks.filter(function(m){return /^(html|card_script|sdk|player_script|main|dom|settings|profile|guest|rendered|gate|content|scriptError)$/.test(m);}).slice(0,16);
   if(parent&&fact.attempt!==parent)item.parent=parent;
   queue.push(item);total++;if(queue.length>24)queue.shift();
   if(!timer)timer=setTimeout(flush,400);
  }catch(e){}
 }
 function flush(){
  timer=null;if(disabled||busy||!queue.length||sent>=12)return;
  busy=true;sent++;
  var batch=queue.slice(0,12),ctrl=new w.AbortController(),timeout=setTimeout(function(){ctrl.abort();},4000);
  fetcher(endpoint,{method:'POST',headers:{'Content-Type':'text/plain'},credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',keepalive:true,signal:ctrl.signal,body:JSON.stringify({records:batch})}).then(function(r){if(r.ok)queue=queue.filter(function(x){return batch.indexOf(x)<0;});}).catch(function(){}).then(function(){clearTimeout(timeout);busy=false;if(queue.length&&sent<12&&!timer)timer=setTimeout(flush,2000);});
 }
 function probe(){
  if(disabled||checks||!parent)return;checks=true;
  [['selectel_api','https://selectel-api.youselllikeagod-magazine.ru/rf/readiness'],['selectel_bot','https://selectel-api.youselllikeagod-magazine.ru/club-bot/health'],['railway',endpoint+'/ping']].forEach(function(plan){
   var began=Date.now(),ctrl=new w.AbortController(),expired=false;
   var timeout=setTimeout(function(){expired=true;ctrl.abort();},3500);
   fetcher(plan[1],{signal:ctrl.signal,credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer'}).then(function(r){
    return r.text().then(function(){return {http:r.status,outcome:r.ok?'ok':'http'};});
   }).catch(function(){return {http:0,outcome:expired?'timeout':'network'};}).then(function(result){
    clearTimeout(timeout);emit(Object.assign({attempt:parent,kind:'probe',event:'check',route:plan[0],duration:Date.now()-began},result));
   });
  });
 }
 function reportResources(){
  if(typeof w.__reportError!=='function')return;
  resources.splice(0).forEach(function(name){try{w.__reportError('Не загрузился ресурс приложения: '+name,'','resource_load');}catch(e){}});
 }
 function resourceName(target){
  if(!target||!/^SCRIPT$|^LINK$/.test(target.tagName||''))return '';
  try{var url=new URL(target.src||target.href,w.location.href),name=url.pathname.split('/').pop();
   // Fixed labels only: never transmit media IDs, query strings or signed URLs.
   if(url.hostname==='play.boomstream.com'&&url.pathname==='/assets/javascripts/biframesdk.js')return 'boomstream_sdk';
   if(url.hostname==='play.boomstream.com'&&/^\/[^/]+\/config\.jsonp$/.test(url.pathname))return 'boomstream_config';
   if(url.hostname==='player.kinescope.io'&&url.pathname==='/latest/iframe.player.js')return 'kinescope_sdk';
   if(/^hls-[\d.]+\.min\.js$/.test(name))return 'hls_js';
   if(!/^(telegram-web-app\.js|vk-bridge(?:\.min)?\.js|card-motion\.js|personal-digest\.js|exit-presence\.js|knowledge-quizzes\.js|game-sharing\.js|sales-timer\.js|film-player\.js|player-diagnostics\.js|meeting-recordings\.(?:js|css))$/.test(name))name='other_'+target.tagName.toLowerCase();
   return name;
  }catch(e){return 'unknown_resource';}
 }
 w.ClubClientDiagnostics={reportResources:reportResources,emit:emit,probe:probe,bind:function(id){parent=id;},parent:function(){return parent;}};
 function error(event,rejection){
  if(disabled)return;
  var resource=!rejection&&event.target&&event.target!==w;
  if(resource){var asset=resourceName(event.target);if(asset&&!resourceSeen[asset]&&Object.keys(resourceSeen).length<4){resourceSeen[asset]=true;resources.push(asset);reportResources();}}
  if(!parent)return;
  var value=rejection?event.reason:event.error,name=value&&value.name;
  emit({attempt:parent,kind:'javascript',event:resource?'resource':rejection?'rejection':'error',error:/^(TypeError|ReferenceError|SyntaxError|RangeError|AbortError|Error)$/.test(name||'')?name:'unknown',line:event.lineno,column:event.colno,...(name==='AbortError'&&w.ClubAbortDiagnostics?{trace:w.ClubAbortDiagnostics.snapshot(value)}:{})});
 }
 w.addEventListener('error',function(e){error(e,false);},true);
 w.addEventListener('unhandledrejection',function(e){error(e,true);});
 w.addEventListener('online',flush);
 w.addEventListener('pagehide',function(){if(timer)clearTimeout(timer);flush();});
})(window,document);
/* END_CLIENT_DIAGNOSTICS_V1 */
