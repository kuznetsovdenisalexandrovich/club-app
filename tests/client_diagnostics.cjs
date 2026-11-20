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
