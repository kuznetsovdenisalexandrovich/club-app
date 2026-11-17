const fs=require('fs'),vm=require('vm'),assert=require('assert');let now=100000,id=0,timers=new Map();
function advance(ms){const end=now+ms;while(true){const pending=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!pending)break;now=pending[1].at;timers.delete(pending[0]);pending[1].f();}now=end;}
class E{constructor(){this.listeners={};this.paused=true;this.currentTime=0;this.duration=100;this.readyState=0;this.networkState=0;}setAttribute(){}removeAttribute(){}append(){}prepend(){}replaceChildren(){}remove(){}canPlayType(){return 'probably'}load(){this.readyState=0;this.networkState=0;}addEventListener(n,f){(this.listeners[n]||=[]).push(f)}removeEventListener(n,f){this.listeners[n]=(this.listeners[n]||[]).filter(x=>x!==f)}fire(n){for(const f of this.listeners[n]||[])f()}play(){this.paused=false;this.fire('play');return Promise.resolve()}pause(){this.paused=true}}
const c={Date:{now:()=>now},document:Object.assign(new E(),{hidden:false,createElement:()=>new E()}),setTimeout:(f,ms)=>{timers.set(++id,{f,at:now+ms});return id},clearTimeout:id=>timers.delete(id)};c.window=c;
vm.runInNewContext(fs.readFileSync(require('path').join(__dirname,'../film-player.js'),'utf8'),c);

function player(extra={}){return new c.ClubFilmPlayer(new E(),{sources:[{url:'https://a.test/master',type:'hls'},{url:'https://b.test/master',type:'hls'}],text:k=>k,onEvent:()=>{},...extra});}

// A new user seek must not inherit waiting time accumulated before that seek.
const p=player();p.video.duration=1900;p.play();p.video.readyState=4;p.video.fire('playing');p.video.currentTime=10;p.video.fire('timeupdate');
p.video.currentTime=310;p.video.seeking=true;p.video.readyState=1;p.video.networkState=2;p.video.fire('seeking');
advance(3000);p.video.seeking=false;p.video.fire('seeked');p.video.currentTime=669;p.video.seeking=true;p.video.fire('seeking');
advance(3000);p.video.seeking=false;p.video.fire('seeked');p.video.currentTime=1172;p.video.seeking=true;p.video.fire('seeking');
advance(5000);assert.equal(p.index,0,'A fresh seek needs its own bounded loading window');
p.video.seeking=false;p.video.readyState=4;p.video.fire('seeked');p.video.currentTime=1173;p.video.fire('timeupdate');assert(p.diagFrame);p.destroy();
console.log('PASS repeated seek keeps the newest target and loading window');
const stuck=player();stuck.video.duration=1900;stuck.play();stuck.video.readyState=4;stuck.video.currentTime=10;stuck.video.fire('timeupdate');stuck.video.currentTime=1172;stuck.video.seeking=true;stuck.video.readyState=1;stuck.video.networkState=2;stuck.video.fire('seeking');
advance(7999);assert.equal(stuck.index,0);advance(1);assert.equal(stuck.index,1,'A genuinely stalled seek still switches at eight seconds');assert.equal(stuck.position,1172);stuck.destroy();
const repeated=player();repeated.video.duration=1900;repeated.play();repeated.video.readyState=4;repeated.video.currentTime=10;repeated.video.fire('timeupdate');
for(let i=0;i<9;i++){repeated.video.currentTime=100+i*100;repeated.video.seeking=true;repeated.video.readyState=1;repeated.video.fire('seeking');advance(3000);assert.equal(repeated.index,0,'Old target must not consume newest seek budget');}
advance(5000);assert.equal(repeated.index,1,'Last seek remains bounded even after prolonged scrubbing');repeated.destroy();
const paused=player();paused.video.duration=1900;paused.video.currentTime=700;paused.video.seeking=true;paused.video.fire('seeking');advance(60000);assert(!paused.wantsPlay);assert.equal(paused.index,0);paused.destroy();
const restore=player({position:900});restore.video.duration=1900;restore.play();restore.video.readyState=1;restore.video.networkState=2;advance(3000);restore.video.fire('loadedmetadata');restore.video.seeking=true;restore.video.fire('seeking');assert(!restore.seekLoading,'Internal restore is not a new user seek');advance(4000);assert.equal(restore.index,1,'Restoring a failed source must not restart its deadline');restore.destroy();
console.log('PASS seek timeout, long scrubbing, manual pause, restoration budget');
