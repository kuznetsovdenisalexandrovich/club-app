const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.join(__dirname,'..'),source=fs.readFileSync(path.join(root,'material-history.js'),'utf8');
function env(){
 const storage=new Map(),calls=[],timers=[],events={};let now=10000;
 const c={Date:{now:()=>++now},Map,Set,JSON,Number,String,Math,Promise,console,queueMicrotask,
  plPendingSeek:null,telegramId:77,API_URL:'https://api.example',localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
  document:{getElementById:()=>null,addEventListener:(k,v)=>events[k]=v},addEventListener:(k,v)=>events[k]=v,
  setTimeout:f=>(timers.push(f),timers.length),clearTimeout:()=>{},requestAnimationFrame:f=>f(),
  apiRequest:async(url,opts)=>{calls.push({url,opts});return url.includes('/lectures/')?{slug:'lesson',title:'Lesson',has_audio:true}:{items:[]};},
  playOneLecture:l=>calls.push({audio:l.slug,seek:c.plPendingSeek.sec}),showToast:()=>{},lectureRecordingAccess:()=>true,openLectureAsGuest:()=>{},openLectureByPlatform:l=>calls.push({external:l.slug}),openUrl:url=>calls.push({external:url})};
 c.window=c;vm.createContext(c);vm.runInContext(source,c);return {c,h:c.ClubMaterialHistory,storage,calls,timers};
}
test('audio resumes its stored second in existing audio player',async()=>{const {h,calls}=env();h.remember('audio','lesson','Lesson',{position:123});await h.open();assert.deepEqual(calls.at(-1),{audio:'lesson',seek:123});});
test('formats do not overwrite each other and explicit rewind wins',()=>{const {h}=env();h.remember('audio','lesson','Lesson',{position:123});h.remember('insights','lesson','Lesson',{position:450});h.remember('audio','lesson','Lesson',{position:20});assert.equal(h.available().length,2);assert.equal(h.get('audio','lesson').position,20);});
test('completed material disappears without resurrecting on pause',()=>{const {h}=env();h.media('meeting','31','Meeting',{method:'stop',time:500,duration:500});h.media('meeting','31','Meeting',{method:'pause',time:500,duration:500});assert.equal(h.available().length,0);});
test('account switch isolates local histories and pending writes',async()=>{const {h,c,calls}=env();h.remember('audio','lesson','Private');c.telegramId=88;assert.equal(h.available().length,0);await h.flush();assert.equal(calls.length,0);c.telegramId=77;assert.equal(h.available()[0].title,'Private');});
test('network error keeps local history and retries on later action',async()=>{const {h,c}=env();h.remember('audio','lesson','Lesson',{position:90});c.apiRequest=async()=>{throw Error('offline');};await h.flush();assert.equal(h.get('audio','lesson').position,90);let count=0;c.apiRequest=async()=>{count++;return {items:[]}};await h.flush();assert.equal(count,1);});
test('late remote read cannot replace more recent local activity',async()=>{const {h,c}=env();let resolve;c.apiRequest=()=>new Promise(r=>resolve=r);const pending=h.sync();h.remember('audio','lesson','New',{position:80});resolve({items:[{kind:'audio',id:'lesson',title:'Old',at:1,position:200}]});await pending;assert.equal(h.get('audio','lesson').position,80);});
test('scroll position restores and listener is cleaned up',()=>{const {h}=env(),listeners={};h.remember('insights','lesson','Lesson',{position:200});const el={scrollTop:0,scrollHeight:1000,clientHeight:200,addEventListener:(k,v)=>listeners[k]=v,removeEventListener:k=>delete listeners[k]};h.watchScroll('insights','lesson','Lesson',el);assert.equal(el.scrollTop,200);el.scrollTop=450;h.stopScroll(el);assert.equal(h.get('insights','lesson').position,450);assert.equal(Object.keys(listeners).length,0);});
test('unknown URL targets are not persisted',()=>{const {h}=env();h.remember('lecture','https://bad.example','Bad');assert.equal(h.available().length,0);});
test('history bounded to 30 records',()=>{const {h}=env();for(let i=0;i<50;i++)h.remember('audio','lesson'+i,'Lesson');assert.equal(h.available().length,30);});
test('new bundle matches source and legacy media engine remains intact',()=>{const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),marker='<script data-club-bundle="material-history.js">',a=html.indexOf(marker)+marker.length;assert.equal(html.slice(a,html.indexOf('</script>',a)),source);assert(html.includes("rememberLastLecture(lec,'audio')"));assert(html.includes("ClubMaterialHistory?.media('bonus'"));});
