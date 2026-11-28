const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('client-diagnostics.js','utf8');
function setup({down=false,view=false}={}){
 const calls=[],timers=new Map(),events={};let id=0;
 const w={location:{search:view?'?view=123':''},navigator:{onLine:true},AbortController,URLSearchParams,
 fetch:async(url,options)=>{calls.push({url,options});if(down||!url.includes('railway.app'))throw Error('PRIVATE URL TOKEN');return {ok:true,status:200,text:async()=> '{}'};},
 addEventListener:(key,fn)=>events[key]=fn};
 Object.assign(w,{window:w,document:{hidden:false},setTimeout:(fn,ms)=>{timers.set(++id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id)});
 vm.runInNewContext(source,w);
 return {w,calls,events,timers,async flush(){const item=[...timers].find(([k,t])=>t.ms===400);if(item){timers.delete(item[0]);item[1].fn();}for(let i=0;i<20;i++)await Promise.resolve();}};
}
const attempt='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
test('external resource failures have fixed distinct names without media IDs or secrets',()=>{
 const s=setup(),reports=[];s.w.URL=URL;s.w.location.href='https://example.test/';s.w.__reportError=(...args)=>reports.push(args);
 const urls=['https://play.boomstream.com/assets/javascripts/biframesdk.js?v=SECRET','https://play.boomstream.com/PRIVATE/config.jsonp?secret=SECRET','https://player.kinescope.io/latest/iframe.player.js?token=SECRET','https://example.test/vendor/hls-1.7.3.min.js?token=SECRET'];
 for(const url of [...urls,...urls])s.events.error({target:{tagName:'SCRIPT',src:url}});
 assert.equal(reports.length,4);
 for(const label of ['boomstream_sdk','boomstream_config','kinescope_sdk','hls_js'])assert(reports.some(r=>r[0].endsWith(label)));
 assert(!JSON.stringify(reports).match(/SECRET|PRIVATE|https:/));
});
test('independent channel records failed RF probes without identity or raw errors',async()=>{
 const s=setup(),d=s.w.ClubClientDiagnostics;d.bind(attempt);
 d.emit({attempt,kind:'startup',event:'ready',launch:'secret',url:'secret',peer:123});await s.flush();
 assert.equal(s.calls.length,1);assert(s.calls[0].url.includes('railway.app'));
 d.probe();d.probe();for(let i=0;i<20;i++)await Promise.resolve();await s.flush();
 const batches=s.calls.filter(c=>c.options.method==='POST').map(c=>JSON.parse(c.options.body));
 const facts=batches.flatMap(b=>b.records);assert.equal(facts.filter(x=>x.kind==='probe').length,3);
 assert(facts.some(x=>x.route==='selectel_bot'&&x.outcome==='network'));
 assert(facts.some(x=>x.route==='railway'&&x.outcome==='ok'));
 assert(!JSON.stringify(facts).includes('secret'));assert(!JSON.stringify(facts).includes('PRIVATE'));
 assert(s.calls.every(c=>c.options.credentials==='omit'));
});
test('healthy path does not probe; queue, sends and failure retries are bounded',async()=>{
 const s=setup({down:true}),d=s.w.ClubClientDiagnostics;d.bind(attempt);
 for(let i=0;i<200;i++){d.emit({attempt,kind:'startup',event:'ready'});await s.flush();}
 for(let i=0;i<200;i++){s.events.online();await s.flush();}
 assert(s.calls.length<=12);assert(s.calls.every(c=>c.url.endsWith('/client-diagnostics')));
 assert(s.calls.every(c=>JSON.parse(c.options.body).records.length<=12));
});
test('JS evidence strips exception message, stack and URL; preview emits nothing',async()=>{
 const s=setup();s.w.ClubClientDiagnostics.bind(attempt);
 s.events.error({target:s.w,error:{name:'TypeError',message:'PRIVATE',stack:'PRIVATE'},filename:'PRIVATE',lineno:123,colno:4});await s.flush();
 const f=JSON.parse(s.calls[0].options.body).records[0];assert.equal(f.error,'TypeError');assert.equal(f.line,123);assert(!JSON.stringify(f).includes('PRIVATE'));
 const v=setup({view:true});v.w.ClubClientDiagnostics.bind(attempt);v.w.ClubClientDiagnostics.emit({attempt,kind:'startup',event:'ready'});v.w.ClubClientDiagnostics.probe();await v.flush();assert.equal(v.calls.length,0);
});
test('inline module exactly matches canonical source',()=>assert(fs.readFileSync('index.html','utf8').includes(source.trim())));
test('early build is used and resource reports never leak signed URLs',async()=>{
 const s=setup();s.w.CLUB_BUILD_ID='app-v680';s.w.URL=URL;s.w.location.href='https://example.test/';const d=s.w.ClubClientDiagnostics;d.bind(attempt);
 s.events.error({target:{tagName:'SCRIPT',src:'https://cdn.test/film-player.js?token=SECRET'}});
 const reports=[];s.w.__reportError=(...args)=>reports.push(args);d.reportResources();
 assert.equal(reports.length,1);assert(reports[0][0].includes('film-player.js'));assert(!JSON.stringify(reports).includes('SECRET'));
 s.events.error({target:{tagName:'SCRIPT',src:'https://cdn.test/film-player.js?token=SECRET'}});assert.equal(reports.length,1);
 await s.flush();assert.equal(JSON.parse(s.calls[0].options.body).records[0].build,'app-v680');
});
test('failed telemetry schedules bounded retry without requiring another user event',async()=>{
 const s=setup({down:true}),d=s.w.ClubClientDiagnostics;d.bind(attempt);d.emit({attempt,kind:'startup',event:'closed'});await s.flush();
 for(let i=0;i<20;i++){const t=[...s.timers].find(([k,v])=>v.ms===2000);if(!t)break;s.timers.delete(t[0]);t[1].fn();for(let j=0;j<20;j++)await Promise.resolve();}
 assert.equal(s.calls.length,12);assert(![...s.timers.values()].some(x=>x.ms===2000));
});
test('resource metadata survives before main code, strips URL secrets, distinguishes HTTP from unknown',async()=>{
 const s=setup();s.w.URL=URL;s.w.location.href='https://example.test/club-app/';s.w.ClubClientDiagnostics.bind(attempt);
 s.w.performance={getEntriesByName:()=>[{responseStatus:404,duration:123}]};
 s.events.error({target:{tagName:'SCRIPT',src:'https://example.test/club-app/film-player.js?token=SECRET#PRIVATE'}});
 const snapshot=s.w.ClubClientDiagnostics.resources();assert.equal(snapshot[0].asset,'film-player.js');assert.equal(snapshot[0].http,404);assert.equal(snapshot[0].cause,'http');assert.equal(snapshot[0].type,'script');
 s.w.performance={getEntriesByName:()=>[]};s.w.navigator.onLine=false;
 s.events.error({target:{tagName:'IMG',src:'https://private.invalid/signed-SECRET.png?signature=PRIVATE'}});
 const x=s.w.ClubClientDiagnostics.resources()[1];assert.equal(x.asset,'other_img');assert.equal(x.cause,'browser_unknown');assert.equal(x.online,false);
 await s.flush();const bodies=JSON.stringify(s.calls.map(c=>JSON.parse(c.options.body)));assert(!/SECRET|PRIVATE|private.invalid/.test(bodies));assert(bodies.includes('film-player.js'));assert(bodies.includes('browser_unknown'));
});
test('media error records browser code without inventing HTTP or a network diagnosis',()=>{
 const s=setup();s.w.URL=URL;s.w.location.href='https://example.test/';s.w.ClubClientDiagnostics.bind(attempt);
 s.events.error({target:{tagName:'VIDEO',src:'https://media.invalid/secret?key=PRIVATE',error:{code:3}}});
 const x=s.w.ClubClientDiagnostics.resources()[0];assert.equal(x.media_code,3);assert.equal(x.cause,'media_decode');assert.equal(x.http,0);assert(!JSON.stringify(x).includes('PRIVATE'));
});

test('empty image src is identified before browser resolves it to the HTML page',()=>{
 const s=setup(),reports=[];s.w.URL=URL;s.w.location.href='https://example.test/';s.w.__reportError=(...a)=>reports.push(a);s.w.ClubClientDiagnostics.bind(attempt);
 s.events.error({target:{tagName:'IMG',src:'https://example.test/',getAttribute:k=>k==='src'?'':null}});
 const r=s.w.ClubClientDiagnostics.resources()[0];assert.equal(r.asset,'empty_source');assert.equal(r.cause,'empty_source');
 assert(reports[0][1].includes('attempt='+attempt));assert(reports[0][1].includes('cause=empty_source'));assert(!reports[0][1].includes('https:'));
});
test('hidden stream placeholder never requests the HTML document as an image',()=>{
 const html=fs.readFileSync('index.html','utf8');assert(html.includes('<img id="stream-hero-img" alt="">'));assert(!html.includes("document.getElementById('stream-hero-img').src = ''"));
});
