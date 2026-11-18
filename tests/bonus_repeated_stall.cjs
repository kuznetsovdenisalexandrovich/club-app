const fs=require('fs'),vm=require('vm'),assert=require('assert');let now=100000,id=0,timers=new Map();
function advance(ms){const end=now+ms;while(true){const pending=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!pending)break;now=pending[1].at;timers.delete(pending[0]);pending[1].f();}now=end;}
class E{constructor(){this.listeners={};this.paused=true;this.currentTime=0;this.duration=100;this.readyState=0;this.networkState=0;}setAttribute(){}removeAttribute(){}append(){}prepend(){}replaceChildren(){}remove(){}canPlayType(){return 'probably'}load(){this.readyState=0;this.networkState=0;}addEventListener(n,f){(this.listeners[n]||=[]).push(f)}removeEventListener(n,f){this.listeners[n]=(this.listeners[n]||[]).filter(x=>x!==f)}fire(n){for(const f of this.listeners[n]||[])f()}play(){this.paused=false;this.fire('play');return Promise.resolve()}pause(){this.paused=true}}
const c={Date:{now:()=>now},document:Object.assign(new E(),{hidden:false,createElement:()=>new E()}),setTimeout:(f,ms)=>{timers.set(++id,{f,at:now+ms});return id},clearTimeout:id=>timers.delete(id)};c.window=c;
vm.runInNewContext(fs.readFileSync(require('path').join(__dirname,'../film-player.js'),'utf8'),c);

function player(extra={}){return new c.ClubFilmPlayer(new E(),{sources:[{url:'https://a.test/master',lowUrl:'https://a.test/360',type:'hls'},{url:'https://b.test/master',lowUrl:'https://b.test/360',type:'hls'}],text:k=>k,onEvent:()=>{},...extra});}


function recovered(p,time){p.video.duration=1900;p.video.fire('loadedmetadata');p.video.readyState=4;p.video.seeking=false;p.video.fire('playing');p.video.currentTime=time;p.video.fire('timeupdate');}
const p=player({adaptiveRecovery:true});p.play();recovered(p,202);
advance(4000);assert.equal(p.index,1);assert.equal(p.quality,'auto');recovered(p,213);
advance(8000);assert.equal(p.quality,'360','Repeated recovered stalls must stop immediately returning to high bandwidth');
assert.equal(p.position,213);assert.equal(p.video.src,'https://a.test/360');
recovered(p,214);assert.equal(p.quality,'360');p.video.currentTime=462;p.video.seeking=true;p.video.fire('seeking');
advance(3000);p.video.seeking=false;p.video.readyState=4;p.video.currentTime=463;p.video.fire('timeupdate');assert.equal(p.position,463);
p.action('pause');advance(60000);assert(!p.wantsPlay);p.setQuality('auto');assert.equal(p.quality,'auto');assert(!p.wantsPlay);assert.equal(p.position,463);p.destroy();
const film=player();film.play();recovered(film,202);advance(4000);recovered(film,213);advance(8000);assert.equal(film.quality,'auto','Funnel policy is unchanged');film.destroy();
const spaced=player({adaptiveRecovery:true});spaced.play();recovered(spaced,202);advance(4000);recovered(spaced,213);spaced.action('pause');spaced.video.fire('pause');advance(300001);spaced.play();advance(8000);assert.equal(spaced.quality,'auto','Unrelated old stalls do not force low quality');spaced.destroy();
console.log('PASS repeated native stalls, saved position, seek, explicit pause/quality, and unchanged funnel policy');
