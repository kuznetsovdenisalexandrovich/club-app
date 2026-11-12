const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const root=path.resolve(__dirname,'..');
class El {
 constructor(tag){this.tagName=tag;this.style={};this.children=[];this.listeners={};this.paused=true;this.currentTime=0;this.duration=5131;}
 append(...items){this.children.push(...items);for(const x of items)x.parentNode=this;}replaceChildren(...items){this.children=[];this.append(...items);}
 prepend(item){this.children.unshift(item);item.parentNode=this;}
 remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(x=>x!==this);}
 setAttribute(){} removeAttribute(){}load(){}canPlayType(){return 'probably';}
 addEventListener(k,f){(this.listeners[k]||=[]).push(f);}removeEventListener(k,f){this.listeners[k]=(this.listeners[k]||[]).filter(x=>x!==f);}fire(k){for(const f of this.listeners[k]||[])f();}
 play(){this.paused=false;this.fire('play');return Promise.resolve();}pause(){this.paused=true;this.fire('pause');}
}
const doc=new El('document');doc.body=new El('body');doc.createElement=t=>new El(t);doc.getElementById=id=>{function walk(x){if(x.id===id)return x;for(const c of x.children){const r=walk(c);if(r)return r;}}return walk(doc.body);};
const ctx={document:doc,console,setTimeout:()=>1,clearTimeout:()=>{},API_URL:'https://api.test',t:x=>x,filmEngineReady:async()=>{},filmDiagnostics:()=>()=>{},refreshFilmSources:async()=>[],apiRequest:async url=>url.includes('/meetings/')?{state:'recording',title:'Practice'}:{sources:[{url:'https://storage.test/master.m3u8',type:'hls'}],expires_in:14400}};ctx.window=ctx;ctx.globalThis=ctx;vm.createContext(ctx);
vm.runInContext(fs.readFileSync(root+'/film-player.js','utf8'),ctx);vm.runInContext(fs.readFileSync(root+'/meeting-recordings.js','utf8'),ctx);
(async()=>{await ctx.openMeetingRecording(29);const p=vm.runInContext('meetingPlayer',ctx);assert(p,'Real player mounted');p.video.fire('loadedmetadata');p.play();p.video.fire('playing');p.video.currentTime=12;p.video.fire('timeupdate');p.action('pause');p.setQuality('360');ctx.closeMeetingRecording();assert(p.destroyed);assert(!doc.getElementById('meeting-recording'));console.log('PASS recording opens real player: metadata, play, progress, pause, quality and teardown');})().catch(e=>{console.error(e);process.exitCode=1;});
