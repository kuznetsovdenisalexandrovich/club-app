const fs=require('fs'),vm=require('vm'),assert=require('assert');let now=100000,id=0,timers=new Map();
function advance(ms){const end=now+ms;while(true){const pending=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!pending)break;now=pending[1].at;timers.delete(pending[0]);pending[1].f();}now=end;}
class E{constructor(){this.listeners={};this.paused=true;this.currentTime=0;this.duration=100;this.readyState=0;this.networkState=0;}setAttribute(){}removeAttribute(){}append(){}prepend(){}replaceChildren(){}remove(){}canPlayType(){return 'probably'}load(){this.readyState=0;this.networkState=0;}addEventListener(n,f){(this.listeners[n]||=[]).push(f)}removeEventListener(n,f){this.listeners[n]=(this.listeners[n]||[]).filter(x=>x!==f)}fire(n){for(const f of this.listeners[n]||[])f()}play(){this.paused=false;this.fire('play');return Promise.resolve()}pause(){this.paused=true}}
const c={Date:{now:()=>now},document:Object.assign(new E(),{hidden:false,createElement:()=>new E()}),setTimeout:(f,ms)=>{timers.set(++id,{f,at:now+ms});return id},clearTimeout:id=>timers.delete(id)};c.window=c;
vm.runInNewContext(fs.readFileSync(require('path').join(__dirname,'../film-player.js'),'utf8'),c);

(async()=>{
let probes=0;const trace=[];c.clubProbeVideo=async(s,p,emit)=>{probes++;emit({event:'probe',http:200});};
const player=new c.ClubFilmPlayer(new E(),{sources:[{url:'https://a.test/master',lowUrl:'https://a.test/360',type:'hls'},{url:'https://b.test/master',lowUrl:'https://b.test/360',type:'hls'}],text:k=>k,onEvent:()=>{},onDiagnostic:e=>trace.push(e)});
player.play();player.video.networkState=2;advance(4000);player.video.networkState=2;
await Promise.resolve();assert.equal(probes,0);advance(6000);await Promise.resolve();
assert.equal(probes,2,'Sustained stall samples both routes before user closes');assert(!player.exhausted);
advance(60000);await Promise.resolve();assert(player.exhausted);assert.equal(probes,2,'Final failure does not repeat probes');player.destroy();
console.log('PASS sustained stall probes early, bounded once, no healthy startup downloads');
})().catch(e=>{console.error(e);process.exitCode=1;});
