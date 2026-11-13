const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const repo=path.resolve(__dirname,'..');
let now=0, timers=new Map(),timerId=0;
function advance(ms){now+=ms;for(const [id,t] of [...timers])if(t.at<=now){timers.delete(id);t.fn();}}
class Element {
 constructor(tag){this.tagName=tag;this.listeners={};this.children=[];this.currentTime=0;this.duration=100;this.paused=true;this.seeking=false;this.textContent='';}
 setAttribute(){} removeAttribute(){} load(){} remove(){} canPlayType(){return '';}
 append(...children){this.children.push(...children);}prepend(c){this.children.unshift(c);}replaceChildren(...c){this.children=c;}
 addEventListener(n,fn){(this.listeners[n] ||= []).push(fn);}
 removeEventListener(n,fn){this.listeners[n]=(this.listeners[n]||[]).filter(x=>x!==fn);}
 fire(n){for(const fn of this.listeners[n]||[])fn();}
 play(){this.paused=false;this.fire('play');return Promise.resolve();}
 pause(){if(!this.paused){this.paused=true;this.fire('pause');}}
}
class Hls {
 static isSupported(){return true;}
 static Events={ERROR:'error',MANIFEST_PARSED:'manifest'};
 constructor(config){this.config=config;this.listeners={};}
 on(n,fn){this.listeners[n]=fn;}loadSource(url){this.url=url;}attachMedia(v){this.video=v;}destroy(){this.destroyed=true;}
}
const events=[],diagnostics=[];
const ctx={Hls,document:Object.assign(new Element('document'),{hidden:false,createElement:t=>new Element(t)}),setTimeout:(fn,ms)=>{timers.set(++timerId,{fn,at:now+ms});return timerId;},clearTimeout:id=>timers.delete(id),globalThis:null};ctx.globalThis=ctx;
vm.runInNewContext(fs.readFileSync(repo+'/film-player.js','utf8'),ctx);
const player=new ctx.ClubFilmPlayer(new Element('div'),{sources:[{url:'https://ru.test/master',lowUrl:'https://ru.test/360',type:'hls'},{url:'https://other.test/master',lowUrl:'https://other.test/360',type:'hls'}],position:25,text:k=>k,onEvent:e=>events.push(e),onFault:e=>events.push({fault:e}),onDiagnostic:e=>diagnostics.push(e)});
let v=player.video;v.fire('loadedmetadata');assert.equal(v.currentTime,25);
assert.equal(player.start.textContent,'film.start');assert(!v.controls);assert(player.retry.hidden);
player.start.onclick();assert(player.wantsPlay);assert(player.start.disabled);
advance(3999);assert.equal(player.index,0);assert(player.retry.hidden);
advance(1);assert.equal(player.index,1);assert.equal(player.position,25);assert(player.wantsPlay);
assert(!events.some(e=>e.fault==='film_stall'),'Try reserve before alarming');
advance(5999);assert(player.retry.hidden);advance(1);assert(!player.retry.hidden);
assert(events.some(e=>e.fault==='film_stall'));
player.retry.onclick();assert(!player.panel.hidden);
const old=v;v=player.video;assert.strictEqual(v,old,'Keep the playback-authorized media element');v.fire('loadedmetadata');assert.equal(v.currentTime,25);
v.fire('playing');assert(!diagnostics.some(e=>e.event==='recovered'),'playing is not proof of recovery');assert(player.start.hidden);assert(player.retry.hidden);
v.fire('pause');assert(player.wantsPlay,'Ignore delayed pause from previous source');
ctx.document.hidden=true;ctx.document.fire('visibilitychange');advance(30000);assert.equal(player.index,1);assert(!player.exhausted);
ctx.document.hidden=false;ctx.document.fire('visibilitychange');
v.currentTime=30;v.fire('timeupdate');assert(diagnostics.some(e=>e.event==='recovered'&&e.source===1),'Advancing video proves reserve recovery');assert(events.some(e=>e.method==='time'&&e.time===30));
old.fire('ended');assert.notEqual(events.at(-1).method,'stop');
player.action('pause');assert.equal(timers.size,0);assert(!player.wantsPlay);advance(20000);assert(player.retry.hidden);
player.setQuality('360');assert.equal(player.hls.url,'https://other.test/360');assert(!player.wantsPlay);assert.equal(player.position,30);
player.video.fire('loadedmetadata');assert.equal(player.video.currentTime,30);
player.setQuality('auto');assert.equal(player.hls.url,'https://other.test/master');
player.action('play');player.hls.listeners.error(null,{fatal:true,details:'fragLoadError',response:{code:503,url:'https://secret.test/?signature=secret'}});assert(diagnostics.some(e=>e.http===503&&e.reason==='fragLoadError'));assert(!JSON.stringify(diagnostics).includes('secret'));assert.equal(player.index,0,'Later reserve failure retries primary after real playback');assert(!player.exhausted);player.video.fire('error');assert(!player.exhausted);assert.equal(player.quality,'360');player.video.fire('error');assert(!player.exhausted);player.video.fire('error');assert(player.exhausted);assert.equal(timers.size,0);
assert(events.some(e=>e.fault==='film_unavailable'));
player.low.onclick();assert(player.wantsPlay);assert(!player.exhausted);player.video.fire('error');assert(!player.exhausted);player.video.fire('error');assert(player.exhausted);
const beforeManualSwitch=player.index;player.other.onclick();assert.equal(player.index,(beforeManualSwitch+1)%2);assert(!player.exhausted);assert.equal(player.position,30);
player.destroy();assert.equal(timers.size,0);const count=events.length;player.video.fire('ended');assert.equal(events.length,count);
const preloadFaults=[];
const preload=new ctx.ClubFilmPlayer(new Element('div'),{sources:[{url:'https://a.test/master',type:'hls'},{url:'https://b.test/master',type:'hls'}],text:k=>k,onEvent:()=>{},onFault:c=>preloadFaults.push(c)});
preload.video.fire('error');preload.video.fire('error');assert(preload.exhausted);assert.equal(preloadFaults.length,0,'Do not alarm about an unwatched preload');
preload.play();assert(preload.wantsPlay);assert(!preload.exhausted);preload.video.fire('error');preload.video.fire('error');assert(preload.exhausted);assert.deepEqual(preloadFaults,['film_unavailable']);preload.destroy();
console.log('OK HLS auto/360, 4s reserve before 10s help, background suspension, source recovery, position, pause, bounded retries, teardown');
// Exercise actual shared funnel handler, not a duplicate implementation.
const html=fs.readFileSync(repo+'/index.html','utf8');
const handler=html.slice(html.indexOf('function filmHandlePlayback('),html.indexOf('function filmRipeOffer('));
const funnel={funnelPlayerReady:true,filmDone:false,filmMsgCount:0,filmFirstMsgMs:0,filmMountedAt:1,filmLastMethod:'',filmLastMsgAt:0,filmBootHide(){},funnelFilmStarted:false,setFunnelStage(){},track(){},startVideoHeartbeat(){},stopVideoHeartbeat(){},filmPlayStartedAt:null,filmTakeMediaSession(){},clearTimeout(){},funnelAfterTimer:null,FUNNEL_FILM_LENGTH_MS:1890000,filmPlayedAccum:0,setTimeout(){throw Error('Native playback must not use wall-clock completion');},showFunnelAfter(){this.completed=true;},msState(){},filmLastPos:0,filmDuration:0,filmMaybeResume(){},filmSavePos(){},filmRipe:false,FILM_RIPE_PCT:.9};
vm.createContext(funnel);vm.runInContext(handler,funnel);
vm.runInContext("filmHandlePlayback({method:'play'},true);filmHandlePlayback({method:'pause'},true)",funnel);
assert(funnel.funnelFilmStarted);assert.equal(funnel.filmPlayStartedAt,null);assert(!funnel.completed);
console.log('OK native buffering cannot start the old wall-clock completion timer');
// WebViews can deliver watchdog timers before a delayed timeupdate callback.
const suspendedTrace=[];
const suspended=new ctx.ClubFilmPlayer(new Element('div'),{sources:[{url:'https://a.test/master',type:'hls'},{url:'https://b.test/master',type:'hls'}],text:k=>k,onEvent:()=>{},onDiagnostic:e=>suspendedTrace.push(e)});
suspended.play();suspended.video.readyState=4;suspended.video.fire('playing');suspended.video.currentTime=10;suspended.video.fire('timeupdate');
suspended.video.currentTime=35; // Media progressed; JavaScript events were delayed.
advance(60000);
assert.equal(suspended.index,0,'A late watchdog must recheck actual progress before discarding healthy video');
assert(!suspendedTrace.some(e=>e.reason==='progress_timeout'),'Delayed timeupdate is not proof of playback failure');
assert(suspended.retry.hidden,'Do not show a stall report for media that advanced');
suspended.video.currentTime=36;suspended.video.fire('timeupdate');advance(4000);
assert.equal(suspended.index,1,'A real lack of progress must still trigger bounded fallback');suspended.destroy();

