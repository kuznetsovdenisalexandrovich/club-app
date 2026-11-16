const fs=require('fs'),vm=require('vm'),assert=require('assert');let now=100000,id=0,timers=new Map();
function advance(ms){const end=now+ms;while(true){const pending=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!pending)break;now=pending[1].at;timers.delete(pending[0]);pending[1].f();}now=end;}
class E{constructor(){this.listeners={};this.paused=true;this.currentTime=0;this.duration=100;this.readyState=0;this.networkState=0;}setAttribute(){}removeAttribute(){}append(){}prepend(){}replaceChildren(){}remove(){}canPlayType(){return 'probably'}load(){this.readyState=0;this.networkState=0;}addEventListener(n,f){(this.listeners[n]||=[]).push(f)}removeEventListener(n,f){this.listeners[n]=(this.listeners[n]||[]).filter(x=>x!==f)}fire(n){for(const f of this.listeners[n]||[])f()}play(){this.paused=false;this.fire('play');return Promise.resolve()}pause(){this.paused=true}}
const c={Date:{now:()=>now},document:Object.assign(new E(),{hidden:false,createElement:()=>new E()}),setTimeout:(f,ms)=>{timers.set(++id,{f,at:now+ms});return id},clearTimeout:id=>timers.delete(id)};c.window=c;
vm.runInNewContext(fs.readFileSync(require('path').join(__dirname,'../film-player.js'),'utf8'),c);

function player(extra={}){return new c.ClubFilmPlayer(new E(),{sources:[{url:'https://a.test/master',type:'hls'},{url:'https://b.test/master',type:'hls'}],text:k=>k,onEvent:()=>{},...extra});}
const p=player();p.play();p.video.networkState=2;p.video.readyState=1;
advance(4000);assert.equal(p.index,0,'Metadata arrived: do not discard the first source at four seconds');
advance(800);p.video.readyState=3;p.video.currentTime=.5;p.video.fire('timeupdate');assert(p.diagFrame);assert.equal(p.index,0);p.destroy();
const stuck=player();stuck.play();stuck.video.networkState=2;stuck.video.readyState=1;advance(7999);assert.equal(stuck.index,0);advance(1);assert.equal(stuck.index,1,'Grace must end at eight seconds');stuck.destroy();
const empty=player();empty.play();empty.video.networkState=2;advance(4000);assert.equal(empty.index,1,'No metadata: keep fast fallback');empty.destroy();
const resume=player({position:454});resume.play();resume.video.networkState=2;resume.video.readyState=1;advance(4000);assert.equal(resume.index,1);assert.equal(resume.position,454);resume.destroy();
const explicit=player({stallMs:3000});explicit.play();explicit.video.networkState=2;explicit.video.readyState=1;advance(3000);assert.equal(explicit.index,1);explicit.destroy();
const paused=player();paused.play();paused.video.networkState=2;paused.video.readyState=1;advance(4000);paused.action('pause');advance(10000);assert.equal(paused.index,0);assert.equal(timers.size,0);paused.destroy();
console.log('PASS bounded first-frame grace, no-metadata fallback, resume, explicit deadline and pause');
