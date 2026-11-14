const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),test=require('node:test');
const html=fs.readFileSync('index.html','utf8');
function fn(name){const start=html.search(new RegExp('^(?:async )?function '+name+'\\(','m'));assert(start>=0);const next=html.slice(start+1).search(/\n(?:async )?function /);return html.slice(start,start+1+next);}
function setup(member=true,audio=true){
 const lecture={slug:'lesson',title:'Lesson',has_audio:audio},calls=[],banner={style:{},scrollIntoView(){}};
 const c={Number,Promise,setTimeout,encodeURIComponent,API_URL:'https://fixture',allLectures:[lecture],ensureBotAccess:()=>true,ensureLibrary:async()=>{},lectureBySafeKey:()=>lecture,showSingleLecture:l=>calls.push(['card',l.slug]),lectureRecordingAccess:()=>member,showFreeVersion:l=>calls.push(['free',l.slug]),plHasAudio:l=>l.has_audio,playOneLecture:l=>calls.push(['play',l.slug,c.plPendingSeek.sec]),safeContentKey:x=>x,document:{getElementById:()=>banner},escapeHtml:x=>String(x),plFmt:x=>String(x)};
 vm.createContext(c);vm.runInContext(fn('openLectureByKey')+'\n'+fn('ggTimecodeSeconds')+'\n'+fn('ggOpenMaterial'),c);return {c,calls,banner};
}
test('game material retains exact lesson and moment, including zero',async()=>{for(const [tc,sec] of [['12:47',767],['0:00',0],['1:02:03',3723]]){const {c,calls}=setup();await c.ggOpenMaterial('lesson',tc);assert.deepEqual(calls,[['card','lesson'],['play','lesson',sec]]);}});
test('guest retains access gate and never seeks full audio',async()=>{const {c,calls}=setup(false);await c.ggOpenMaterial('lesson','12:47');assert.deepEqual(calls,[['card','lesson'],['free','lesson']]);});
test('video-only lesson gets visible honest time hint',async()=>{const {c,calls,banner}=setup(true,false);await c.ggOpenMaterial('lesson','12:47');assert.equal(calls.length,1);assert.equal(banner.style.display,'block');assert(banner.innerHTML.includes('767'));});
test('bad and missing timecode retain ordinary lesson route',async()=>{for(const tc of ['',null,'1:99','-2','1:2:3:4','86401']){const {c,calls}=setup();await c.ggOpenMaterial('lesson',tc);assert.deepEqual(calls,[['card','lesson']]);}});

function player(){
 const pending=[],events=[],els={},lec={slug:'lesson',title:'Lesson'};
 const audio={src:'old',currentTime:3,readyState:0,paused:true,addEventListener:(name,f)=>events.push(f)};
 const c={plQueue:[lec],plIndex:0,plAudio:audio,plPendingSeek:{slug:'lesson',sec:1},plResolveAudioUrl:()=>new Promise(resolve=>pending.push(resolve)),plSpeeds:[1],plSpeedIdx:0,plSourceLabel:'Test',plEl:id=>els[id]||(els[id]={}),plCoverHtml:()=>'',plPositions:()=>({lesson:4}),plUpdateNavButtons:()=>{},plRenderList:()=>{},plRenderMarkers:()=>{},rememberLastLecture:()=>{},plPlay:()=>{},plSyncIcon:()=>{}};
 vm.createContext(c);vm.runInContext('let plLoadGeneration=0;\n'+fn('plLoadCurrent'),c);return {c,audio,pending,events};
}
test('explicit seek waits for target source metadata and supports zero',async()=>{for(const sec of [0,1]){const {c,audio,pending,events}=player();c.plPendingSeek.sec=sec;c.plLoadCurrent(true);assert.equal(audio.currentTime,3);pending[0]('new');await Promise.resolve();assert.equal(events.length,1);events[0]();assert.equal(audio.currentTime,sec);}});
test('stale resolution and metadata cannot seek a newer selection',async()=>{const {c,audio,pending,events}=player();c.plLoadCurrent(true);pending[0]('first');await Promise.resolve();c.plPendingSeek={slug:'lesson',sec:2};c.plLoadCurrent(true);events[0]();assert.equal(audio.currentTime,3);pending[1]('second');await Promise.resolve();events[1]();assert.equal(audio.currentTime,2);});
test('same-lesson delayed old response cannot replace newer source',async()=>{const {c,audio,pending}=player();c.plLoadCurrent(true);c.plPendingSeek={slug:'lesson',sec:2};c.plLoadCurrent(true);pending[1]('new');await Promise.resolve();pending[0]('old-delayed');await Promise.resolve();assert.equal(audio.src,'new');});