const failedPause=new ctx.ClubFilmPlayer(new Element('div'),{sources:[{url:'https://a.test/master',type:'hls'},{url:'https://b.test/master',type:'hls'}],text:k=>k,onEvent:()=>{}});
failedPause.play();failedPause.video.readyState=4;failedPause.video.fire('playing');
failedPause.video.error={code:4};failedPause.video.paused=true;failedPause.video.fire('pause');
assert(failedPause.wantsPlay,'A media-error pause must not cancel the viewer playback request');
failedPause.video.fire('error');assert.equal(failedPause.index,1);assert(failedPause.wantsPlay);
failedPause.video.error=null;failedPause.action('pause');assert(!failedPause.wantsPlay,'Explicit pause still wins');failedPause.destroy();
console.log('OK delayed watchdog samples real progress; media error pause keeps recovery intent; explicit pause preserved');

(async()=>{
 const trace=[];let refreshes=0;
 const p=new ctx.ClubFilmPlayer(new Element('div'),{sources:[{url:'https://a.test/old',type:'hls'},{url:'https://b.test/old',type:'hls'}],text:k=>k,onEvent:()=>{},onDiagnostic:e=>trace.push(e),
 refreshSources:async()=>{refreshes++;return {expires_in:14400,sources:[{url:'https://a.test/fresh',type:'hls'},{url:'https://b.test/fresh',type:'hls'}]};}});
 p.video.duration=1000;p.position=412;p.video.currentTime=412;p.sourcesExpireAt=0;p.play();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(refreshes,1);assert.equal(p.hls.url,'https://a.test/fresh');assert.equal(p.position,412);
 p.video.readyState=0;p.video.currentTime=0;p.video.fire('timeupdate');assert.equal(p.position,412,'A reset media element must not erase the resume position');
 p.video.fire('loadedmetadata');assert.equal(p.video.currentTime,412);
 assert(!trace.some(e=>e.event==='recovered'),'Refreshed links alone do not prove playback');
 p.video.readyState=4;p.video.currentTime=414;p.video.fire('timeupdate');assert(trace.some(e=>e.event==='recovered'));
 p.options.refreshSources=async()=>{refreshes++;throw Object.assign(Error('offline'),{status:503});};p.sourcesExpireAt=0;p.lastRefresh=0;p.play();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(refreshes,2);assert(trace.some(e=>e.event==='refresh_failed'&&e.http===503));p.video.fire('error');assert.equal(refreshes,2,'No unbounded manifest-refresh loop');p.destroy();
 console.log('OK expired links renew once, preserve position, prove recovery by progress, and bound failed renewals');
})().catch(e=>{console.error(e);process.exitCode=1;});

