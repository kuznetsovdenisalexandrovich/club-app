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
const events=[];
const ctx={Hls,document:{createElement:t=>new Element(t)},setTimeout:(fn,ms)=>{timers.set(++timerId,{fn,at:now+ms});return timerId;},clearTimeout:id=>timers.delete(id),globalThis:null};ctx.globalThis=ctx;
vm.runInNewContext(fs.readFileSync(repo+'/film-player.js','utf8'),ctx);
const player=new ctx.ClubFilmPlayer(new Element('div'),{sources:[{url:'https://ru.test/master',lowUrl:'https://ru.test/360',type:'hls'},{url:'https://other.test/master',lowUrl:'https://other.test/360',type:'hls'}],position:25,text:k=>k,onEvent:e=>events.push(e),onFault:e=>events.push({fault:e})});
let v=player.video;v.fire('loadedmetadata');assert.equal(v.currentTime,25);
assert.equal(player.start.textContent,'film.start');assert(!v.controls);assert(player.retry.hidden);
player.start.onclick();assert(player.wantsPlay);assert(player.start.disabled);
advance(9999);assert(player.retry.hidden);advance(1);assert(!player.retry.hidden);
assert(events.some(e=>e.fault==='film_stall'));
player.retry.onclick();assert(!player.panel.hidden);
advance(4000);assert.equal(player.index,1);assert.equal(player.position,25);assert(player.wantsPlay);
const old=v;v=player.video;assert.strictEqual(v,old,'Keep the playback-authorized media element');v.fire('loadedmetadata');assert.equal(v.currentTime,25);
v.fire('playing');assert(player.start.hidden);assert(player.retry.hidden);
v.currentTime=30;v.fire('timeupdate');assert(events.some(e=>e.method==='time'&&e.time===30));
old.fire('ended');assert.notEqual(events.at(-1).method,'stop');
player.action('pause');assert.equal(timers.size,0);assert(!player.wantsPlay);advance(20000);assert(player.retry.hidden);
player.setQuality('360');assert.equal(player.hls.url,'https://other.test/360');assert(!player.wantsPlay);assert.equal(player.position,30);
player.video.fire('loadedmetadata');assert.equal(player.video.currentTime,30);
player.setQuality('auto');assert.equal(player.hls.url,'https://other.test/master');
player.action('play');player.hls.listeners.error(null,{fatal:true});assert(player.exhausted);assert.equal(timers.size,0);
assert(events.some(e=>e.fault==='film_unavailable'));
player.low.onclick();assert(player.wantsPlay);assert(!player.exhausted);player.video.fire('error');assert(player.exhausted);
player.other.onclick();assert.equal(player.index,0);assert(!player.exhausted);assert.equal(player.position,30);
player.destroy();assert.equal(timers.size,0);const count=events.length;player.video.fire('ended');assert.equal(events.length,count);
console.log('OK HLS auto/360, 10s help, source recovery, position, pause, bounded retries, teardown');
// Exercise actual shared funnel handler, not a duplicate implementation.
const html=fs.readFileSync(repo+'/index.html','utf8');
const handler=html.slice(html.indexOf('function filmHandlePlayback('),html.indexOf('function filmRipeOffer('));
const funnel={funnelPlayerReady:true,filmDone:false,filmMsgCount:0,filmFirstMsgMs:0,filmMountedAt:1,filmLastMethod:'',filmLastMsgAt:0,filmBootHide(){},funnelFilmStarted:false,setFunnelStage(){},track(){},startVideoHeartbeat(){},stopVideoHeartbeat(){},filmPlayStartedAt:null,filmTakeMediaSession(){},clearTimeout(){},funnelAfterTimer:null,FUNNEL_FILM_LENGTH_MS:1890000,filmPlayedAccum:0,setTimeout(){throw Error('Native playback must not use wall-clock completion');},showFunnelAfter(){this.completed=true;},msState(){},filmLastPos:0,filmDuration:0,filmMaybeResume(){},filmSavePos(){},filmRipe:false,FILM_RIPE_PCT:.9};
vm.createContext(funnel);vm.runInContext(handler,funnel);
vm.runInContext("filmHandlePlayback({method:'play'},true);filmHandlePlayback({method:'pause'},true)",funnel);
assert(funnel.funnelFilmStarted);assert.equal(funnel.filmPlayStartedAt,null);assert(!funnel.completed);
console.log('OK native buffering cannot start the old wall-clock completion timer');
