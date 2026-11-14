const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const html=fs.readFileSync(require('path').join(__dirname,'../index.html'),'utf8');
const part=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
test('film catalog stays deferred until browse, concurrent opens share hydration',async()=>{
 const calls=[];let finish;const c={window:{},Promise,appStartParamRaw:()=> 'film_ig_film',loadPortalData:()=>{calls.push('portal');return new Promise(r=>finish=r)},loadStreams:()=>calls.push('streams'),loadLibrary:()=>calls.push('library')};vm.createContext(c);vm.runInContext(part('function filmBrowseDeferred(){','function bootNeedsPortal(){'),c);
 assert(c.filmBrowseDeferred());assert.deepEqual(calls,[]);const p=c.loadFilmBrowseData();assert.equal(c.loadFilmBrowseData(),p);assert(!c.filmBrowseDeferred());assert.deepEqual(calls,['portal','streams','library']);finish();await p;
});
test('minimize preserves film then hydrates app',()=>{
 const calls=[],c={track:()=>{},funnelLeave:keep=>calls.push(['leave',keep]),loadFilmBrowseData:()=>calls.push(['hydrate'])};vm.createContext(c);vm.runInContext(part('function funnelMinimize(){','/* Тап по PiP'),c);c.funnelMinimize();assert.deepEqual(calls,[['leave',true],['hydrate']]);
});
test('guest events including linkless and replays offer paywall, no private route',()=>{
 const c={isMember:false};vm.createContext(c);vm.runInContext(part('function schedEventActionsHtml(','function schedRemind('),c);
 for(const event of [{id:1,title:'Upcoming',link:''},{id:2,replay_state:'recording'},{id:3,link:'https://private.invalid'}]){const out=c.schedEventActionsHtml(event,0,'2026-11-14');assert(out.includes('openPaywall()'));assert(!out.includes('openMeetingRecording'));assert(!out.includes('private.invalid'));}
});
test('guest replay shortcut offers paywall without requesting a recording',async()=>{
 let paywalls=0;const c={isMember:false,isPaused:false,openPaywall:()=>paywalls++};vm.createContext(c);vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../meeting-recordings.js'),'utf8'),c);await c.openMeetingRecording(31);assert.equal(paywalls,1);
});
test('paused member keeps recording entry while guest gets paywall',()=>{
 const c={isMember:false,isPaused:true};vm.createContext(c);vm.runInContext(part('function schedEventActionsHtml(','function schedRemind('),c);assert(c.schedEventActionsHtml({id:31,replay_state:'recording'},0,'2026-11-14').includes('openMeetingRecording(31)'));
});