// A slow native initial load gets a bounded final-source window, not a false failure at 12s.
const slow=new ctx.ClubFilmPlayer(new Element('div'),{sources:[{url:'https://a.test/video',type:'mp4'},{url:'https://b.test/video',type:'mp4'}],text:k=>k,onEvent:()=>{}});
slow.video.readyState=0;slow.video.networkState=2;slow.play();advance(4000);assert.equal(slow.index,1);
advance(8000);assert(!slow.exhausted,'Still loading the final native source');
advance(11999);assert(!slow.exhausted);advance(1);assert(slow.exhausted,'Startup deadline remains bounded');slow.destroy();
const recovering=new ctx.ClubFilmPlayer(new Element('div'),{sources:[{url:'https://a.test/video',type:'mp4'},{url:'https://b.test/video',type:'mp4'}],text:k=>k,onEvent:()=>{}});
recovering.video.readyState=0;recovering.video.networkState=2;recovering.play();advance(4000);advance(10000);
recovering.video.readyState=3;recovering.video.fire('playing');recovering.video.currentTime=1;recovering.video.fire('timeupdate');assert(!recovering.exhausted);recovering.destroy();
console.log('OK slow native startup: fast reserve, 20s bounded final load, recovery');
(async()=>{
 let requests=0;const rescued=new ctx.ClubFilmPlayer(new Element('div'),{sources:[{url:'https://a.test/video',type:'mp4'}],text:k=>k,onEvent:()=>{},onBotFallback:async()=>{requests++;return {message:'Queued in bot'};}});
 assert(rescued.botFallback.hidden);assert.equal(requests,0);rescued.play();rescued.video.fire('error');assert(!rescued.botFallback.hidden);assert.equal(requests,0);
 await rescued.botFallback.onclick();assert.equal(requests,1);assert.equal(rescued.notice.textContent,'Queued in bot');assert(!rescued.botFallback.disabled);rescued.destroy();
 console.log('OK explicit bot fallback is shown on exhaustion and only sends on click');
})();

