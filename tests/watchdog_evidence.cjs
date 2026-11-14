const fs=require('fs'),vm=require('vm'),assert=require('assert');let now=100000,id=0,timers=new Map();
function advance(ms){const end=now+ms;while(true){const pending=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!pending)break;now=pending[1].at;timers.delete(pending[0]);pending[1].f();}now=end;}
class E{constructor(){this.listeners={};this.paused=true;this.currentTime=0;this.duration=100;this.readyState=0;this.networkState=0;}setAttribute(){}removeAttribute(){}append(){}prepend(){}replaceChildren(){}remove(){}canPlayType(){return 'probably'}load(){this.readyState=0;this.networkState=0;}addEventListener(n,f){(this.listeners[n]||=[]).push(f)}removeEventListener(n,f){this.listeners[n]=(this.listeners[n]||[]).filter(x=>x!==f)}fire(n){for(const f of this.listeners[n]||[])f()}play(){this.paused=false;this.fire('play');return Promise.resolve()}pause(){this.paused=true}}
const c={Date:{now:()=>now},document:Object.assign(new E(),{hidden:false,createElement:()=>new E()}),setTimeout:(f,ms)=>{timers.set(++id,{f,at:now+ms});return id},clearTimeout:id=>timers.delete(id)};c.window=c;
vm.runInNewContext(fs.readFileSync(require('path').join(__dirname,'../film-player.js'),'utf8'),c);

const events=[];const options={sources:[{url:'https://a.test/master',type:'hls'},{url:'https://b.test/master',type:'hls'}],text:k=>k,onEvent:()=>{},onDiagnostic:e=>events.push(e)};
const p=new c.ClubFilmPlayer(new E(),options);p.play();p.video.readyState=4;p.video.currentTime=663;p.video.fire('timeupdate');
const timer=p.timer,callback=timers.get(timer).f;now+=143752;timers.delete(timer);callback();
assert.equal(p.index,1,'Telemetry must preserve the existing failover decision');assert(events.some(e=>e.reason==='watchdog_late'));assert(events.some(e=>e.reason==='progress_timeout'));p.destroy();
events.length=0;const q=new c.ClubFilmPlayer(new E(),options);q.play();q.video.readyState=4;q.video.currentTime=10;q.video.fire('timeupdate');advance(4000);
assert.equal(q.index,1);assert(!events.some(e=>e.reason==='watchdog_late'),'On-time failure must remain distinct');q.destroy();
events.length=0;const z=new c.ClubFilmPlayer(new E(),options);z.play();z.video.readyState=4;z.video.currentTime=10;z.video.fire('timeupdate');const stale=timers.get(z.timer).f;z.action('pause');now+=20000;stale();assert.equal(z.index,0);assert(!events.some(e=>e.reason==='watchdog_late'));
for(let i=0;i<100;i++){c.document.hidden=i%2===0;c.document.fire('visibilitychange')}
assert(events.filter(e=>['visibility_hidden','visibility_visible','play_requested','paused'].includes(e.reason)).length<=12);z.destroy();
for(const e of events)assert(/^[a-zA-Z_]*$/.test(e.reason||''));
console.log('PASS late vs on-time timer, unchanged failover, stale cancellation and bounded lifecycle evidence');
