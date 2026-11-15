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
const ctx={Hls,document:Object.assign(new Element('document'),{hidden:false,createElement:t=>new Element(t)}),setTimeout:(fn,ms)=>{timers.set(++timerId,{fn,at:now+ms});return timerId;},clearTimeout:id=>timers.delete(id),globalThis:null};ctx.globalThis=ctx;
vm.runInNewContext(fs.readFileSync(repo+'/film-player.js','utf8'),ctx);
// Android's native decoder can reject an otherwise available HLS stream mid-VOD.
{
 const original=Element.prototype.canPlayType;const existingTimers=new Set(timers.keys());
 Element.prototype.canPlayType=()=> 'probably';ctx.navigator={userAgent:'Android'};
 const trace=[];
 const p=new ctx.ClubFilmPlayer(new Element('div'),{sources:[{url:'https://a.test/master',lowUrl:'https://a.test/360',type:'hls'},{url:'https://b.test/master',lowUrl:'https://b.test/360',type:'hls'}],text:k=>k,onEvent:()=>{},onDiagnostic:e=>trace.push(e)});
 assert.equal(p.engine,'native');p.play();p.video.duration=3000;p.video.readyState=4;p.video.currentTime=1609;p.video.fire('timeupdate');
 p.video.error={code:4};p.video.fire('error');
 assert.equal(p.engine,'hls');assert.equal(p.index,0);assert.equal(p.position,1609);
 p.video.currentTime=0;p.video.fire('loadedmetadata');assert.equal(p.video.currentTime,1609);
 assert(!trace.some(e=>e.event==='recovered'),'Decoder installation is not recovery');
 p.video.error=null;p.video.currentTime=1610;p.video.fire('timeupdate');assert(trace.some(e=>e.event==='recovered'));
 for(let n=0;n<4;n++)p.hls.listeners.error(null,{fatal:true,details:'mediaError'});
 assert(p.exhausted);assert.equal(trace.filter(e=>e.reason==='native_to_hls').length,1);
 p.destroy();assert([...timers.keys()].every(id=>existingTimers.has(id)));Element.prototype.canPlayType=original;delete ctx.navigator;
 console.log('OK Android decoder fallback preserves position, requires progress, exhausts without retry loops');
}

(async()=>{
 const html=fs.readFileSync(repo+'/index.html','utf8');
 const source=html.slice(html.indexOf('let filmEnginePromise=null;'),html.indexOf('\nfunction filmEdition()'));
 let script,resolveTimer;
 const context={Promise,navigator:{userAgent:'Android'},document:{createElement:tag=>tag==='video'?{canPlayType:()=> 'probably'}:{remove(){}},head:{appendChild:s=>script=s}},setTimeout:fn=>{resolveTimer=fn;return 1;},clearTimeout(){}};context.window=context;
 vm.createContext(context);vm.runInContext(source,context);
 await context.filmEngineReady();assert(script,'Android alternate decoder is preloaded');
 resolveTimer();await Promise.resolve(); // Failure remains optional for native playback.
 script=null;context.navigator.userAgent='iPhone';await context.filmEngineReady();assert.equal(script,null);
 console.log('OK optional Android decoder preload never delays native playback');
})().catch(e=>{console.error(e);process.exitCode=1;});