// Resume after a real frame: slow native reserve loading is not a final failure.
const resumeFaults=[],resumeTrace=[];
const savedCanPlay=Element.prototype.canPlayType;Element.prototype.canPlayType=()=> 'probably';
const resume=new ctx.ClubFilmPlayer(new Element('div'),{sources:[{url:'https://a.test/master',lowUrl:'https://a.test/360',type:'hls'},{url:'https://b.test/master',lowUrl:'https://b.test/360',type:'hls'}],text:k=>k,onEvent:()=>{},onFault:c=>resumeFaults.push(c),onDiagnostic:e=>resumeTrace.push(e)});
resume.play();resume.video.readyState=4;resume.video.networkState=2;resume.video.fire('playing');resume.video.currentTime=45;resume.video.fire('timeupdate');
resume.video.readyState=2;resume.video.fire('waiting');advance(4000);assert.equal(resume.index,1);
resume.video.readyState=1;resume.video.fire('loadedmetadata');advance(8000);
assert(!resume.exhausted,'Do not abandon a loading native reserve after playback at eight seconds');
assert.equal(resume.quality,'auto','Reserve has time before lowering quality');
advance(12000);assert.equal(resume.quality,'360');assert(!resume.exhausted);assert.equal(resume.video.src,'https://a.test/360');
resume.video.fire('loadedmetadata');assert.equal(resume.video.currentTime,45);
advance(8000);assert.equal(resume.video.src,'https://b.test/360');assert(!resume.exhausted);
advance(20000);assert(resume.exhausted,'No endless retry loop after both qualities fail');
assert.equal(resumeFaults.filter(x=>x==='film_unavailable').length,1);
assert(resumeTrace.some(x=>x.event==='source'&&x.reason==='automatic_low'&&x.quality==='360'));
resume.destroy();Element.prototype.canPlayType=savedCanPlay;
console.log('OK native resume waits for loading, tries bounded 360 recovery, preserves position, and fails once');

const lowFaults=[],lowTrace=[];
const lowRecovery=new ctx.ClubFilmPlayer(new Element('div'),{sources:[{url:'https://a.test/master',lowUrl:'https://a.test/360',type:'hls'},{url:'https://b.test/master',lowUrl:'https://b.test/360',type:'hls'}],text:k=>k,onEvent:()=>{},onFault:c=>lowFaults.push(c),onDiagnostic:e=>lowTrace.push(e)});
lowRecovery.play();lowRecovery.video.currentTime=45;lowRecovery.video.fire('error');lowRecovery.video.fire('error');
assert.equal(lowRecovery.quality,'360');assert(!lowFaults.includes('film_unavailable'));
lowRecovery.video.fire('loadedmetadata');assert.equal(lowRecovery.video.currentTime,45);
lowRecovery.video.readyState=4;lowRecovery.video.fire('playing');
assert(!lowTrace.some(e=>e.event==='recovered'),'Loading or playing alone is not a recovered frame');
lowRecovery.video.currentTime=46;lowRecovery.video.fire('timeupdate');
assert(lowTrace.some(e=>e.event==='recovered'&&e.quality==='360'));
assert(!lowFaults.includes('film_unavailable'));assert(lowRecovery.retry.hidden);
lowRecovery.action('pause');const pausedSource=lowRecovery.index;advance(60000);assert.equal(lowRecovery.index,pausedSource);assert(!lowRecovery.exhausted);
lowRecovery.setQuality('auto');assert.equal(lowRecovery.quality,'auto');assert(!lowRecovery.wantsPlay,'Manual quality change preserves pause');lowRecovery.destroy();
console.log('OK 360 advances before confirming recovery, avoids emergency, preserves manual pause and quality control');

(async()=>{
 let probes=0;ctx.clubProbeVideo=async(source,position,emit)=>{probes++;emit({event:'probe',reason:'sample_360'});};
 const bounded=new ctx.ClubFilmPlayer(new Element('div'),{sources:[{url:'https://a.test/master',lowUrl:'https://a.test/360',type:'hls'}],text:k=>k,onEvent:()=>{}});
 bounded.play();await Promise.resolve();assert.equal(probes,0,'Normal playback has no diagnostic downloads');bounded.video.fire('error');await Promise.resolve();assert.equal(probes,0,'Recovering playback has no diagnostic downloads');bounded.video.fire('error');await Promise.resolve();assert.equal(probes,1);bounded.play();bounded.video.fire('error');await Promise.resolve();assert.equal(probes,1,'Repeated failure has only one comparison per player');bounded.destroy();delete ctx.clubProbeVideo;
 console.log('OK diagnostic samples only after final failure, once per player');
})().catch(e=>{console.error(e);process.exitCode=1;});
