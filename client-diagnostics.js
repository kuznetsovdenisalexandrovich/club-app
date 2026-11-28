/* CLIENT_DIAGNOSTICS_V1: independent, anonymous, bounded, never blocks startup. */
(function(w,d){
 'use strict';
 if(!w.fetch||!w.AbortController)return;
 var fetcher=w.fetch.bind(w),endpoint='https://club-bot-production-2b38.up.railway.app/client-diagnostics';
 var queue=[],sent=0,total=0,busy=false,timer=null,checks=false,parent='',disabled=false;
 var resources=[],resourceSeen={},resourceFacts=[],abortReports=0;
 var knownResources=["abort-diagnostics.js", "account.css", "account.js", "boomstream-sdk.js", "bot-transport.js", "card-motion.js", "client-diagnostics.js", "exit-presence.js", "film-player.js", "game-messenger.css", "game-sharing.js", "guest-experiment.css", "guest-experiment.js", "ignore-game-core.js", "ignore-game-ui.js", "images/bonuses/backstage.jpg", "images/bonuses/masterclass.jpg", "images/card/divider-light.png", "images/card/divider.png", "images/card/plate-light.png", "images/card/plate.png", "images/favicon-16.png", "images/favicon-32.png", "images/film-ya-podumayu.jpg", "images/god-figures.png", "images/god-signs.png", "images/icon-180.png", "images/icon-512.png", "images/icon-maskable-192.png", "images/icon-maskable-512.png", "images/magazine/pilot.jpg", "images/magazine/tile.jpg", "images/magazine/vol01.jpg", "images/magazine/vol02.jpg", "images/magazine/vol03.jpg", "images/magazine/vol04.jpg", "images/onboarding-video.jpg", "images/plan/bg-dark.webp", "images/plan/bg-light.webp", "images/plan/rail-dark.webp", "images/plan/rail-light.webp", "images/plan/stop-done-dark.webp", "images/plan/stop-done-light.webp", "images/plan/stop-future-dark.webp", "images/plan/stop-future-light.webp", "images/plan/stop-next-dark.webp", "images/plan/stop-next-light.webp", "images/reveal/back-dark.webp", "images/reveal/frame-dark.webp", "images/reveal/frame-light.webp", "images/reveal/reveal-gold.webp", "images/reveal/reveal-holo.webp", "images/reveal/screens/back-dark.webp", "images/reveal/screens/back-legendary.webp", "images/reveal/screens/back-light.webp", "images/reveal/screens/close-legendary.webp", "images/reveal/screens/plate-dark.webp", "images/reveal/screens/plate-legendary-done.webp", "images/reveal/screens/plate-legendary-open.webp", "images/reveal/screens/plate-legendary-view.webp", "images/reveal/screens/plate-light.webp", "images/reveal/screens/sigil-idle.webp", "images/reveal/screens/stage-dark.webp", "images/reveal/screens/stage-legendary.webp", "images/reveal/screens/stage-light.webp", "images/reveal/tex-dark.webp", "images/reveal/tex-light.webp", "images/robot.png", "images/splash.jpg", "images/streams/friday_meetings.png", "images/streams/sales_p03.jpg", "images/streams/sales_p04.jpg", "images/tab-signs.png", "introduction.css", "introduction.js", "knowledge-quizzes.js", "legal-center.js", "lesson-audio.css", "lesson-audio.js", "material-history.js", "meeting-recordings.css", "meeting-recordings.js", "member-profiles.css", "member-profiles.js", "payment-navigation.js", "personal-digest.js", "player-diagnostics.js", "premium.css", "premium.js", "promo-layer.js", "quiz-recommendations.css", "quiz-recommendations.js", "reviews.css", "reviews.js", "rf-parallel.js", "sales-timer.js", "service-worker.js", "telegram-web-app.js", "vendor/hls-1.7.3.min.js", "unknown_resource", "empty_source", "other_script", "other_link", "other_img", "other_video", "other_audio", "other_source", "other_iframe", "boomstream_sdk", "boomstream_config", "kinescope_sdk", "hls_js"];
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
   if(fact.resource)item.resource=fact.resource;
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
  resources.splice(0).forEach(function(info){try{var detail='attempt='+(parent||'unbound')+'; type='+info.type+'; origin='+info.origin+'; cause='+info.cause+'; http='+info.http+'; online='+info.online+'; visible='+info.visible;if(info.key)detail+='; resource_key='+info.key;w.__reportError('Не загрузился ресурс приложения: '+info.asset,detail,'resource_load');}catch(e){}});
 }
 function resourceInfo(target, blocked){
  var tag=String(target&&target.tagName||'').toLowerCase();
  if(!/^(script|link|img|video|audio|source|iframe)$/.test(tag))return null;
  var raw=target.currentSrc||target.src||target.href||'';
  if(tag==='img'&&target.getAttribute&&target.getAttribute('src')===''&&!target.getAttribute('srcset'))raw='';
  var asset='unknown_resource',origin='other',url=null;
  if(!raw)asset='empty_source';
  try{
   url=new URL(raw,w.location.href);var name=url.pathname.split('/').pop();
   if(url.origin===new URL(w.location.href).origin){origin='app';var local=url.pathname.replace(/^\/club-app\//,'').replace(/^\//,'');if(knownResources.indexOf(local)>=0)asset=local;}
   if(asset==='unknown_resource'&&knownResources.indexOf(name)>=0)asset=name;
   if(url.hostname==='play.boomstream.com'){origin='boomstream';if(url.pathname==='/assets/javascripts/biframesdk.js')asset='boomstream_sdk';else if(/\/config\.jsonp$/.test(url.pathname))asset='boomstream_config';}
   if(url.hostname==='player.kinescope.io'){origin='kinescope';if(url.pathname==='/latest/iframe.player.js')asset='kinescope_sdk';}
   if(/^hls-[\d.]+\.min\.js$/.test(name))asset='hls_js';
  }catch(e){}
  if(asset==='unknown_resource')asset='other_'+tag;
  var out={asset:asset,type:tag,origin:origin,cause:blocked?'csp':'browser_unknown',http:0,duration:0,media_code:0,online:!w.navigator||w.navigator.onLine!==false,visible:!d.hidden};
  try{var entries=url&&w.performance&&w.performance.getEntriesByName(url.href,'resource'),entry=entries&&entries[entries.length-1];
   if(entry){out.http=bounded(entry.responseStatus,599);out.duration=bounded(entry.duration,60000);if(out.http>=400&&!blocked)out.cause='http';}
  }catch(e){}
  if(!raw&&!blocked)out.cause='empty_source';
  if(!blocked&&target.error&&Number.isInteger(target.error.code)&&target.error.code>=1&&target.error.code<=4){out.media_code=target.error.code;out.cause=['','media_aborted','media_network','media_decode','media_unsupported'][target.error.code];}
  // Correlate private/dynamic assets without retaining URL, query or credentials.
  try{if(url&&/^https?:$/.test(url.protocol)&&w.crypto&&w.crypto.subtle&&w.TextEncoder){
   w.crypto.subtle.digest('SHA-256',new w.TextEncoder().encode(url.origin+url.pathname)).then(function(buf){out.key=Array.from(new Uint8Array(buf)).map(function(x){return x.toString(16).padStart(2,'0');}).join('');}).catch(function(){});
  }}catch(e){}
  return out;
 }
 function rememberResource(info){
  if(!info)return;
  var key=info.type+':'+info.asset;
  if(Object.prototype.hasOwnProperty.call(resourceSeen,key)){var i=resourceSeen[key];if(resourceFacts[i].cause==='browser_unknown'&&info.cause!=='browser_unknown'){resourceFacts[i]=info;return true;}return false;}
  if(resourceFacts.length>=4)return false;
  resourceSeen[key]=resourceFacts.length;resourceFacts.push(info);resources.push(info);reportResources();return true;
 }
 w.ClubClientDiagnostics={reportResources:reportResources,emit:emit,probe:probe,bind:function(id){parent=id;},parent:function(){return parent;},resources:function(){return resourceFacts.map(function(x){return Object.assign({},x);});}};
 function error(event,rejection){
  if(disabled)return;
  var resource=!rejection&&event.target&&event.target!==w;
  var info=resource?resourceInfo(event.target,false):null;if(info&&!rememberResource(info))return;
  if(!parent)return;
  var value=rejection?event.reason:event.error,name=value&&value.name;
  emit({attempt:parent,kind:'javascript',event:resource?'resource':rejection?'rejection':'error',error:/^(TypeError|ReferenceError|SyntaxError|RangeError|AbortError|Error)$/.test(name||'')?name:'unknown',line:event.lineno,column:event.colno,...(info?{resource:info}:{}),...(name==='AbortError'&&w.ClubAbortDiagnostics?{trace:w.ClubAbortDiagnostics.snapshot(value)}:{})});
 }
 w.addEventListener('error',function(e){error(e,false);},true);
 w.addEventListener('unhandledrejection',function(e){error(e,true);});
 d.addEventListener&&d.addEventListener('securitypolicyviolation',function(e){
  if(disabled||!parent)return;
  var tag=/^script-src/.test(e.effectiveDirective)?'SCRIPT':/^style-src/.test(e.effectiveDirective)?'LINK':/^img-src/.test(e.effectiveDirective)?'IMG':/^media-src/.test(e.effectiveDirective)?'VIDEO':/^frame-src/.test(e.effectiveDirective)?'IFRAME':'';
  if(!tag)return;
  var info=resourceInfo({tagName:tag,src:e.blockedURI},true);if(!rememberResource(info))return;
  emit({attempt:parent,kind:'javascript',event:'resource',resource:info});
 });
 w.addEventListener('online',flush);
 w.addEventListener('pagehide',function(){if(timer)clearTimeout(timer);flush();});
})(window,document);
/* END_CLIENT_DIAGNOSTICS_V1 */
